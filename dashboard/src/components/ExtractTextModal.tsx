import React, { useState } from 'react';
import type { Document } from '../api';

interface ExtractTextModalProps {
  sourceDocument: Document | null;
  selectedText: string;
  onConfirm: (title: string, documentType: string) => void;
  onCancel: () => void;
}

export function ExtractTextModal({ sourceDocument, selectedText, onConfirm, onCancel }: ExtractTextModalProps) {
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState(sourceDocument?.document_type || '');

  const handleConfirm = () => {
    if (title.trim() && documentType.trim()) {
      onConfirm(title.trim(), documentType.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content extract-text-modal">
        <div className="modal-header">
          <h3>Extract Text to New Document</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        
        <div className="modal-body">
          {sourceDocument && (
            <div className="source-document-info">
              <p><strong>Source:</strong> {sourceDocument.title}</p>
              <p><strong>Selected Text:</strong> "{selectedText.length > 100 ? selectedText.substring(0, 100) + '...' : selectedText}"</p>
            </div>
          )}

          <div className="extract-form">
            <label className="form-label">
              Title:
              <input
                type="text"
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Enter title for extracted document"
                autoFocus
              />
            </label>

            <label className="form-label">
              Document Type:
              <input
                type="text"
                className="form-input"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Enter document type (e.g., event, character, location)"
              />
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn--secondary" onClick={onCancel}>
            Cancel
          </button>
          <button 
            className="btn btn--primary" 
            onClick={handleConfirm}
            disabled={!title.trim() || !documentType.trim()}
          >
            Extract Text
          </button>
        </div>
      </div>
    </div>
  );
}

export type { ExtractTextModalProps };