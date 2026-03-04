import React from 'react'

function ChatSidebar({
  conversations,
  currentConversationId,
  onNewConversation,
  onSwitchConversation,
  onDeleteConversation,
  isOpen,
  sampleQuestions = [],
  onSampleQuestionClick,
  onViewHistory,
  style = {}
}) {
  return (
    <div className={`chat-sidebar ${!isOpen ? 'hidden' : ''}`} style={style}>
      <div className="sidebar-header">
        <button className="new-chat-btn" onClick={() => onNewConversation()}>
          + NEW CHAT
        </button>
      </div>

      <div className="sidebar-content-wrapper" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '0 20px' }}>
          <div className="sidebar-section-title" style={{ margin: '24px 0 16px' }}>Neural Investigation Starters</div>
          {sampleQuestions && sampleQuestions.length > 0 ? (
            sampleQuestions.map((q, idx) => (
              <button
                key={idx}
                className="sample-q-btn"
                onClick={() => onSampleQuestionClick(q)}
                style={{
                  fontSize: '0.75rem',
                  padding: '12px 14px',
                  marginBottom: '10px',
                  border: '1.5px solid var(--border-soft)',
                  background: 'var(--bg-main)',
                  borderRadius: '10px',
                  lineHeight: '1.5',
                  color: 'var(--text-secondary)',
                  fontWeight: '700'
                }}
              >
                {q}
              </button>
            ))
          ) : (
            <div style={{
              fontSize: '0.7rem',
              color: 'var(--sage-dark)',
              fontStyle: 'italic',
              padding: '12px',
              border: '1px dashed var(--sage-soft)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span className="live-pulse"></span>
              Synthesizing Neural Insight...
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default ChatSidebar
