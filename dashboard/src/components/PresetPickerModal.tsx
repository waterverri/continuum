import React, { useState } from 'react';
import type { Document } from '../api';
import { DocumentListItem } from './DocumentList';

interface PresetPickerModalProps {
  documents: Document[];
  onSelect: (name: string, document: Document) => void;
  onCancel: () => void;
}

export function PresetPickerModal({ documents, onSelect, onCancel }: PresetPickerModalProps) {
  const [presetName, setPresetName] = useState('');
  const [step, setStep] = useState<'name' | 'document'>('name');

  const handleNameConfirm = () => {
    if (presetName.trim()) {
      setStep('document');
    }
  };

  const handleDocumentSelect = (document: Document) => {
    onSelect(presetName, document);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && step === 'name') {
      handleNameConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (step === 'name') {
    return (
      <div className="modal-overlay">
        <div className="modal-content preset-name-modal">
          <div className="modal-header">
            <h3>Create Preset</h3>
            <button className="modal-close" onClick={onCancel}>×</button>
          </div>
          
          <div className="modal-body">
            <div className="preset-name-section">
              <label className="form-label">
                Preset Name (will be used in API endpoint):
                <input
                  type="text"
                  className="form-input"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="e.g., character-sheet, world-guide"
                  autoFocus
                />
              </label>
              <p className="preset-name-help">
                This will create the endpoint: <code>/preset/&#123;project-id&#125;/{presetName || '{name}'}</code>
              </p>
            </div>
          </div>

          <div className="modal-footer">
            <button className="btn btn--secondary" onClick={onCancel}>
              Cancel
            </button>
            <button 
              className="btn btn--primary" 
              onClick={handleNameConfirm}
              disabled={!presetName.trim()}
            >
              Next: Select Document
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content document-picker-modal">
        <div className="modal-header">
          <h3>Select Document for "{presetName}"</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="document-picker-list">
            {documents.map((document) => (
              <DocumentListItem
                key={document.id}
                document={document}
                onClick={handleDocumentSelect}
                showPreview={true}
                variant="picker"
              />
            ))}
            {documents.length === 0 && (
              <div className="empty-state">
                <p>No documents available.</p>
                <p>Create a document first before creating a preset.</p>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn--secondary" onClick={() => setStep('name')}>
            Back
          </button>
          <button className="btn btn--secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export type { PresetPickerModalProps };