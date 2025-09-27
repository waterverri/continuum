import { useState, useRef, useCallback, useEffect } from 'react';
import { marked } from 'marked';
import type { Document, DocumentHistoryResponse, DocumentHistory, AIProvider } from '../api';
import { clearChatMessages } from '../api';
import { ExtractButton } from './ExtractButton';
import { InlineTagManager } from './InlineTagManager';
import DocumentHistoryModal from './DocumentHistoryModal';
import { AIChatModal } from './AIChatModal';
import { TransformModal } from './TransformModal';

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});


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
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showTransformModal, setShowTransformModal] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState<string>(document.id);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const hasComponents = document.components && Object.keys(document.components).length > 0;
  const [rawContentVisible, setRawContentVisible] = useState(!hasComponents); // Hidden by default for templates
  const [componentsVisible, setComponentsVisible] = useState(!hasComponents); // Hidden by default for templates
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
  const availableTypes = [...new Set(groupDocuments.map(doc => doc.document_type || 'document').filter((type): type is string => Boolean(type)))];
  
  // Get current document based on active document ID
  const currentDocument = groupDocuments.find(doc => doc.id === activeDocumentId) || document;

  console.log('📊 CURRENT DOCUMENT CALCULATION:', {
    activeDocumentId,
    groupDocuments: groupDocuments.map(d => ({ id: d.id, type: d.document_type, title: d.title })),
    foundDoc: groupDocuments.find(doc => doc.id === activeDocumentId),
    currentDocument: { id: currentDocument.id, type: currentDocument.document_type, title: currentDocument.title }
  });

  
  // Update active document ID when document changes
  useEffect(() => {
    console.log('🔄 DOCUMENT CHANGED EFFECT:', {
      documentId: document.id,
      documentType: document.document_type,
      oldActiveDocumentId: activeDocumentId,
      newActiveDocumentId: document.id
    });
    setActiveDocumentId(document.id);
    // Reset visibility states when document changes
    const hasComponents = document.components && Object.keys(document.components).length > 0;
    setRawContentVisible(!hasComponents);
    setComponentsVisible(!hasComponents);
  }, [document.id, document.document_type, document.components]);


  const handleRollback = useCallback(async (historyId: string) => {
    if (!onRollback) return;
    try {
      await onRollback(currentDocument.id, historyId);
      setShowHistoryModal(false);
    } catch (err) {
      console.error('Failed to rollback document:', err);
      // Error handling is done in the hook, so we just need to not close the modal
    }
  }, [currentDocument.id, onRollback]);

  // Check if this is a chat document
  const isChatDocument = currentDocument.interaction_mode === 'chat';
  let chatData = null;

  if (isChatDocument && currentDocument.content) {
    try {
      chatData = JSON.parse(currentDocument.content);
    } catch (error) {
      console.warn('Failed to parse chat data:', error);
    }
  }

  return (
    <div className={`document-viewer ${headerVisible ? '' : 'header-hidden'}`}>
      {headerVisible && (
        <div className="document-viewer__header">
        <h3 className="document-viewer__title">
          {currentDocument.title}
          {isChatDocument && <span className="chat-indicator"> 💬</span>}
        </h3>

        {/* Document Metadata */}
        <div className="document-viewer__meta">
          <strong>Type:</strong> {currentDocument.document_type || 'No type'} •
          <strong>Format:</strong> {currentDocument.components && Object.keys(currentDocument.components).length > 0 ? 'Composite Document' : 'Static Document'}
        </div>

        {/* Inline Tag Manager */}
        <div className="document-viewer__tags">
          <InlineTagManager
            projectId={projectId}
            documentId={currentDocument.id}
            currentTags={currentDocument.tags || []}
            onTagUpdate={onTagUpdate}
          />
        </div>

        {/* Document Type Dropdown */}
        {groupDocuments.length > 1 && (
          <div className="document-viewer__type-selector">
            <div className="dropdown">
              <button
                className="dropdown-button"
                onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                onBlur={() => setTimeout(() => setShowTypeDropdown(false), 200)}
              >
                {currentDocument.document_type || 'Select Type'} ▼
              </button>
              {showTypeDropdown && (
                <div className="dropdown-menu">
                  {groupDocuments.map(doc => (
                    <button
                      key={doc.id}
                      className={`dropdown-item ${currentDocument.id === doc.id ? 'dropdown-item--active' : ''}`}
                      data-doc-id={doc.id}
                      onClick={() => {
                        console.log('🔥 DROPDOWN CLICKED:', {
                          clickedDoc: { id: doc.id, title: doc.title, type: doc.document_type },
                          originalDoc: { id: document.id, title: document.title, type: document.document_type },
                          currentDoc: { id: currentDocument.id, title: currentDocument.title, type: currentDocument.document_type },
                          activeDocumentId: activeDocumentId,
                          newActiveDocumentId: doc.id
                        });

                        setActiveDocumentId(doc.id);
                        console.log('🎯 ACTIVE DOCUMENT ID SET TO:', doc.id);

                        setShowTypeDropdown(false);
                        console.log('📋 DROPDOWN CLOSED');

                        if (onDocumentSelect) {
                          console.log('✅ onDocumentSelect EXISTS');
                          if (doc.id !== document.id) {
                            console.log('🚀 CALLING onDocumentSelect with doc:', doc);
                            onDocumentSelect(doc);
                          } else {
                            console.log('❌ NOT CALLING onDocumentSelect - same document ID');
                          }
                        } else {
                          console.log('❌ onDocumentSelect is NULL/UNDEFINED');
                        }
                      }}
                    >
                      {availableTypes.length < groupDocuments.length
                        ? `${doc.document_type || 'document'} - ${doc.title}`
                        : doc.document_type || 'document'
                      }
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
          {currentDocument.components && Object.keys(currentDocument.components).length > 0 && (
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
        <button
          className="document-viewer__toggle-btn"
          onClick={toggleHeader}
          title="Show header"
        >
          ↓
        </button>
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
                        await clearChatMessages(currentDocument.id, accessToken);
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
            {chatData.messages?.map((message: { role: string; content: string; timestamp?: string; tokens?: number; cost?: number }, index: number) => (
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
                    dangerouslySetInnerHTML={{ __html: marked(message.content) as string }}
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
          {!(currentDocument.components && Object.keys(currentDocument.components).length > 0) && (
            <div className="content-section">
              <div
                ref={contentRef}
                className="document-reader document-reader--raw"
                style={{ userSelect: 'text', cursor: 'text' }}
                dangerouslySetInnerHTML={{
                  __html: marked(currentDocument.content || '*No content*') as string
                }}
              />
            </div>
          )}

          {/* For composite documents, show resolved content first */}
          {currentDocument.components && Object.keys(currentDocument.components).length > 0 && resolvedContent && (
            <div className="content-section">
              <div
                ref={resolvedContentRef}
                className="document-reader document-reader--resolved"
                style={{ userSelect: 'text', cursor: 'text' }}
                dangerouslySetInnerHTML={{
                  __html: marked(resolvedContent) as string
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
          {currentDocument.components && Object.keys(currentDocument.components).length > 0 && componentsVisible && (
            <div className="document-components">
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
          {currentDocument.components && Object.keys(currentDocument.components).length > 0 && rawContentVisible && (
            <div className="content-section">
              <div
                ref={contentRef}
                className="document-reader document-reader--raw"
                style={{ userSelect: 'text', cursor: 'text' }}
                dangerouslySetInnerHTML={{
                  __html: marked(currentDocument.content || '*No content*') as string
                }}
              />
            </div>
          )}
        </>
      )}

      {/* Extract Button - positioned as floating button */}
      <div className="extract-button-container">
        <ExtractButton
          sourceDocument={currentDocument}
          allDocuments={allDocuments}
          onCreateFromSelection={onCreateFromSelection}
          contentRefs={[contentRef, resolvedContentRef]}
        />
      </div>
      
      {showHistoryModal && loadDocumentHistory && loadHistoryEntry && (
        <DocumentHistoryModal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          document={currentDocument}
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
          document={currentDocument}
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
          document={currentDocument}
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