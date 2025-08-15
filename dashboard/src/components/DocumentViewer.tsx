import { useState, useRef, useCallback } from 'react';
import type { Document } from '../api';

interface DocumentViewerProps {
  document: Document;
  resolvedContent: string | null;
  onResolve: () => void;
  onCreateFromSelection?: (selectedText: string, selectionInfo: { start: number; end: number }) => void;
}

export function DocumentViewer({ document, resolvedContent, onResolve, onCreateFromSelection }: DocumentViewerProps) {
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [showCreateButton, setShowCreateButton] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setSelectedText('');
      setSelectionRange(null);
      setShowCreateButton(false);
      return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    
    // Only show button if text is selected and it's within our content div
    if (selectedText && contentRef.current && contentRef.current.contains(range.commonAncestorContainer)) {
      // Calculate text position in the full document content
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
        setSelectedText('');
        setSelectionRange(null);
        setShowCreateButton(false);
      }
    } else {
      setSelectedText('');
      setSelectionRange(null);
      setShowCreateButton(false);
    }
  }, [document.content]);

  const handleCreateFromSelection = useCallback(() => {
    if (selectedText && selectionRange && onCreateFromSelection) {
      onCreateFromSelection(selectedText, selectionRange);
      setSelectedText('');
      setSelectionRange(null);
      setShowCreateButton(false);
      window.getSelection()?.removeAllRanges();
    }
  }, [selectedText, selectionRange, onCreateFromSelection]);

  return (
    <div className="document-viewer">
      <div className="document-viewer__header">
        <h3 className="document-viewer__title">{document.title}</h3>
        <p className="document-viewer__meta">
          <strong>Type:</strong> {document.document_type || 'No type'} • 
          <strong>Format:</strong> {document.is_composite ? 'Composite Document' : 'Static Document'}
        </p>
        {document.is_composite && (
          <button className="btn btn--primary" onClick={onResolve}>
            🔗 Resolve Template
          </button>
        )}
        {showCreateButton && selectedText && !document.is_composite && (
          <button className="btn btn--success" onClick={handleCreateFromSelection} style={{ marginLeft: '0.5rem' }}>
            📄 Extract "{selectedText.length > 20 ? selectedText.substring(0, 20) + '...' : selectedText}"
          </button>
        )}
      </div>
      
      {document.is_composite && Object.keys(document.components || {}).length > 0 && (
        <div className="document-components">
          <h4>Components:</h4>
          <div className="components-list">
            {Object.entries(document.components || {}).map(([key, docId]) => (
              <div key={key} className="component-mapping">
                <strong>{`{{${key}}}`}</strong> → {docId}
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="content-section">
        <h4>Raw Content:</h4>
        <div 
          ref={contentRef}
          className="content-display content-display--raw" 
          onMouseUp={handleTextSelection}
          onKeyUp={handleTextSelection}
          style={{ userSelect: 'text', cursor: 'text' }}
        >
          {document.content || 'No content'}
        </div>
      </div>
      
      {document.is_composite && resolvedContent && (
        <div className="content-section">
          <h4>Resolved Content:</h4>
          <div className="content-display content-display--resolved">
            {resolvedContent}
          </div>
        </div>
      )}
    </div>
  );
}

export type { DocumentViewerProps };