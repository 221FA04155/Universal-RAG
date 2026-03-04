import React, { useState, useEffect, useRef, useCallback } from 'react'
import ChatSidebar from '../components/ChatSidebar'
import ChatMessages from '../components/ChatMessages'
import ChatInput from '../components/ChatInput'
import InsightsSidebar from '../components/InsightsSidebar'
import {
  getAllConversations,
  saveConversation,
  getConversation,
  deleteConversationById,
  generateUUID
} from '../utils/storage'
import { fetchWithTimeout, API_BASE_URL } from '../utils/api'

function ChatPage({ assistantId, assistantName, onNewAssistant, onHome, onViewHistory }) {
  const [currentConversationId, setCurrentConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [conversations, setConversations] = useState([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024)
  const [isInsightsOpen, setIsInsightsOpen] = useState(window.innerWidth > 1200)
  const [isLoading, setIsLoading] = useState(false)
  const [assistantDetails, setAssistantDetails] = useState({
    attributes: [],
    sample_questions: [],
    uploaded_files: [],
    file_history: [],
    data_source_type: '',
    graph_data: {}
  })
  const [activeDataset, setActiveDataset] = useState(null)
  const [shouldAutoSummarize, setShouldAutoSummarize] = useState(false)

  // --- Resizable Sidebar Logic ---
  const [sidebarWidth, setSidebarWidth] = useState(300)
  const [insightsWidth, setInsightsWidth] = useState(340)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const [isResizingInsights, setIsResizingInsights] = useState(false)

  const startResizingSidebar = useCallback((e) => {
    e.preventDefault();
    setIsResizingSidebar(true);
  }, []);

  const startResizingInsights = useCallback((e) => {
    e.preventDefault();
    setIsResizingInsights(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizingSidebar(false);
    setIsResizingInsights(false);
  }, []);

  const resize = useCallback((e) => {
    if (isResizingSidebar) {
      const newWidth = e.clientX;
      if (newWidth > 200 && newWidth < 500) {
        setSidebarWidth(newWidth);
      }
    }
    if (isResizingInsights) {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 250 && newWidth < 600) {
        setInsightsWidth(newWidth);
      }
    }
  }, [isResizingSidebar, isResizingInsights]);

  useEffect(() => {
    if (isResizingSidebar || isResizingInsights) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizingSidebar, isResizingInsights, resize, stopResizing]);
  // -------------------------------

  useEffect(() => {
    const handleResize = () => {
      // Allow CSS to handle layout transitions; only close if screen is tiny
      if (window.innerWidth <= 480) {
        if (isSidebarOpen) setIsSidebarOpen(false);
        if (isInsightsOpen) setIsInsightsOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarOpen, isInsightsOpen]);

  useEffect(() => {
    loadConversations()
    loadChatHistoryFromBackend()
    fetchAssistantDetails()

    const allConversations = getAllConversations()
    const assistantConversations = Object.values(allConversations)
      .filter(conv => conv.assistantId === assistantId)

    if (assistantConversations.length > 0) {
      const mostRecent = assistantConversations.sort((a, b) =>
        new Date(b.updatedAt) - new Date(a.updatedAt)
      )[0]
      switchConversation(mostRecent.id)
    } else {
      startNewConversation()
    }
  }, [assistantId])

  const fetchAssistantDetails = async (retryCount = 0, filename = null) => {
    try {
      let url = `${API_BASE_URL}/api/assistants/${assistantId}`;
      if (filename) url += `?filename=${encodeURIComponent(filename)}`;

      const response = await fetchWithTimeout(url, {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()

        let hasData = (data.attributes && data.attributes.length > 0) ||
          (data.graph_data && Object.keys(data.graph_data).length > 0);

        setAssistantDetails({
          attributes: data.attributes || [],
          sample_questions: data.sample_questions || [],
          uploaded_files: data.uploaded_files || [],
          file_history: data.file_history || [],
          data_source_type: data.data_source_type,
          graph_data: data.graph_data || {}
        })

        // Check if indexing and analytical synthesis is complete
        // We poll specifically for sample_questions because graph_data might contain mock fallbacks
        const isSynthesisComplete = (data.sample_questions && data.sample_questions.length > 0);

        if (!isSynthesisComplete && retryCount < 100) {
          // Continue polling until strategic synthesis (questions/graphs) is finished
          setTimeout(() => fetchAssistantDetails(retryCount + 1, filename), 3000);
        } else {
          // If this is the completion of synthesis, check for auto-summarization
          // Auto-summarization protocol deactivated per USER request
          setShouldAutoSummarize(false);

          // Open insights panel to show new data

          // Open insights panel to show new data
          if (window.innerWidth > 1024) {
            setIsInsightsOpen(true);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching assistant details:', error)
    }
  }

  const loadChatHistoryFromBackend = async () => {
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/assistants/${assistantId}/chat-history?limit=100`, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        if (data.messages && data.messages.length > 0) {
          // If we have no local messages, populate from backend
          if (messages.length === 0) {
            setMessages(data.messages)

            // Also sync to local storage if it's a new conversation
            const conv = getConversation(currentConversationId)
            if (conv && conv.messages.length === 0) {
              conv.messages = data.messages
              if (data.messages.length > 0) {
                const firstMsg = data.messages.find(m => m.role === 'user')
                if (firstMsg) {
                  conv.title = firstMsg.content.substring(0, 30) + (firstMsg.content.length > 30 ? '...' : '')
                }
              }
              saveConversation(currentConversationId, conv)
              loadConversations()
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading chat history:', error)
    }
  }
  const loadConversations = () => {
    const all = getAllConversations()
    const filtered = Object.values(all)
      .filter(conv => conv.assistantId === assistantId)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    setConversations(filtered)
  }

  const startNewConversation = () => {
    const newId = generateUUID()
    const newConv = {
      id: newId,
      assistantId,
      title: 'New Investigation',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    setCurrentConversationId(newId)
    setMessages([])
    setActiveDataset(null) // Clear specialized focus on new chat
    saveConversation(newId, newConv)
    loadConversations()
  }

  const switchConversation = (id) => {
    const conv = getConversation(id)
    if (conv) {
      setCurrentConversationId(id)
      setMessages(conv.messages || [])
    }
  }

  const deleteConversation = (id, e) => {
    if (e) e.stopPropagation()
    deleteConversationById(id)
    loadConversations()
    if (id === currentConversationId) {
      startNewConversation()
    }
  }

  const sendMessage = async (text) => {
    if (!text.trim()) return

    const userMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setIsLoading(true)

    // Update conversation storage
    const currentConv = getConversation(currentConversationId) || {
      id: currentConversationId,
      assistantId,
      createdAt: new Date().toISOString()
    }

    // Auto-update title if it's the first message
    if (messages.length === 0) {
      currentConv.title = text.substring(0, 30) + (text.length > 30 ? '...' : '')
    }

    currentConv.messages = updatedMessages
    currentConv.updatedAt = new Date().toISOString()
    currentConv.assistantId = assistantId
    saveConversation(currentConversationId, currentConv)
    loadConversations()

    try {
      const history = updatedMessages.slice(0, -1).map(m => ({
        role: m.role,
        content: m.content
      }))

      // Create a placeholder for the bot message that we'll stream into
      const botMessageId = Date.now()
      const botMessage = {
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        isStreaming: true
      }
      setMessages(prev => [...prev, botMessage])

      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assistant_id: assistantId,
          message: text,
          history: history,
          active_dataset: activeDataset
        }),
        credentials: 'include'
      })

      if (!response.ok) throw new Error('Network response was not ok')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulatedContent = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const parsed = JSON.parse(line)
            if (parsed.type === 'content') {
              accumulatedContent += parsed.data
              setMessages(prev => {
                const newMessages = [...prev]
                const last = newMessages[newMessages.length - 1]
                if (last && last.role === 'assistant') {
                  last.content = accumulatedContent
                }
                return newMessages
              })
            } else if (parsed.type === 'sources') {
              setMessages(prev => {
                const newMessages = [...prev]
                const last = newMessages[newMessages.length - 1]
                if (last && last.role === 'assistant') {
                  last.sources = parsed.data
                }
                return newMessages
              })
            } else if (parsed.type === 'error') {
              addSystemMessage(parsed.data)
            }
          } catch (e) {
            console.warn('Error parsing stream line:', e)
          }
        }
      }

      // Finalize the message
      setMessages(prev => {
        const newMessages = [...prev]
        const last = newMessages[newMessages.length - 1]
        if (last && last.role === 'assistant') {
          last.isStreaming = false
        }
        return newMessages
      })

      // Final persistence
      const finalConv = getConversation(currentConversationId)
      if (finalConv) {
        setMessages(prev => {
          finalConv.messages = prev
          finalConv.updatedAt = new Date().toISOString()
          saveConversation(currentConversationId, finalConv)
          return prev
        })
      }

    } catch (error) {
      console.error('Chat error:', error)
      addSystemMessage("Connection Error: The neural link was interrupted. Please verify connectivity.")
    } finally {
      setIsLoading(false)
    }
  }

  const addSystemMessage = (text) => {
    const systemMessage = {
      role: 'assistant',
      content: text,
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, systemMessage])
  }

  const handleDeleteFile = async (filename) => {
    // 1. Optimistic UI Update: Remove file locally first for instant responsiveness
    setAssistantDetails(prev => ({
      ...prev,
      file_history: prev.file_history.filter(f => f.filename !== filename),
      uploaded_files: prev.uploaded_files.filter(f => f !== filename)
    }));

    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/assistants/${assistantId}/files/${filename}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        // If it fails, silent refresh to restore correct state
        fetchAssistantDetails();
      }
      // "No pop notifications" - removed addSystemMessage call
    } catch (error) {
      console.error('Delete error:', error);
      fetchAssistantDetails(); // Restore on error
    }
  }

  const handleActivateFile = (filename) => {
    setActiveDataset(filename);

    // 1. Clear chat/Start new conversation as requested
    startNewConversation();
    // Re-set active dataset since startNewConversation clears it by default
    setActiveDataset(filename);

    // 2. Fetch specialized metadata & insights for this specific file
    fetchAssistantDetails(0, filename);

    // 3. Initialize context with a professional neural synthesis message
    const activationMessage = `Initializing neural focus on dataset: ‘${filename}’. Vector space synchronization complete. All analytical engines are now calibrated to this specific source. How would you like me to begin our analysis?`;

    addSystemMessage(activationMessage);
  }

  return (
    <div className={`chat-page-wrapper ${!isSidebarOpen ? 'left-closed' : ''} ${!isInsightsOpen ? 'right-closed' : ''} ${isResizingSidebar || isResizingInsights ? 'is-resizing' : ''}`}>
      <div className="chat-layout-triple">
        <ChatSidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          onNewConversation={startNewConversation}
          onSwitchConversation={switchConversation}
          onDeleteConversation={deleteConversation}
          isOpen={isSidebarOpen}
          sampleQuestions={assistantDetails.sample_questions || []}
          onSampleQuestionClick={sendMessage}
          onViewHistory={onViewHistory}
          style={isSidebarOpen ? { width: `${sidebarWidth}px` } : {}}
        />

        {isSidebarOpen && (
          <div
            className={`layout-resizer sidebar-resizer ${isResizingSidebar ? 'active' : ''}`}
            onMouseDown={startResizingSidebar}
          />
        )}

        <div className="chat-center-column">
          <div className="chat-header">
            <div className="header-left">
              <button
                className="icon-btn"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="9" y1="3" x2="9" y2="21"></line>
                </svg>
              </button>
            </div>

            <div className="header-center">
              <div className="assistant-avatar-tiny">
                {(assistantName || 'A').charAt(0).toUpperCase()}
              </div>
              <h3 className="assistant-name-header">{assistantName}</h3>
              {assistantDetails?.uploaded_files?.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span className="ent-badge" style={{
                    fontSize: '0.65rem',
                    padding: '2px 8px',
                    background: 'var(--accent-glass)',
                    border: '1px solid var(--border-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                      <polyline points="13 2 13 9 20 9"></polyline>
                    </svg>
                    {assistantDetails.uploaded_files.length} {assistantDetails.uploaded_files.length === 1 ? 'DATASET' : 'DATASETS'}
                  </span>
                </div>
              )}
              {activeDataset && (
                <div className="active-focus-pill" title={`Restricting neural search to: ${activeDataset}`}>
                  <span className="focus-pulse"></span>
                  FOCUS: {activeDataset.length > 20 ? activeDataset.substring(0, 17) + '...' : activeDataset}
                </div>
              )}
              <div className="active-status-pill">
                <div className={`active-status-indicator ${isLoading ? 'pulsing' : ''}`}></div>
                {isLoading ? 'Processing' : 'Context Ready'}
              </div>
            </div>

            <div className="header-right">
              <button
                className={`icon-btn ${isInsightsOpen ? 'active' : ''}`}
                onClick={() => setIsInsightsOpen(!isInsightsOpen)}
                title="Toggle Analysis Panel"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
                  <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
                </svg>
              </button>
            </div>
          </div>

          <ChatMessages
            messages={messages}
            assistantName={assistantName}
            isLoading={isLoading}
            assistantDetails={assistantDetails}
            onSampleQuestionClick={sendMessage}
          />

          <ChatInput
            onSendMessage={sendMessage}
            onAddSystemMessage={addSystemMessage}
            onRefreshDetails={() => {
              setShouldAutoSummarize(true);
              fetchAssistantDetails();
            }}
            disabled={isLoading}
            assistantId={assistantId}
          />
        </div>

        {isInsightsOpen && (
          <div
            className={`layout-resizer insights-resizer ${isResizingInsights ? 'active' : ''}`}
            onMouseDown={startResizingInsights}
          />
        )}

        <InsightsSidebar
          attributes={assistantDetails.attributes}
          sampleQuestions={assistantDetails.sample_questions}
          onQuestionClick={sendMessage}
          graphData={assistantDetails.graph_data}
          dataSourceType={assistantDetails.data_source_type}
          fileHistory={assistantDetails.file_history}
          onDeleteFile={handleDeleteFile}
          onActivateFile={handleActivateFile}
          activeDataset={activeDataset}
          isOpen={isInsightsOpen}
          onClose={() => setIsInsightsOpen(false)}
          onToggle={() => setIsInsightsOpen(!isInsightsOpen)}
          onRefresh={fetchAssistantDetails}
          style={isInsightsOpen ? { width: `${insightsWidth}px` } : {}}
        />
      </div>
    </div>
  )
}

export default ChatPage
