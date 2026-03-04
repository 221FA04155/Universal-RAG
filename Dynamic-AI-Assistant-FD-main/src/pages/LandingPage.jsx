import React from 'react'

function LandingPage({ onGetStarted, onSelectUseCase, isAuthenticated }) {
  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-bg-overlay"></div>

        <div className="hero-content">
          {/* Badge */}
          <div className="ent-badge" style={{ marginBottom: '32px' }}>
            <span className="pulse-indicator"></span>
            AI-POWERED KNOWLEDGE PLATFORM
          </div>

          {/* Main Headline */}
          <h1 className="hero-headline">
            Transform Your Enterprise Data Into<br />
            <span>Intelligent Conversations</span>
          </h1>

          {/* Subheadline */}
          <p className="hero-subheadline">
            Create custom AI assistants that understand your business domain.
            Upload CSV or JSON datasets, connect URLs, and get instant, accurate insights through high-context RAG.
          </p>

          {/* CTA Buttons */}
          <div className="hero-actions">
            <button onClick={onGetStarted} className="ent-btn-primary" style={{ padding: '16px 40px', fontSize: '1.1rem' }}>
              Get Started Free
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
            <button
              className="ent-btn-secondary"
              style={{ padding: '16px 40px', fontSize: '1.1rem' }}
              onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
            >
              Learn More
            </button>
          </div>

          {/* Stats */}
          <div className="hero-stats">
            {[
              { value: '10K+', label: 'Active Users' },
              { value: '50M+', label: 'Queries Answered' },
              { value: '99.9%', label: 'Platform Uptime' }
            ].map((stat, idx) => (
              <div key={idx} className="stat-item">
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trusted By */}
      <section style={{ padding: '60px 0 100px', textAlign: 'center', background: 'white' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '48px' }}>
          TRUSTED BY INNOVATIVE TEAMS AT
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '80px', flexWrap: 'wrap', opacity: 0.4, alignItems: 'center' }}>
          {['Acme Corp', 'GlobalTech', 'Nebula Inc', 'FutureSoft', 'BlueSky'].map((name, i) => (
            <span key={i} style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--accent-navy)', letterSpacing: '-0.02em' }}>{name}</span>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" style={{ padding: '120px 24px', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '80px' }}>
            <h2 className="ent-section-title">Built for Performance</h2>
            <p className="ent-subtitle">Everything you need to deploy enterprise-grade AI assistants.</p>
          </div>

          <div className="feature-grid">
            {[
              {
                title: 'Instant Data Indexing',
                description: 'Go from raw PDF or JSON to a functional assistant in seconds. Our engine handles the heavy lifting of vector conversion.'
              },
              {
                title: 'High-Fidelity RAG',
                description: 'Proprietary retrieval algorithms ensure the assistant only speaks from your data, minimizing hallucinations.'
              },
              {
                title: 'Real-time Analytics',
                description: 'Visualize data distributions and query patterns directly within the dashboard for better business intelligence.'
              },
              {
                title: 'Security-First Architecture',
                description: 'Data is isolated and encrypted at rest. We provide private workspace environments for sensitive enterprise data.'
              },
              {
                title: 'Multi-Source Integration',
                description: 'Connect local files, cloud storage, or public URLs to build a unified knowledge mesh for your team.'
              },
              {
                title: 'Neural Fine-Tuning',
                description: 'Customize assistant behavior, tone, and system instructions to match your corporate brand guidelines.'
              }
            ].map((feature, idx) => (
              <div key={idx} className="ent-card">
                <div className="feature-icon-box">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                  </svg>
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '12px', color: 'var(--accent-navy)', letterSpacing: '-0.01em' }}>
                  {feature.title}
                </h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.95rem' }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section id="use-cases" style={{ padding: '120px 24px', background: 'white' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '80px' }}>
            <h2 className="ent-section-title">Industrial Solutions</h2>
            <p className="ent-subtitle">Optimized neural architectures for mission-critical business domains.</p>
          </div>
          <div className="solutions-grid">
            {[
              { title: 'Legal & Compliance', desc: 'Accelerate contract review and verify regulatory compliance with semantic search and extraction.', color: '#3B82F6' },
              { title: 'Financial Analytics', desc: 'Analyze quarterly reports, detect budget anomalies, and synthesize fiscal trends in real-time.', color: '#10B981' },
              { title: 'Research & R&D', desc: 'Query vast repositories of scientific journals and technical documentations to speed up discovery.', color: '#F59E0B' }
            ].map((useCase, idx) => (
              <div
                key={idx}
                onClick={() => onSelectUseCase && onSelectUseCase(useCase)}
                className="solution-card-wrapper"
              >
                <div className="ent-card solution-card" style={{ borderBottomColor: useCase.color }}>
                  <div style={{ background: useCase.color, width: '40px', height: '40px', borderRadius: '12px', marginBottom: '24px', opacity: 0.1 }}></div>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '16px', color: 'var(--accent-navy)', letterSpacing: '-0.02em' }}>{useCase.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '32px', fontSize: '1rem' }}>{useCase.desc}</p>
                  <div className="deploy-link" style={{ color: useCase.color }}>
                    DEPLOY WORKSPACE
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" style={{ padding: '120px 24px', background: 'var(--bg-secondary)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '80px' }}>
            <h2 className="ent-section-title">Investment Plans</h2>
            <p className="ent-subtitle">Transparent licensing for organizations of all scales.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
            {[
              { title: 'Essential', price: '$49', features: ['3 Digital Assistants', '1GB Neural Memory', 'Standard Support'] },
              { title: 'Professional', price: '$149', features: ['10 Digital Assistants', '10GB Neural Memory', 'Priority Support', 'API Access'], featured: true },
              { title: 'Enterprise', price: 'Custom', features: ['Unlimited Assistants', 'Private Neural Mesh', 'Dedicated Account Manager', 'SLA Guarantee'] }
            ].map((plan, idx) => (
              <div key={idx} className="ent-card" style={{
                border: plan.featured ? '2px solid var(--accent-primary)' : '1px solid var(--border-main)',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {plan.featured && <div className="ent-badge" style={{ alignSelf: 'center', marginBottom: '16px' }}>MOST POPULAR</div>}
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '8px', color: 'var(--accent-navy)' }}>{plan.title}</h3>
                <div style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--accent-primary)', marginBottom: '24px' }}>
                  {plan.price}<span style={{ fontSize: '1rem', color: 'var(--text-tertiary)', fontWeight: '600' }}>{plan.price !== 'Custom' ? '/mo' : ''}</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, marginBottom: '32px', flex: 1 }}>
                  {plan.features.map((f, i) => (
                    <li key={i} style={{ marginBottom: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button className={plan.featured ? 'ent-btn-primary' : 'ent-btn-secondary'} style={{ width: '100%' }}>
                  {plan.title === 'Enterprise' ? 'Contact Sales' : 'Start Free Trial'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{ padding: '120px 24px', background: 'var(--bg-surface)' }}>
        <div className="cta-block">
          <div style={{ flex: 1, minWidth: '300px', textAlign: 'left', position: 'relative', zIndex: 1 }}>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.75rem)', fontWeight: '800', marginBottom: '20px', letterSpacing: '-0.04em', lineHeight: '1.1' }}>
              Empower Your Team With<br />Data Intelligence
            </h2>
            <p style={{ fontSize: '1.15rem', opacity: 0.8, lineHeight: '1.6', maxWidth: '500px' }}>
              Ready to deploy your first cross-domain knowledge base?
              Join 500+ enterprises leveraging DataMind today.
            </p>
          </div>
          <button onClick={onGetStarted} style={{
            background: 'white',
            color: 'var(--accent-navy)',
            border: 'none',
            padding: '20px 48px',
            fontSize: '1.1rem',
            fontWeight: '800',
            borderRadius: '14px',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            whiteSpace: 'nowrap',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
            position: 'relative',
            zIndex: 1
          }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.15)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)';
            }}
          >
            Create Your Assistant
          </button>
        </div>
      </section>
    </div>
  )
}

export default LandingPage
