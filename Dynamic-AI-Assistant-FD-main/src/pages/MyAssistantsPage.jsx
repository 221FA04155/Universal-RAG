import React, { useState, useEffect } from 'react';
import { fetchWithTimeout } from '../utils/api';

function MyAssistantsPage({ onSelectAssistant, onCreateNew, onBack }) {
  const [assistants, setAssistants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ totalVectors: 0, activeUnits: 0, sources: 0 });

  useEffect(() => {
    fetchAssistants();
  }, []);

  const fetchAssistants = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetchWithTimeout('/api/assistants', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Neural API rejected the assistant retrieval request.');
      }

      const data = await response.json();
      const list = data.assistants || [];
      setAssistants(list);

      // Compute real-time stats
      const totalV = list.reduce((acc, curr) => acc + (curr.documents_count || 0), 0);
      const uniqueSources = new Set(list.map(a => a.data_source_type)).size;
      setStats({ totalVectors: totalV, activeUnits: list.length, sources: uniqueSources });
    } catch (err) {
      console.error('Error fetching assistants:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (assistantId, event) => {
    event.stopPropagation();

    try {
      const response = await fetchWithTimeout(`/api/assistants/${assistantId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to purge assistant from the neural grid.');
      }
      fetchAssistants();
    } catch (err) {
      console.error('Error deleting assistant:', err);
      alert('PURGE ERROR: ' + err.message);
    }
  };

  const handleDeleteFile = async (assistantId, filename, event) => {
    event.stopPropagation();

    try {
      const response = await fetchWithTimeout(`/api/assistants/${assistantId}/files/${filename}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to decommission dataset from the repository.');
      }
      fetchAssistants();
    } catch (err) {
      console.error('Error deleting file:', err);
      alert('PURGE ERROR: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-main)'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid var(--border-main)',
          borderTopColor: 'var(--accent-primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '20px'
        }}></div>
        <p style={{ fontWeight: '800', color: 'var(--accent-navy)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.8rem' }}>
          Synchronizing Neural Grid...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const filteredTableData = assistants.flatMap(a =>
    (a.uploaded_files || []).map(file => ({
      ...a,
      filename: file
    }))
  ).filter(item =>
    item.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ background: 'var(--bg-main)', minHeight: '100vh', paddingBottom: '100px' }}>
      <div className="container">
        <div className="page-header">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-tertiary)',
                fontWeight: '800',
                fontSize: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '12px',
                letterSpacing: '0.05em'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              DASHBOARD
            </button>
            <h1>Intelligence Units</h1>
            <p style={{ color: 'var(--text-secondary)', fontWeight: '600', fontSize: '0.95rem' }}> Manage your active neural workspaces and datasets.</p>
          </div>
          <button
            onClick={onCreateNew}
            className="ent-btn-primary"
            style={{ padding: '10px 20px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            INITIALIZE NEW HUB
          </button>
        </div>

        {error && (
          <div className="system-alert-banner">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            SYSTEM ALERT: {error}
          </div>
        )}

        {/* Command Search */}
        <div className="dashboard-controls">
          <div className="search-bar-wrapper">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Search Intelligence Units & Datasets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="dashboard-search-input"
            />
          </div>
        </div>

        {assistants.length === 0 ? (
          <div className="empty-state-card">
            <div className="empty-icon-box">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            </div>
            <h2>Empty Context Space</h2>
            <p>No active intelligence units detected. Initialize your first specialized neural hub to begin.</p>
          </div>
        ) : (
          <div className="assistants-grid">
            {assistants
              .filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map(assistant => (
                <div
                  key={assistant.assistant_id}
                  className="assistant-card"
                  onClick={() => onSelectAssistant(assistant.assistant_id, assistant.name)}
                >
                  <div className="assistant-card-header">
                    <div className="assistant-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                      </svg>
                    </div>
                    <button
                      className="assistant-delete-btn"
                      onClick={(e) => handleDelete(assistant.assistant_id, e)}
                      title="Decommission Intelligence Unit"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                  <div className="assistant-card-body">
                    <h3>{assistant.name}</h3>
                    <div className="assistant-meta">
                      <span className="ent-badge" style={{ fontSize: '0.65rem', padding: '4px 10px' }}>{assistant.data_source_type.toUpperCase()}</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-tertiary)' }}>{assistant.documents_count} DATA VECTORS</span>
                    </div>
                    <div className="assistant-card-footer">
                      <span className="initialized-date">
                        INITIALIZED: {new Date(assistant.created_at).toLocaleDateString()}
                      </span>
                      <span className="sync-action">SYNC →</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Data Repository Section */}
        <div style={{ marginTop: '80px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--accent-navy)', marginBottom: '8px' }}>Neural Data Repository</h2>
              <p style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>Centralized storage for all successfully indexed datasets and documents.</p>
            </div>
            <div className="ent-badge live-status" style={{ background: 'var(--bg-surface)', color: 'var(--accent-primary)', border: '1.5px solid var(--accent-primary)', gap: '10px' }}>
              <div style={{ width: '8px', height: '8px', background: 'var(--accent-success)', borderRadius: '50%', boxShadow: '0 0 8px var(--accent-success)', animation: 'pulse 2s infinite' }}></div>
              AUTOMATIC TRACKING ACTIVE
            </div>
          </div>

          <div className="table-responsive-wrapper">
            <table className="neural-data-table">
              <thead>
                <tr>
                  <th>Dataset Name</th>
                  <th>Source Unit</th>
                  <th>Type</th>
                  <th>Stored Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTableData.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="table-empty-msg">
                      {searchQuery ? `No datasets matching "${searchQuery}" detected.` : "No stored data detected in the neural grid."}
                    </td>
                  </tr>
                ) : (
                  filteredTableData.map((item, idx) => (
                    <tr key={`${item.assistant_id}-${item.filename}-${idx}`} onClick={() => onSelectAssistant(item.assistant_id, item.name)}>
                      <td style={{ padding: '12px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                            <polyline points="13 2 13 9 20 9"></polyline>
                          </svg>
                          <span style={{ fontWeight: '700', color: 'var(--accent-navy)', fontSize: '0.85rem' }}>{item.filename}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 24px' }}><span className="source-unit-link" style={{ fontSize: '0.85rem' }}>{item.name}</span></td>
                      <td style={{ padding: '12px 24px' }}>
                        <span className="source-type-pill" style={{ fontSize: '0.6rem' }}>{item.data_source_type.toUpperCase()}</span>
                      </td>
                      <td style={{ padding: '12px 24px', fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: '700' }}>{new Date(item.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '12px 24px' }}>
                        <div className="status-indicator">
                          <div className="status-dot"></div>
                          STORED
                        </div>
                      </td>
                      <td style={{ padding: '12px 24px' }}>
                        <button
                          className="icon-btn"
                          onClick={(e) => handleDeleteFile(item.assistant_id, item.filename, e)}
                          title="Purge Dataset"
                          style={{
                            color: 'var(--accent-danger)',
                            padding: '6px',
                            background: 'rgba(239, 68, 68, 0.05)',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0.4; transform: scale(0.9); }
        }
        .table-empty-msg {
          padding: 40px !important;
          text-align: center;
          color: var(--text-tertiary);
          font-weight: 700;
          font-size: 0.9rem;
          background: var(--bg-surface);
        }
      `}</style>
    </div>
  );
}

export default MyAssistantsPage;
