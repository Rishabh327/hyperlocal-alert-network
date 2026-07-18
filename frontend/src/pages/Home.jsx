// ==============================================
// Home Page — Protected Dashboard
// ==============================================
// This is the main landing page after login. It displays:
// - A navbar with the user's name and a logout button
// - A hero section welcoming the user to the network
// - Stats cards showing the user's metrics
//
// This page is protected — if the user is not logged in,
// they are redirected to /login automatically (handled in App.jsx).

import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  // Get the authenticated user and logout function from AuthContext
  const { user, logout } = useAuth();

  // Navigation hook for redirecting after logout
  const navigate = useNavigate();

  // ==============================================
  // Handle Logout
  // ==============================================
  const handleLogout = () => {
    logout(); // Clear token and user state
    navigate('/login'); // Redirect to login page
  };

  // Get the user's initials for the avatar (e.g., "John Doe" → "JD")
  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="home-page">
      {/* ==============================================
          Navigation Bar
          ============================================== */}
      <nav className="navbar" id="main-navbar">
        {/* Brand / Logo */}
        <div className="navbar-brand">
          <div className="navbar-logo">🚨</div>
          <span className="navbar-title">Hyperlocal Alert Network</span>
        </div>

        {/* User Info & Logout */}
        <div className="navbar-user">
          <div className="navbar-user-info">
            {/* User avatar with initials */}
            <div className="user-avatar" id="user-avatar">
              {getInitials(user?.name)}
            </div>
            <div>
              <div className="user-name" id="user-display-name">
                {user?.name}
              </div>
              <div className="user-role">{user?.role}</div>
            </div>
          </div>

          {/* Logout Button */}
          <button
            id="logout-button"
            className="btn btn-ghost"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </nav>

      {/* ==============================================
          Hero Section — Welcome Message
          ============================================== */}
      <section className="hero-section" id="hero-section">
        <div className="hero-content">
          {/* Status badge with animated dot */}
          <div className="hero-badge">
            <span className="pulse-dot"></span>
            Network Active
          </div>

          {/* Main heading */}
          <h1 className="hero-title">
            Welcome to the{' '}
            <span className="gradient-text">Hyperlocal Alert Network</span>
          </h1>

          {/* Description text */}
          <p className="hero-description">
            You&apos;re now connected to your community&apos;s real-time emergency
            alert system. Report incidents, receive alerts, and help keep your
            neighborhood safe.
          </p>
        </div>
      </section>

      {/* ==============================================
          User Stats Cards
          ============================================== */}
      <div className="stats-grid" id="user-stats">
        {/* Alerts Reported Card */}
        <div className="stat-card">
          <div className="stat-icon">📢</div>
          <div className="stat-value">{user?.alertsReported ?? 0}</div>
          <div className="stat-label">Alerts Reported</div>
        </div>

        {/* Credibility Score Card */}
        <div className="stat-card">
          <div className="stat-icon">⭐</div>
          <div className="stat-value">{user?.credibilityScore ?? 100}</div>
          <div className="stat-label">Credibility Score</div>
        </div>

        {/* Account Role Card */}
        <div className="stat-card">
          <div className="stat-icon">🛡️</div>
          <div className="stat-value" style={{ fontSize: '1.25rem', textTransform: 'capitalize' }}>
            {user?.role ?? 'citizen'}
          </div>
          <div className="stat-label">Account Type</div>
        </div>
      </div>
    </div>
  );
};

export default Home;
