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

  // Phase 4 - Real-Time Broadcast and Escalation notifications
  const [broadcastNotification, setBroadcastNotification] = useState(null);
  const [escalatedNotification, setEscalatedNotification] = useState(null);

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

      // When an authority broadcast is received
      socket.on('authority_broadcast', (broadcast) => {
        console.log('Authority broadcast received:', broadcast);
        setBroadcastNotification(broadcast.message);
        setTimeout(() => {
          setBroadcastNotification(null);
        }, 10000); // Auto-dismiss after 10 seconds
      });

      // When an alert is escalated
      socket.on('alert_escalated', (alert) => {
        console.log('Alert escalated received:', alert);
        setEscalatedNotification(alert);
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
        socket.off('authority_broadcast');
        socket.off('alert_escalated');
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
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes pulseGlow {
          from { box-shadow: 0 0 10px rgba(255, 23, 68, 0.6); }
          to { box-shadow: 0 0 25px rgba(255, 23, 68, 1); }
        }
      `}</style>

      {/* Authority Broadcast Notification Banner */}
      {broadcastNotification && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          backgroundColor: '#ff3333',
          color: 'white',
          padding: '15px 20px',
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: '16px',
          zIndex: 99999,
          boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          animation: 'slideDown 0.3s ease-out'
        }}>
          <span style={{ fontSize: '20px', marginRight: '10px' }}>📢</span>
          <div style={{ flex: 1 }}>{broadcastNotification}</div>
          <button 
            onClick={() => setBroadcastNotification(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              cursor: 'pointer',
              marginLeft: '20px'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Escalated Alert Notification Popup */}
      {escalatedNotification && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '320px',
          backgroundColor: '#ff1744',
          color: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          zIndex: 99999,
          animation: 'pulseGlow 1.5s infinite alternate, slideIn 0.3s ease-out',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              🔺 URGENT ESCALATION
            </span>
            <button 
              onClick={() => setEscalatedNotification(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: '20px',
                cursor: 'pointer'
              }}
            >
              ×
            </button>
          </div>
          <div style={{ fontSize: '15px', fontWeight: 'bold' }}>{escalatedNotification.title}</div>
          <div style={{ fontSize: '13px', opacity: 0.9 }}>{escalatedNotification.description}</div>
          <div style={{ fontSize: '12px', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px', marginTop: '5px' }}>
            📍 Location: {escalatedNotification.location?.coordinates?.[1].toFixed(4)}, {escalatedNotification.location?.coordinates?.[0].toFixed(4)}
          </div>
        </div>
      )}

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
