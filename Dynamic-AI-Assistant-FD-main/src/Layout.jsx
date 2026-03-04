import React from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

const Layout = ({ children, onHomeClick, onCreateClick, onMyAssistantsClick, onLoginClick, onSignupClick, onLogoutClick, user, isAuthenticated, showFooter }) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'transparent' }}>
            <Navbar
                onHomeClick={onHomeClick}
                onCreateClick={onCreateClick}
                onMyAssistantsClick={onMyAssistantsClick}
                onLoginClick={onLoginClick}
                onSignupClick={onSignupClick}
                onLogoutClick={onLogoutClick}
                user={user}
                isAuthenticated={isAuthenticated}
            />
            {/* Main content wrapper */}
            {/* We don't apply padding by default because pages often manage their own, 
                just ensure it fills the space */}
            <main style={{ flex: 1, paddingTop: '70px', display: 'flex', flexDirection: 'column' }}>
                {children}
            </main>
            {showFooter && <Footer />}
        </div>
    );
};

export default Layout;
