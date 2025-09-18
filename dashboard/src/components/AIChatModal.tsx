import { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import type { Document, AIProvider } from '../api';
import { submitAIChat, getProviderModels, updateChatMessages, getProjectAIConfig, createDocument } from '../api';
import { EnhancedDocumentPickerModal } from './EnhancedDocumentPickerModal';
import { ensureBidirectionalGroupAssignment } from '../utils/groupAssignment';

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

const renderMarkdown = (content: string): string => {
  return marked(content) as string;
};

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
  onDocumentSwitch?: (newDocument: Document) => void;
  onDocumentUpdate?: () => void;
}

export function AIChatModal({
  isOpen,
  onClose,
  document,
  allDocuments,
  aiProviders,
  accessToken,
  projectId: _projectId,
  events = [],
  onDocumentSwitch,
  onDocumentUpdate
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
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [sourceDocument, setSourceDocument] = useState<any>(null);
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Save as document state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveMessageIndex, setSaveMessageIndex] = useState<number | null>(null);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocType, setNewDocType] = useState('');
  const [newDocGroupId, setNewDocGroupId] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Available groups (reusing logic from TransformModal)
  const availableGroups = allDocuments.filter(doc => {
    // Show group head documents (documents that can be group heads)
    // These are documents without group_id or documents where group_id equals their own id
    return !doc.group_id || doc.group_id === doc.id;
  }).map(doc => {
    // Enhance with group information
    const groupDocuments = allDocuments.filter(d => d.group_id === doc.id);
    const groupSize = groupDocuments.length;
    const isExistingGroup = groupSize > 0;

    return {
      ...doc,
      displayName: isExistingGroup
        ? `${doc.title} (Group with ${groupSize} documents)`
        : doc.title,
      isGroup: isExistingGroup
    };
  });

  // Load existing chat data if document is chat mode and initialize AI config from document
  useEffect(() => {
    if (document.interaction_mode === 'chat' && document.content) {
      try {
        const chatData = JSON.parse(document.content);
        if (chatData.messages) {
          setMessages(chatData.messages);
        }
        // Handle both old and new chat data formats
        if (chatData.additional_context) {
          setContextDocuments(chatData.additional_context);
        } else if (chatData.active_context) {
          setContextDocuments(chatData.active_context);
        }
        // Set source document from primary context
        if (chatData.primary_context) {
          setSourceDocument(chatData.primary_context);
        }
      } catch (error) {
        console.warn('Failed to parse chat data:', error);
      }
    }

    // Initialize AI picker from document AI columns if available
    if (document.last_ai_provider_id) {
      setSelectedProvider(document.last_ai_provider_id);
    }
    if (document.last_ai_model_id) {
      setSelectedModel(document.last_ai_model_id);
      setModelSearch(document.last_ai_model_id);
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

  // Load project AI config to initialize provider/model if document doesn't have AI columns filled
  useEffect(() => {
    if (isOpen && _projectId && (!document.last_ai_provider_id || !document.last_ai_model_id)) {
      loadProjectAIConfig();
    }
  }, [isOpen, _projectId, document]);

  const loadProjectAIConfig = async () => {
    try {
      const { aiConfig } = await getProjectAIConfig(_projectId, accessToken);
      if (aiConfig) {
        // Only set if document doesn't have AI columns or they're empty
        if (!document.last_ai_provider_id && aiConfig.provider_id) {
          setSelectedProvider(aiConfig.provider_id);
        }
        if (!document.last_ai_model_id && aiConfig.model_id) {
          setSelectedModel(aiConfig.model_id);
          setModelSearch(aiConfig.model_id); // Set the search field too
        }
      }
    } catch (error) {
      console.error('Failed to load project AI config:', error);
      // Don't show error to user - this is optional functionality
    }
  };

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

  const handleEditMessage = (index: number, content: string) => {
    setEditingMessageIndex(index);
    setEditingContent(content);
  };

  const handleSaveEditMessage = async () => {
    if (editingMessageIndex === null) return;
    
    const updatedMessages = [...messages];
    updatedMessages[editingMessageIndex].content = editingContent;
    setMessages(updatedMessages);
    
    // Update the document with the new messages
    await updateChatDocument(updatedMessages);
    
    // Note: We don't call onDocumentUpdate here to avoid closing the modal
    // The messages are already saved via updateChatDocument
    
    setEditingMessageIndex(null);
    setEditingContent('');
  };

  const handleCancelEditMessage = () => {
    setEditingMessageIndex(null);
    setEditingContent('');
  };

  const handleDeleteMessage = async (index: number) => {
    if (confirm('Are you sure you want to delete this message?')) {
      const updatedMessages = messages.filter((_, i) => i !== index);
      setMessages(updatedMessages);
      
      // Update the document with the new messages
      await updateChatDocument(updatedMessages);
      
      // Note: We don't call onDocumentUpdate here to avoid closing the modal
      // The messages are already saved via updateChatDocument
    }
  };

  const handleRegenerateMessage = async (index: number) => {
    if (!selectedProvider || !selectedModel) {
      alert('Please select a provider and model first');
      return;
    }

    setRegeneratingIndex(index);
    
    try {
      // Get messages up to the one being regenerated (excluding the one being regenerated)
      const messagesToSend = messages.slice(0, index);
      
      const response = await submitAIChat({
        documentId: document.id,
        messages: messagesToSend,
        providerId: selectedProvider,
        model: selectedModel,
        contextDocuments,
        regenerateOnly: true
      }, accessToken);

      // Replace the message at the index with the new response
      const updatedMessages = [...messages];
      updatedMessages[index] = {
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toISOString(),
        tokens: response.outputTokens,
        cost: response.costCredits
      };
      
      // Remove any messages after the regenerated one
      const finalMessages = updatedMessages.slice(0, index + 1);
      setMessages(finalMessages);
      
      // Update the document
      await updateChatDocument(finalMessages);
      
      // Note: We don't call onDocumentUpdate here to avoid closing the modal
      // The messages are already saved via updateChatDocument
    } catch (error) {
      console.error('Error regenerating message:', error);
      alert('Failed to regenerate message. Please try again.');
    } finally {
      setRegeneratingIndex(null);
    }
  };

  const updateChatDocument = async (updatedMessages: Message[]) => {
    try {
      await updateChatMessages(document.id, updatedMessages, accessToken);
    } catch (error) {
      console.error('Error updating chat document:', error);
      alert('Failed to save changes. Please try again.');
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

      const updatedMessages = [...messages, userMessage, assistantMessage];
      setMessages(updatedMessages);

      // Save the messages to the backend
      await updateChatDocument(updatedMessages);

      // If a new chat document was created, switch to it
      if (response.chatDocument && onDocumentSwitch) {
        console.debug('Switching to newly created chat document:', response.chatDocument.id);
        onDocumentSwitch(response.chatDocument);
        // Only refresh document view when switching to a new document
        if (onDocumentUpdate) {
          onDocumentUpdate();
        }
      }
      // Note: We don't call onDocumentUpdate for existing documents to avoid closing the modal
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, there was an error processing your message. Please try again.',
        timestamp: new Date().toISOString()
      };
      
      const errorMessages = [...messages, userMessage, errorMessage];
      setMessages(errorMessages);
      
      // Save the messages including the error message
      try {
        await updateChatDocument(errorMessages);
      } catch (saveError) {
        console.error('Error saving chat after error:', saveError);
      }
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

  const handleModelSelect = (model: { id: string; name: string }) => {
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

  // Save as document handlers (reusing logic from TransformModal)
  const handleSaveAsDocument = (messageIndex: number) => {
    const message = messages[messageIndex];
    if (message?.role === 'assistant') {
      setSaveMessageIndex(messageIndex);
      setNewDocTitle(`${document.title} - AI Response`);
      setNewDocType(document.document_type || 'document');

      // Default to current document's group, or the current document itself if it can be a group head
      let defaultGroupId = '';
      let defaultGroupName = '';

      if (document.group_id) {
        // Document is in a group, use that group
        defaultGroupId = document.group_id;
        const groupDoc = availableGroups.find(g => g.id === document.group_id);
        if (groupDoc) {
          defaultGroupName = groupDoc.displayName;
        }
      } else {
        // Document is not in a group, use the document itself as the group
        defaultGroupId = document.id;
        const docAsGroup = availableGroups.find(g => g.id === document.id);
        if (docAsGroup) {
          defaultGroupName = docAsGroup.displayName;
        }
      }

      setNewDocGroupId(defaultGroupId);
      setGroupSearch(defaultGroupName);
      setShowSaveModal(true);
    }
  };

  const filteredGroups = availableGroups.filter(group =>
    group.displayName.toLowerCase().includes(groupSearch.toLowerCase()) ||
    group.document_type?.toLowerCase().includes(groupSearch.toLowerCase())
  );

  const handleGroupSelect = (group: { id: string; displayName: string }) => {
    setNewDocGroupId(group.id);
    setGroupSearch(group.displayName);
    setShowGroupDropdown(false);
  };

  const handleGroupSearchChange = (value: string) => {
    setGroupSearch(value);
    setShowGroupDropdown(true);
    if (!value) {
      setNewDocGroupId('');
    }
  };

  const clearGroupSelection = () => {
    setNewDocGroupId('');
    setGroupSearch('');
  };

  const handleSaveAsNewDocument = async () => {
    if (!newDocTitle.trim() || saveMessageIndex === null) {
      return;
    }

    const messageToSave = messages[saveMessageIndex];
    if (!messageToSave) {
      return;
    }

    setIsSaving(true);

    try {
      // Create the new document
      await createDocument(_projectId, {
        title: newDocTitle.trim(),
        document_type: newDocType || 'document',
        content: messageToSave.content,
        group_id: newDocGroupId || undefined,
        interaction_mode: 'document'
      }, accessToken);

      // If assigning to a group, ensure bidirectional group assignment
      if (newDocGroupId) {
        try {
          await ensureBidirectionalGroupAssignment(
            newDocGroupId,
            allDocuments,
            _projectId,
            accessToken
          );
        } catch (groupError) {
          console.error('🔧 Bidirectional group assignment failed in chat modal:', groupError);
          // Don't fail the whole operation, just log the error
        }
      }

      if (onDocumentUpdate) {
        onDocumentUpdate();
      }

      // Close the save modal and reset state
      setShowSaveModal(false);
      setSaveMessageIndex(null);
      setNewDocTitle('');
      setNewDocType('');
      setNewDocGroupId('');
      setGroupSearch('');
    } catch (error) {
      console.error('Save document error:', error);
      alert('Failed to save document. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal modal--large">
        <div className="modal__header">
          <h2>🤖 AI Chat - {document.title}</h2>
          <button 
            className="modal__close" 
            onClick={onClose}
            disabled={regeneratingIndex !== null || isLoading}
            title={regeneratingIndex !== null ? "Please wait for regeneration to complete" : "Close"}
          >
            ×
          </button>
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

          {/* Source Document Info */}
          {sourceDocument && (
            <div className="source-document-info">
              <h4>Source Document:</h4>
              <div className="source-document-card" onClick={() => setShowSourceModal(true)}>
                <div className="source-document-details">
                  <span className="source-document-title">{sourceDocument.title}</span>
                  <span className="source-document-meta">
                    Captured: {new Date(sourceDocument.captured_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="source-document-action">
                  <span className="view-content-hint">Click to view content</span>
                </div>
              </div>
            </div>
          )}

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
            {regeneratingIndex !== null && (
              <div className="regeneration-progress">
                <div className="regeneration-progress__content">
                  <span className="spinner"></span>
                  <span>Regenerating message... This may take a few moments.</span>
                </div>
              </div>
            )}
            <div className="chat-messages">
              {messages.map((message, index) => (
                <div key={index} className={`chat-message chat-message--${message.role} ${regeneratingIndex === index ? 'chat-message--regenerating' : ''}`}>
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
                    <div className="chat-message__actions">
                      <button 
                        className="btn btn--ghost btn--xs"
                        onClick={() => handleEditMessage(index, message.content)}
                        disabled={regeneratingIndex !== null || isLoading}
                        title="Edit message"
                      >
                        ✏️
                      </button>
                      <button 
                        className="btn btn--ghost btn--xs"
                        onClick={() => handleDeleteMessage(index)}
                        disabled={regeneratingIndex !== null || isLoading}
                        title="Delete message"
                      >
                        🗑️
                      </button>
                      {message.role === 'assistant' && (
                        <>
                          <button
                            className="btn btn--ghost btn--xs"
                            onClick={() => handleRegenerateMessage(index)}
                            disabled={regeneratingIndex === index || isLoading}
                            title={regeneratingIndex === index ? "Regenerating message..." : "Regenerate message"}
                          >
                            {regeneratingIndex === index ? (
                              <span className="regenerate-loading">
                                <span className="spinner"></span>
                              </span>
                            ) : '🔄'}
                          </button>
                          <button
                            className="btn btn--ghost btn--xs"
                            onClick={() => handleSaveAsDocument(index)}
                            disabled={regeneratingIndex !== null || isLoading}
                            title="Save as new document"
                          >
                            💾
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="chat-message__content">
                    {editingMessageIndex === index ? (
                      <div className="chat-message__edit">
                        <textarea
                          className="form-input"
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          rows={4}
                        />
                        <div className="chat-message__edit-actions">
                          <button 
                            className="btn btn--primary btn--sm"
                            onClick={handleSaveEditMessage}
                          >
                            Save
                          </button>
                          <button 
                            className="btn btn--secondary btn--sm"
                            onClick={handleCancelEditMessage}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="chat-message__markdown"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                      />
                    )}
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
                placeholder={regeneratingIndex !== null ? "Please wait for regeneration to complete..." : "Type your message... (Enter to send, Shift+Enter for new line)"}
                rows={3}
                disabled={isLoading || regeneratingIndex !== null}
              />
              <button
                className="btn btn--primary"
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || !selectedProvider || !selectedModel || isLoading || regeneratingIndex !== null}
              >
                {isLoading ? 'Sending...' : regeneratingIndex !== null ? 'Regenerating...' : 'Send'}
              </button>
            </div>
          </div>
        </div>

        <div className="modal__footer">
          <button 
            className="btn btn--danger"
            onClick={async () => {
              if (confirm('Regenerate entire chat from the first message? This will remove all existing messages and restart the conversation.')) {
                if (messages.length > 0) {
                  const firstMessage = messages.find(msg => msg.role === 'user');
                  if (firstMessage && selectedProvider && selectedModel) {
                    setMessages([]);
                    try {
                      const response = await submitAIChat({
                        documentId: document.id,
                        messages: [firstMessage],
                        providerId: selectedProvider,
                        model: selectedModel,
                        contextDocuments
                      }, accessToken);

                      const assistantMessage = {
                        role: 'assistant' as const,
                        content: response.response,
                        timestamp: new Date().toISOString(),
                        tokens: response.outputTokens,
                        cost: response.costCredits
                      };

                      setMessages([firstMessage, assistantMessage]);
                    } catch (error) {
                      console.error('Error regenerating chat:', error);
                      alert('Failed to regenerate chat. Please try again.');
                    }
                  }
                }
              }
            }}
            disabled={messages.length === 0 || !selectedProvider || !selectedModel}
            title="Regenerate entire chat from the first message"
          >
            🔄 Regenerate Chat
          </button>
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

      {/* Source Document Content Modal */}
      {showSourceModal && sourceDocument && (
        <div className="modal-overlay">
          <div className="modal-content source-content-modal">
            <div className="modal-header">
              <h3>{sourceDocument.title}</h3>
              <button className="modal-close" onClick={() => setShowSourceModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="source-content-meta">
                <p><strong>Captured:</strong> {new Date(sourceDocument.captured_at).toLocaleString()}</p>
                <p><strong>Document ID:</strong> {sourceDocument.document_id}</p>
              </div>
              <div className="source-content">
                <h4>Content:</h4>
                <div className="source-content-text">
                  {sourceDocument.content_snapshot || 'No content available'}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={() => setShowSourceModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save as Document Modal */}
      {showSaveModal && saveMessageIndex !== null && (
        <div className="modal-overlay">
          <div className="modal modal--medium">
            <div className="modal__header">
              <h2>💾 Save Message as Document</h2>
              <button className="modal__close" onClick={() => setShowSaveModal(false)}>×</button>
            </div>

            <div className="modal__body">
              <div className="form-section">
                <h3>Message Content</h3>
                <div className="transform-result">
                  <textarea
                    className="form-input"
                    value={messages[saveMessageIndex]?.content || ''}
                    readOnly
                    rows={8}
                    style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}
                  />
                </div>
              </div>

              <div className="form-section">
                <h3>Document Details</h3>
                <div className="new-document-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">
                        Title:
                        <input
                          type="text"
                          className="form-input"
                          value={newDocTitle}
                          onChange={(e) => setNewDocTitle(e.target.value)}
                          placeholder="Enter document title..."
                        />
                      </label>
                    </div>
                    <div className="form-group">
                      <label className="form-label">
                        Type:
                        <input
                          type="text"
                          className="form-input"
                          value={newDocType}
                          onChange={(e) => setNewDocType(e.target.value)}
                          placeholder="document"
                        />
                      </label>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Group (Optional):
                      <div className="searchable-select">
                        <input
                          type="text"
                          className="form-input"
                          value={groupSearch}
                          onChange={(e) => handleGroupSearchChange(e.target.value)}
                          onFocus={() => setShowGroupDropdown(true)}
                          onBlur={() => setTimeout(() => setShowGroupDropdown(false), 200)}
                          placeholder={availableGroups.length === 0 ? "No groups available" : "Search groups or leave empty for no group..."}
                          disabled={availableGroups.length === 0}
                        />
                        {groupSearch && (
                          <button
                            type="button"
                            className="searchable-clear"
                            onClick={clearGroupSelection}
                            title="Clear group selection"
                          >
                            ×
                          </button>
                        )}
                        {showGroupDropdown && availableGroups.length > 0 && (
                          <div className="searchable-dropdown">
                            {filteredGroups.length === 0 ? (
                              <div className="dropdown-item dropdown-item--no-results">
                                No groups match your search
                              </div>
                            ) : (
                              filteredGroups.map(group => (
                                <div
                                  key={group.id}
                                  className="dropdown-item"
                                  onClick={() => handleGroupSelect(group)}
                                >
                                  <div className="group-name">{group.title}</div>
                                  <div className="group-meta">
                                    {group.isGroup ?
                                      `📁 Existing group with ${allDocuments.filter(d => d.group_id === group.id).length} documents` :
                                      '📄 Can become group head'
                                    }
                                  </div>
                                  {group.document_type && (
                                    <div className="group-type">Type: {group.document_type}</div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal__footer">
              <button className="btn btn--secondary" onClick={() => setShowSaveModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn--primary"
                onClick={handleSaveAsNewDocument}
                disabled={isSaving || !newDocTitle.trim()}
              >
                {isSaving ? 'Saving...' : '💾 Save as Document'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}