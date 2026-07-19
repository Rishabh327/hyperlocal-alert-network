import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  getAllAlerts,
  getAnalytics,
  verifyAlert,
  dismissAlert,
  escalateAlert,
  sendBroadcast,
  getBroadcastHistory,
  resolveAlert,
  getGrievances
} from '../api/authority';

// ==============================================
// User Location Icon (Pulsing blue dot)
// ==============================================
const userLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: `
    <div class="user-marker-container">
      <div class="user-marker-pulse"></div>
      <div class="user-marker-dot"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// ==============================================
// Helper Component: fly back to the authority's location
// ==============================================
const RecenterControl = ({ userLocation }) => {
  const map = useMap();
  const handleRecenter = () => {
    if (userLocation) {
      map.flyTo(userLocation, 13, { duration: 1.5 });
    }
  };
  return (
    <button
      onClick={handleRecenter}
      type="button"
      style={{
        position: "absolute",
        bottom: "100px",
        right: "20px",
        zIndex: 1000,
        background: "#e94560",
        color: "white",
        border: "none",
        width: "50px",
        height: "50px",
        borderRadius: "50%",
        fontSize: "20px",
        cursor: "pointer",
        boxShadow: "0 4px 15px rgba(233, 69, 96, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "transform 0.2s"
      }}
      title="Go to My Location"
    >
      🎯
    </button>
  );
};

// ==============================================
// Helper Component: Draggable Marker for Broadcast Setup
// ==============================================
const DraggableMarker = ({ position, setPosition }) => {
  const markerRef = useRef(null);
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const latLng = marker.getLatLng();
          setPosition({ lat: latLng.lat, lng: latLng.lng });
        }
      },
    }),
    [setPosition],
  );

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={[position.lat, position.lng]}
      ref={markerRef}
    />
  );
};

// ==============================================
// Helper Component: Click Map to Set Center Coordinates
// ==============================================
const MapClickHandler = ({ setPosition }) => {
  useMapEvents({
    click(e) {
      setPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
};

// ==============================================
// Custom Marker Icon Generator
// ==============================================
const createMarkerIcon = (status, type, escalated) => {
  const color = escalated
    ? '#9b59b6'
    : status === 'verified'
    ? '#2ecc71'
    : status === 'flagged'
    ? '#e74c3c'
    : '#f39c12';

  const typeIcons = {
    flood: '🌊',
    fire: '🔥',
    accident: '🚗',
    gas_leak: '☁️',
    medical: '🏥',
    earthquake: '🌍',
    other: '⚠️'
  };

  const iconHtml = `
    <div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; ${
      escalated ? 'animation: pulseBorder 1.5s infinite alternate;' : ''
    }">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="${color}" stroke="#ffffff" stroke-width="1.5"/>
      </svg>
      <div style="position: absolute; top: 8px; width: 22px; height: 22px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
        ${typeIcons[type] || '⚠️'}
      </div>
    </div>
  `;

  return L.divIcon({
    html: iconHtml,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
  });
};

// ==============================================
// Main Component
// ==============================================
const AuthorityDashboard = () => {
  const { user, logout } = useAuth();
  const { socket, liveAlerts, mergeAlerts } = useSocket();

  // Navigation state
  const [currentView, setCurrentView] = useState('live-map');

  // Core authority states
  const [alerts, setAlerts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [broadcasts, setBroadcasts] = useState([]);
  const [grievances, setGrievances] = useState([]);

  // Toast status states
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Authority GPS position
  const [authorityLocation, setAuthorityLocation] = useState([20.5937, 78.9629]);
  const [locationLoaded, setLocationLoaded] = useState(false);

  // Filter states (for View 2: All Alerts)
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Broadcast state (for View 4: Send Broadcast)
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastCenter, setBroadcastCenter] = useState({ lat: 20.5937, lng: 78.9629 });
  const [broadcastRadius, setBroadcastRadius] = useState(5); // In kilometers
  const [broadcastStatus, setBroadcastStatus] = useState({ type: '', msg: '' });

  // Map settings
  const defaultCenter = [20.5937, 78.9629];

  // Fetch alerts from backend
  const fetchAllAlertData = async () => {
    try {
      const data = await getAllAlerts();
      if (data && data.success) {
        setAlerts(data.alerts);
        mergeAlerts(data.alerts);
      }
    } catch (err) {
      console.error('Error fetching alerts:', err.message);
    }
  };

  // Fetch analytics from backend
  const fetchAnalyticsData = async () => {
    try {
      const data = await getAnalytics();
      if (data && data.success) {
        setAnalytics(data.analytics);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err.message);
    }
  };

  // Fetch broadcast logs from backend
  const fetchBroadcastLogs = async () => {
    try {
      const data = await getBroadcastHistory();
      if (data && data.success) {
        setBroadcasts(data.broadcasts);
      }
    } catch (err) {
      console.error('Error fetching broadcasts:', err.message);
    }
  };

  // Fetch grievances from backend
  const fetchGrievancesData = async () => {
    try {
      const data = await getGrievances();
      if (data && data.success) {
        setGrievances(data.alerts);
      }
    } catch (err) {
      console.error('Error fetching grievances:', err.message);
    }
  };

  // Get Authority's Current GPS Location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setAuthorityLocation([lat, lng]);
          setLocationLoaded(true);
          // Set broadcast center by default to authority location too
          setBroadcastCenter({ lat, lng });
        },
        (err) => {
          console.warn("Error getting geolocation:", err.message);
        }
      );
    }
  }, []);

  // Load initial view data
  useEffect(() => {
    fetchAllAlertData();
    fetchAnalyticsData();
    fetchBroadcastLogs();
    fetchGrievancesData();
  }, []);

  // Sync state if socket changes occur
  useEffect(() => {
    if (liveAlerts.length > 0) {
      setAlerts((prevAlerts) => {
        const updated = [...prevAlerts];
        liveAlerts.forEach((live) => {
          const idx = updated.findIndex((a) => a._id === live._id);
          if (idx !== -1) {
            updated[idx] = live;
          } else {
            updated.unshift(live);
          }
        });
        return updated;
      });
    }
  }, [liveAlerts]);

  // Sync state with alert_resolved socket event
  useEffect(() => {
    if (!socket) return;
    const handleAlertResolved = ({ alertId }) => {
      setAlerts((prev) => prev.filter((a) => a._id !== alertId));
      setGrievances((prev) => prev.filter((g) => g._id !== alertId));
      fetchAnalyticsData();
    };

    socket.on('alert_resolved', handleAlertResolved);
    return () => {
      socket.off('alert_resolved', handleAlertResolved);
    };
  }, [socket]);

  // Handler: Verify alert
  const handleVerify = async (id) => {
    try {
      const res = await verifyAlert(id);
      if (res && res.success) {
        setAlerts((prev) => prev.map((a) => (a._id === id ? res.alert : a)));
        fetchAnalyticsData();
      }
    } catch (err) {
      alert('Verification action failed: ' + err.message);
    }
  };

  // Handler: Dismiss alert
  const handleDismiss = async (id) => {
    try {
      const res = await dismissAlert(id);
      if (res && res.success) {
        setAlerts((prev) => prev.map((a) => (a._id === id ? res.alert : a)));
        fetchAnalyticsData();
      }
    } catch (err) {
      alert('Dismiss action failed: ' + err.message);
    }
  };

  // Handler: Escalate alert
  const handleEscalate = async (id) => {
    try {
      const res = await escalateAlert(id);
      if (res && res.success) {
        setAlerts((prev) => prev.map((a) => (a._id === id ? res.alert : a)));
        fetchAnalyticsData();
      }
    } catch (err) {
      alert('Escalation action failed: ' + err.message);
    }
  };

  // Handler: Resolve alert
  const handleResolve = async (id) => {
    try {
      const res = await resolveAlert(id);
      if (res && res.success) {
        // Remove from local active alerts immediately
        setAlerts((prev) => prev.filter((a) => a._id !== id));
        fetchAnalyticsData();
        showToast("Alert marked as resolved");
      }
    } catch (err) {
      alert('Resolution action failed: ' + err.message);
    }
  };

  // Handler: Dismiss alert in Grievances Panel
  const handleGrievanceDismiss = async (id) => {
    try {
      const res = await dismissAlert(id);
      if (res && res.success) {
        setGrievances((prev) => prev.filter((g) => g._id !== id));
        setAlerts((prev) => prev.filter((a) => a._id !== id));
        fetchAnalyticsData();
        showToast("Decision recorded");
      }
    } catch (err) {
      alert('Dismiss failed: ' + err.message);
    }
  };

  // Handler: Keep alert in Grievances Panel
  const handleGrievanceKeep = async (id) => {
    try {
      const res = await verifyAlert(id);
      if (res && res.success) {
        setGrievances((prev) => prev.filter((g) => g._id !== id));
        setAlerts((prev) => prev.map((a) => (a._id === id ? res.alert : a)));
        fetchAnalyticsData();
        showToast("Decision recorded");
      }
    } catch (err) {
      alert('Verification failed: ' + err.message);
    }
  };

  // Handler: Send Broadcast
  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) {
      setBroadcastStatus({ type: 'error', msg: 'Message is required' });
      return;
    }
    try {
      const res = await sendBroadcast({
        message: broadcastMessage,
        zone_lat: broadcastCenter.lat,
        zone_lng: broadcastCenter.lng,
        zone_radius: broadcastRadius
      });
      if (res && res.success) {
        setBroadcastStatus({
          type: 'success',
          msg: `Broadcast sent to ${res.affected_users} users successfully!`
        });
        setBroadcastMessage('');
        fetchBroadcastLogs();
      }
    } catch (err) {
      setBroadcastStatus({ type: 'error', msg: 'Failed to send broadcast: ' + err.message });
    }
  };

  // Filter logic for View 2 list
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const matchesStatus = statusFilter === 'all' || alert.status === statusFilter;
      const matchesType = typeFilter === 'all' || alert.type === typeFilter;
      const matchesQuery =
        searchQuery === '' ||
        alert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        alert.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesType && matchesQuery;
    });
  }, [alerts, statusFilter, typeFilter, searchQuery]);

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        background: '#16213e',
        color: '#ffffff',
        fontFamily: "'Outfit', 'Inter', sans-serif",
        overflow: 'hidden'
      }}
    >
      {/* Styles Injection */}
      <style>{`
        @keyframes pulseBorder {
          from { filter: drop-shadow(0 0 2px #9b59b6); }
          to { filter: drop-shadow(0 0 8px #9b59b6); }
        }
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #1a1a2e;
        }
        ::-webkit-scrollbar-thumb {
          background: #0f3460;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #e94560;
        }
      `}</style>

      {/* Floating Toast Message */}
      {toastMessage && (
        <div style={{
          position: "fixed",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "#2ecc71",
          color: "white",
          padding: "12px 24px",
          borderRadius: "8px",
          fontWeight: "bold",
          boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
          zIndex: 100000
        }}>
          {toastMessage}
        </div>
      )}

      {/* Sidebar */}
      <div
        style={{
          width: '280px',
          background: '#1a1a2e',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '24px',
          boxSizing: 'border-box',
          borderRight: '1px solid #0f3460',
          zIndex: 10
        }}
      >
        <div>
          {/* Logo & Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
            <span style={{ fontSize: '28px' }}>🚨</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', letterSpacing: '0.5px' }}>
                ALERT NETWORK
              </h2>
              <span style={{ fontSize: '11px', color: '#e94560', fontWeight: 'bold' }}>
                AUTHORITY DASHBOARD
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { id: 'live-map', label: '🗺️ Live Map' },
              { id: 'all-alerts', label: '📋 All Alerts' },
              { id: 'analytics', label: '📊 Analytics' },
              { id: 'broadcast', label: '📢 Broadcast' },
              { id: 'broadcast-history', label: '📜 Broadcast History' },
              { id: 'grievances', label: '🚩 Grievances', badge: grievances.length }
            ].map((item) => {
              const active = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: active ? '#e94560' : 'transparent',
                    color: active ? '#ffffff' : '#b2bec3',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: active ? 'bold' : 'normal',
                    transition: 'all 0.2s',
                    width: '100%'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <span>{item.label}</span>
                    {item.badge > 0 && (
                      <span style={{
                        background: '#e74c3c',
                        color: 'white',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        lineHeight: '1'
                      }}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Authority Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: '#0f3460', padding: '12px', borderRadius: '8px', border: '1px solid #16213e' }}>
            <div style={{ fontSize: '11px', color: '#b2bec3' }}>Logged in as</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              👤 {user?.name || 'Authority Admin'}
            </div>
          </div>
          <button
            onClick={logout}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #e94560',
              background: 'transparent',
              color: '#e94560',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 'bold',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#e94560';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#e94560';
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        
        {/* VIEW 1: Live Map */}
        {currentView === 'live-map' && (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <MapContainer
              key={locationLoaded ? `${authorityLocation[0]}-${authorityLocation[1]}` : "loading"}
              center={authorityLocation}
              zoom={13}
              style={{ width: '100%', height: '100%' }}
              zoomControl={true}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              />

              {/* User location marker (Authority current position) */}
              {locationLoaded && (
                <Marker position={authorityLocation} icon={userLocationIcon}>
                  <Popup>
                    <div style={{ textAlign: "center", fontFamily: "sans-serif" }}>
                      <strong>📍 Your Location (Authority)</strong>
                      <br />
                      <span style={{ fontSize: "11px", color: "#666" }}>
                        {authorityLocation[0].toFixed(4)}, {authorityLocation[1].toFixed(4)}
                      </span>
                    </div>
                  </Popup>
                </Marker>
              )}

              {alerts.filter(a => a.isActive).map((alert) => {
                if (!alert.location || !alert.location.coordinates) return null;
                const coords = [alert.location.coordinates[1], alert.location.coordinates[0]];
                return (
                  <Marker
                    key={alert._id}
                    position={coords}
                    icon={createMarkerIcon(alert.status, alert.type, alert.escalated)}
                  >
                    <Popup maxWidth={360}>
                      <div
                        style={{
                          color: '#ffffff',
                          padding: '4px',
                          fontFamily: 'inherit',
                          fontSize: '13px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#e94560', fontWeight: 'bold' }}>
                            {alert.type}
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              background: alert.escalated
                                ? '#9b59b6'
                                : alert.status === 'verified'
                                ? '#2e7d32'
                                : alert.status === 'flagged'
                                ? '#c62828'
                                : '#e65100',
                              color: 'white',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 'bold'
                            }}
                          >
                            {alert.escalated ? 'Escalated' : alert.status}
                          </span>
                        </div>
                        <h4 style={{ margin: 0, fontSize: '15px', color: '#1a1a2e', fontWeight: 'bold' }}>
                          {alert.title}
                        </h4>
                        <p style={{ margin: 0, color: '#333333', fontSize: '12px' }}>
                          {alert.description}
                        </p>
                        <hr style={{ border: 'none', borderTop: '1px solid #e0e0e0', margin: '4px 0' }} />
                        <div style={{ fontSize: '11px', color: '#555555' }}>
                          <div>👤 Reporter: {alert.reportedBy?.name || 'Anonymous'}</div>
                          <div>🎖️ Reporter Trust: {alert.reportedBy?.credibilityScore ?? 100}%</div>
                          <div>📊 AI Credibility Score: {alert.credibilityScore}%</div>
                        </div>

                        {/* Interactive Controls */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => handleVerify(alert._id)}
                              disabled={alert.status === 'verified'}
                              style={{
                                flex: 1,
                                background: '#2ecc71',
                                color: 'white',
                                border: 'none',
                                padding: '6px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '11px',
                                opacity: alert.status === 'verified' ? 0.6 : 1
                              }}
                            >
                              Verify
                            </button>
                            <button
                              onClick={() => handleDismiss(alert._id)}
                              disabled={alert.status === 'flagged'}
                              style={{
                                flex: 1,
                                background: '#e74c3c',
                                color: 'white',
                                border: 'none',
                                padding: '6px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '11px',
                                opacity: alert.status === 'flagged' ? 0.6 : 1
                              }}
                            >
                              Dismiss
                            </button>
                            <button
                              onClick={() => handleEscalate(alert._id)}
                              disabled={alert.escalated}
                              style={{
                                flex: 1,
                                background: '#f39c12',
                                color: 'white',
                                border: 'none',
                                padding: '6px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '11px',
                                opacity: alert.escalated ? 0.6 : 1
                              }}
                            >
                              Escalate
                            </button>
                          </div>
                          <button
                            onClick={() => handleResolve(alert._id)}
                            style={{
                              width: '100%',
                              background: '#2ecc71',
                              color: 'white',
                              border: 'none',
                              padding: '8px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              fontSize: '12px',
                              textAlign: 'center'
                            }}
                          >
                            ✅ Mark Resolved
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              <RecenterControl userLocation={authorityLocation} />
            </MapContainer>

            {/* Floating Legend */}
            <div
              style={{
                position: 'absolute',
                bottom: '20px',
                right: '20px',
                background: '#1a1a2e',
                border: '1px solid #0f3460',
                borderRadius: '8px',
                padding: '12px 16px',
                zIndex: 1000,
                display: 'flex',
                gap: '15px',
                fontSize: '12px',
                color: '#ffffff',
                boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ color: '#2ecc71', fontSize: '14px' }}>●</span> Verified
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ color: '#f39c12', fontSize: '14px' }}>●</span> Unverified
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ color: '#e74c3c', fontSize: '14px' }}>●</span> Flagged
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ color: '#9b59b6', fontSize: '14px' }}>●</span> Escalated
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: All Alerts */}
        {currentView === 'all-alerts' && (
          <div style={{ padding: '32px', boxSizing: 'border-box' }}>
            <h1 style={{ margin: '0 0 24px 0', fontSize: '24px', fontWeight: '800' }}>Platform Alerts</h1>

            {/* Filter Bar */}
            <div
              style={{
                display: 'flex',
                gap: '16px',
                marginBottom: '24px',
                flexWrap: 'wrap',
                background: '#0f3460',
                padding: '16px',
                borderRadius: '8px'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '180px' }}>
                <label style={{ fontSize: '12px', color: '#b2bec3' }}>Search Alerts</label>
                <input
                  type="text"
                  placeholder="Search title/desc..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    background: '#16213e',
                    border: '1px solid #1a1a2e',
                    padding: '10px',
                    borderRadius: '6px',
                    color: 'white',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '150px' }}>
                <label style={{ fontSize: '12px', color: '#b2bec3' }}>Status Filter</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    background: '#16213e',
                    border: '1px solid #1a1a2e',
                    padding: '10px',
                    borderRadius: '6px',
                    color: 'white',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">All Statuses</option>
                  <option value="unverified">Unverified</option>
                  <option value="verified">Verified</option>
                  <option value="flagged">Flagged</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '150px' }}>
                <label style={{ fontSize: '12px', color: '#b2bec3' }}>Type Filter</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  style={{
                    background: '#16213e',
                    border: '1px solid #1a1a2e',
                    padding: '10px',
                    borderRadius: '6px',
                    color: 'white',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">All Types</option>
                  <option value="flood">Flood</option>
                  <option value="fire">Fire</option>
                  <option value="accident">Accident</option>
                  <option value="gas_leak">Gas Leak</option>
                  <option value="medical">Medical</option>
                  <option value="earthquake">Earthquake</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Alerts Table */}
            <div style={{ background: '#0f3460', borderRadius: '8px', overflow: 'hidden' }}>
              {filteredAlerts.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#b2bec3' }}>
                  No alerts match your filter criteria.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ background: '#1a1a2e', borderBottom: '2px solid #0f3460' }}>
                      <th style={{ padding: '16px' }}>Type</th>
                      <th style={{ padding: '16px' }}>Title & Description</th>
                      <th style={{ padding: '16px' }}>Reporter Info</th>
                      <th style={{ padding: '16px' }}>Time</th>
                      <th style={{ padding: '16px' }}>Score</th>
                      <th style={{ padding: '16px' }}>Status</th>
                      <th style={{ padding: '16px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAlerts.map((alert) => {
                      const emojis = {
                        flood: '🌊',
                        fire: '🔥',
                        accident: '🚗',
                        gas_leak: '☁️',
                        medical: '🏥',
                        earthquake: '🌍',
                        other: '⚠️'
                      };
                      return (
                        <tr
                          key={alert._id}
                          style={{
                            borderBottom: '1px solid #16213e',
                            transition: 'background 0.2s'
                          }}
                          onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(233,69,96,0.05)')}
                          onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td style={{ padding: '16px', fontSize: '20px' }}>{emojis[alert.type] || '⚠️'}</td>
                          <td style={{ padding: '16px' }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{alert.title}</div>
                            <div style={{ fontSize: '12px', color: '#b2bec3', maxWidth: '300px' }}>
                              {alert.description}
                            </div>
                          </td>
                          <td style={{ padding: '16px' }}>
                            <div style={{ fontWeight: '500' }}>{alert.reportedBy?.name || 'Anonymous'}</div>
                            <div style={{ fontSize: '11px', color: '#b2bec3' }}>
                              Credibility: {alert.reportedBy?.credibilityScore ?? 100}%
                            </div>
                          </td>
                          <td style={{ padding: '16px', fontSize: '12px', color: '#b2bec3' }}>
                            {new Date(alert.createdAt).toLocaleString()}
                          </td>
                          <td style={{ padding: '16px', fontWeight: 'bold' }}>{alert.credibilityScore}%</td>
                          <td style={{ padding: '16px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                color: 'white',
                                background: alert.escalated
                                  ? '#9b59b6'
                                  : alert.status === 'resolved'
                                  ? '#4a5568'
                                  : alert.status === 'verified'
                                  ? '#2e7d32'
                                  : alert.status === 'flagged'
                                  ? '#c62828'
                                  : '#e65100'
                              }}
                            >
                              {alert.escalated ? 'ESCALATED' : alert.status.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '16px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                onClick={() => handleVerify(alert._id)}
                                disabled={alert.status === 'verified' || alert.status === 'resolved'}
                                style={{
                                  background: '#2ecc71',
                                  color: 'white',
                                  border: 'none',
                                  padding: '6px 10px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold',
                                  fontSize: '11px',
                                  opacity: (alert.status === 'verified' || alert.status === 'resolved') ? 0.5 : 1
                                }}
                              >
                                Verify
                              </button>
                              <button
                                onClick={() => handleDismiss(alert._id)}
                                disabled={alert.status === 'flagged' || alert.status === 'resolved'}
                                style={{
                                  background: '#e74c3c',
                                  color: 'white',
                                  border: 'none',
                                  padding: '6px 10px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold',
                                  fontSize: '11px',
                                  opacity: (alert.status === 'flagged' || alert.status === 'resolved') ? 0.5 : 1
                                }}
                              >
                                Dismiss
                              </button>
                              <button
                                onClick={() => handleEscalate(alert._id)}
                                disabled={alert.escalated || alert.status === 'resolved'}
                                style={{
                                  background: '#f39c12',
                                  color: 'white',
                                  border: 'none',
                                  padding: '6px 10px',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold',
                                  fontSize: '11px',
                                  opacity: (alert.escalated || alert.status === 'resolved') ? 0.5 : 1
                                }}
                              >
                                Escalate
                              </button>
                              {alert.status !== 'resolved' && (
                                <button
                                  onClick={() => handleResolve(alert._id)}
                                  style={{
                                    background: '#2ecc71',
                                    color: 'white',
                                    border: 'none',
                                    padding: '6px 10px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    fontSize: '11px'
                                  }}
                                >
                                  Resolve
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: Analytics */}
        {currentView === 'analytics' && (
          <div style={{ padding: '32px', boxSizing: 'border-box' }}>
            <h1 style={{ margin: '0 0 24px 0', fontSize: '24px', fontWeight: '800' }}>Platform Analytics</h1>

            {analytics ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                {/* Row 1 - Stat cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                  {[
                    { label: 'Total Alerts (Today)', val: analytics.total_alerts_today, color: '#3498db' },
                    { label: 'Verified Alerts', val: analytics.verified_count, color: '#2ecc71' },
                    { label: 'Flagged Alerts', val: analytics.flagged_count, color: '#e74c3c' },
                    { label: 'Verification Rate', val: `${analytics.verification_rate}%`, color: '#9b59b6' }
                  ].map((card, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#0f3460',
                        padding: '24px',
                        borderRadius: '8px',
                        borderLeft: `5px solid ${card.color}`
                      }}
                    >
                      <div style={{ fontSize: '13px', color: '#b2bec3', marginBottom: '8px' }}>{card.label}</div>
                      <div style={{ fontSize: '32px', fontWeight: 'bold', color: card.color }}>{card.val}</div>
                    </div>
                  ))}
                </div>

                {/* Row 2 - Alerts by type relative progress */}
                <div style={{ style: { background: '#0f3460', padding: '24px', borderRadius: '8px' } }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Category Distributions</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {Object.entries(analytics.alerts_by_type).map(([key, count]) => {
                      const maxVal = Math.max(...Object.values(analytics.alerts_by_type), 1);
                      const widthPercent = (count / maxVal) * 100;
                      const labels = {
                        flood: '🌊 Flood',
                        fire: '🔥 Fire',
                        accident: '🚗 Accident',
                        gas_leak: '☁️ Gas Leak',
                        medical: '🏥 Medical',
                        earthquake: '🌍 Earthquake',
                        other: '⚠️ Other'
                      };
                      return (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <span style={{ width: '120px', fontSize: '13px', color: '#b2bec3' }}>{labels[key] || key}</span>
                          <div style={{ flex: 1, height: '14px', background: '#16213e', borderRadius: '7px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${widthPercent}%`,
                                height: '100%',
                                background: '#e94560',
                                borderRadius: '7px',
                                transition: 'width 0.5s'
                              }}
                            />
                          </div>
                          <span style={{ width: '30px', textAlign: 'right', fontSize: '13px', fontWeight: 'bold' }}>
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Row 3 - Alerts by hour 24 bars */}
                <div style={{ background: '#0f3460', padding: '24px', borderRadius: '8px' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>24-Hour Active Feed Trend</h3>
                  <div style={{ display: 'flex', height: '150px', alignItems: 'flex-end', gap: '8px', paddingBottom: '10px', borderBottom: '1px solid #16213e' }}>
                    {analytics.alerts_by_hour.map((count, hr) => {
                      const maxHour = Math.max(...analytics.alerts_by_hour, 1);
                      const heightPercent = (count / maxHour) * 100;
                      const isCurrentHour = new Date().getHours() === hr;
                      return (
                        <div
                          key={hr}
                          style={{
                            flex: 1,
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-end',
                            alignItems: 'center'
                          }}
                        >
                          <div
                            style={{
                              width: '100%',
                              height: `${heightPercent}%`,
                              background: isCurrentHour ? '#e74c3c' : '#3498db',
                              borderRadius: '3px 3px 0 0',
                              transition: 'height 0.5s'
                            }}
                            title={`Hour ${hr}: ${count} alerts`}
                          />
                        </div>
                      );
                    })}
                  </div>
                  {/* Axis labels */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: '#b2bec3' }}>
                    <span>12am</span>
                    <span>6am</span>
                    <span>12pm</span>
                    <span>6pm</span>
                    <span>11pm</span>
                  </div>
                </div>

                {/* Row 4 - Top reporters */}
                <div style={{ background: '#0f3460', padding: '24px', borderRadius: '8px' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Reporter Reputation Leaderboard</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {analytics.top_reporters.map((reporter, index) => {
                      let badgeColor = '#2ecc71';
                      if (reporter.credibilityScore < 50) badgeColor = '#e74c3c';
                      else if (reporter.credibilityScore < 80) badgeColor = '#f39c12';
                      return (
                        <div
                          key={reporter._id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px',
                            background: '#16213e',
                            borderRadius: '6px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#e94560' }}>
                              #{index + 1}
                            </span>
                            <span style={{ fontWeight: '500' }}>{reporter.name}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <span style={{ fontSize: '12px', color: '#b2bec3' }}>
                              Reports: {reporter.alertsReported}
                            </span>
                            <span
                              style={{
                                background: badgeColor,
                                color: 'white',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold'
                              }}
                            >
                              Trust: {reporter.credibilityScore}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '50px' }}>Loading analytics calculations...</div>
            )}
          </div>
        )}

        {/* VIEW 4: Broadcast */}
        {currentView === 'broadcast' && (
          <div style={{ padding: '32px', boxSizing: 'border-box' }}>
            <h1 style={{ margin: '0 0 24px 0', fontSize: '24px', fontWeight: '800' }}>Geofenced Broadcast</h1>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', height: 'calc(100vh - 120px)' }}>
              
              {/* Left Column: Form */}
              <form
                onSubmit={handleSendBroadcast}
                style={{
                  background: '#0f3460',
                  padding: '24px',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  height: 'fit-content'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#b2bec3' }}>
                    Broadcast message
                  </label>
                  <textarea
                    rows={4}
                    maxLength={200}
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Enter warning instructions for citizens..."
                    style={{
                      background: '#16213e',
                      border: '1px solid #1a1a2e',
                      padding: '12px',
                      borderRadius: '6px',
                      color: 'white',
                      fontSize: '14px',
                      resize: 'none',
                      outline: 'none'
                    }}
                  />
                  <div style={{ textAlign: 'right', fontSize: '11px', color: '#b2bec3' }}>
                    {broadcastMessage.length}/200 characters
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#b2bec3' }}>
                    Radius: {broadcastRadius} km
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={broadcastRadius}
                    onChange={(e) => setBroadcastRadius(Number(e.target.value))}
                    style={{
                      accentColor: '#e94560',
                      cursor: 'pointer'
                    }}
                  />
                </div>

                <div
                  style={{
                    background: 'rgba(233,69,96,0.1)',
                    border: '1px dashed #e94560',
                    padding: '12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#e94560',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    📍 Center: {broadcastCenter.lat.toFixed(4)}, {broadcastCenter.lng.toFixed(4)}
                    <br />
                    💡 This broadcast will reach users within {broadcastRadius}km of the selected location.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          (pos) => {
                            setBroadcastCenter({
                              lat: pos.coords.latitude,
                              lng: pos.coords.longitude
                            });
                          },
                          (err) => alert("Could not fetch geolocation: " + err.message)
                        );
                      } else {
                        alert("Geolocation is not supported by your browser");
                      }
                    }}
                    style={{
                      background: '#e94560',
                      color: 'white',
                      border: 'none',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      transition: 'opacity 0.2s'
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.opacity = 0.9)}
                    onMouseOut={(e) => (e.currentTarget.style.opacity = 1)}
                  >
                    Set to Current
                  </button>
                </div>

                {broadcastStatus.msg && (
                  <div
                    style={{
                      background: broadcastStatus.type === 'error' ? 'rgba(231,76,60,0.1)' : 'rgba(46,204,113,0.1)',
                      border: `1px solid ${broadcastStatus.type === 'error' ? '#e74c3c' : '#2ecc71'}`,
                      color: broadcastStatus.type === 'error' ? '#e74c3c' : '#2ecc71',
                      padding: '12px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}
                  >
                    {broadcastStatus.msg}
                  </div>
                )}

                <button
                  type="submit"
                  style={{
                    background: '#e94560',
                    color: 'white',
                    border: 'none',
                    padding: '14px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    transition: 'opacity 0.2s'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.opacity = 0.9)}
                  onMouseOut={(e) => (e.currentTarget.style.opacity = 1)}
                >
                  📢 Send Broadcast
                </button>
              </form>

              {/* Right Column: Mini Interactive Map */}
              <div style={{ position: 'relative', height: '100%', borderRadius: '8px', overflow: 'hidden' }}>
                <MapContainer
                  center={defaultCenter}
                  zoom={6}
                  style={{ width: '100%', height: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  />
                  <DraggableMarker position={broadcastCenter} setPosition={setBroadcastCenter} />
                  <Circle
                    center={[broadcastCenter.lat, broadcastCenter.lng]}
                    radius={broadcastRadius * 1000}
                    pathOptions={{ color: '#e94560', fillColor: '#e94560', fillOpacity: 0.15 }}
                  />
                  <MapClickHandler setPosition={setBroadcastCenter} />
                </MapContainer>
                <div
                  style={{
                    position: 'absolute',
                    top: '10px',
                    left: '50px',
                    background: '#1a1a2e',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    zIndex: 1000,
                    fontSize: '11px',
                    color: '#ffffff',
                    border: '1px solid #0f3460'
                  }}
                >
                  Drag the pin or click on the map to set the center
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 5: Broadcast History */}
        {currentView === 'broadcast-history' && (
          <div style={{ padding: '32px', boxSizing: 'border-box' }}>
            <h1 style={{ margin: '0 0 24px 0', fontSize: '24px', fontWeight: '800' }}>Broadcast History</h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {broadcasts.length === 0 ? (
                <div style={{ background: '#0f3460', padding: '30px', borderRadius: '8px', textAlign: 'center', color: '#b2bec3' }}>
                  No broadcasts yet.
                </div>
              ) : (
                broadcasts.map((b) => (
                  <div
                    key={b._id}
                    style={{
                      background: '#0f3460',
                      padding: '20px',
                      borderRadius: '8px',
                      borderLeft: '4px solid #e94560',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '15px'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '280px' }}>
                      <div style={{ fontSize: '15px', fontWeight: 'bold' }}>📢 {b.message}</div>
                      <div style={{ fontSize: '11px', color: '#b2bec3' }}>
                        Zone Center: {b.zone?.lat.toFixed(4)}, {b.zone?.lng.toFixed(4)} | Radius: {b.zone?.radius} km
                      </div>
                      <div style={{ fontSize: '11px', color: '#b2bec3' }}>
                        Sent By: {b.sentBy?.name || 'Authority'} on {new Date(b.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div style={{ background: '#16213e', padding: '12px 18px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#e94560' }}>{b.affectedCount}</div>
                      <div style={{ fontSize: '10px', color: '#b2bec3', textTransform: 'uppercase' }}>Users Notified</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* VIEW 6: Grievances */}
        {currentView === 'grievances' && (
          <div style={{ padding: '32px', boxSizing: 'border-box' }}>
            <h1 style={{ margin: '0 0 24px 0', fontSize: '24px', fontWeight: '800' }}>Citizen Grievance Reports</h1>
            {grievances.length === 0 ? (
              <div style={{ background: '#0f3460', padding: '40px', borderRadius: '8px', textAlign: 'center', color: '#2ecc71', fontWeight: 'bold' }}>
                ✅ No pending grievances
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
                {grievances.map((gAlert) => {
                  const emojis = {
                    flood: '🌊',
                    fire: '🔥',
                    accident: '🚗',
                    gas_leak: '☁️',
                    medical: '🏥',
                    earthquake: '🌍',
                    other: '⚠️'
                  };
                  return (
                    <div
                      key={gAlert._id}
                      style={{
                        background: '#0f3460',
                        border: '1px solid rgba(233, 69, 96, 0.15)',
                        borderRadius: '12px',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '16px',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                      }}
                    >
                      <div>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                            {emojis[gAlert.type] || '⚠️'} {gAlert.title}
                          </span>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 'bold',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            color: 'white',
                            background: gAlert.status === 'verified' ? '#2e7d32' : gAlert.status === 'flagged' ? '#c62828' : '#e65100'
                          }}>
                            {gAlert.status.toUpperCase()}
                          </span>
                        </div>
                        
                        <div style={{ fontSize: '13px', color: '#b2bec3', marginBottom: '12px' }}>
                          Reporter: {gAlert.reportedBy?.name || 'Anonymous'}
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                          <div style={{ flex: 1, background: '#16213e', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: '#b2bec3' }}>Credibility</div>
                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#e94560' }}>{gAlert.credibilityScore}%</div>
                          </div>
                          <div style={{ flex: 1, background: '#16213e', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', color: '#b2bec3' }}>Reports Count</div>
                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#f1c40f' }}>🚩 {gAlert.grievances?.length || 0}</div>
                          </div>
                        </div>

                        {/* Grievance list */}
                        <div style={{ background: '#16213e', borderRadius: '6px', padding: '12px', maxHeight: '180px', overflowY: 'auto' }}>
                          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#e94560', marginBottom: '8px' }}>
                            🚩 False Reports ({gAlert.grievances?.length || 0}):
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {gAlert.grievances?.map((grievance, idx) => (
                              <div key={idx} style={{ borderBottom: idx < gAlert.grievances.length - 1 ? '1px solid #0f3460' : 'none', paddingBottom: '6px' }}>
                                <div style={{ fontSize: '12px', color: 'white', fontStyle: 'italic' }}>"{grievance.reason}"</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#718096', marginTop: '4px' }}>
                                  <span>By: {grievance.reportedBy?.name || 'Citizen'}</span>
                                  <span>{new Date(grievance.createdAt).toLocaleString()}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Decision buttons */}
                      <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        <button
                          onClick={() => handleGrievanceDismiss(gAlert._id)}
                          style={{
                            flex: 1,
                            background: '#e74c3c',
                            color: 'white',
                            border: 'none',
                            padding: '10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            transition: 'opacity 0.2s'
                          }}
                          onMouseOver={(e) => (e.currentTarget.style.opacity = 0.9)}
                          onMouseOut={(e) => (e.currentTarget.style.opacity = 1)}
                        >
                          ❌ Dismiss Alert
                        </button>
                        <button
                          onClick={() => handleGrievanceKeep(gAlert._id)}
                          style={{
                            flex: 1,
                            background: '#2ecc71',
                            color: 'white',
                            border: 'none',
                            padding: '10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            transition: 'opacity 0.2s'
                          }}
                          onMouseOver={(e) => (e.currentTarget.style.opacity = 0.9)}
                          onMouseOut={(e) => (e.currentTarget.style.opacity = 1)}
                        >
                          ✅ Keep Alert
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthorityDashboard;
