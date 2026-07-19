import { useState, useContext } from "react"
import { AuthContext } from "../context/AuthContext"
import { corroborateAlert } from "../api/alerts"

const TYPE_EMOJI = {
  flood: "🌊",
  fire: "🔥",
  accident: "🚗",
  gas_leak: "☁️",
  medical: "🏥",
  earthquake: "🌍",
  other: "⚠️"
}

export default function AlertCard({ alert }) {
  const [confirmed, setConfirmed] = useState(false)
  const auth = useContext(AuthContext)
  const user = auth?.user

  const [showGrievanceForm, setShowGrievanceForm] = useState(false)
  const [grievanceReason, setGrievanceReason] = useState("")
  const [grievanceStatus, setGrievanceStatus] = useState("")
  const [grievanceMsg, setGrievanceMsg] = useState("")

  const handleGrievanceSubmit = async (e) => {
    e.preventDefault()
    if (!grievanceReason.trim()) return

    try {
      const res = await fetch(`http://localhost:5000/api/alerts/${alert._id}/grievance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${auth?.token}`
        },
        body: JSON.stringify({ reason: grievanceReason })
      })

      const data = await res.json()
      if (data.success) {
        setGrievanceStatus("success")
        setGrievanceMsg("Thank you. Our team will review this alert.")
        setGrievanceReason("")
        setTimeout(() => {
          setShowGrievanceForm(false)
          setGrievanceStatus("")
          setGrievanceMsg("")
        }, 3000)
      } else {
        setGrievanceStatus("error")
        setGrievanceMsg(data.message || "Failed to submit report")
      }
    } catch (err) {
      setGrievanceStatus("error")
      setGrievanceMsg("Server error. Please try again.")
    }
  }

  const emoji = TYPE_EMOJI[alert.type] || "⚠️"

  const getMinutesAgo = (dateString) => {
    if (!dateString) return "Just now"
    const diffMs = new Date() - new Date(dateString)
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins <= 0) return "Just now"
    return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`
  }

  const getScoreColor = (score) => {
    if (score > 70) return "#2ecc71"
    if (score >= 40) return "#f39c12"
    return "#e74c3c"
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case "verified":
        return "✅ Verified"
      case "flagged":
        return "🚫 Flagged"
      case "unverified":
      default:
        return "⚠️ Unverified"
    }
  }

  const handleConfirm = async (e) => {
    e.stopPropagation()
    try {
      await corroborateAlert(alert._id)
      setConfirmed(true)
    } catch (err) {
      console.error("Failed to confirm alert:", err)
    }
  }

  const statusBadge = getStatusBadge(alert.status)
  const scoreColor = getScoreColor(alert.credibilityScore)

  const hasCorroborated = alert.corroborations?.some(
    (c) => (typeof c === "string" ? c : c._id) === user?.id
  )

  const isReporter =
    (typeof alert.reportedBy === "string" ? alert.reportedBy : alert.reportedBy?._id) === user?.id

  const alreadyConfirmed = confirmed || hasCorroborated || isReporter

  return (
    <div 
      // Stop event propagation to Leaflet map container to prevent scroll/click issues
      onWheel={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        fontFamily: "'Outfit', 'Inter', 'Segoe UI', sans-serif",
        padding: "10px",
        color: "#2d3748",
        backgroundColor: "#ffffff",
        borderRadius: "8px",
        lineHeight: "1.35",
        fontSize: "12px",
        maxHeight: "360px",
        overflowY: "auto",
        scrollbarWidth: "thin"
      }}
    >
      {/* Header — Emoji + Type, Status */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "6px"
      }}>
        <span style={{
          fontSize: "12px",
          fontWeight: "bold",
          textTransform: "uppercase",
          color: "#4a5568"
        }}>
          {emoji} {alert.type}
        </span>
        <span style={{
          fontSize: "10px",
          fontWeight: "bold",
          color: alert.status === "verified" ? "#2ecc71" : alert.status === "flagged" ? "#e74c3c" : "#f39c12"
        }}>
          {statusBadge}
        </span>
      </div>

      {/* Title */}
      <div style={{
        fontSize: "15px",
        fontWeight: "bold",
        marginBottom: "4px",
        color: "#1a202c"
      }}>
        <strong>{alert.title}</strong>
      </div>

      {/* Description */}
      <div style={{
        fontSize: "12px",
        color: "#4a5568",
        marginBottom: "6px",
        wordBreak: "break-word"
      }}>
        {alert.description}
      </div>

      {/* Optional Photo */}
      {alert.photo && (
        <img
          src={`http://localhost:5000${alert.photo}`}
          alt={alert.title}
          style={{
            width: "100%",
            height: "90px",
            objectFit: "cover",
            borderRadius: "4px",
            marginBottom: "6px",
            border: "1px solid #edf2f7"
          }}
        />
      )}

      {/* Metrics Row (Credibility and Confirmations count) */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
        <div style={{
          flex: 1,
          backgroundColor: "#f7fafc",
          padding: "4px 8px",
          borderRadius: "4px",
          border: "1px solid #edf2f7"
        }}>
          <div style={{ color: "#718096", fontSize: "10px" }}>Credibility</div>
          <div style={{ fontWeight: "bold", color: scoreColor, fontSize: "12px" }}>{alert.credibilityScore}%</div>
        </div>
        <div style={{
          flex: 1,
          backgroundColor: "#f7fafc",
          padding: "4px 8px",
          borderRadius: "4px",
          border: "1px solid #edf2f7"
        }}>
          <div style={{ color: "#718096", fontSize: "10px" }}>Confirmations</div>
          <div style={{ fontWeight: "bold", color: "#2d3748", fontSize: "12px" }}>📢 {alert.corroborationCount || 0}</div>
        </div>
      </div>

      {/* Posted Time */}
      <div style={{
        fontSize: "10px",
        color: "#718096",
        marginBottom: "6px"
      }}>
        🕒 Posted {getMinutesAgo(alert.createdAt)}
      </div>

      {/* Collapsible AI Analysis Factors Breakdown */}
      {alert.factors && (
        <details style={{ marginBottom: "8px", fontSize: "11px" }}>
          <summary style={{
            cursor: "pointer",
            fontWeight: "bold",
            color: "#4a5568",
            outline: "none"
          }}>
            📊 View AI Analysis Factors
          </summary>
          <div style={{
            marginTop: "4px",
            backgroundColor: "#f8fafc",
            padding: "6px",
            borderRadius: "4px",
            border: "1px solid #e2e8f0"
          }}>
            {Object.entries(alert.factors).map(([key, val]) => (
              <div key={key} style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "2px 0"
              }}>
                <span style={{ textTransform: "capitalize", color: "#64748b" }}>{key.replace(/_/g, " ")}:</span>
                <span style={{
                  fontWeight: "bold",
                  color: val >= 0 ? "#2ecc71" : "#e74c3c"
                }}>
                  {val >= 0 ? `+${val}` : val}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Confirm Button */}
      {alreadyConfirmed ? (
        <div style={{
          color: "#2ecc71",
          fontWeight: "bold",
          textAlign: "center",
          padding: "6px",
          background: "rgba(46, 204, 113, 0.08)",
          borderRadius: "4px",
          fontSize: "12px"
        }}>
          ✅ {isReporter ? "You reported this" : "You confirmed this"}
        </div>
      ) : (
        <button
          onClick={handleConfirm}
          style={{
            width: "100%",
            background: "#2ecc71",
            color: "white",
            border: "none",
            padding: "6px 0",
            borderRadius: "4px",
            fontWeight: "bold",
            fontSize: "12px",
            cursor: "pointer",
            transition: "background 0.2s"
          }}
        >
          ✅ Confirm Alert
        </button>
      )}

      {/* Grievance reporting form */}
      <div style={{ marginTop: "8px" }}>
        {showGrievanceForm ? (
          <form 
            onSubmit={handleGrievanceSubmit} 
            onClick={(e) => e.stopPropagation()}
            style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}
          >
            <textarea
              value={grievanceReason}
              onChange={(e) => setGrievanceReason(e.target.value)}
              placeholder="Why do you think this alert is false?"
              maxLength={200}
              rows={2}
              style={{
                width: "100%",
                padding: "6px",
                borderRadius: "4px",
                border: "1px solid #cbd5e0",
                fontSize: "11px",
                resize: "none",
                outline: "none",
                boxSizing: "border-box"
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "10px", color: "#a0aec0" }}>{grievanceReason.length}/200</span>
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  type="button"
                  onClick={() => setShowGrievanceForm(false)}
                  style={{
                    background: "#edf2f7",
                    color: "#4a5568",
                    border: "none",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!grievanceReason.trim()}
                  style={{
                    background: "#e74c3c",
                    color: "white",
                    border: "none",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    cursor: grievanceReason.trim() ? "pointer" : "not-allowed",
                    opacity: grievanceReason.trim() ? 1 : 0.6
                  }}
                >
                  Submit Report
                </button>
              </div>
            </div>
          </form>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowGrievanceForm(true)
            }}
            style={{
              width: "100%",
              background: "transparent",
              border: "1px dashed #e74c3c",
              color: "#e74c3c",
              padding: "6px 0",
              borderRadius: "4px",
              fontWeight: "bold",
              fontSize: "12px",
              cursor: "pointer",
              marginTop: "6px",
              transition: "all 0.2s"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "rgba(231, 76, 60, 0.05)"
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "transparent"
            }}
          >
            🚩 Report as False
          </button>
        )}

        {grievanceMsg && (
          <div style={{
            marginTop: "6px",
            fontSize: "11px",
            color: grievanceStatus === "success" ? "#2ecc71" : "#e74c3c",
            textAlign: "center",
            fontWeight: "500"
          }}>
            {grievanceMsg}
          </div>
        )}
      </div>
    </div>
  )
}
