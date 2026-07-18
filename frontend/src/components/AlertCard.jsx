import { useAuth } from "../context/AuthContext"
import { corroborateAlert } from "../api/alerts"

// ==============================================
// Alert Type → Emoji Mapping
// ==============================================
const ALERT_ICONS = {
  flood: '🌊',
  fire: '🔥',
  accident: '🚗',
  gas_leak: '☁️',
  medical: '🏥',
  earthquake: '🌍',
  other: '⚠️',
};

// ==============================================
// Helper — Get Credibility Badge Color Style
// ==============================================
const getCredibilityStyle = (score) => {
  if (score > 70) return { background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' };
  if (score >= 40) return { background: 'rgba(234, 179, 8, 0.15)', color: '#eab308' };
  return { background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' };
};

export default function AlertCard({ alert }) {
  const { user } = useAuth();

  const handleConfirm = async () => {
    try {
      await corroborateAlert(alert._id);
      // No local state hooks used. Re-rendering will trigger globally via Socket.IO
    } catch (err) {
      console.error("Failed to corroborate alert:", err);
    }
  };

  const hasCorroborated = alert.corroborations?.some(
    (c) => (typeof c === 'string' ? c : c._id) === user?.id
  );

  const isReporter =
    (typeof alert.reportedBy === 'string' ? alert.reportedBy : alert.reportedBy?._id) === user?.id;

  const credStyle = getCredibilityStyle(alert.credibilityScore);
  const typeEmoji = ALERT_ICONS[alert.type] || '⚠️';

  return (
    <div className="alert-card-popup">
      <div className="alert-card-header">
        <span className="alert-card-type-icon">{typeEmoji} {alert.type}</span>
        <span className="alert-card-status">{alert.status}</span>
      </div>

      <h3 className="alert-card-title">
        <strong>{alert.title}</strong>
      </h3>

      <p className="alert-card-desc">{alert.description}</p>

      {alert.photo && (
        <img
          src={`http://localhost:5000${alert.photo}`}
          alt={alert.title}
          className="alert-card-photo"
        />
      )}

      <div className="alert-card-meta" style={{ marginTop: '8px' }}>
        <span
          className="alert-card-credibility"
          style={{
            display: 'inline-block',
            padding: '3px 8px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: '600',
            ...credStyle
          }}
        >
          ⭐ Credibility: {alert.credibilityScore}
        </span>
      </div>

      <div className="alert-card-corroborations" style={{ margin: '8px 0', fontSize: '0.85rem' }}>
        ✅ {alert.corroborationCount} {alert.corroborationCount === 1 ? 'person' : 'people'} confirmed this
      </div>

      {hasCorroborated || isReporter ? (
        <div className="alert-card-confirmed" style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: '600' }}>
          ✅ You confirmed this
        </div>
      ) : (
        <button
          className="alert-card-confirm-btn"
          onClick={handleConfirm}
          style={{
            width: '100%',
            padding: '10px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            marginTop: '8px'
          }}
        >
          ✅ Confirm Alert
        </button>
      )}
    </div>
  );
}
