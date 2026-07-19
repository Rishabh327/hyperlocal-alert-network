// Haversine formula to compute distance between two coordinates in kilometers
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// 1. requestNotificationPermission()
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    localStorage.setItem('alertnet_notification_permission', 'granted');
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    localStorage.setItem('alertnet_notification_permission', permission);
    return permission === 'granted';
  }

  return false;
}

// 2. showNotification(title, body, data)
export function showNotification(title, body, data) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const options = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'alertnet-notification',
    data
  };

  const notification = new Notification(title, options);

  notification.onclick = function (event) {
    event.preventDefault();
    window.focus();
    window.location.href = '/map';
  };
}

// 3. subscribeToAlertNotifications(socket)
export function subscribeToAlertNotifications(socket) {
  if (!socket) return;

  // Listen for the "new_alert" socket event
  socket.on('new_alert', (alert) => {
    const cachedLocation = localStorage.getItem('alertnet_user_location');
    if (!cachedLocation) return;

    try {
      const [userLat, userLng] = JSON.parse(cachedLocation);
      if (alert.location && alert.location.coordinates) {
        const [alertLng, alertLat] = alert.location.coordinates;
        const distance = getDistance(userLat, userLng, alertLat, alertLng);

        // Notify only if within 5 kilometers
        if (distance <= 5) {
          showNotification(
            `🚨 ${alert.type.toUpperCase()} Alert Nearby`,
            `${alert.title} - ${alert.description.substring(0, 100)}`,
            { alertId: alert._id }
          );
        }
      }
    } catch (err) {
      console.error('Error parsing user location for notifications:', err);
    }
  });
}
