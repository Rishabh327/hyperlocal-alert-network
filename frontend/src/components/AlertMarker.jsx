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

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const width = isMobile ? 44 : 36;
  const height = isMobile ? 56 : 46;
  const circleSize = isMobile ? 30 : 24;
  const offset = isMobile ? 7 : 6;
  const emojiSize = isMobile ? 18 : 15;

  const icon = divIcon({
    html: `
      <div style="position: relative; width: ${width}px; height: ${height}px; filter: drop-shadow(0px 3px 5px rgba(0, 0, 0, 0.4)) drop-shadow(0 0 8px ${color});">
        <svg width="${width}" height="${height}" viewBox="0 0 36 46" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block; pointer-events: none;">
          <!-- Teardrop shape pointer in status color -->
          <path d="M18 0C8.06 0 0 8.06 0 18C0 31.5 18 46 18 46C18 46 36 31.5 36 18C36 8.06 27.94 0 18 0Z" fill="${color}"/>
        </svg>
        <!-- White circle background centered in the pin head -->
        <div style="
          position: absolute;
          top: ${offset}px;
          left: ${offset}px;
          width: ${circleSize}px;
          height: ${circleSize}px;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${emojiSize}px;
          line-height: 1;
          user-select: none;
        ">
          ${emoji}
        </div>
      </div>
    `,
    className: "",
    iconSize: [width, height],
    iconAnchor: [width / 2, height],
    popupAnchor: [0, -height + 4]
  })

  return (
    <Marker position={[lat, lng]} icon={icon}>
      <Popup minWidth={isMobile ? 260 : 250} maxWidth={isMobile ? Math.floor(window.innerWidth * 0.9) : 300}>
        <AlertCard alert={alert} />
      </Popup>
    </Marker>
  )
}
