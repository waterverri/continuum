import { useState, useEffect } from 'react';
import type { Document } from '../api';

interface DocumentGroupDeletionModalProps {
  isOpen: boolean;
  document: Document;
  groupDocuments: Document[];
  onClose: () => void;
  onDeleteDocument: (documentId: string) => void;
}

export function DocumentGroupDeletionModal({ 
  isOpen, 
  document, 
  groupDocuments, 
  onClose, 
  onDeleteDocument
}: DocumentGroupDeletionModalProps) {
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedDocuments(new Set());
      setShowConfirmation(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isGroupedDocument = Boolean(document.group_id);
  const isGroupHead = document.id === document.group_id;
  const groupSize = groupDocuments.length;

  const handleProceed = () => {
    if (selectedDocuments.size === 0) return;
    setShowConfirmation(true);
  };

  const handleConfirmDelete = () => {
    // Delete each selected document individually
    selectedDocuments.forEach(documentId => {
      onDeleteDocument(documentId);
    });
    onClose();
  };

  const toggleDocumentSelection = (documentId: string) => {
    const newSelected = new Set(selectedDocuments);
    if (newSelected.has(documentId)) {
      newSelected.delete(documentId);
    } else {
      newSelected.add(documentId);
    }
    setSelectedDocuments(newSelected);
  };

  const selectAll = () => {
    setSelectedDocuments(new Set(groupDocuments.map(doc => doc.id)));
  };

  const selectNone = () => {
    setSelectedDocuments(new Set());
  };

  const handleCancel = () => {
    if (showConfirmation) {
      setShowConfirmation(false);
    } else {
      onClose();
    }
  };

  if (!showConfirmation) {
    return (
      <div className="modal-overlay">
        <div className="modal-content component-key-modal">
          <div className="modal-header">
            <h3>Delete Document</h3>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
          
          <div className="modal-body">
            <div className="document-deletion-info">
              <p><strong>Document:</strong> {document.title}</p>
              {isGroupedDocument && (
                <>
                  <p><strong>Type:</strong> {document.document_type || 'No type'}</p>
                  <p><strong>Group Status:</strong> {isGroupHead ? 'Group Head Document' : 'Group Member'}</p>
                  <p><strong>Documents in Group:</strong> {groupSize}</p>
                </>
              )}
            </div>

            <div className="document-selection">
              <div className="selection-header">
                <p>Select which documents to delete from this group ({groupSize} documents):</p>
                <div className="selection-controls">
                  <button type="button" className="btn btn--sm btn--secondary" onClick={selectAll}>
                    Select All
                  </button>
                  <button type="button" className="btn btn--sm btn--secondary" onClick={selectNone}>
                    Select None
                  </button>
                </div>
              </div>

              <div className="documents-list-scrollable">
                {groupDocuments.map(doc => (
                  <label key={doc.id} className="document-checkbox-item">
                    <input
                      type="checkbox"
                      checked={selectedDocuments.has(doc.id)}
                      onChange={() => toggleDocumentSelection(doc.id)}
                    />
                    <div className="document-info">
                      <div className="document-title">{doc.title}</div>
                      <div className="document-meta">
                        <span className="document-type">{doc.document_type || 'No type'}</span>
                        {doc.id === doc.group_id && <span className="head-badge">Group Head</span>}
                        {doc.id === document.id && <span className="current-badge">Current</span>}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              {selectedDocuments.size > 0 && (
                <div className="selection-summary">
                  <strong>{selectedDocuments.size} document(s) selected for deletion</strong>
                  {selectedDocuments.has(document.group_id || '') && (
                    <div className="warning-text">
                      ⚠️ Group head will be deleted. Another document will be automatically assigned as the new group head.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button className="btn btn--secondary" onClick={onClose}>
              Cancel
            </button>
            <button 
              className="btn btn--danger" 
              onClick={handleProceed}
              disabled={selectedDocuments.size === 0}
            >
              Delete Selected ({selectedDocuments.size})
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Confirmation step
  return (
    <div className="modal-overlay">
      <div className="modal-content component-key-modal">
        <div className="modal-header">
          <h3>Confirm Deletion</h3>
          <button className="modal-close" onClick={handleCancel}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="confirmation-content">
            <div className="deletion-confirmation">
              <div className="confirmation-icon">⚠️</div>
              <h4>Delete Selected Documents?</h4>
              <p>You are about to permanently delete <strong>{selectedDocuments.size} document{selectedDocuments.size > 1 ? 's' : ''}</strong>:</p>
              <ul className="documents-to-delete">
                {Array.from(selectedDocuments).map(docId => {
                  const doc = groupDocuments.find(d => d.id === docId);
                  return doc ? (
                    <li key={doc.id}>
                      <strong>{doc.title}</strong> ({doc.document_type || 'No type'})
                      {doc.id === doc.group_id && <span className="head-indicator">Group Head</span>}
                    </li>
                  ) : null;
                })}
              </ul>
              {selectedDocuments.has(document.group_id || '') && (
                <p className="group-head-warning">
                  ⚠️ The group head document will be deleted. Another document will be automatically assigned as the new group head.
                </p>
              )}
              <p className="final-warning">
                <strong>This action cannot be undone.</strong> All document content, tags, and associations will be permanently lost.
              </p>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn--secondary" onClick={handleCancel}>
            Go Back
          </button>
          <button className="btn btn--danger" onClick={handleConfirmDelete}>
            Delete {selectedDocuments.size} Document{selectedDocuments.size > 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}