import React, { useEffect, useRef } from 'react'

function ChatMessages({ messages, assistantName, isLoading, assistantDetails, onSampleQuestionClick }) {
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  const formatMessage = (text) => {
    if (!text) return '';

    // Enterprise-grade message formatting
    let formatted = text.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    // Markdown-like bold: **text**
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--accent-navy)">$1</strong>');

    // Bullet points: - item or * item
    formatted = formatted.replace(/^[-*]\s+(.*)/gm, '<div style="display:flex; gap:10px; margin-bottom:12px; padding-left:4px;"><span style="color:var(--accent-primary); font-weight:800">•</span><span style="flex:1">$1</span></div>');

    // Paragraph breaks (double newlines)
    formatted = formatted.replace(/\n\n/g, '</div><div style="margin-top:16px;">');

    // Single line breaks
    formatted = formatted.replace(/\n/g, '<br>');

    return `<div style="line-height:1.7;">${formatted}</div>`;
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  return (
    <div className="messages-container">
      {messages.length === 0 && !isLoading && (
        <div style={{ textAlign: 'center', padding: '100px 40px', maxWidth: '800px', margin: '0 auto' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-main)',
            margin: '0 auto 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-primary)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--accent-navy)', marginBottom: '12px', letterSpacing: '-0.04em' }}>
            DataMind Platform
          </h1>
          <p style={{ fontSize: '1rem', color: 'var(--text-tertiary)', lineHeight: '1.6', marginBottom: '40px', maxWidth: '500px', margin: '0 auto 40px' }}>
            Enterprise-grade intelligence for your documents. Upload data to begin analysis.
          </p>

          {/* Metadata and placeholders removed for a cleaner central workspace */}
        </div>
      )}

      {messages.map((message, index) => {
        const isUser = message.role === 'user'
        const avatarInitial = isUser ? 'U' : (assistantName ? assistantName.charAt(0).toUpperCase() : 'D')
        const time = formatTime(message.timestamp)

        return (
          <div key={index} className={`message-row ${message.role}`}>
            <div className="message-avatar">
              {avatarInitial}
            </div>

            <div className="message-bubble-wrapper" style={{ display: 'flex', flexDirection: 'column', maxWidth: '85%' }}>
              {!isUser && <span className="assistant-name-label">{assistantName || 'DataMind AI'}</span>}
              <div className="message-bubble">
                {(!message.content && message.isStreaming) ? (
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center', minHeight: '24px' }}>
                    <div className="typing-dot" style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor', opacity: 0.6, animation: 'pulse 1.5s infinite' }}></div>
                    <div className="typing-dot" style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor', opacity: 0.6, animation: 'pulse 1.5s infinite 0.2s' }}></div>
                    <div className="typing-dot" style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor', opacity: 0.6, animation: 'pulse 1.5s infinite 0.4s' }}></div>
                  </div>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }} />
                )}
              </div>
              <span className="timestamp">
                {time} • {isUser ? 'User' : 'Assistant'}
              </span>
            </div>
          </div>
        )
      })}

      {/* Bottom loading space integrated inside the bubbles */}
      <div ref={messagesEndRef} />

      <style>{`
          @keyframes pulse {
              0% { transform: scale(1); opacity: 0.4; }
              50% { transform: scale(1.2); opacity: 0.8; }
              100% { transform: scale(1); opacity: 0.4; }
          }
          @keyframes float {
              0% { transform: translateY(0px); }
              50% { transform: translateY(-10px); }
              100% { transform: translateY(0px); }
          }
      `}</style>
    </div>
  )
}

export default ChatMessages
