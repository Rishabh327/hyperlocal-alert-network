import { Marker, Popup } from "react-leaflet"
import { divIcon } from "leaflet"
import AlertCard from "./AlertCard"

const TYPE_EMOJI = {
  flood: "🌊",
  fire: "🔥",
  accident: "🚗",
  gas_leak: "☁️",
  medical: "🏥",
  earthquake: "🌍",
  other: "⚠️"
}

const STATUS_COLOR = {
  verified: "#2ecc71",
  unverified: "#f39c12",
  flagged: "#e74c3c"
}

export default function AlertMarker({ alert }) {
  const lat = alert.location.coordinates[1]
  const lng = alert.location.coordinates[0]
  const emoji = TYPE_EMOJI[alert.type] || "⚠️"
  const color = STATUS_COLOR[alert.status] || "#f39c12"

  const icon = divIcon({
    html: `
      <div style="position: relative; width: 36px; height: 46px; filter: drop-shadow(0px 3px 5px rgba(0, 0, 0, 0.4)) drop-shadow(0 0 8px ${color});">
        <svg width="36" height="46" viewBox="0 0 36 46" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block; pointer-events: none;">
          <!-- Teardrop shape pointer in status color -->
          <path d="M18 0C8.06 0 0 8.06 0 18C0 31.5 18 46 18 46C18 46 36 31.5 36 18C36 8.06 27.94 0 18 0Z" fill="${color}"/>
        </svg>
        <!-- White circle background centered in the pin head -->
        <div style="
          position: absolute;
          top: 6px;
          left: 6px;
          width: 24px;
          height: 24px;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          line-height: 1;
          user-select: none;
        ">
          ${emoji}
        </div>
      </div>
    `,
    className: "",
    iconSize: [36, 46],
    iconAnchor: [18, 46],
    popupAnchor: [0, -42]
  })

  return (
    <Marker position={[lat, lng]} icon={icon}>
      <Popup minWidth={250} maxWidth={300}>
        <AlertCard alert={alert} />
      </Popup>
    </Marker>
  )
}
