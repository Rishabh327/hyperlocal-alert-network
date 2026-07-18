// ==============================================
// App Component — Root Application with Routing
// ==============================================
// Sets up React Router with the following routes:
// - /         → Redirects to /login
// - /login    → Login page (public)
// - /register → Register page (public)
// - /home     → Home page (protected)
// - /map      → Map page (protected — main dashboard)
//
// After login/register, users are redirected to /map.
// SocketProvider wraps all routes so real-time alerts
// are available throughout the app.

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Map from './pages/Map';

// ==============================================
// ProtectedRoute Component
// ==============================================
// Wraps protected pages. Checks authentication state:
// - If still loading (checking token), shows a loading screen
// - If not authenticated, redirects to /login
// - If authenticated, renders the child component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  // Show a loading screen while checking auth status
  // (prevents a flash of the login page on page refresh)
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p className="loading-text">Loading your dashboard...</p>
      </div>
    );
  }

  // If user is not authenticated, redirect to the login page
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // User is authenticated — render the protected page
  return children;
};

// ==============================================
// PublicRoute Component
// ==============================================
// Wraps public pages (login, register). If the user is already
// logged in, redirects them to /map instead of showing the auth forms.
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  // Don't redirect while still checking auth status
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p className="loading-text">Checking authentication...</p>
      </div>
    );
  }

  // If user is already authenticated, redirect to map (main dashboard)
  if (user) {
    return <Navigate to="/map" replace />;
  }

  // User is not authenticated — show the public page
  return children;
};

// ==============================================
// Main App Component
// ==============================================
const App = () => {
  return (
    // AuthProvider wraps the entire app so all components
    // can access auth state and functions via useAuth()
    <AuthProvider>
      {/* SocketProvider wraps all routes so real-time alerts
          are available throughout the app */}
      <SocketProvider>
        <Router>
          <Routes>
            {/* Root path redirects to login */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Login page — public route, redirects to /map if already logged in */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />

            {/* Register page — public route, redirects to /map if already logged in */}
            <Route
              path="/register"
              element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              }
            />

            {/* Home page — protected route (legacy, still accessible) */}
            <Route
              path="/home"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />

            {/* Map page — protected route, main dashboard with live alerts */}
            <Route
              path="/map"
              element={
                <ProtectedRoute>
                  <Map />
                </ProtectedRoute>
              }
            />

            {/* Catch-all — redirect unknown routes to login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
};

export default App;
