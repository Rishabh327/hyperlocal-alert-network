// ==============================================
// Socket Context — Real-Time Communication Layer
// ==============================================
// Manages the Socket.IO client connection lifecycle:
// - Connects when user is logged in (has a token)
// - Disconnects when user logs out
// - Listens for "new_alert" events → adds to alerts array
// - Listens for "alert_updated" events → updates existing alert
// - Provides the socket instance and live alerts to all components

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

// Create the Socket context
export const SocketContext = createContext(null);

// ==============================================
// SocketProvider Component
// ==============================================
export const SocketProvider = ({ children }) => {
  // Reference to the socket instance (persists across re-renders)
  const socketRef = useRef(null);

  // Array of alerts received in real-time via socket events
  const [liveAlerts, setLiveAlerts] = useState([]);

  // Connection status for UI feedback
  const [isConnected, setIsConnected] = useState(false);

  // Get the current auth token from AuthContext
  const { token } = useAuth();

  // ==============================================
  // Effect: Connect/Disconnect Socket Based on Auth State
  // ==============================================
  useEffect(() => {
    // Only connect if the user is authenticated
    if (token) {
      // Create a new socket connection to the backend
      const socket = io('http://localhost:5000', {
        transports: ['websocket', 'polling'],
        autoConnect: true,
      });

      // Store the socket reference
      socketRef.current = socket;

      // ==============================================
      // Connection Event Handlers
      // ==============================================
      socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        setIsConnected(true);
      });

      socket.on('disconnect', () => {
        console.log('Socket disconnected');
        setIsConnected(false);
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error.message);
        setIsConnected(false);
      });

      // ==============================================
      // Real-Time Alert Event Handlers
      // ==============================================

      // When a new alert is broadcast by the server
      socket.on('new_alert', (alert) => {
        console.log('New alert received:', alert.title);
        setLiveAlerts((prev) => {
          // Avoid duplicates — check if alert already exists
          const exists = prev.find((a) => a._id === alert._id);
          if (exists) return prev;
          return [alert, ...prev];
        });
      });

      // When an existing alert is updated (e.g., corroborated)
      socket.on('alert_updated', (updatedAlert) => {
        console.log('Alert updated:', updatedAlert.title);
        setLiveAlerts((prev) =>
          prev.map((a) => (a._id === updatedAlert._id ? updatedAlert : a))
        );
      });

      // ==============================================
      // Cleanup: Disconnect When User Logs Out or Component Unmounts
      // ==============================================
      return () => {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('connect_error');
        socket.off('new_alert');
        socket.off('alert_updated');
        socket.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      };
    } else {
      // User is not authenticated — ensure socket is disconnected
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      // Clear live alerts when user logs out
      setLiveAlerts([]);
    }
  }, [token]);

  // ==============================================
  // Function to merge fetched alerts with live alerts
  // ==============================================
  // Prevents duplicates when initial HTTP fetch overlaps with socket events
  const mergeAlerts = (fetchedAlerts) => {
    setLiveAlerts((prev) => {
      const existingIds = new Set(prev.map((a) => a._id));
      const newAlerts = fetchedAlerts.filter((a) => !existingIds.has(a._id));
      return [...prev, ...newAlerts];
    });
  };

  // ==============================================
  // Function to update a single alert in the live array
  // ==============================================
  // Used when a corroboration response comes back via HTTP
  const updateAlertInState = (updatedAlert) => {
    setLiveAlerts((prev) =>
      prev.map((a) => (a._id === updatedAlert._id ? updatedAlert : a))
    );
  };

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        liveAlerts,
        isConnected,
        mergeAlerts,
        updateAlertInState,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

// ==============================================
// useSocket Hook — Convenient Access to Socket Context
// ==============================================
export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export default SocketContext;
