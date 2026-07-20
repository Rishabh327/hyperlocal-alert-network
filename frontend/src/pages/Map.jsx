import { useState, useEffect, useContext } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import { AuthContext } from "../context/AuthContext"
import { SocketContext } from "../context/SocketContext"
import AlertMarker from "../components/AlertMarker"
import AlertForm from "../components/AlertForm"
import ConsentScreen from "../components/ConsentScreen"
import InstallPrompt from "../components/InstallPrompt"
import { getNearbyAlerts } from "../api/alerts"
import { requestNotificationPermission, subscribeToAlertNotifications } from "../utils/notifications"

// User location marker icon using CSS classes from index.css
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
})

const TYPE_EMOJI = {
  flood: "🌊",
  fire: "🔥",
  accident: "🚗",
  gas_leak: "☁️",
  medical: "🏥",
  earthquake: "🌍",
  other: "⚠️"
}

// Haversine formula to calculate distance in km
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return (R * c).toFixed(2);
}

// Custom control to center map on user coordinates
const RecenterControl = ({ userLocation }) => {
  const map = useMap()

  const handleRecenter = () => {
    if (userLocation) {
      map.flyTo(userLocation, 13, { duration: 1.5 })
    }
  }

  const isMobile = window.innerWidth < 768;

  return (
    <button
      onClick={handleRecenter}
      style={{
        position: "absolute",
        bottom: isMobile ? "20px" : "30px",
        right: isMobile ? "12px" : "20px",
        zIndex: 1000,
        background: "#3b82f6",
        color: "white",
        border: "none",
        width: "50px",
        height: "50px",
        borderRadius: "50%",
        fontSize: "20px",
        cursor: "pointer",
        boxShadow: "0 4px 15px rgba(59, 130, 246, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "transform 0.2s"
      }}
      title="Go to My Location"
    >
      🎯
    </button>
  )
}

// Custom control to fly to highlighted markers
const MapFlyTo = ({ target }) => {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo(target, 15, { duration: 1.5 });
    }
  }, [target, map]);
  return null;
};

