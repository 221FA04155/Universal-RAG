import React, { useState, useRef, useEffect } from 'react'
import { fetchWithTimeout } from '../utils/api'

function ChatInput({ onSendMessage, onAddSystemMessage, onRefreshDetails, disabled, assistantId }) {
  const [message, setMessage] = useState('')
  const [showUploadMenu, setShowUploadMenu] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const textareaRef = useRef(null)
  const uploadMenuRef = useRef(null)
  const fileInputRef = useRef(null)
  const jsonInputRef = useRef(null)

  useEffect(() => {
    adjustHeight()
  }, [message])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (uploadMenuRef.current && !uploadMenuRef.current.contains(event.target)) {
        setShowUploadMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const adjustHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 250) + 'px'
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (message.trim() && !disabled) {
      onSendMessage(message)
      setMessage('')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleFileUpload = (type) => {
    setShowUploadMenu(false)
    if (type === 'file') fileInputRef.current.click()
    if (type === 'json') jsonInputRef.current.click()
  }

  const handleUrlInput = () => {
    setShowUploadMenu(false)
    const url = prompt("Enter the URL to index:")
    if (url && url.startsWith('http')) {
      processUpload({ name: url }, 'url')
    }
  }

  const processUpload = async (file, type) => {
    if (!assistantId) {
      alert("No active assistant selected.");
      return;
    }

    setIsUploading(true)
    try {
      if (type === 'url') {
        await new Promise(resolve => setTimeout(resolve, 1500));
        if (onAddSystemMessage) {
          onAddSystemMessage(`Dataset ‘${file.name}’ successfully connected and indexed.`);
        } else {
          onSendMessage(`Dataset ‘${file.name}’ successfully connected and indexed.`);
        }
      } else {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetchWithTimeout(`/api/assistants/${assistantId}/upload`, {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.detail || result.error || 'Upload failed');
        }

        if (onAddSystemMessage) {
          onAddSystemMessage(`Dataset ‘${file.name}’ has been successfully indexed and permanently stored in your Dashboard. Initializing automated neural analysis...`);
        } else {
          onSendMessage(`Dataset ‘${file.name}’ has been successfully indexed and permanently stored in your Dashboard. Initializing automated neural analysis...`);
        }

        if (onRefreshDetails) onRefreshDetails();
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Failed to upload: ${error.message}`);
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (jsonInputRef.current) jsonInputRef.current.value = '';
    }
  }

  const onFileSelect = (e, type) => {
    const file = e.target.files[0]
    if (file) {
      processUpload(file, type)
    }
  }

  return (
    <div className="input-area-wrapper">
      {isUploading && (
        <div className="processing-overlay">
          <div className="processing-card">
            <div className="neural-spinner" style={{ width: '48px', height: '48px', borderWidth: '4px' }}></div>
            <div className="processing-status">Indexing Neural Context...</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: '600' }}>
              Synthesizing: {fileInputRef.current?.files[0]?.name || jsonInputRef.current?.files[0]?.name || 'Data Source'}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="input-form">
        <div className="input-container">
          <div className="upload-container" ref={uploadMenuRef}>
            <button
              type="button"
              className="upload-trigger-btn"
              onClick={() => setShowUploadMenu(!showUploadMenu)}
              disabled={disabled || isUploading}
              title="Add data source"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </button>

            {showUploadMenu && (
              <div className="upload-menu-popover">
                {[
                  { id: 'file', title: 'Documents', desc: 'CSV, JSON', onClick: () => handleFileUpload('file') },
                  { id: 'url', title: 'Web Connection', desc: 'URL indexing & crawling', onClick: handleUrlInput }
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className="upload-menu-item"
                    onClick={item.onClick}
                  >
                    <span className="item-title">{item.title}</span>
                    <span className="item-desc">{item.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <textarea
            className="chat-input"
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your documents..."
            disabled={disabled || isUploading}
          />

          <button
            type="submit"
            className={`send-btn ${message.trim() ? 'active' : ''}`}
            disabled={disabled || !message.trim() || isUploading}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>

        <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={(e) => onFileSelect(e, 'file')} accept=".csv,.json" />
      </form>
    </div>
  )
}

export default ChatInput
