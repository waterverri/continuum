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
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleDocumentSelect = (document: Document) => {
    setSelectedDocument(document);
  };

  const handleSubmit = async () => {
    if (!presetName.trim() || !selectedDocument) return;
    
    setIsLoading(true);
    try {
      await onSelect(presetName.trim(), selectedDocument);
    } catch (error) {
      console.error('Failed to create preset:', error);
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && presetName.trim() && selectedDocument) {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content preset-create-modal">
        <div className="modal-header">
          <h3>Create New Preset</h3>
          <button className="modal-close" onClick={onCancel}>&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="preset-create-form">
            {/* Step 1: Preset Name */}
            <div className="form-section">
              <div className="form-section-header">
                <h4>1. Preset Configuration</h4>
                <p>Configure your preset name and API endpoint</p>
              </div>
              
              <div className="form-group">
                <label className="form-label">
                  Preset Name *
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
                <p className="form-help">
                  API endpoint: <code>/preset/&#123;project-id&#125;/{presetName || '{name}'}</code>
                </p>
              </div>
            </div>

            {/* Step 2: Document Selection */}
            <div className="form-section">
              <div className="form-section-header">
                <h4>2. Document Selection</h4>
                <p>Choose the document this preset will serve</p>
              </div>

              {selectedDocument && (
                <div className="selected-document-preview">
                  <h5>Selected Document:</h5>
                  <div className="current-document">
                    <DocumentListItem
                      document={selectedDocument}
                      onClick={() => setSelectedDocument(null)}
                      showPreview={false}
                      variant="picker"
                    />
                  </div>
                  <p className="form-help">Click to change selection</p>
                </div>
              )}

              <div className="document-picker-section">
                <h5>{selectedDocument ? 'Choose Different Document:' : 'Select Document:'}</h5>
                <div className="document-picker-list">
                  {documents.map((document) => (
                    <DocumentListItem
                      key={document.id}
                      document={document}
                      onClick={handleDocumentSelect}
                      showPreview={true}
                      variant="picker"
                      isSelected={selectedDocument?.id === document.id}
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
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button 
            className="btn btn--secondary" 
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button 
            className="btn btn--primary" 
            onClick={handleSubmit}
            disabled={!presetName.trim() || !selectedDocument || isLoading}
          >
            {isLoading ? 'Creating...' : 'Create Preset'}
          </button>
        </div>
      </div>
    </div>
  );
}

export type { PresetPickerModalProps };