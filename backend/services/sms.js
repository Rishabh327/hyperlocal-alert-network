// ==============================================
// SMS Service — Twilio Integration
// ==============================================
// Sends SMS notifications through Twilio. If the Twilio environment
// variables are missing, every send is skipped (and logged) so the
// rest of the app keeps working without SMS.
//
// Required env vars:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and either
//   TWILIO_PHONE_NUMBER (e.g. +15551234567) or TWILIO_MESSAGING_SERVICE_SID
// Optional env vars:
//   SMS_DEFAULT_COUNTRY_CODE  — prefix for numbers saved without one (default +91)
//   SMS_MAX_RECIPIENTS        — cap per notification to limit cost (default 100)
//   SMS_ALERT_RADIUS_KM       — radius for alert-based notifications (default 5)

const twilio = require('twilio');
const User = require('../models/User');

let client = null;

const isConfigured = () =>
  Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID)
  );

const getClient = () => {
  if (!client) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return client;
};

/**
 * normalizePhone - Convert a user-entered phone number to E.164 format.
 * "98765 43210" -> "+919876543210", "+1 (555) 123-4567" -> "+15551234567".
 * Returns null when the number can't be used.
 */
const normalizePhone = (phone) => {
  if (!phone) return null;
  const trimmed = String(phone).trim();
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  let e164;
  if (trimmed.startsWith('+')) {
    e164 = `+${digits}`;
  } else if (digits.startsWith('00')) {
    e164 = `+${digits.slice(2)}`;
  } else {
    // Local number: drop a trunk "0" prefix and add the default country code
    digits = digits.replace(/^0+/, '');
    const countryCode = (process.env.SMS_DEFAULT_COUNTRY_CODE || '+91').replace(/\D/g, '');
    e164 = digits.startsWith(countryCode) && digits.length > 10 ? `+${digits}` : `+${countryCode}${digits}`;
  }

  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
};

/**
 * sendBulkSms - Send the same message to many users (deduplicated by number).
 * @param {Array} users - User documents (must include `phone`)
 * @param {string} body - Message text
 * @returns {Promise<{sent: number, failed: number, skipped: number}>}
 */
const sendBulkSms = async (users, body) => {
  const result = { sent: 0, failed: 0, skipped: 0 };

  if (!isConfigured()) {
    console.log('SMS skipped: Twilio is not configured');
    result.skipped = users.length;
    return result;
  }

  const numbers = [...new Set(users.map((u) => normalizePhone(u.phone)).filter(Boolean))];
  result.skipped = users.length - numbers.length;

  const maxRecipients = parseInt(process.env.SMS_MAX_RECIPIENTS, 10) || 100;
  if (numbers.length > maxRecipients) {
    console.warn(`SMS capped at ${maxRecipients} of ${numbers.length} recipients`);
    result.skipped += numbers.length - maxRecipients;
    numbers.length = maxRecipients;
  }

  const sender = process.env.TWILIO_MESSAGING_SERVICE_SID
    ? { messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID }
    : { from: process.env.TWILIO_PHONE_NUMBER };

  const outcomes = await Promise.allSettled(
    numbers.map((to) => getClient().messages.create({ ...sender, to, body }))
  );

  outcomes.forEach((outcome, i) => {
    if (outcome.status === 'fulfilled') {
      result.sent++;
    } else {
      result.failed++;
      console.error(`SMS to ${numbers[i]} failed:`, outcome.reason && outcome.reason.message);
    }
  });

  console.log(`SMS summary: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`);
  return result;
};

/**
 * notifyUsersNearAlert - Text citizens with a phone number whose last known
 * location is within SMS_ALERT_RADIUS_KM of the alert.
 * @param {Object} alert - Alert document with GeoJSON location
 * @param {string} body - Message text
 */
const notifyUsersNearAlert = async (alert, body) => {
  if (!alert.location || !alert.location.coordinates) {
    return { sent: 0, failed: 0, skipped: 0 };
  }
  const radiusKm = parseFloat(process.env.SMS_ALERT_RADIUS_KM) || 5;

  const users = await User.find({
    role: 'citizen',
    phone: { $exists: true, $nin: [null, ''] },
    lastLocation: {
      $nearSphere: {
        $geometry: { type: 'Point', coordinates: alert.location.coordinates },
        $maxDistance: radiusKm * 1000,
      },
    },
  }).select('phone');

  return sendBulkSms(users, body);
};

/**
 * appLink - First CLIENT_URL origin, used to point SMS readers back to the app.
 */
const appLink = () => {
  const first = (process.env.CLIENT_URL || '').split(',')[0].trim().replace(/\/+$/, '');
  return first ? ` ${first}/map` : '';
};

module.exports = { isConfigured, normalizePhone, sendBulkSms, notifyUsersNearAlert, appLink };
