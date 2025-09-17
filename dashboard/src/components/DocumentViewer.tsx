import { useState, useRef, useCallback, useEffect } from 'react';
import { marked } from 'marked';
import type { Document, DocumentHistoryResponse, DocumentHistory, AIProvider } from '../api';
import { clearChatMessages } from '../api';
import { ExtractTextModal } from './ExtractTextModal';
import { InlineTagManager } from './InlineTagManager';
import DocumentHistoryModal from './DocumentHistoryModal';
import { AIChatModal } from './AIChatModal';
import { TransformModal } from './TransformModal';

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

const renderMarkdown = (content: string): string => {
  return marked(content) as string;
};

interface DocumentViewerProps {
  document: Document;
  allDocuments: Document[];
  resolvedContent: string | null;
  onResolve: () => void;
  onCreateFromSelection?: (selectedText: string, selectionInfo: { start: number; end: number }, title: string, documentType: string, groupId?: string) => void;
  onDocumentSelect?: (document: Document) => void;
  onDocumentUpdate?: () => void;
  onTagUpdate?: (documentId: string, tagIds: string[]) => void;
  onEditDocument?: (document: Document) => void;
  projectId: string;
  loadDocumentHistory?: (documentId: string, limit?: number, offset?: number) => Promise<DocumentHistoryResponse>;
  loadHistoryEntry?: (documentId: string, historyId: string) => Promise<DocumentHistory>;
  onRollback?: (documentId: string, historyId: string) => Promise<Document>;
  onDeleteHistory?: (historyId: string) => Promise<void>;
  // AI props
  aiProviders?: AIProvider[];
  accessToken?: string;
}

