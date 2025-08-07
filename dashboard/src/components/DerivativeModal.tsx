import React, { useState } from 'react';
import type { Document } from '../api';

interface DerivativeModalProps {
  sourceDocument: Document | null;
  onConfirm: (derivativeType: string, title: string) => void;
  onCancel: () => void;
}

export function DerivativeModal({ sourceDocument, onConfirm, onCancel }: DerivativeModalProps) {
  const [derivativeType, setDerivativeType] = useState('');
  const [title, setTitle] = useState('');

  const handleConfirm = () => {
    if (derivativeType.trim() && title.trim()) {
      onConfirm(derivativeType.trim(), title.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const generateSuggestedTitle = (type: string) => {
    if (!sourceDocument) return '';
    const baseTitle = sourceDocument.title;
    return type ? `${baseTitle} - ${type}` : baseTitle;
  };

  const handleTypeChange = (type: string) => {
    setDerivativeType(type);
    if (!title || title === generateSuggestedTitle(derivativeType)) {
      setTitle(generateSuggestedTitle(type));
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content derivative-modal">
        <div className="modal-header">
          <h3>Create Derivative Document</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        
        <div className="modal-body">
          {sourceDocument && (
            <div className="source-document-info">
              <p><strong>Source:</strong> {sourceDocument.title}</p>
              {sourceDocument.document_type && (
                <p><strong>Type:</strong> {sourceDocument.document_type}</p>
              )}
            </div>
          )}

          <div className="derivative-form">
            <label className="form-label">
              Document Type:
              <input
                type="text"
                className="form-input"
                value={derivativeType}
                onChange={(e) => handleTypeChange(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Enter any type (e.g., summary, analysis, notes, translation)"
                autoFocus
              />
            </label>

            <label className="form-label">
              Title:
              <input
                type="text"
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Enter derivative document title"
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
            disabled={!derivativeType.trim() || !title.trim()}
          >
            Create Derivative
          </button>
        </div>
      </div>
    </div>
  );
}

export type { DerivativeModalProps };