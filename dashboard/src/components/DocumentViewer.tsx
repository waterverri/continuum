import { useState, useRef, useCallback, useEffect } from 'react';
import type { Document, DocumentHistoryResponse, DocumentHistory } from '../api';
import { ExtractTextModal } from './ExtractTextModal';
import { InlineTagManager } from './InlineTagManager';
import DocumentHistoryModal from './DocumentHistoryModal';

interface DocumentViewerProps {
  document: Document;
  allDocuments: Document[];
  resolvedContent: string | null;
  onResolve: () => void;
  onCreateFromSelection?: (selectedText: string, selectionInfo: { start: number; end: number }, title: string, documentType: string, groupId?: string) => void;
  onDocumentSelect?: (document: Document) => void;
  onTagUpdate?: (documentId: string, tagIds: string[]) => void;
  projectId: string;
  loadDocumentHistory?: (documentId: string, limit?: number, offset?: number) => Promise<DocumentHistoryResponse>;
  loadHistoryEntry?: (documentId: string, historyId: string) => Promise<DocumentHistory>;
  onRollback?: (documentId: string, historyId: string) => Promise<Document>;
  onDeleteHistory?: (historyId: string) => Promise<void>;
}

export function DocumentViewer({ 
  document, 
  allDocuments, 
  resolvedContent, 
  onResolve, 
  onCreateFromSelection, 
  onDocumentSelect,
  onTagUpdate,
  projectId,
  loadDocumentHistory,
  loadHistoryEntry,
  onRollback,
  onDeleteHistory
}: DocumentViewerProps) {
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [showCreateButton, setShowCreateButton] = useState(false);
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(document.document_type || '');
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
  }, [document.id, document.document_type]);

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

  return (
    <div className="document-viewer">
      <div className="document-viewer__header">
        <h3 className="document-viewer__title">{document.title}</h3>
        
        {/* Document Type Tabs */}
        {availableTypes.length > 1 && (
          <div className="document-viewer__tabs">
            {availableTypes.map(type => (
              <button
                key={type}
                className={`document-tab ${activeTab === type ? 'document-tab--active' : ''}`}
                onClick={() => {
                  setActiveTab(type);
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
        
        
        <div className="document-viewer__actions">
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
          {showCreateButton && selectedText && (
            <button className="btn btn--primary" onClick={handleShowExtractModal} style={{ marginLeft: '0.5rem' }}>
              📄 Extract "{selectedText.length > 20 ? selectedText.substring(0, 20) + '...' : selectedText}"
            </button>
          )}
        </div>
      </div>
      
      {currentDocument.is_composite && Object.keys(currentDocument.components || {}).length > 0 && (
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
      
      <div className="content-section">
        <div className="document-content-header">
          <h4>Raw Content</h4>
          <div className="document-content-meta">
            <strong>Type:</strong> {currentDocument.document_type || 'No type'} • 
            <strong>Format:</strong> {currentDocument.is_composite ? 'Composite Document' : 'Static Document'}
          </div>
        </div>
        
        {/* Inline Tag Manager */}
        <div className="document-content-tags">
          <InlineTagManager
            projectId={projectId}
            documentId={document.id}
            currentTags={document.tags || []}
            onTagUpdate={onTagUpdate}
          />
        </div>
        
        <div 
          ref={contentRef}
          className="content-display content-display--raw" 
          onMouseUp={handleTextSelection}
          onKeyUp={handleTextSelection}
          style={{ userSelect: 'text', cursor: 'text' }}
        >
          {currentDocument.content || 'No content'}
        </div>
      </div>
      
      {currentDocument.is_composite && resolvedContent && (
        <div className="content-section">
          <h4>Resolved Content:</h4>
          <div 
            ref={resolvedContentRef}
            className="content-display content-display--resolved"
            onMouseUp={handleTextSelection}
            onKeyUp={handleTextSelection}
            style={{ userSelect: 'text', cursor: 'text' }}
          >
            {resolvedContent}
          </div>
        </div>
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
    </div>
  );
}

export type { DocumentViewerProps };