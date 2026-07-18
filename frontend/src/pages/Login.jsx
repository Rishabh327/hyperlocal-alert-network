// ==============================================
// Login Page — User Authentication
// ==============================================
// Provides a login form with email and password fields.
// On successful login, saves the JWT token via AuthContext
// and redirects the user to the Home page.
// Shows error messages for invalid credentials.
// Includes a link to the Register page for new users.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  // Form field state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // UI state for loading and error handling
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Auth context provides the login function
  const { login } = useAuth();

  // React Router navigation hook for redirecting after login
  const navigate = useNavigate();

  // ==============================================
  // Handle Form Submission
  // ==============================================
  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent default form submission behavior
    setError(''); // Clear any previous error messages
    setLoading(true); // Show loading state on the button

    try {
      // Call the login function from AuthContext
      // This sends POST /api/auth/login and saves the token
      await login(email, password);

      // On success, redirect to the home page
      navigate('/map');
    } catch (err) {
      // Display the error message from the server, or a fallback
      setError(
        err.response?.data?.message || 'Login failed. Please try again.'
      );
    } finally {
      setLoading(false); // Reset loading state
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Header with logo and title */}
        <div className="auth-header">
          <div className="auth-logo">🚨</div>
          <h1 className="auth-title">Welcome Back</h1>
          <p className="auth-subtitle">
            Sign in to access the Hyperlocal Alert Network
          </p>
        </div>

        {/* Error message display — shown only when there's an error */}
        {error && (
          <div className="error-message" id="login-error">
            ⚠️ {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          {/* Email Field */}
          <div className="form-group">
            <label htmlFor="login-email" className="form-label">
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          {/* Password Field */}
          <div className="form-group">
            <label htmlFor="login-password" className="form-label">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {/* Submit Button — shows spinner while loading */}
          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Footer with link to Register page */}
        <div className="auth-footer">
          Don&apos;t have an account?{' '}
          <Link to="/register">Create one here</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
