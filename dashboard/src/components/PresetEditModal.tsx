import React, { useState } from 'react';
import type { Preset, Document } from '../api';
import { DocumentListItem } from './DocumentList';

interface PresetEditModalProps {
  preset: Preset;
  documents: Document[];
  onSave: (presetId: string, name: string, documentId?: string) => Promise<void>;
  onCancel: () => void;
}

export function PresetEditModal({ preset, documents, onSave, onCancel }: PresetEditModalProps) {
  const [name, setName] = useState(preset.name);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | undefined>(
    preset.rules?.document_id
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    
    setIsLoading(true);
    try {
      await onSave(preset.id, name.trim(), selectedDocumentId);
    } catch (error) {
      console.error('Failed to save preset:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDocumentSelect = (document: Document) => {
    setSelectedDocumentId(document.id);
  };

  const selectedDocument = documents.find(doc => doc.id === selectedDocumentId);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content preset-edit-modal">
        <div className="modal-header">
          <h3>Edit Preset</h3>
          <button className="modal-close" onClick={onCancel}>&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="preset-edit-form">
            <div className="form-group">
              <label className="form-label">
                Preset Name:
                <input
                  type="text"
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="e.g., character-sheet, world-guide"
                  autoFocus
                />
              </label>
              <p className="form-help">
                This will be used in the API endpoint: <code>/preset/&#123;project-id&#125;/{name || '{name}'}</code>
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Current Document:</label>
              {selectedDocument ? (
                <div className="current-document">
                  <DocumentListItem
                    document={selectedDocument}
                    onClick={() => {}}
                    showPreview={false}
                    variant="picker"
                  />
                </div>
              ) : (
                <div className="no-document">
                  <p>No document selected</p>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Select Different Document (optional):</label>
              <div className="document-picker-list">
                {documents.map((document) => (
                  <DocumentListItem
                    key={document.id}
                    document={document}
                    onClick={handleDocumentSelect}
                    showPreview={true}
                    variant="picker"
                    isSelected={document.id === selectedDocumentId}
                  />
                ))}
                {documents.length === 0 && (
                  <div className="empty-state">
                    <p>No documents available.</p>
                  </div>
                )}
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
            onClick={handleSave}
            disabled={!name.trim() || isLoading}
          >
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}