// Custom middle-right zoom controls to prevent overlap with bottom nav
const CustomZoomControl = () => {
  const map = useMap();
  const isMobile = window.innerWidth < 768;

  return (
    <div 
      className="custom-zoom-controls"
      style={{
        position: 'absolute',
        right: isMobile ? '12px' : '20px',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}
    >
      <button 
        onClick={() => map.zoomIn()}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: '#1a1a2e',
          color: 'white',
          border: '2px solid #e74c3c',
          fontWeight: 'bold',
          fontSize: '20px',
          cursor: 'pointer',
          boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        +
      </button>
      <button 
        onClick={() => map.zoomOut()}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: '#1a1a2e',
          color: 'white',
          border: '2px solid #e74c3c',
          fontWeight: 'bold',
          fontSize: '20px',
          cursor: 'pointer',
          boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        &minus;
      </button>
    </div>
  );
};

export default function Map() {
  const { user, logout } = useContext(AuthContext)
  const { socket, updateUserLocation } = useContext(SocketContext)

  const [userLocation, setUserLocation] = useState([20.5937, 78.9629])
  const [alerts, setAlerts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [locationLoaded, setLocationLoaded] = useState(false)
  const [alertsFetched, setAlertsFetched] = useState(false)
  const [activeAlertCount, setActiveAlertCount] = useState(0)

  // Mobile navigation tab selection: "map", "alerts", "profile"
  const [activeTab, setActiveTab] = useState("map")
  const [flyToTarget, setFlyToTarget] = useState(null)

  // Local consent state
  const [hasConsent, setHasConsent] = useState(!!localStorage.getItem("alertnet_consent"))
  
  // Geolocation error state
  const [locationError, setLocationError] = useState(false)

  // ON COMPONENT MOUNT & GEOLOCATION
  useEffect(() => {
    const handleFetchNearby = (lat, lng) => {
      // Cache coordinates for PWA notifications
      localStorage.setItem("alertnet_user_location", JSON.stringify([lat, lng]))
      
      getNearbyAlerts(lat, lng, 5)
        .then((data) => {
          const fetched = data.alerts || []
          setAlerts(fetched)
          setActiveAlertCount(fetched.length)
          setAlertsFetched(true)
        })
        .catch((err) => {
          console.error("Error fetching nearby alerts:", err)
          setAlertsFetched(true)
        })
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          setUserLocation([lat, lng])
          setLocationLoaded(true)
          handleFetchNearby(lat, lng)
          
          // Emit initial user location register event
          if (updateUserLocation) {
            updateUserLocation(lat, lng)
          }

          // Request notifications permission and subscribe to real-time alerts
          requestNotificationPermission();
        },
        (error) => {
          console.warn("Geolocation error:", error)
          setLocationError(true)
          setLocationLoaded(true)
          handleFetchNearby(20.5937, 78.9629)
        }
      )
    } else {
      console.warn("Geolocation not supported")
      setLocationError(true)
      setLocationLoaded(true)
      handleFetchNearby(20.5937, 78.9629)
    }
  }, [updateUserLocation])

  // Periodic GPS Location updates (every 5 minutes)
  useEffect(() => {
    if (!updateUserLocation) return

    const intervalId = setInterval(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude
            const lng = pos.coords.longitude
            updateUserLocation(lat, lng)
          },
          (err) => console.log("Periodic geolocation query failed", err)
        )
      }
    }, 5 * 60 * 1000)

    return () => clearInterval(intervalId)
  }, [updateUserLocation])

  // SOCKET AND NOTIFICATIONS INTEGRATION
  useEffect(() => {
    if (!socket) return

    const handleNewAlert = (newAlert) => {
      setAlerts((prev) => {
        if (prev.some((a) => a._id === newAlert._id)) return prev
        const updated = [newAlert, ...prev]
        setActiveAlertCount(updated.length)
        return updated
      })
    }

    const handleAlertUpdated = (updatedAlert) => {
      setAlerts((prev) => {
        const updated = prev.map((a) => (a._id === updatedAlert._id ? updatedAlert : a))
        setActiveAlertCount(updated.length)
        return updated
      })
    }

    socket.on("new_alert", handleNewAlert)
    socket.on("alert_updated", handleAlertUpdated)

    // Subscribe user to proximity alert notifications
    subscribeToAlertNotifications(socket)

    return () => {
      socket.off("new_alert", handleNewAlert)
      socket.off("alert_updated", handleAlertUpdated)
    }
  }, [socket])

  const getMinutesAgo = (dateString) => {
    if (!dateString) return "Just now"
    const diffMs = new Date() - new Date(dateString)
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins <= 0) return "Just now"
    return `${diffMins}m ago`
  }

  const handleAlertTap = (alert) => {
    const lat = alert.location.coordinates[1]
    const lng = alert.location.coordinates[0]
    setFlyToTarget([lat, lng])
    setActiveTab("map")
  }

  // Show Loading Screen until location completes and alerts are fetched
  if (!locationLoaded || !alertsFetched) {
    return (
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "#0a0e1a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100000,
        color: "white",
        fontFamily: "'Outfit', 'Inter', sans-serif"
      }}>
        <style>{`
          @keyframes pulseEmoji {
            0% { transform: scale(1); filter: drop-shadow(0 0 10px rgba(231,76,60,0.4)); }
            50% { transform: scale(1.2); filter: drop-shadow(0 0 25px rgba(231,76,60,0.8)); }
            100% { transform: scale(1); filter: drop-shadow(0 0 10px rgba(231,76,60,0.4)); }
          }
          .loading-emoji-pulse {
            font-size: 80px;
            animation: pulseEmoji 1.5s infinite ease-in-out;
            margin-bottom: 24px;
          }
        `}</style>
        <div className="loading-emoji-pulse">🚨</div>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "28px", fontWeight: "800", letterSpacing: "1px" }}>AlertNet</h1>
        <p style={{ margin: 0, color: "#718096", fontSize: "14px" }}>Finding alerts near you...</p>
      </div>
    )
  }

  const trustScore = user?.credibilityScore !== undefined ? user.credibilityScore : 100
  const scoreColor = trustScore > 70 ? "#2ecc71" : trustScore >= 40 ? "#f39c12" : "#e74c3c"

  return (
    <div style={{ position: "relative", height: "100vh", width: "100%", background: "#0a0e1a", overflow: "hidden" }}>
      <style>{`
        /* Responsive Media Queries */
        @media (max-width: 767px) {
          .desktop-only {
            display: none !important;
          }
          .mobile-only {
            display: block !important;
          }
          .map-container-wrapper {
            height: calc(100vh - 116px) !important;
            top: 56px !important;
          }
          .leaflet-popup-content-wrapper {
            max-width: 90vw !important;
          }
        }
        @media (min-width: 768px) {
          .desktop-only {
            display: block !important;
          }
          .mobile-only {
            display: none !important;
          }
          .map-container-wrapper {
            height: calc(100vh - 64px) !important;
            top: 64px !important;
          }
        }

        .leaflet-popup-close-button {
          color: #1a1a2e !important;
          font-size: 20px !important;
          padding: 8px !important;
          font-weight: bold !important;
        }
      `}</style>

      {/* Legal Consent Overlay screen */}
      {!hasConsent && <ConsentScreen onAccept={() => setHasConsent(true)} />}

      {/* MOBILE NAVBAR */}
      <div 
        className="mobile-only"
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: "56px",
          background: "#1a1a2e",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 16px",
          color: "white",
          zIndex: 1000,
          boxSizing: "border-box",
          fontSize: "14px"
        }}
      >
        <div style={{ fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}>
          <span>🚨</span> AlertNet
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ 
            background: "#e74c3c", 
            padding: "4px 10px", 
            borderRadius: "20px", 
            fontSize: "12px",
            fontWeight: "bold"
          }}>
            🔔 {activeAlertCount}
          </span>
          <button 
            onClick={logout} 
            style={{ 
              background: "transparent", 
              border: "none", 
              color: "white", 
              fontSize: "18px", 
              cursor: "pointer",
              padding: "4px"
            }}
            title="Logout"
          >
            ⬛&rarr;
          </button>
        </div>
      </div>

      {/* DESKTOP NAVBAR */}
      <div 
        className="desktop-only"
        style={{ 
          position: "absolute", top: 0, left: 0, 
          right: 0, zIndex: 1000, background: "#1a1a2e", 
          padding: "10px 20px", display: "flex", 
          justifyContent: "space-between", alignItems: "center",
          color: "white", boxSizing: "border-box",
          height: "64px"
        }}
      >
        <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px", fontSize: "20px" }}>
          <span>🚨</span>
          <span>Alert Network</span>
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ 
            background: "#e74c3c", padding: "6px 12px", 
            borderRadius: "20px", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span>🔔</span>
            <span>{activeAlertCount} active alerts</span>
          </span>
          <button onClick={logout} style={{ background: "#e74c3c",
            color: "white", border: "none", padding: "8px 16px",
            borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: "bold" }}>
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Geolocation Denied warning banner */}
      {locationError && (
        <div style={{
          position: "absolute",
          top: "70px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "90%",
          maxWidth: "600px",
          background: "#f1c40f",
          color: "#1a1a2e",
          padding: "10px 16px",
          borderRadius: "8px",
          boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
          zIndex: 1001,
          fontSize: "12px",
          fontWeight: "bold",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: "'Outfit', 'Inter', sans-serif"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>📍</span>
            <span>Location access denied. Showing default location. Enable location for better experience.</span>
          </div>
          <button 
            onClick={() => setLocationError(false)}
            style={{
              background: "transparent",
              border: "none",
              color: "#1a1a2e",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: "pointer",
              padding: "0 5px"
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Empty State Card when no alerts nearby (Desktop Only) */}
      {alertsFetched && alerts.length === 0 && (
        <div 
          className="desktop-only"
          style={{
            position: "absolute",
            top: "80px",
            right: "20px",
            background: "#1a1a2e",
            border: "1px solid #2ecc71",
            color: "white",
            padding: "12px 18px",
            borderRadius: "8px",
            boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontFamily: "'Outfit', 'Inter', sans-serif",
            fontSize: "13px",
            fontWeight: "bold"
          }}
        >
          <span>✅</span>
          <span>No active alerts in your area</span>
        </div>
      )}

      {/* MAP CONTAINER */}
      <div className="map-container-wrapper" style={{ position: "absolute", width: "100%", left: 0 }}>
        <MapContainer
          key={locationLoaded ? `${userLocation[0]}-${userLocation[1]}` : "loading"}
          center={userLocation}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="OpenStreetMap contributors"
          />
          {alerts.map(alert => (
            <AlertMarker key={alert._id} alert={alert} />
          ))}

          {/* User's current location marker */}
          {locationLoaded && !locationError && (
            <Marker position={userLocation} icon={userLocationIcon}>
              <Popup>
                <div style={{ textAlign: "center", fontFamily: "sans-serif" }}>
                  <strong>📍 Your Location</strong>
                  <br />
                  <span style={{ fontSize: "11px", color: "#666" }}>
                    {userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}
                  </span>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Map FlyTo Listener */}
          <MapFlyTo target={flyToTarget} />

          {/* Custom Middle-Right Zoom Widget */}
          <CustomZoomControl />

          {/* Floating Recenter Control */}
          <RecenterControl userLocation={userLocation} />
        </MapContainer>
      </div>

      {/* REPORT BUTTON (Desktop only) */}
      <button
        onClick={() => setShowForm(true)}
        className="desktop-only"
        style={{
          position: "fixed",
          bottom: "30px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1000,
          background: "#e74c3c",
          color: "white",
          border: "none",
          padding: "15px 30px",
          borderRadius: "50px",
          fontSize: "16px",
          fontWeight: "bold",
          cursor: "pointer",
          boxShadow: "0 4px 15px rgba(231, 76, 60, 0.5)",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}
      >
        <span>🚨</span>
        <span>Report Emergency</span>
      </button>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <div 
        className="mobile-only"
        style={{
          position: "fixed",
          bottom: 0, left: 0, right: 0,
          height: "60px",
          background: "#1a1a2e",
          borderTop: "1px solid #e74c3c",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          zIndex: 2100,
          boxShadow: "0 -4px 15px rgba(0,0,0,0.3)"
        }}
      >
        <button 
          onClick={() => setActiveTab("map")}
          style={{
            background: "transparent",
            border: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            cursor: "pointer",
            color: activeTab === "map" ? "#e74c3c" : "#888888"
          }}
        >
          <span style={{ fontSize: "20px" }}>🗺️</span>
          <span style={{ fontSize: "10px", marginTop: "2px" }}>Map</span>
        </button>

        <button 
          onClick={() => setShowForm(true)}
          style={{
            background: "transparent",
            border: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            cursor: "pointer",
            color: "#888888"
          }}
        >
          <span style={{ fontSize: "20px" }}>🚨</span>
          <span style={{ fontSize: "10px", marginTop: "2px" }}>Report</span>
        </button>

        <button 
          onClick={() => setActiveTab("alerts")}
          style={{
            background: "transparent",
            border: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            cursor: "pointer",
            color: activeTab === "alerts" ? "#e74c3c" : "#888888"
          }}
        >
          <span style={{ fontSize: "20px" }}>🔔</span>
          <span style={{ fontSize: "10px", marginTop: "2px" }}>Alerts</span>
        </button>

        <button 
          onClick={() => setActiveTab("profile")}
          style={{
            background: "transparent",
            border: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            cursor: "pointer",
            color: activeTab === "profile" ? "#e74c3c" : "#888888"
          }}
        >
          <span style={{ fontSize: "20px" }}>👤</span>
          <span style={{ fontSize: "10px", marginTop: "2px" }}>Profile</span>
        </button>
      </div>

      {/* ALERTS SLIDE-UP PANEL (Mobile Only) */}
      <div
        className="mobile-only"
        style={{
          position: "fixed",
          bottom: activeTab === "alerts" ? "60px" : "-100%",
          left: 0, right: 0,
          height: "60vh",
          background: "#1a1a2e",
          color: "white",
          borderRadius: "20px 20px 0 0",
          borderTop: "2px solid #e74c3c",
          padding: "16px",
          boxSizing: "border-box",
          zIndex: 2050,
          transition: "bottom 0.3s ease-out",
          overflowY: "auto"
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
          <div style={{ width: "40px", height: "2px", background: "#888888", borderRadius: "1px" }}></div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, fontSize: "16px" }}>Nearby Alerts ({alerts.length})</h3>
          <button 
            onClick={() => setActiveTab("map")}
            style={{ background: "transparent", border: "none", color: "#888", fontSize: "24px", cursor: "pointer", padding: "0 8px" }}
          >
            &times;
          </button>
        </div>

        <div style={{ paddingBottom: "20px" }}>
          {alerts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#cbd5e0", fontSize: "14px" }}>
              ✅ No active alerts nearby
            </div>
          ) : (
            alerts.map(alert => (
              <div 
                key={alert._id} 
                onClick={() => handleAlertTap(alert)}
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "12px",
                  padding: "12px",
                  marginBottom: "10px",
                  cursor: "pointer"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontWeight: "bold", fontSize: "13px", color: "#fff" }}>
                    {TYPE_EMOJI[alert.type] || "⚠️"} {alert.type.toUpperCase()}
                  </span>
                  <span style={{ 
                    fontSize: "11px", 
                    fontWeight: "bold",
                    color: alert.status === "verified" ? "#2ecc71" : alert.status === "flagged" ? "#e74c3c" : "#f39c12" 
                  }}>
                    {alert.status.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: "14px", fontWeight: "bold", color: "#cbd5e0", marginBottom: "6px" }}>
                  {alert.title}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#718096" }}>
                  <span>📍 {getDistance(userLocation[0], userLocation[1], alert.location?.coordinates?.[1] || 0, alert.location?.coordinates?.[0] || 0)} km away</span>
                  <span>🕒 {getMinutesAgo(alert.createdAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* PROFILE SLIDE-UP PANEL (Mobile Only) */}
      <div
        className="mobile-only"
        style={{
          position: "fixed",
          bottom: activeTab === "profile" ? "60px" : "-100%",
          left: 0, right: 0,
          height: "50vh",
          background: "#1a1a2e",
          color: "white",
          borderRadius: "20px 20px 0 0",
          borderTop: "2px solid #e74c3c",
          padding: "20px",
          boxSizing: "border-box",
          zIndex: 2050,
          transition: "bottom 0.3s ease-out"
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
          <div style={{ width: "40px", height: "2px", background: "#888888", borderRadius: "1px" }}></div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ margin: 0, fontSize: "16px" }}>Citizen Profile</h3>
          <button 
            onClick={() => setActiveTab("map")}
            style={{ background: "transparent", border: "none", color: "#888", fontSize: "24px", cursor: "pointer", padding: "0 8px" }}
          >
            &times;
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", height: "calc(100% - 64px)", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "22px", fontWeight: "bold", color: "#fff" }}>{user?.name || "Citizen User"}</div>
            <div style={{ fontSize: "14px", color: "#a0aec0", marginTop: "4px" }}>{user?.email || "No email available"}</div>
            
            <div style={{ marginTop: "20px", display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
              <span>Alerts Reported:</span>
              <span style={{ fontWeight: "bold" }}>{user?.alertsReported || 0}</span>
            </div>

            <div style={{ marginTop: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: "bold", marginBottom: "6px" }}>
                <span>Trust Score</span>
                <span style={{ color: scoreColor }}>{trustScore}/100</span>
              </div>
              <div style={{ width: "100%", height: "10px", background: "#2d3748", borderRadius: "5px", overflow: "hidden" }}>
                <div style={{ width: `${trustScore}%`, height: "100%", background: scoreColor, borderRadius: "5px", transition: "width 0.5s ease-out" }}></div>
              </div>
            </div>
          </div>

          <button 
            onClick={logout} 
            style={{
              width: "100%",
              background: "#e74c3c",
              color: "white",
              border: "none",
              padding: "12px",
              borderRadius: "8px",
              fontWeight: "bold",
              fontSize: "14px",
              cursor: "pointer",
              marginTop: "auto"
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* PWA Custom Install Prompt Guide (Shown immediately on load) */}
      <InstallPrompt />

      {/* ALERT FORM MODAL */}
      {showForm && (
        <AlertForm
          userLocation={userLocation}
          onClose={() => setShowForm(false)}
          onSuccess={(newAlert) => {
            setAlerts(prev => [newAlert, ...prev])
            setActiveAlertCount(prev => prev + 1)
            setShowForm(false)
          }}
        />
      )}

    </div>
  )
}
