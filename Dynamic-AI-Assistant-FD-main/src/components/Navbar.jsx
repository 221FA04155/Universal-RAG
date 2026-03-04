import React, { useState, useRef, useEffect } from 'react'

function Navbar({ onHomeClick, onCreateClick, onMyAssistantsClick, onLoginClick, onSignupClick, onLogoutClick, user, isAuthenticated }) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const profileRef = useRef(null)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const toggleProfileMenu = () => {
    setProfileMenuOpen(!profileMenuOpen)
  }

  const handleProfileMenuClick = (action) => {
    setProfileMenuOpen(false)
    setMobileMenuOpen(false)
    action()
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <nav className={`main-navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar-inner">
        {/* Logo */}
        <div onClick={onHomeClick} className="navbar-logo">
          <div className="logo-icon">D</div>
          <span className="logo-text">
            Data<span>Mind</span>
          </span>
        </div>

        {/* Desktop Navigation */}
        <div className="nav-links-desktop">
          {!isAuthenticated && (
            <>
              <button onClick={onHomeClick} className="nav-link no-style-btn" style={navLinkStyle}>Home</button>
              <a href="#features" className="nav-link" style={navLinkStyle}>Features</a>
              <a href="#use-cases" className="nav-link" style={navLinkStyle}>Solutions</a>
              <a href="#pricing" className="nav-link" style={navLinkStyle}>Pricing</a>
            </>
          )}

          {isAuthenticated ? (
            <div className="navbar-actions">
              <button
                className="ent-btn-primary"
                onClick={onCreateClick}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Create Assistant
              </button>

              <div ref={profileRef} style={{ position: 'relative' }}>
                <button onClick={toggleProfileMenu} className="profile-trigger">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </button>

                {profileMenuOpen && (
                  <div className="profile-dropdown ent-card">
                    <div className="dropdown-account">
                      <div className="dropdown-label">Account</div>
                      <div className="dropdown-email">{user?.email}</div>
                    </div>

                    <button onClick={() => handleProfileMenuClick(onLogoutClick)} className="dropdown-item logout">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button onClick={onLoginClick} className="ent-btn-primary">
              Sign In
            </button>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="mobile-menu-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div style={{
          position: 'fixed',
          top: '70px',
          left: 0,
          right: 0,
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-main)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 999
        }}>
          {!isAuthenticated && (
            <>
              <button onClick={() => handleProfileMenuClick(onHomeClick)} style={mobileLinkStyle}>Home</button>
              <a href="#features" onClick={() => setMobileMenuOpen(false)} style={mobileLinkStyle}>Features</a>
              <a href="#use-cases" onClick={() => setMobileMenuOpen(false)} style={mobileLinkStyle}>Solutions</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} style={mobileLinkStyle}>Pricing</a>
            </>
          )}
          {isAuthenticated ? (
            <>
              <button onClick={() => handleProfileMenuClick(onLogoutClick)} style={{ ...mobileLinkStyle, color: 'var(--accent-danger)' }}>Sign Out</button>
            </>
          ) : (
            <button onClick={() => handleProfileMenuClick(onLoginClick)} className="ent-btn-primary">Sign In</button>
          )}
        </div>
      )}

      <style>{`
        .nav-link:hover { color: var(--accent-primary) !important; }
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 900px) {
            .nav-links-desktop { display: none !important; }
            .mobile-menu-toggle { display: block !important; }
        }
      `}</style>
    </nav>
  )
}

const navLinkStyle = {
  fontSize: '0.85rem',
  fontWeight: '800',
  color: 'var(--text-secondary)',
  textDecoration: 'none',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em'
};

const menuButtonStyle = {
  width: '100%',
  padding: '12px 14px',
  textAlign: 'left',
  background: 'none',
  border: 'none',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  borderRadius: 'var(--radius-md)',
  fontSize: '0.9rem',
  transition: 'all 0.2s',
  fontWeight: '600',
  display: 'flex',
  alignItems: 'center'
};

const mobileLinkStyle = {
  background: 'none',
  border: 'none',
  textAlign: 'center',
  color: 'var(--accent-navy)',
  fontWeight: '800',
  fontSize: '1.1rem',
  padding: '16px',
  cursor: 'pointer',
  textDecoration: 'none'
};

export default Navbar
