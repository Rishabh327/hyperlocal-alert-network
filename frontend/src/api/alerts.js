// ==============================================
// Alert API Functions — HTTP Calls to Alert Endpoints
// ==============================================
// Provides clean functions for all alert-related API calls.
// Each function uses the pre-configured axios instance
// which automatically attaches the JWT token.

import API from './axios';

/**
 * submitAlert - Submit a new emergency alert with optional photo
 * Uses FormData because of multipart file upload
 * @param {FormData} formData - Form data with title, type, description, latitude, longitude, photo
 * @returns {Promise} API response with the created alert
 */
export const submitAlert = async (formData) => {
  const response = await API.post('/alerts', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * getNearbyAlerts - Fetch all active alerts within a radius
 * @param {number} lat - User's latitude
 * @param {number} lng - User's longitude
 * @param {number} radius - Search radius in km (default 5)
 * @returns {Promise} API response with array of nearby alerts
 */
export const getNearbyAlerts = async (lat, lng, radius = 5) => {
  const response = await API.get('/alerts/nearby', {
    params: { lat, lng, radius },
  });
  return response.data;
};

/**
 * corroborateAlert - Confirm/corroborate an existing alert
 * @param {string} id - The alert's MongoDB _id
 * @returns {Promise} API response with updated alert data
 */
export const corroborateAlert = async (id) => {
  const response = await API.post(`/alerts/${id}/corroborate`);
  return response.data;
};

/**
 * getMyAlerts - Fetch all alerts reported by the logged-in user
 * @returns {Promise} API response with array of user's alerts
 */
export const getMyAlerts = async () => {
  const response = await API.get('/alerts/my');
  return response.data;
};

/**
 * getAlertById - Fetch a single alert by its ID
 * @param {string} id - The alert's MongoDB _id
 * @returns {Promise} API response with alert data
 */
export const getAlertById = async (id) => {
  const response = await API.get(`/alerts/${id}`);
  return response.data;
};
