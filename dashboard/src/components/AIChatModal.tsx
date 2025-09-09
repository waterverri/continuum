import { useState, useEffect, useRef } from 'react';
import type { Document, AIProvider } from '../api';
import { submitAIChat, getProviderModels } from '../api';

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
}

export function AIChatModal({
  isOpen,
  onClose,
  document,
  allDocuments,
  aiProviders,
  accessToken,
  projectId: _projectId
}: AIChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [contextDocuments, setContextDocuments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

  const toggleContextDocument = (docId: string) => {
    setContextDocuments(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

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
                  <select
                    className="form-input"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={!selectedProvider}
                  >
                    <option value="">Select model...</option>
                    {availableModels.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </div>

          {/* Context Documents */}
          <div className="context-selector">
            <h4>Additional Context Documents:</h4>
            <div className="context-documents">
              {allDocuments
                .filter(doc => doc.id !== document.id && doc.project_id === document.project_id)
                .map(doc => (
                  <label key={doc.id} className="context-document">
                    <input
                      type="checkbox"
                      checked={contextDocuments.includes(doc.id)}
                      onChange={() => toggleContextDocument(doc.id)}
                    />
                    <span>{doc.title} ({doc.document_type || 'Document'})</span>
                  </label>
                ))}
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
    </div>
  );
}