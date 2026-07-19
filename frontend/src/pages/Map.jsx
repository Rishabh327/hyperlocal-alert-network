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

// Custom recenter control to fly back to the user's location
const RecenterControl = ({ userLocation }) => {
  const map = useMap()

  const handleRecenter = () => {
    if (userLocation) {
      map.flyTo(userLocation, 13, { duration: 1.5 })
    }
  }

  return (
    <button
      onClick={handleRecenter}
      style={{
        position: "absolute",
        bottom: "100px",
        right: "20px",
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

export default function Map() {
  const { logout } = useContext(AuthContext)
  const { socket } = useContext(SocketContext)

  const [userLocation, setUserLocation] = useState([20.5937, 78.9629])
  const [alerts, setAlerts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [locationLoaded, setLocationLoaded] = useState(false)
  const [alertsFetched, setAlertsFetched] = useState(false)
  const [activeAlertCount, setActiveAlertCount] = useState(0)

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

          // Request notifications permission and subscribe to real-time alerts
          requestNotificationPermission();
        },
        (error) => {
          console.warn("Geolocation error:", error)
          setLocationError(true)
          setLocationLoaded(true)
          // Fallback to default India coordinates
          handleFetchNearby(20.5937, 78.9629)
        }
      )
    } else {
      console.warn("Geolocation not supported")
      setLocationError(true)
      setLocationLoaded(true)
      handleFetchNearby(20.5937, 78.9629)
    }
  }, [])

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
          .loading-emoji {
            font-size: 64px;
            animation: pulseEmoji 1.5s infinite ease-in-out;
            margin-bottom: 20px;
          }
        `}</style>
        <div className="loading-emoji">🚨</div>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "28px", fontWeight: "800", letterSpacing: "1px" }}>AlertNet</h1>
        <p style={{ margin: 0, color: "#718096", fontSize: "14px" }}>Loading your area...</p>
      </div>
    )
  }

  return (
    <div style={{ position: "relative", height: "100vh", width: "100%" }}>
      <style>{`
        .leaflet-top {
          top: 75px !important;
        }
        @media (max-width: 600px) {
          .nav-bar {
            padding: 8px 12px !important;
          }
          .nav-text {
            display: none !important;
          }
          .nav-brand {
            font-size: 18px !important;
          }
          .report-emergency-btn {
            padding: 12px 24px !important;
            font-size: 14px !important;
            bottom: calc(20px + env(safe-area-inset-bottom)) !important;
          }
        }
      `}</style>

      {/* Legal Consent Overlay screen */}
      {!hasConsent && <ConsentScreen onAccept={() => setHasConsent(true)} />}

      {/* NAVBAR at top */}
      <div 
        className="nav-bar"
        style={{ 
          position: "absolute", top: 0, left: 0, 
          right: 0, zIndex: 1000, background: "#1a1a2e", 
          padding: "10px 20px", display: "flex", 
          justifyContent: "space-between", alignItems: "center",
          color: "white", boxSizing: "border-box" 
        }}
      >
        <h2 className="nav-brand" style={{ margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
          <span>🚨</span>
          <span className="nav-text">Alert Network</span>
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ 
            background: "#e74c3c", padding: "4px 10px", 
            borderRadius: "20px", fontSize: "14px", display: "flex", alignItems: "center", gap: "4px" }}>
            <span>🔔</span>
            <span className="nav-text">{activeAlertCount} active alerts</span>
          </span>
          <button onClick={logout} style={{ background: "#e74c3c",
            color: "white", border: "none", padding: "6px 14px",
            borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
            <span>🚪</span>
            <span className="nav-text">Logout</span>
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

      {/* Empty State Card when no alerts nearby */}
      {alertsFetched && alerts.length === 0 && (
        <div style={{
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
        }}>
          <span>✅</span>
          <span>No active alerts in your area</span>
        </div>
      )}

      {/* MAP taking full screen */}
      <MapContainer
        key={locationLoaded ? `${userLocation[0]}-${userLocation[1]}` : "loading"}
        center={userLocation}
        zoom={13}
        style={{ height: "100vh", width: "100%" }}
        zoomControl={true}
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

        {/* Floating Recenter Control */}
        <RecenterControl userLocation={userLocation} />
      </MapContainer>

      {/* REPORT BUTTON fixed at bottom center */}
      <button
        onClick={() => setShowForm(true)}
        className="report-emergency-btn"
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
          gap: "8px",
          opacity: 1
        }}>
        <span className="report-btn-icon">🚨</span>
        <span className="report-btn-text nav-text">Report Emergency</span>
      </button>

      {/* Install Prompt PWA Banner */}
      <InstallPrompt />

      {/* ALERT FORM MODAL */}
      {showForm && (
        <AlertForm
          userLocation={userLocation}
          onClose={() => setShowForm(false)}
          onSuccess={(newAlert) => {
            setAlerts(prev => [...prev, newAlert])
            setActiveAlertCount(prev => prev + 1)
            setShowForm(false)
          }}
        />
      )}

    </div>
  )
}
