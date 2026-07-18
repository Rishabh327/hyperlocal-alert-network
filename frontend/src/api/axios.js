// ==============================================
// Axios Instance Configuration
// ==============================================
// Creates a pre-configured axios instance that:
// 1. Points all requests to the backend API (http://localhost:5000/api)
// 2. Automatically attaches the JWT token from localStorage
//    to every outgoing request's Authorization header
// This means individual components don't need to manually
// handle token attachment — it's done globally here.

import axios from 'axios';

// Create an axios instance with a base URL pointing to the backend API
const API = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// ==============================================
// Request Interceptor — Attach JWT Token
// ==============================================
// Before every request is sent, this interceptor checks
// localStorage for a saved JWT token. If found, it adds
// the token to the Authorization header in "Bearer <token>" format.
API.interceptors.request.use(
  (config) => {
    // Retrieve the token from localStorage
    const token = localStorage.getItem('token');

    // If a token exists, attach it to the request headers
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    // If there's an error setting up the request, reject the promise
    return Promise.reject(error);
  }
);

export default API;
