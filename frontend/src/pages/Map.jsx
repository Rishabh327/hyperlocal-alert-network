import { useState, useEffect, useContext } from "react"
import { MapContainer, TileLayer, useMapEvents, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import { AuthContext } from "../context/AuthContext"
import { SocketContext } from "../context/SocketContext"
import AlertMarker from "../components/AlertMarker"
import AlertForm from "../components/AlertForm"
import { getNearbyAlerts } from "../api/alerts"

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
  const [activeAlertCount, setActiveAlertCount] = useState(0)

  // ON COMPONENT MOUNT
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          setUserLocation([lat, lng])
          setLocationLoaded(true)

          getNearbyAlerts(lat, lng, 5)
            .then((data) => {
              const fetched = data.alerts || []
              setAlerts(fetched)
              setActiveAlertCount(fetched.length)
            })
            .catch((err) => {
              console.error("Error fetching nearby alerts:", err)
            })
        },
        (error) => {
          console.warn("Geolocation error:", error)
          setLocationLoaded(true)
          // Fallback to default
          const lat = userLocation[0]
          const lng = userLocation[1]
          getNearbyAlerts(lat, lng, 5)
            .then((data) => {
              const fetched = data.alerts || []
              setAlerts(fetched)
              setActiveAlertCount(fetched.length)
            })
            .catch((err) => {
              console.error("Error fetching nearby alerts:", err)
            })
        }
      )
    } else {
      console.warn("Geolocation not supported")
      setLocationLoaded(true)
      const lat = userLocation[0]
      const lng = userLocation[1]
      getNearbyAlerts(lat, lng, 5)
        .then((data) => {
          const fetched = data.alerts || []
          setAlerts(fetched)
          setActiveAlertCount(fetched.length)
        })
        .catch((err) => {
          console.error("Error fetching nearby alerts:", err)
        })
    }
  }, [])

  // SOCKET INTEGRATION
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

    return () => {
      socket.off("new_alert", handleNewAlert)
      socket.off("alert_updated", handleAlertUpdated)
    }
  }, [socket])

  return (
    <div style={{ position: "relative", height: "100vh", width: "100%" }}>
      <style>{`
        .leaflet-top {
          top: 75px !important;
        }
      `}</style>

      {/* NAVBAR at top */}
      <div style={{ position: "absolute", top: 0, left: 0, 
        right: 0, zIndex: 1000, background: "#1a1a2e", 
        padding: "10px 20px", display: "flex", 
        justifyContent: "space-between", alignItems: "center",
        color: "white" }}>
        <h2 style={{ margin: 0 }}>🚨 Alert Network</h2>
        <div>
          <span style={{ marginRight: "15px", 
            background: "#e74c3c", padding: "4px 10px", 
            borderRadius: "20px", fontSize: "14px" }}>
            {activeAlertCount} active alerts
          </span>
          <button onClick={logout} style={{ background: "#e74c3c",
            color: "white", border: "none", padding: "6px 14px",
            borderRadius: "6px", cursor: "pointer" }}>
            Logout
          </button>
        </div>
      </div>

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
        {locationLoaded && (
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
        <span className="report-btn-text">Report Emergency</span>
      </button>

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
