// ==============================================
// Register Page — New User Registration
// ==============================================
// Provides a registration form with name, email, phone,
// and password fields. On successful registration, saves
// the JWT token via AuthContext and redirects to Home.
// Shows error messages for validation failures or duplicate emails.
// Includes a link to the Login page for existing users.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  // Form field state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // UI state for loading and error handling
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Auth context provides the register function
  const { register } = useAuth();

  // React Router navigation hook for redirecting after registration
  const navigate = useNavigate();

  // ==============================================
  // Handle Form Submission
  // ==============================================
  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent default form submission behavior
    setError(''); // Clear any previous error messages
    setLoading(true); // Show loading state on the button

    // Basic client-side validation for password length
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      // Call the register function from AuthContext
      // This sends POST /api/auth/register and saves the token
      await register(name, email, password, phone);

      // On success, redirect to the home page
      navigate('/map');
    } catch (err) {
      // Display the error message from the server, or a fallback
      setError(
        err.response?.data?.message || 'Registration failed. Please try again.'
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
          <div className="auth-logo">🛡️</div>
          <h1 className="auth-title">Join the Network</h1>
          <p className="auth-subtitle">
            Create your account to start reporting and receiving alerts
          </p>
        </div>

        {/* Error message display — shown only when there's an error */}
        {error && (
          <div className="error-message" id="register-error">
            ⚠️ {error}
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit}>
          {/* Full Name Field */}
          <div className="form-group">
            <label htmlFor="register-name" className="form-label">
              Full Name
            </label>
            <input
              id="register-name"
              type="text"
              className="form-input"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>

          {/* Email Field */}
          <div className="form-group">
            <label htmlFor="register-email" className="form-label">
              Email Address
            </label>
            <input
              id="register-email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          {/* Phone Number Field — Optional */}
          <div className="form-group">
            <label htmlFor="register-phone" className="form-label">
              Phone Number <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              id="register-phone"
              type="tel"
              className="form-input"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
          </div>

          {/* Password Field */}
          <div className="form-group">
            <label htmlFor="register-password" className="form-label">
              Password
            </label>
            <input
              id="register-password"
              type="password"
              className="form-input"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          {/* Submit Button — shows spinner while loading */}
          <button
            id="register-submit"
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Footer with link to Login page */}
        <div className="auth-footer">
          Already have an account?{' '}
          <Link to="/login">Sign in here</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
