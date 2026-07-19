// ==============================================
// Authentication Context — Global Auth State
// ==============================================
// This context provides authentication state and functions
// to the entire app. It manages:
// - The currently logged-in user object
// - The JWT token (persisted in localStorage)
// - Loading state while checking auth status
// - login(), register(), and logout() functions
//
// Wrap the entire app with <AuthProvider> so all components
// can access auth state via useAuth() hook.

import { createContext, useContext, useState, useEffect } from 'react';
import API from '../api/axios';

// Create the Auth context
export const AuthContext = createContext(null);

// ==============================================
// AuthProvider Component
// ==============================================
// Wraps the app and provides auth state + functions to all children
export const AuthProvider = ({ children }) => {
  // State for the authenticated user object
  const [user, setUser] = useState(null);

  // State for the JWT token — initialize from localStorage if available
  const [token, setToken] = useState(localStorage.getItem('token'));

  // Loading state — true while we're checking if the user is authenticated
  const [loading, setLoading] = useState(true);

  // ==============================================
  // Effect: Load User on Mount / Token Change
  // ==============================================
  // When the component mounts (or when the token changes),
  // attempt to fetch the current user's profile from the API.
  // This handles page refreshes — the token is in localStorage,
  // so we can re-authenticate without the user logging in again.
  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          // Fetch the user profile using the stored token
          const res = await API.get('/auth/me');
          setUser(res.data.user);
        } catch (error) {
          // If the token is invalid/expired, clear everything
          console.error('Failed to load user:', error);
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      }
      // Done loading regardless of outcome
      setLoading(false);
    };

    loadUser();
  }, [token]);

  // ==============================================
  // Login Function
  // ==============================================
  // Sends email and password to the login endpoint.
  // On success, saves the token and user data.
  const login = async (email, password) => {
    const res = await API.post('/auth/login', { email, password });

    // Save the token to localStorage for persistence
    localStorage.setItem('token', res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);

    return res.data;
  };

  // ==============================================
  // Register Function
  // ==============================================
  // Sends name, email, password, and phone to the register endpoint.
  // On success, saves the token and user data.
  const register = async (name, email, password, phone) => {
    const res = await API.post('/auth/register', {
      name,
      email,
      password,
      phone,
    });

    // Save the token to localStorage for persistence
    localStorage.setItem('token', res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);

    return res.data;
  };

  // ==============================================
  // Logout Function
  // ==============================================
  // Clears the token and user data from state and localStorage
  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  // Provide the auth state and functions to all children
  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// ==============================================
// useAuth Hook — Convenient Access to Auth Context
// ==============================================
// Use this hook in any component to access auth state and functions:
// const { user, login, logout, register, loading } = useAuth();
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
