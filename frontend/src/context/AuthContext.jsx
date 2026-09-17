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
import LogoutModal from '../components/LogoutModal';

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

  // State for logout confirmation modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // ==============================================
  // Effect: Load User on Mount / Token Change
  // ==============================================
  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          const res = await API.get('/auth/me');
          setUser(res.data.user);
        } catch (error) {
          console.error('Failed to load user:', error);
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    loadUser();
  }, [token]);

  const login = async (email, password) => {
    const res = await API.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const register = async (name, email, password, phone) => {
    const res = await API.post('/auth/register', {
      name,
      email,
      password,
      phone,
    });
    localStorage.setItem('token', res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  // ==============================================
  // Logout Functions — Triggers Confirmation Modal
  // ==============================================
  const logout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setShowLogoutModal(false);
  };

  const cancelLogout = () => {
    setShowLogoutModal(false);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, confirmLogout, cancelLogout }}>
      {children}
      {showLogoutModal && (
        <LogoutModal onConfirm={confirmLogout} onCancel={cancelLogout} />
      )}
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
