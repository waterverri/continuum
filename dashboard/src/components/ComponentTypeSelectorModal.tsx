import React from 'react';

interface ComponentTypeSelectorModalProps {
  componentKey: string | null;
  onSelect: (type: 'document' | 'group') => void;
  onCancel: () => void;
}

export function ComponentTypeSelectorModal({ componentKey, onSelect, onCancel }: ComponentTypeSelectorModalProps) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content component-key-modal">
        <div className="modal-header">
          <h3>Select Component Type</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="key-input-section">
            <p>Choose how to populate the component key <strong>{componentKey}</strong>:</p>
            <div className="form-actions">
              <button 
                className="btn btn--primary"
                onClick={() => onSelect('document')}
                onKeyDown={handleKeyPress}
                autoFocus
              >
                Select Document
              </button>
              <button 
                className="btn btn--secondary"
                onClick={() => onSelect('group')}
                onKeyDown={handleKeyPress}
              >
                Select Group
              </button>
            </div>
            <p className="key-input-help">
              <strong>Document:</strong> Choose a specific document to populate this component.<br/>
              <strong>Group:</strong> Choose a document group - the system will use the preferred group member.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { ComponentTypeSelectorModalProps };