import { useState, useEffect, useRef } from 'react';
import type { Document, AIProvider } from '../api';
import { submitAIChat, getProviderModels } from '../api';
import { EnhancedDocumentPickerModal } from './EnhancedDocumentPickerModal';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  tokens?: number;
  cost?: number;
}

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document;
  allDocuments: Document[];
  aiProviders: AIProvider[];
  accessToken: string;
  projectId: string;
  events?: any[];
}

export function AIChatModal({
  isOpen,
  onClose,
  document,
  allDocuments,
  aiProviders,
  accessToken,
  projectId: _projectId,
  events = []
}: AIChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [modelSearch, setModelSearch] = useState('');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [contextDocuments, setContextDocuments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDocumentPicker, setShowDocumentPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load existing chat data if document is chat mode
  useEffect(() => {
    if (document.interaction_mode === 'chat' && document.content) {
      try {
        const chatData = JSON.parse(document.content);
        if (chatData.messages) {
          setMessages(chatData.messages);
        }
        if (chatData.active_context) {
          setContextDocuments(chatData.active_context);
        }
      } catch (error) {
        console.warn('Failed to parse chat data:', error);
      }
    }
  }, [document]);

  // Load models when provider changes
  useEffect(() => {
    if (selectedProvider) {
      loadProviderModels(selectedProvider);
    } else {
      setAvailableModels([]);
      setSelectedModel('');
    }
  }, [selectedProvider]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadProviderModels = async (providerId: string) => {
    try {
      const models = await getProviderModels(providerId, accessToken);
      setAvailableModels(models);
      setSelectedModel('');
    } catch (error) {
      console.error('Failed to load models:', error);
      setAvailableModels([]);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedProvider || !selectedModel || isLoading) {
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await submitAIChat({
        documentId: document.id,
        messages: [userMessage],
        providerId: selectedProvider,
        model: selectedModel,
        contextDocuments
      }, accessToken);

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toISOString(),
        tokens: response.outputTokens,
        cost: response.costCredits
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, there was an error processing your message. Please try again.',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleDocumentSelect = (docId: string) => {
    if (!contextDocuments.includes(docId)) {
      setContextDocuments(prev => [...prev, docId]);
    }
    setShowDocumentPicker(false);
  };

  const removeContextDocument = (docId: string) => {
    setContextDocuments(prev => prev.filter(id => id !== docId));
  };

  const handleModelSelect = (model: any) => {
    setSelectedModel(model.id);
    setModelSearch(model.name);
    setShowModelDropdown(false);
  };

  const handleModelSearchChange = (value: string) => {
    setModelSearch(value);
    setShowModelDropdown(true);
    if (!value) {
      setSelectedModel('');
    }
  };

  const filteredModels = availableModels.filter(model =>
    model.name.toLowerCase().includes(modelSearch.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal modal--large">
        <div className="modal__header">
          <h2>🤖 AI Chat - {document.title}</h2>
          <button className="modal__close" onClick={onClose}>×</button>
        </div>

        <div className="modal__body">
          {/* AI Configuration */}
          <div className="ai-config">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  AI Provider:
                  <select
                    className="form-input"
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value)}
                  >
                    <option value="">Select provider...</option>
                    {aiProviders.map(provider => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Model:
                  <div className="searchable-select">
                    <input
                      type="text"
                      className="form-input"
                      value={modelSearch}
                      onChange={(e) => handleModelSearchChange(e.target.value)}
                      onFocus={() => setShowModelDropdown(true)}
                      onBlur={() => setTimeout(() => setShowModelDropdown(false), 200)}
                      placeholder={!selectedProvider ? "Select provider first..." : "Search models..."}
                      disabled={!selectedProvider}
                    />
                    {showModelDropdown && selectedProvider && filteredModels.length > 0 && (
                      <div className="searchable-dropdown">
                        {filteredModels.map(model => (
                          <div
                            key={model.id}
                            className="dropdown-item"
                            onClick={() => handleModelSelect(model)}
                          >
                            <div className="model-name">{model.name}</div>
                            {model.description && (
                              <div className="model-description">{model.description}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Context Documents */}
          <div className="context-selector">
            <div className="context-header">
              <h4>Additional Context Documents:</h4>
              <button 
                className="btn btn--secondary btn--sm"
                onClick={() => setShowDocumentPicker(true)}
              >
                + Add Document
              </button>
            </div>
            <div className="context-documents">
              {contextDocuments.length === 0 ? (
                <p className="no-context-docs">No additional context documents selected. Click "Add Document" to include relevant documents in your conversation.</p>
              ) : (
                contextDocuments
                  .map(docId => allDocuments.find(doc => doc.id === docId))
                  .filter(doc => doc)
                  .map(doc => (
                    <div key={doc!.id} className="context-document-card">
                      <div className="context-document-info">
                        <span className="context-document-title">{doc!.title}</span>
                        <span className="context-document-type">({doc!.document_type || 'Document'})</span>
                      </div>
                      <button 
                        className="context-document-remove"
                        onClick={() => removeContextDocument(doc!.id)}
                        title="Remove document"
                      >
                        ×
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Chat Messages */}
          <div className="chat-container">
            <div className="chat-messages">
              {messages.map((message, index) => (
                <div key={index} className={`chat-message chat-message--${message.role}`}>
                  <div className="chat-message__header">
                    <strong>{message.role === 'user' ? 'You' : 'AI'}</strong>
                    <span className="chat-message__time">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                    {message.tokens && (
                      <span className="chat-message__meta">
                        {message.tokens} tokens • {message.cost} credits
                      </span>
                    )}
                  </div>
                  <div className="chat-message__content">
                    {message.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="chat-message chat-message--assistant">
                  <div className="chat-message__header">
                    <strong>AI</strong>
                  </div>
                  <div className="chat-message__content">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="chat-input">
              <textarea
                className="form-input"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                rows={3}
                disabled={isLoading}
              />
              <button
                className="btn btn--primary"
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || !selectedProvider || !selectedModel || isLoading}
              >
                {isLoading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>

        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      
      {/* Document Picker Modal */}
      {showDocumentPicker && (
        <EnhancedDocumentPickerModal
          documents={allDocuments.filter(doc => 
            doc.id !== document.id && 
            doc.project_id === document.project_id &&
            !contextDocuments.includes(doc.id)
          )}
          events={events}
          projectId={_projectId}
          componentKey="AI Chat Context"
          onSelect={handleDocumentSelect}
          onCancel={() => setShowDocumentPicker(false)}
        />
      )}
    </div>
  );
}