import API from './axios';

/**
 * getAllAlerts - Fetch all alerts on the platform with optional filters
 * @param {Object} filters - Query filters (status, type, limit)
 */
export const getAllAlerts = async (filters = {}) => {
  const response = await API.get('/authority/alerts', { params: filters });
  return response.data;
};

/**
 * getAnalytics - Fetch platform aggregated statistics and metrics
 */
export const getAnalytics = async () => {
  const response = await API.get('/authority/analytics');
  return response.data;
};

/**
 * verifyAlert - Confirm alert validity, update credibility score, call ML feedback
 * @param {string} id - Alert database ID
 */
export const verifyAlert = async (id) => {
  const response = await API.put(`/authority/alerts/${id}/verify`);
  return response.data;
};

/**
 * dismissAlert - Reject alert, flag it, mark inactive, penalize reporter
 * @param {string} id - Alert database ID
 */
export const dismissAlert = async (id) => {
  const response = await API.put(`/authority/alerts/${id}/dismiss`);
  return response.data;
};

/**
 * escalateAlert - Flag alert as highly urgent, trigger critical notifications
 * @param {string} id - Alert database ID
 */
export const escalateAlert = async (id) => {
  const response = await API.put(`/authority/alerts/${id}/escalate`);
  return response.data;
};

/**
 * sendBroadcast - Broadcast official safety message to all users in geo-radius
 * @param {Object} data - Contains { message, zone_lat, zone_lng, zone_radius }
 */
export const sendBroadcast = async (data) => {
  const response = await API.post('/authority/broadcast', data);
  return response.data;
};

/**
 * getBroadcastHistory - Retrieve log of last 20 broadcasts
 */
export const getBroadcastHistory = async () => {
  const response = await API.get('/authority/broadcasts');
  return response.data;
};