export function DocumentViewer({ 
  document, 
  allDocuments, 
  resolvedContent, 
  onResolve, 
  onCreateFromSelection, 
  onDocumentSelect,
  onDocumentUpdate,
  onTagUpdate,
  onEditDocument,
  projectId,
  loadDocumentHistory,
  loadHistoryEntry,
  onRollback,
  onDeleteHistory,
  aiProviders = [],
  accessToken = ''
}: DocumentViewerProps) {
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [showCreateButton, setShowCreateButton] = useState(false);
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showTransformModal, setShowTransformModal] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(document.document_type || '');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [rawContentVisible, setRawContentVisible] = useState(!document.is_composite); // Hidden by default for composite
  const [componentsVisible, setComponentsVisible] = useState(!document.is_composite); // Hidden by default for composite
  const toggleHeader = () => setHeaderVisible(!headerVisible);
  const toggleRawContent = () => setRawContentVisible(!rawContentVisible);
  const toggleComponents = () => setComponentsVisible(!componentsVisible);
  const contentRef = useRef<HTMLDivElement>(null);
  const resolvedContentRef = useRef<HTMLDivElement>(null);

  // Get documents in the same group
  const groupDocuments = document.group_id 
    ? allDocuments.filter(doc => doc.group_id === document.group_id)
    : [document];
  
  // Get available document types in this group
  const availableTypes = [...new Set(groupDocuments.map(doc => doc.document_type).filter((type): type is string => Boolean(type)))];
  
  // Get current document based on active tab
  const currentDocument = groupDocuments.find(doc => doc.document_type === activeTab) || document;
  
  // Update active tab when document changes
  useEffect(() => {
    setActiveTab(document.document_type || '');
    // Reset visibility states when document changes
    setRawContentVisible(!document.is_composite);
    setComponentsVisible(!document.is_composite);
  }, [document.id, document.document_type, document.is_composite]);

  const handleTextSelection = useCallback(() => {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        setSelectedText('');
        setSelectionRange(null);
        setShowCreateButton(false);
        return;
      }

      const range = selection.getRangeAt(0);
      const selectedText = selection.toString().trim();
      
      // Only show button if text is selected and it's within our content divs
      const isInRawContent = contentRef.current && range.commonAncestorContainer && 
          (contentRef.current.contains(range.commonAncestorContainer) || 
           contentRef.current === range.commonAncestorContainer);
      const isInResolvedContent = resolvedContentRef.current && range.commonAncestorContainer && 
          (resolvedContentRef.current.contains(range.commonAncestorContainer) || 
           resolvedContentRef.current === range.commonAncestorContainer);
      
      if (selectedText && (isInRawContent || isInResolvedContent)) {
        if (isInRawContent) {
          // For raw content, try to find position in document content
          const fullText = document.content || '';
          const startIndex = fullText.indexOf(selectedText);
          
          if (startIndex !== -1) {
            setSelectedText(selectedText);
            setSelectionRange({
              start: startIndex,
              end: startIndex + selectedText.length
            });
            setShowCreateButton(true);
          } else {
            // Even if we can't find exact position, still allow extraction
            setSelectedText(selectedText);
            setSelectionRange({ start: 0, end: selectedText.length });
            setShowCreateButton(true);
          }
        } else {
          // For resolved content, we can't determine exact position in raw content
          // but we can still extract the selected text
          setSelectedText(selectedText);
          setSelectionRange({ start: 0, end: selectedText.length });
          setShowCreateButton(true);
        }
      } else {
        setSelectedText('');
        setSelectionRange(null);
        setShowCreateButton(false);
      }
    } catch (error) {
      // Silently handle any selection-related errors
      console.warn('Text selection error:', error);
      setSelectedText('');
      setSelectionRange(null);
      setShowCreateButton(false);
    }
  }, [document.content]);

  const handleShowExtractModal = useCallback(() => {
    setShowExtractModal(true);
  }, []);

  const handleExtractConfirm = useCallback((title: string, documentType: string, groupId?: string) => {
    try {
      if (selectedText && selectionRange && onCreateFromSelection) {
        onCreateFromSelection(selectedText, selectionRange, title, documentType, groupId);
        setSelectedText('');
        setSelectionRange(null);
        setShowCreateButton(false);
        setShowExtractModal(false);
        window.getSelection()?.removeAllRanges();
      }
    } catch (error) {
      console.error('Error creating document from selection:', error);
      // Reset state on error
      setSelectedText('');
      setSelectionRange(null);
      setShowCreateButton(false);
      setShowExtractModal(false);
    }
  }, [selectedText, selectionRange, onCreateFromSelection]);

  const handleExtractCancel = useCallback(() => {
    setShowExtractModal(false);
  }, []);

  const handleRollback = useCallback(async (historyId: string) => {
    if (!onRollback) return;
    try {
      await onRollback(document.id, historyId);
      setShowHistoryModal(false);
    } catch (err) {
      console.error('Failed to rollback document:', err);
      // Error handling is done in the hook, so we just need to not close the modal
    }
  }, [document.id, onRollback]);

  // Check if this is a chat document
  const isChatDocument = document.interaction_mode === 'chat';
  let chatData = null;
  
  if (isChatDocument && document.content) {
    try {
      chatData = JSON.parse(document.content);
    } catch (error) {
      console.warn('Failed to parse chat data:', error);
    }
  }

  return (
    <div className={`document-viewer ${headerVisible ? '' : 'header-hidden'}`}>
      {headerVisible && (
        <div className="document-viewer__header">
        <h3 className="document-viewer__title">
          {document.title}
          {isChatDocument && <span className="chat-indicator"> 💬</span>}
        </h3>

        {/* Document Metadata */}
        <div className="document-viewer__meta">
          <strong>Type:</strong> {currentDocument.document_type || 'No type'} •
          <strong>Format:</strong> {currentDocument.is_composite ? 'Composite Document' : 'Static Document'}
        </div>

        {/* Inline Tag Manager */}
        <div className="document-viewer__tags">
          <InlineTagManager
            projectId={projectId}
            documentId={document.id}
            currentTags={document.tags || []}
            onTagUpdate={onTagUpdate}
          />
        </div>

        {/* Document Type Dropdown */}
        {availableTypes.length > 1 && (
          <div className="document-viewer__type-selector">
            <div className="dropdown">
              <button 
                className="dropdown-button"
                onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                onBlur={() => setTimeout(() => setShowTypeDropdown(false), 200)}
              >
                {activeTab || 'Select Type'} ▼
              </button>
              {showTypeDropdown && (
                <div className="dropdown-menu">
                  {availableTypes.map(type => (
                    <button
                      key={type}
                      className={`dropdown-item ${activeTab === type ? 'dropdown-item--active' : ''}`}
                      onClick={() => {
                        setActiveTab(type);
                        setShowTypeDropdown(false);
                        const targetDoc = groupDocuments.find(doc => doc.document_type === type);
                        if (targetDoc && onDocumentSelect) {
                          onDocumentSelect(targetDoc);
                        }
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        
        
        <div className="document-viewer__actions">
          {onEditDocument && (
            <button 
              className="btn btn--primary" 
              onClick={() => onEditDocument(currentDocument)}
              title="Edit this document"
            >
              ✏️ Edit
            </button>
          )}
          {loadDocumentHistory && loadHistoryEntry && (
            <button className="btn btn--secondary" onClick={() => setShowHistoryModal(true)}>
              📜 History
            </button>
          )}
          {currentDocument.is_composite && (
            <button className="btn btn--primary" onClick={onResolve}>
              🔗 Resolve Template
            </button>
          )}
          <button 
            className="btn btn--ai" 
            onClick={() => setShowAIModal(true)}
            title="Chat with AI about this document"
          >
            🤖 AI Chat
          </button>
          <button 
            className="btn btn--ai btn--secondary" 
            onClick={() => setShowTransformModal(true)}
            title="Transform document using AI templates"
          >
            ⚡ Transform
          </button>
          {showCreateButton && selectedText && (
            <button className="btn btn--primary" onClick={handleShowExtractModal} style={{ marginLeft: '0.5rem' }}>
              📄 Extract "{selectedText.length > 20 ? selectedText.substring(0, 20) + '...' : selectedText}"
            </button>
          )}
          <button
            className="document-viewer__hide-btn"
            onClick={toggleHeader}
            title="Hide header"
          >
            ↑
          </button>
        </div>
        </div>
      )}
      {!headerVisible && (
        <div className="document-viewer__hover-trigger">
          <div className="document-viewer__show-hint" onClick={toggleHeader}>
            ↓ Show Header
          </div>
        </div>
      )}
      
      {/* Chat Document View */}
      {isChatDocument && chatData ? (
        <div className="chat-document-view">
          <div className="chat-document-info">
            <div className="chat-stats">
              <span>💬 {chatData.messages?.length || 0} messages</span>
              <span>💰 {chatData.total_cost || 0} credits spent</span>
              {chatData.active_context?.length > 0 && (
                <span>📄 {chatData.active_context.length} context docs</span>
              )}
            </div>
            <div className="chat-document-actions">
              <button 
                className="btn btn--primary"
                onClick={() => setShowAIModal(true)}
                title="Continue this chat conversation"
              >
                💬 Continue Chat
              </button>
              <button 
                className="btn btn--secondary"
                onClick={() => setShowAIModal(true)}
                title="Regenerate entire chat conversation from the beginning"
              >
                🔄 Regenerate Chat
              </button>
              <button 
                className="btn btn--danger btn--secondary"
                onClick={async () => {
                  if (confirm('Are you sure you want to clear all messages from this chat? This cannot be undone.')) {
                    try {
                      if (accessToken) {
                        await clearChatMessages(document.id, accessToken);
                        // Refresh the page or update the document to reflect the cleared chat
                        window.location.reload();
                      }
                    } catch (error) {
                      console.error('Error clearing chat:', error);
                      alert('Failed to clear chat messages. Please try again.');
                    }
                  }
                }}
                title="Clear all chat messages"
              >
                🗑️ Clear Chat
              </button>
            </div>
          </div>
          
          <div className="chat-messages-readonly">
            {chatData.messages?.map((message: any, index: number) => (
              <div key={index} className={`chat-message chat-message--${message.role}`}>
                <div className="chat-message__header">
                  <strong>{message.role === 'user' ? 'You' : 'AI'}</strong>
                  <span className="chat-message__time">
                    {message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : ''}
                  </span>
                  {message.tokens && (
                    <span className="chat-message__meta">
                      {message.tokens} tokens • {message.cost || 0} credits
                    </span>
                  )}
                </div>
                <div className="chat-message__content">
                  <div 
                    className="chat-message__markdown"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                  />
                </div>
              </div>
            )) || <p className="no-messages">No messages yet. Start a conversation using AI Chat!</p>}
          </div>
          
          {chatData.conversation_summary && (
            <div className="chat-summary">
              <h4>Conversation Summary:</h4>
              <p>{chatData.conversation_summary}</p>
            </div>
          )}
        </div>
      ) : (
        // Regular Document View
        <>
          {/* For non-composite documents, show raw content at top */}
          {!currentDocument.is_composite && (
            <div className="content-section">
              <h4>Raw Content</h4>
              <div
                ref={contentRef}
                className="document-reader document-reader--raw"
                onMouseUp={handleTextSelection}
                onKeyUp={handleTextSelection}
                style={{ userSelect: 'text', cursor: 'text' }}
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(currentDocument.content || '*No content*')
                }}
              />
            </div>
          )}

          {/* For composite documents, show resolved content first */}
          {currentDocument.is_composite && resolvedContent && (
            <div className="content-section">
              <h4>Resolved Content:</h4>
              <div
                ref={resolvedContentRef}
                className="document-reader document-reader--resolved"
                onMouseUp={handleTextSelection}
                onKeyUp={handleTextSelection}
                style={{ userSelect: 'text', cursor: 'text' }}
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(resolvedContent)
                }}
              />

              {/* Toggle buttons for composite document sections */}
              <div className="document-section-toggles">
                <button
                  className="btn btn--secondary btn--sm"
                  onClick={toggleComponents}
                  title={componentsVisible ? "Hide components section" : "Show components section"}
                >
                  {componentsVisible ? "⊖" : "⊕"} Components
                </button>
                <button
                  className="btn btn--secondary btn--sm"
                  onClick={toggleRawContent}
                  title={rawContentVisible ? "Hide raw content section" : "Show raw content section"}
                >
                  {rawContentVisible ? "⊖" : "⊕"} Raw Content
                </button>
              </div>
            </div>
          )}

          {/* Components section - appears at bottom when toggled for composite docs */}
          {currentDocument.is_composite && Object.keys(currentDocument.components || {}).length > 0 && componentsVisible && (
            <div className="document-components">
              <h4>Components:</h4>
              <div className="components-list">
                {Object.entries(currentDocument.components || {}).map(([key, docId]) => (
                  <div key={key} className="component-mapping">
                    <strong>{`{{${key}}}`}</strong> → {docId}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw Content section - appears at bottom when toggled for composite docs */}
          {currentDocument.is_composite && rawContentVisible && (
            <div className="content-section">
              <h4>Raw Content</h4>
              <div
                ref={contentRef}
                className="document-reader document-reader--raw"
                onMouseUp={handleTextSelection}
                onKeyUp={handleTextSelection}
                style={{ userSelect: 'text', cursor: 'text' }}
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(currentDocument.content || '*No content*')
                }}
              />
            </div>
          )}
        </>
      )}

      {showExtractModal && (
        <ExtractTextModal
          sourceDocument={currentDocument}
          selectedText={selectedText}
          allDocuments={allDocuments}
          onConfirm={handleExtractConfirm}
          onCancel={handleExtractCancel}
        />
      )}
      
      {showHistoryModal && loadDocumentHistory && loadHistoryEntry && (
        <DocumentHistoryModal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          document={document}
          projectId={projectId}
          loadDocumentHistory={loadDocumentHistory}
          loadHistoryEntry={loadHistoryEntry}
          onRollback={onRollback ? handleRollback : undefined}
          onDeleteHistory={onDeleteHistory}
        />
      )}

      {showAIModal && aiProviders.length > 0 && (
        <AIChatModal
          isOpen={showAIModal}
          onClose={() => setShowAIModal(false)}
          document={document}
          allDocuments={allDocuments}
          aiProviders={aiProviders}
          accessToken={accessToken}
          projectId={projectId}
          onDocumentSwitch={onDocumentSelect}
          onDocumentUpdate={onDocumentUpdate}
        />
      )}

      {showTransformModal && aiProviders.length > 0 && (
        <TransformModal
          isOpen={showTransformModal}
          onClose={() => setShowTransformModal(false)}
          document={document}
          documents={allDocuments}
          aiProviders={aiProviders}
          accessToken={accessToken}
          projectId={projectId}
          onSuccess={(newDocument) => {
            console.log('Transform successful, new document created:', newDocument);
            setShowTransformModal(false);
            // Notify parent component to refresh documents
            if (onDocumentUpdate) {
              onDocumentUpdate();
            }
          }}
        />
      )}
    </div>
  );
}

export type { DocumentViewerProps };