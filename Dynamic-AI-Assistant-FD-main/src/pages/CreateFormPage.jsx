import React, { useState, useEffect } from 'react'
import { fetchWithTimeout } from '../utils/api'

function CreateFormPage({ onBack, onSuccess, initialData }) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    dataSourceType: 'csv',
    file: null,
    dataUrl: '',
    customInstructions: initialData?.customInstructions || 'You are a professional Enterprise AI Assistant. Provide accurate, context-aware analysis based solely on the connected documentation and data sources.',
    enableStatistics: true,
    enableAlerts: false,
    enableRecommendations: false
  })

  const [fileName, setFileName] = useState('Choose a file...')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleDataSourceTypeChange = (value) => {
    setFormData(prev => ({
      ...prev,
      dataSourceType: value
    }))
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setFormData(prev => ({ ...prev, file }))
      setFileName(file.name)
    } else {
      setFormData(prev => ({ ...prev, file: null }))
      setFileName('Choose a file...')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const formDataToSend = new FormData()
      formDataToSend.append('name', formData.name)
      formDataToSend.append('data_source_type', formData.dataSourceType)

      if (formData.dataSourceType === 'url') {
        formDataToSend.append('data_source_url', formData.dataUrl)
      } else if (formData.file) {
        formDataToSend.append('file', formData.file)
      }

      formDataToSend.append('custom_instructions', formData.customInstructions)
      formDataToSend.append('enable_statistics', formData.enableStatistics)
      formDataToSend.append('enable_alerts', formData.enableAlerts)
      formDataToSend.append('enable_recommendations', formData.enableRecommendations)

      const response = await fetchWithTimeout('/api/assistants/create', {
        method: 'POST',
        body: formDataToSend,
        credentials: 'include'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.error || 'Enterprise API rejected the creation request')
      }

      const result = await response.json()
      onSuccess(result.assistant_id, result.name)

    } catch (error) {
      console.error('Error creating assistant:', error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-page" style={{ padding: '40px 24px', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontWeight: '700',
            fontSize: '0.9rem',
            marginBottom: '24px',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => e.target.style.color = 'var(--accent-primary)'}
          onMouseOut={(e) => e.target.style.color = 'var(--text-secondary)'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          RETURN TO DASHBOARD
        </button>

        <div className="auth-card" style={{ maxWidth: 'none', padding: '32px' }}>
          <div className="auth-logo" style={{ textAlign: 'left', marginBottom: '24px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'var(--accent-navy)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              marginBottom: '20px'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            </div>
            <h1 className="auth-title" style={{ fontSize: '1.5rem', marginBottom: '4px' }}>Configure Intelligence Hub</h1>
            <p className="auth-tagline" style={{ fontSize: '0.85rem' }}>Initialize a new neural vector space for specialized data analysis.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="input-wrapper">
              <label className="input-label" htmlFor="name">Assistant Identity *</label>
              <input
                className="auth-input"
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., Financial Audit Neural Layer"
                required
                maxLength="100"
              />
            </div>

            <div className="input-wrapper">
              <label className="input-label">Core Data Protocols *</label>
              <div className="source-selector">
                {[
                  { id: 'csv', label: 'CSV Data', icon: '📊' },
                  { id: 'json', label: 'JSON API', icon: '🔗' },
                  { id: 'url', label: 'Web Scrape', icon: '🌐' }
                ].map(type => (
                  <label key={type.id} className="source-item">
                    <input
                      type="radio"
                      name="dataSourceType"
                      value={type.id}
                      checked={formData.dataSourceType === type.id}
                      onChange={() => handleDataSourceTypeChange(type.id)}
                    />
                    <span style={{ fontSize: '1.2rem' }}>{type.icon}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800' }}>{type.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="ent-form-grid">
              {formData.dataSourceType !== 'url' ? (
                <div className="input-wrapper">
                  <label className="input-label" htmlFor="file-upload">Upload Vector Source *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="file"
                      id="file-upload"
                      style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 10 }}
                      accept={
                        formData.dataSourceType === 'csv' ? '.csv' :
                          formData.dataSourceType === 'json' ? '.json' :
                            '*'
                      }
                      onChange={handleFileChange}
                      required
                    />
                    <div style={{
                      padding: '16px',
                      background: 'var(--bg-main)',
                      border: '2px dashed var(--border-main)',
                      borderRadius: 'var(--radius-md)',
                      textAlign: 'center',
                      color: 'var(--text-secondary)',
                      fontWeight: '700'
                    }}>
                      {fileName}
                    </div>
                  </div>
                  <small className="form-hint">MAX SECURE UPLOAD: 100MB</small>
                </div>
              ) : (
                <div className="input-wrapper">
                  <label className="input-label" htmlFor="dataUrl">Production Website Endpoint *</label>
                  <input
                    className="auth-input"
                    type="url"
                    id="dataUrl"
                    name="dataUrl"
                    value={formData.dataUrl}
                    onChange={handleInputChange}
                    placeholder="https://enterprise.nexus/docs"
                    required
                  />
                  <small className="form-hint">Secure SSL connection required for external crawling.</small>
                </div>
              )}

              <div className="input-wrapper">
                <label className="input-label" htmlFor="customInstructions">Behavioral Logic & Constraints</label>
                <textarea
                  className="auth-textarea"
                  id="customInstructions"
                  name="customInstructions"
                  value={formData.customInstructions}
                  onChange={handleInputChange}
                  placeholder="Define restricted domains, preferred terminology, and analysis depth."
                />
              </div>
            </div>

            <label className="input-label" style={{ marginBottom: '16px' }}>Advanced Module Configuration</label>
            <div className="ent-form-grid" style={{ marginBottom: '24px' }}>
              <label className="checkbox-premium">
                <input
                  type="checkbox"
                  name="enableStatistics"
                  checked={formData.enableStatistics}
                  onChange={handleInputChange}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--accent-navy)' }}>Intelligence Analytics</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Quantitative data synthesis and distribution modeling.</span>
                </div>
              </label>
              <label className="checkbox-premium">
                <input
                  type="checkbox"
                  name="enableAlerts"
                  checked={formData.enableAlerts}
                  onChange={handleInputChange}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--accent-navy)' }}>Anomaly Detection</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Real-time pattern shift and structural outlier alerts.</span>
                </div>
              </label>
            </div>

            <div style={{
              marginTop: '48px',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '16px',
              borderTop: '1px solid var(--border-soft)',
              paddingTop: '32px'
            }}>
              <button
                type="button"
                className="ent-btn-secondary"
                onClick={onBack}
                disabled={isLoading}
                style={{
                  background: 'none',
                  border: '1px solid var(--border-main)',
                  color: 'var(--text-secondary)',
                  padding: '14px 24px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                DISCARD
              </button>
              <button
                type="submit"
                className="ent-btn-primary"
                disabled={isLoading}
              >
                {isLoading ? 'INITIALIZING HUB...' : 'DEPLOY INTELLIGENCE HUB'}
              </button>
            </div>

            {error && (
              <div style={{
                marginTop: '24px',
                padding: '16px',
                background: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid var(--accent-danger)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--accent-danger)',
                fontSize: '0.85rem',
                fontWeight: '700',
                textAlign: 'center'
              }}>
                PROTOCOL ERROR: {error}
              </div>
            )}
          </form>
        </div>
      </div>
      {isLoading && (
        <div className="processing-overlay">
          <div className="processing-card">
            <div className="neural-spinner" style={{ width: '48px', height: '48px', borderWidth: '4px' }}></div>
            <div className="processing-status">Deploying Neural Hub...</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: '600', maxWidth: '300px' }}>
              Initializing dedicated vector space and behavioral logic constraints.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default CreateFormPage
