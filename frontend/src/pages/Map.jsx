// ==============================================
// Map Page — Full-Screen Live Alert Map
// ==============================================
// The core page of the app. Displays a full-screen Leaflet
// map centered on the user's GPS location (or India's center).
// Shows nearby alerts as markers in real-time.
// Includes a navbar, alert count badge, and a floating
// "Report Emergency" button that opens the AlertForm modal.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { getNearbyAlerts } from '../api/alerts';
import AlertMarker from '../components/AlertMarker';
import AlertForm from '../components/AlertForm';

// Default center — India's geographic center
const DEFAULT_CENTER = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;
const LOCATED_ZOOM = 13;

// ==============================================
// RecenterMap — Helper component to fly to user location
// ==============================================
const RecenterMap = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom, { duration: 1.5 });
    }
  }, [center, zoom, map]);
  return null;
};

// ==============================================
// User location marker icon
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

const Map = () => {
  const { user, logout } = useAuth();
  const { liveAlerts, isConnected, mergeAlerts } = useSocket();
  const navigate = useNavigate();

  // User's GPS location (defaulting to DEFAULT_CENTER to prevent MapContainer crash)
  const [userLocation, setUserLocation] = useState(DEFAULT_CENTER);
  // Whether we are actively geolocating the user
  const [locating, setLocating] = useState(true);
  // Whether the alert form modal is open
  const [showAlertForm, setShowAlertForm] = useState(false);
  // Loading state for fetching alerts
  const [fetchingAlerts, setFetchingAlerts] = useState(false);

  // Alias liveAlerts to alerts for rendering mapping
  const alerts = liveAlerts;

  // ==============================================
  // Effect: Get User's GPS Location
  // ==============================================
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
          setLocating(false);
        },
        (error) => {
          console.warn('Geolocation error:', error.message);
          setLocating(false);
          // Fallback is already DEFAULT_CENTER
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    } else {
      console.warn('Geolocation not supported');
      setLocating(false);
    }
  }, []);

  // ==============================================
  // Effect: Fetch Nearby Alerts When Location is Settled
  // ==============================================
  const fetchAlerts = useCallback(async () => {
    if (locating) return;

    setFetchingAlerts(true);
    try {
      const data = await getNearbyAlerts(userLocation[0], userLocation[1], 5);
      mergeAlerts(data.alerts);
    } catch (error) {
      console.error('Failed to fetch nearby alerts:', error);
    } finally {
      setFetchingAlerts(false);
    }
  }, [userLocation, locating, mergeAlerts]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // ==============================================
  // Handle Logout
  // ==============================================
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Get user initials for avatar
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="map-page">
      {/* ==============================================
          Navigation Bar
          ============================================== */}
      <nav className="navbar map-navbar" id="map-navbar">
        <div className="navbar-brand">
          <div className="navbar-logo">🚨</div>
          <span className="navbar-title">Hyperlocal Alert Network</span>
        </div>

        {/* Alert count + connection status */}
        <div className="navbar-center">
          <div className="alert-count-badge" id="alert-count-badge">
            <span className={`connection-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
            <span>{alerts.length} active alert{alerts.length !== 1 ? 's' : ''} nearby</span>
          </div>
        </div>

        <div className="navbar-user">
          <div className="navbar-user-info">
            <div className="user-avatar">{getInitials(user?.name)}</div>
            <div>
              <div className="user-name">{user?.name}</div>
              <div className="user-role">{user?.role}</div>
            </div>
          </div>
          <button id="logout-button" className="btn btn-ghost" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </nav>

      {/* ==============================================
          Full-Screen Map
          ============================================== */}
      <div className="map-container" id="map-container">
        <MapContainer
          center={userLocation}
          zoom={13}
          style={{ height: "100vh", width: "100%" }}
          zoomControl={true}
        >
          {/* OpenStreetMap dark tile layer for premium look */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {/* Recenter map when user location is determined */}
          <RecenterMap center={userLocation} zoom={LOCATED_ZOOM} />

          {/* User's current location marker */}
          {!locating && (
            <Marker
              position={userLocation}
              icon={userLocationIcon}
            >
              <Popup>
                <div style={{ textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
                  <strong>📍 Your Location</strong>
                  <br />
                  <small style={{ color: '#94a3b8' }}>
                    {userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}
                  </small>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Alert Markers rendered inside MapContainer */}
          {alerts.map(alert => (
            <AlertMarker key={alert._id} alert={alert} />
          ))}
        </MapContainer>

        {/* Locating overlay */}
        {locating && (
          <div className="map-locating-overlay">
            <div className="spinner"></div>
            <p>Determining your location...</p>
          </div>
        )}

        {/* Fetching alerts indicator */}
        {fetchingAlerts && (
          <div className="map-fetching-badge">
            <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></div>
            Fetching nearby alerts...
          </div>
        )}
      </div>

      {/* ==============================================
          Floating Report Emergency Button
          ============================================== */}
      <button
        id="report-emergency-btn"
        className="report-emergency-btn"
        onClick={() => setShowAlertForm(true)}
      >
        <span className="report-btn-icon">🚨</span>
        <span className="report-btn-text">Report Emergency</span>
      </button>

      {/* ==============================================
          Alert Form Modal
          ============================================== */}
      {showAlertForm && (
        <AlertForm
          onClose={() => setShowAlertForm(false)}
          userLocation={{ lat: userLocation[0], lng: userLocation[1] }}
        />
      )}
    </div>
  );
};

export default Map;
