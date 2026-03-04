import React, { useState, useEffect, useCallback, useRef } from 'react'
import { AuthProvider, useAuth } from './utils/AuthContext'
import Navbar from './components/Navbar'
import LandingPage from './pages/LandingPage'
import CreateFormPage from './pages/CreateFormPage'
import ChatPage from './pages/ChatPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import Layout from './Layout'
import { fetchWithTimeout } from './utils/api'

function AppContent() {
  const [currentAssistant, setCurrentAssistant] = useState(() => {
    try {
      const savedAssistant = localStorage.getItem('currentAssistant')
      return savedAssistant ? JSON.parse(savedAssistant) : null
    } catch (e) {
      console.warn("Failed to parse currentAssistant from localStorage:", e)
      return null
    }
  })

  const [currentPage, setCurrentPage] = useState(() => {
    const savedPage = localStorage.getItem('currentPage') || 'landing'
    const savedAssistant = localStorage.getItem('currentAssistant')
    if (savedPage === 'chat' && !savedAssistant) return 'landing'
    const validPages = ['landing', 'login', 'signup', 'create', 'chat']
    if (!validPages.includes(savedPage)) return 'landing'
    return savedPage
  })

  const { user, loading, logout, isAuthenticated } = useAuth()

  useEffect(() => {
    console.log("App State Update:", { currentPage, isAuthenticated, userEmail: user?.email, loading });
  }, [currentPage, isAuthenticated, user, loading]);

  useEffect(() => {
    // Version guard: clear stale localStorage from old sessions
    const storedVersion = localStorage.getItem('appVersion')
    const APP_VERSION = '1.2'
    if (storedVersion !== APP_VERSION) {
      console.log("App version mismatch, clearing storage...");
      localStorage.removeItem('currentPage')
      localStorage.removeItem('currentAssistant')
      localStorage.setItem('appVersion', APP_VERSION)
      setCurrentPage('landing')
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('currentPage', currentPage)
  }, [currentPage])

  useEffect(() => {
    if (currentAssistant) {
      localStorage.setItem('currentAssistant', JSON.stringify(currentAssistant))
    } else {
      localStorage.removeItem('currentAssistant')
    }
  }, [currentAssistant])

  const [initialFormState, setInitialFormState] = useState(null)
  const hasRedirected = useRef(false)

  const navigateToLanding = () => {
    setCurrentPage('landing')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const navigateToCreateForm = () => {
    if (!isAuthenticated) {
      setCurrentPage('login')
      return
    }
    // If we came from model selection or direct, keep initialFormState if set, 
    // or maybe we should only clear it if we want "New Blank Assistant".
    // For now, let's assume if I click "Create Assistant" in nav, I want blank.
    // But wait, navigateToCreateForm is called after model selection too.
    // Let's rely on handleUseCaseSelect to set it, and if it's null, CreateForm uses default.
    // But if I click "Create Assistant" in navbar -> Model Selection -> Create Form, it should be blank.
    // So distinct function for "Start New Blank"? 
    // Let's clear initialFormState in navigateToModelSelection UNLESS we are coming from UseCaseSelect.
    // This is fetching complicated.
    // Simpler: handleUseCaseSelect sets state and navigates.
    // navigateToModelSelection (from Navbar) clears state and navigates.
    setCurrentPage('create')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const navigateToModelSelection = () => {
    if (!isAuthenticated) {
      setCurrentPage('login')
      return
    }
    setInitialFormState(null) // Reset for fresh flow
    setCurrentPage('create')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleUseCaseSelect = (useCase) => {
    if (!isAuthenticated) {
      setCurrentPage('login')
      return
    }
    setInitialFormState({
      name: `${useCase.title} Assistant`,
      customInstructions: `${useCase.desc}\n\nPlease act as a specialist in ${useCase.title}. Analyze the provided data with a focus on industry standards and best practices.`
    })
    setCurrentPage('create')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }


  const navigateToChat = useCallback((assistantId, assistantName) => {
    setCurrentAssistant({ id: assistantId, name: assistantName })
    setCurrentPage('chat')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const navigateToLogin = useCallback(() => {
    setCurrentPage('login')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const navigateToSignup = useCallback(() => {
    setCurrentPage('signup')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const navigateToMyAssistants = useCallback(() => {
    if (!isAuthenticated) {
      setCurrentPage('login')
      return
    }
    setCurrentPage('landing') // Default fallback since dashboard is gone
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [isAuthenticated])


  const isGettingStarted = useRef(false);

  const handleGetStarted = useCallback(async (forceAuth = false) => {
    if (!isAuthenticated && !forceAuth) {
      setCurrentPage('login')
      return
    }

    if (isGettingStarted.current) return;
    isGettingStarted.current = true;

    // Try to find the latest assistant to resume work
    try {
      const response = await fetchWithTimeout('/api/assistants', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        if (data.assistants && data.assistants.length > 0) {
          const latest = data.assistants[0];
          isGettingStarted.current = false; // Reset BEFORE navigation
          navigateToChat(latest.assistant_id, latest.name);
          return;
        }
      }
      setCurrentPage('create');
    } catch (error) {
      console.error("Error navigating to latest assistant:", error);
      setCurrentPage('create');
    } finally {
      isGettingStarted.current = false;
    }
  }, [isAuthenticated, navigateToChat])

  const handleLogout = async () => {
    await logout()
    localStorage.removeItem('currentPage')
    localStorage.removeItem('currentAssistant')
    setInitialFormState(null)
    navigateToLanding()
  }

  const [showSlowLoadingMessage, setShowSlowLoadingMessage] = useState(false);

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        setShowSlowLoadingMessage(true);
      }, 8000); // Show message after 8 seconds
      return () => clearTimeout(timer);
    } else {
      setShowSlowLoadingMessage(false);
    }
  }, [loading]);

  useEffect(() => {
    if (!loading && isAuthenticated && !hasRedirected.current) {
      // Only auto-redirect if on a non-workspace page
      if (['landing', 'login', 'signup'].includes(currentPage)) {
        hasRedirected.current = true
        handleGetStarted(true)
      }
    }
    // Reset redirect flag on logout
    if (!loading && !isAuthenticated) {
      hasRedirected.current = false
    }
    // Safety: if on 'chat' page but no assistant is set, go to landing
    if (!loading && currentPage === 'chat' && !currentAssistant) {
      setCurrentPage('landing')
    }
  }, [isAuthenticated, loading, currentPage, currentAssistant, handleGetStarted]);

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-main)',
        gap: '24px'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          background: 'var(--accent-navy)',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(15, 23, 42, 0.2)',
          animation: 'pulse 2s infinite'
        }}>
          <span style={{ color: 'white', fontWeight: '900', fontSize: '2rem' }}>D</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--accent-navy)', letterSpacing: '-0.5px' }}>
            Data<span style={{ color: 'var(--accent-primary)' }}>Mind</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            INITIALIZING SECURE WORKSPACE
          </div>
        </div>
      </div>
    )
  }

  return (
    <Layout
      onHomeClick={navigateToLanding}
      onCreateClick={handleGetStarted}
      onMyAssistantsClick={navigateToMyAssistants}
      onLoginClick={navigateToLogin}
      onLogoutClick={handleLogout}
      onSignupClick={navigateToSignup}
      user={user}
      isAuthenticated={isAuthenticated}
      showFooter={currentPage === 'landing' && !isAuthenticated}
    >
      <div className="app-content-wrapper">
        {currentPage === 'landing' && (
          <LandingPage
            onGetStarted={handleGetStarted}
            onSelectUseCase={handleUseCaseSelect}
            isAuthenticated={isAuthenticated}
          />
        )}
        {currentPage === 'login' && (
          <LoginPage
            onSignupClick={navigateToSignup}
            onHomeClick={navigateToLanding}
            onLoginSuccess={() => {
              // Commit cookie, then enter workspace
              setTimeout(() => handleGetStarted(true), 100)
            }}
          />
        )}
        {currentPage === 'signup' && (
          <SignupPage
            onLoginClick={navigateToLogin}
            onSignupSuccess={() => {
              // Start fresh or go to workspace
              handleGetStarted(true)
            }}
          />
        )}
        {currentPage === 'create' && (
          <CreateFormPage
            onBack={navigateToLanding}
            onSuccess={navigateToChat}
            initialData={initialFormState}
          />
        )}
        {currentPage === 'chat' && currentAssistant && (
          <ChatPage
            assistantId={currentAssistant.id}
            assistantName={currentAssistant.name}
            onNewAssistant={navigateToCreateForm}
            onHome={navigateToLanding}
            onViewHistory={navigateToLanding}
          />
        )}

        {/* Catch-all: if no page matched, show landing */}
        {!['landing', 'login', 'signup', 'create', 'chat'].includes(currentPage) && (
          <LandingPage
            onGetStarted={handleGetStarted}
            onSelectUseCase={handleUseCaseSelect}
            isAuthenticated={isAuthenticated}
          />
        )}
      </div>
    </Layout>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
