import { Marker, Popup } from "react-leaflet"
import L from "leaflet"
import AlertCard from "./AlertCard"

// ==============================================
// Alert Type → Color Mapping
// ==============================================
const ALERT_COLORS = {
  flood: '#3b82f6',      // blue
  fire: '#ef4444',        // red
  accident: '#f97316',    // orange
  gas_leak: '#eab308',    // yellow
  medical: '#22c55e',     // green
  earthquake: '#a855f7',  // purple
  other: '#6b7280',       // grey
};

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
// Create a Custom Teardrop Navigation Pin DivIcon
// ==============================================
// Returns a Leaflet DivIcon with a clean SVG teardrop navigation pin.
// It uses a native SVG <text> node to render the emoji directly inside the SVG,
// preventing any nested HTML layout issues and ensuring correct click propagation.
const createAlertIcon = (type) => {
  const color = ALERT_COLORS[type] || ALERT_COLORS.other;
  const icon = ALERT_ICONS[type] || ALERT_ICONS.other;

  return L.divIcon({
    className: 'custom-alert-marker',
    html: `
      <svg width="36" height="46" viewBox="0 0 36 46" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block; filter: drop-shadow(0px 3px 5px rgba(0, 0, 0, 0.4)); pointer-events: none;">
        <!-- Teardrop shape pointer -->
        <path d="M18 0C8.06 0 0 8.06 0 18C0 31.5 18 46 18 46C18 46 36 31.5 36 18C36 8.06 27.94 0 18 0Z" fill="${color}"/>
        <!-- Inner circle background for emoji -->
        <circle cx="18" cy="18" r="10" fill="#111827"/>
        <!-- Emoji centered on pin head -->
        <text x="18" y="22" font-size="14" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle" fill="white" style="user-select: none;">
          ${icon}
        </text>
      </svg>
    `,
    iconSize: [36, 46],
    iconAnchor: [18, 46],
    popupAnchor: [0, -42],
  });
};

export default function AlertMarker({ alert, currentUser }) {
  const lat = alert.location.coordinates[1]
  const lng = alert.location.coordinates[0]

  return (
    <Marker 
      position={[lat, lng]} 
      icon={createAlertIcon(alert.type)}
      eventHandlers={{
        click: (e) => {
          // Explicitly open popup on click to guarantee it displays
          e.target.openPopup();
        }
      }}
    >
      <Popup className="alert-popup" maxWidth={300} minWidth={260}>
        <AlertCard alert={alert} currentUser={currentUser} />
      </Popup>
    </Marker>
  )
}
