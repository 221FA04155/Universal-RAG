import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../utils/AuthContext';

function LoginPage({ onSignupClick, onLoginSuccess, onHomeClick }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const emailRef = useRef(null);
  const { login } = useAuth();

  useEffect(() => {
    // Focus removed to allow clean page load without triggering popups
    /*
    if (emailRef.current) {
      emailRef.current.focus();
    }
    */
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Strict Email Validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid and properly formatted email address (e.g., name@company.com).');
      return;
    }

    setLoading(true);

    try {
      await login(email, password);
      // Immediately redirect - no delay needed
      onLoginSuccess();
    } catch (err) {
      setError(err.message || 'Invalid email or password. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-box">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </div>
          <h1 className="auth-title">Secure Login</h1>
          <p className="auth-tagline">Access your intelligent digital workspace</p>
        </div>

        {error && (
          <div className="auth-error-panel" style={{ borderRadius: '12px', marginBottom: '20px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="auth-form-group">
            <div className="auth-field-wrapper">
              <input
                ref={emailRef}
                type="email"
                className="auth-input-refined"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="auth-form-group">
            <div className="auth-field-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                className="auth-input-refined"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Secure Password"
                required
                disabled={loading}
                style={{ paddingRight: '48px' }}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94A3B8',
                  padding: '4px',
                  display: 'flex',
                  transition: 'color 0.2s',
                  zIndex: 2
                }}
                className="eye-toggle-btn"
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                )}
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                type="button"
                className="auth-action-link"
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: '500',
                  color: '#64748B',
                  opacity: 0.9,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.color = 'var(--accent-primary)'}
                onMouseLeave={(e) => e.target.style.color = '#64748B'}
                onClick={(e) => e.preventDefault()}
              >
                Forgot password?
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-auth-primary"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          {loading && (
            <p className="auth-status-message">
              Establishing encrypted connection...
            </p>
          )}
        </form>

        <div className="auth-footer-refined">
          <p className="auth-footer-text">
            Don't have an account?{' '}
            <button
              onClick={onSignupClick}
              disabled={loading}
              className="auth-action-link"
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
