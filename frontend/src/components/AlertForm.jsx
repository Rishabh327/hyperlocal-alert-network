// ==============================================
// AlertForm Component — Submit Emergency Alert Modal
// ==============================================
// A modal popup form for reporting a new emergency.
// Fields: Title, Type, Description, Location Picker Map, Photo.
//
// BUG 2 FIX: Instead of using only the user's GPS,
// this form now includes an interactive Leaflet map picker
// (200px height) where users can click anywhere or drag
// a marker to set the alert location. A "Use My Current
// Location" button snaps the marker back to GPS coordinates.
//
// Submits via POST /api/alerts with FormData for file upload.

import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { submitAlert } from '../api/alerts';

// Alert type options for the dropdown
const ALERT_TYPES = [
  { value: 'flood', label: '🌊 Flood' },
  { value: 'fire', label: '🔥 Fire' },
  { value: 'accident', label: '🚗 Accident' },
  { value: 'gas_leak', label: '☁️ Gas Leak' },
  { value: 'medical', label: '🏥 Medical Emergency' },
  { value: 'earthquake', label: '🌍 Earthquake' },
  { value: 'other', label: '⚠️ Other' },
];

// Default center — India's geographic center (fallback if no GPS)
const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };

// ==============================================
// ClickHandler — Moves marker on map click
// ==============================================
// A headless component that listens for click events
// on the map and updates the selected position.
const ClickHandler = ({ onLocationSelect }) => {
  useMapEvents({
    click(e) {
      onLocationSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
};

// ==============================================
// RecenterPickerMap — Fly to a position on the picker map
// ==============================================
const RecenterPickerMap = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo([center.lat, center.lng], map.getZoom(), { duration: 0.5 });
    }
  }, [center, map]);
  return null;
};

// ==============================================
// DraggableMarker — Marker the user can drag to set location
// ==============================================
const DraggableMarker = ({ position, onDragEnd }) => {
  // Event handlers for the draggable marker
  const eventHandlers = useMemo(
    () => ({
      dragend(e) {
        const marker = e.target;
        const latlng = marker.getLatLng();
        onDragEnd({ lat: latlng.lat, lng: latlng.lng });
      },
    }),
    [onDragEnd]
  );

  return (
    <Marker
      position={[position.lat, position.lng]}
      draggable={true}
      eventHandlers={eventHandlers}
    />
  );
};

