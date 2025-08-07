import React from 'react';

interface ComponentKeyInputModalProps {
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ComponentKeyInputModal({ value, onChange, onConfirm, onCancel }: ComponentKeyInputModalProps) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content component-key-modal">
        <div className="modal-header">
          <h3>Add Component</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="key-input-section">
            <label className="form-label">
              Placeholder Key (without {`{{}}`}):
              <input
                type="text"
                className="form-input"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="e.g., chapter1, character_intro, setting"
                autoFocus
              />
            </label>
            <p className="key-input-help">
              This key will be used as {value && `{{${value}}}`} in your template content.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn--secondary" onClick={onCancel}>
            Cancel
          </button>
          <button 
            className="btn btn--primary" 
            onClick={onConfirm}
            disabled={!value.trim()}
          >
            Next: Select Document
          </button>
        </div>
      </div>
    </div>
  );
}

export type { ComponentKeyInputModalProps };