// ==============================================
// AlertForm Component
// ==============================================
const AlertForm = ({ onClose, userLocation }) => {
  // Form state
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState(null);

  // Location picker state — start at user's GPS or default center
  const formattedUserLocation = useMemo(() => {
    if (!userLocation) return null;
    if (Array.isArray(userLocation)) {
      return { lat: userLocation[0], lng: userLocation[1] };
    }
    return userLocation;
  }, [userLocation]);

  const [selectedLocation, setSelectedLocation] = useState(
    formattedUserLocation || DEFAULT_CENTER
  );

  // Sync selected location if userLocation becomes available post-mount
  useEffect(() => {
    if (formattedUserLocation) {
      setSelectedLocation(formattedUserLocation);
    }
  }, [formattedUserLocation]);

  // Track a "recenter target" to trigger flyTo on the picker map
  const [recenterTarget, setRecenterTarget] = useState(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // ==============================================
  // Handle Location Selection (click or drag)
  // ==============================================
  const handleLocationSelect = (latlng) => {
    setSelectedLocation(latlng);
  };

  // ==============================================
  // Handle "Use My Current Location" button
  // ==============================================
  const handleUseMyLocation = () => {
    if (formattedUserLocation) {
      setSelectedLocation(formattedUserLocation);
      setRecenterTarget({ ...formattedUserLocation }); // new object ref to trigger effect
    }
  };

  // ==============================================
  // Handle Form Submission
  // ==============================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate location is selected
    if (!selectedLocation) {
      setError('Please select a location on the map.');
      setLoading(false);
      return;
    }

    try {
      // Build FormData for multipart upload (photo support)
      const formData = new FormData();
      formData.append('title', title);
      formData.append('type', type);
      formData.append('description', description);
      formData.append('latitude', selectedLocation.lat);
      formData.append('longitude', selectedLocation.lng);

      // Attach photo if selected
      if (photo) {
        formData.append('photo', photo);
      }

      // Submit the alert to the backend
      await submitAlert(formData);

      // Show success feedback
      setSuccess(true);

      // Close the modal after a brief delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(
        err.response?.data?.message || 'Failed to submit alert. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ==============================================
  // Handle Click on Overlay (Close Modal)
  // ==============================================
  const handleOverlayClick = (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick} style={{ zIndex: 9999 }}>
      <div className="modal-content alert-form-modal">
        {/* Modal Header */}
        <div className="modal-header">
          <h2 className="modal-title">
            🚨 Report Emergency
          </h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Success State */}
        {success ? (
          <div className="alert-form-success">
            <div className="success-icon">✅</div>
            <h3>Alert Reported Successfully</h3>
            <p>Your emergency report has been submitted and broadcast to nearby users.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Error message */}
            {error && (
              <div className="error-message">⚠️ {error}</div>
            )}

            {/* 1. Title */}
            <div className="form-group">
              <label htmlFor="alert-title" className="form-label">
                Alert Title
              </label>
              <input
                id="alert-title"
                type="text"
                className="form-input"
                placeholder="e.g., Major road flooding near MG Road"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={120}
              />
            </div>

            {/* 2. Type Dropdown */}
            <div className="form-group">
              <label htmlFor="alert-type" className="form-label">
                Emergency Type
              </label>
              <select
                id="alert-type"
                className="form-input form-select"
                value={type}
                onChange={(e) => setType(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select emergency type...
                </option>
                {ALERT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Description */}
            <div className="form-group">
              <label htmlFor="alert-description" className="form-label">
                Description
              </label>
              <textarea
                id="alert-description"
                className="form-input form-textarea"
                placeholder="Describe the emergency situation in detail..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                maxLength={1000}
                rows={3}
              />
            </div>

            {/* 4. Location Picker Map */}
            <div className="form-group">
              <label className="form-label">
                Alert Location
              </label>

              {/* "Use My Current Location" button */}
              <button
                type="button"
                className="btn-use-location"
                onClick={handleUseMyLocation}
                disabled={!userLocation}
              >
                📍 Use My Current Location
              </button>

              {/* Interactive map picker — 200px height */}
              <div className="location-picker-map" id="location-picker-map">
                <MapContainer
                  center={[selectedLocation.lat, selectedLocation.lng]}
                  zoom={14}
                  className="picker-map"
                  zoomControl={true}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | <a href="https://carto.com/">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  />

                  {/* Click anywhere on the map to move the marker */}
                  <ClickHandler onLocationSelect={handleLocationSelect} />

                  {/* Fly to new position when "Use My Location" is clicked */}
                  {recenterTarget && (
                    <RecenterPickerMap center={recenterTarget} />
                  )}

                  {/* Draggable marker at the selected location */}
                  <DraggableMarker
                    position={selectedLocation}
                    onDragEnd={handleLocationSelect}
                  />
                </MapContainer>
              </div>

              {/* Live coordinate readout */}
              <div className="location-readout">
                📍 Selected: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
              </div>
            </div>

            {/* 5. Photo Upload */}
            <div className="form-group">
              <label htmlFor="alert-photo" className="form-label">
                Photo <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                id="alert-photo"
                type="file"
                className="form-input form-file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={(e) => setPhoto(e.target.files[0])}
              />
              {photo && (
                <div className="photo-preview-name">
                  📎 {photo.name}
                </div>
              )}
            </div>

            {/* 6. Submit Button */}
            <button
              id="alert-submit"
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Submitting Report...
                </>
              ) : (
                '🚨 Submit Emergency Report'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AlertForm;
