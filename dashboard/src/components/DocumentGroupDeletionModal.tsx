import { useState, useEffect } from 'react';
import type { Document } from '../api';

interface DocumentGroupDeletionModalProps {
  isOpen: boolean;
  document: Document;
  groupDocuments: Document[];
  onClose: () => void;
  onDeleteDocument: (documentId: string) => void;
  onDeleteGroup: (groupId: string) => void;
}

export function DocumentGroupDeletionModal({ 
  isOpen, 
  document, 
  groupDocuments, 
  onClose, 
  onDeleteDocument, 
  onDeleteGroup 
}: DocumentGroupDeletionModalProps) {
  const [selectedAction, setSelectedAction] = useState<'individual' | 'group'>('individual');
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedAction('individual');
      setShowConfirmation(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isGroupedDocument = Boolean(document.group_id);
  const isGroupHead = document.id === document.group_id;
  const groupSize = groupDocuments.length;

  const handleProceed = () => {
    setShowConfirmation(true);
  };

  const handleConfirmDelete = () => {
    if (selectedAction === 'group' && document.group_id) {
      onDeleteGroup(document.group_id);
    } else {
      onDeleteDocument(document.id);
    }
    onClose();
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

            {isGroupedDocument ? (
              <div className="deletion-options">
                <p>This document is part of a group. Choose your deletion option:</p>
                
                <div className="form-group">
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="deleteAction"
                      value="individual"
                      checked={selectedAction === 'individual'}
                      onChange={() => setSelectedAction('individual')}
                    />
                    <span className="radio-content">
                      <strong>Delete Individual Document</strong>
                      <div className="radio-description">
                        Remove only this document. Other documents in the group remain unchanged.
                        {isGroupHead && (
                          <div className="warning-text">
                            ⚠️ This is the group head document. Another document will be automatically assigned as the new group head.
                          </div>
                        )}
                      </div>
                    </span>
                  </label>

                  <label className="radio-option">
                    <input
                      type="radio"
                      name="deleteAction"
                      value="group"
                      checked={selectedAction === 'group'}
                      onChange={() => setSelectedAction('group')}
                    />
                    <span className="radio-content">
                      <strong>Delete Entire Group</strong>
                      <div className="radio-description">
                        Remove all {groupSize} documents in this group permanently.
                        <div className="warning-text">
                          ⚠️ This action cannot be undone and will delete all group variants.
                        </div>
                      </div>
                    </span>
                  </label>
                </div>

                {groupSize > 1 && (
                  <div className="group-documents-preview">
                    <h4>Documents in Group:</h4>
                    <ul className="group-documents-list">
                      {groupDocuments.map(doc => (
                        <li key={doc.id} className={doc.id === document.id ? 'current-document' : ''}>
                          <span className="doc-title">{doc.title}</span>
                          <span className="doc-type">({doc.document_type || 'No type'})</span>
                          {doc.id === document.id && <span className="current-indicator">← Current</span>}
                          {doc.id === doc.group_id && <span className="head-indicator">Group Head</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="single-document-deletion">
                <p>This document is not part of a group. It will be deleted permanently.</p>
                <div className="warning-text">
                  ⚠️ This action cannot be undone.
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button className="btn btn--secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn--danger" onClick={handleProceed}>
              Continue
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
            {selectedAction === 'group' ? (
              <div className="group-deletion-confirmation">
                <div className="confirmation-icon">⚠️</div>
                <h4>Delete Entire Group?</h4>
                <p>You are about to permanently delete <strong>all {groupSize} documents</strong> in this group:</p>
                <ul className="documents-to-delete">
                  {groupDocuments.map(doc => (
                    <li key={doc.id}>
                      <strong>{doc.title}</strong> ({doc.document_type || 'No type'})
                    </li>
                  ))}
                </ul>
                <p className="final-warning">
                  <strong>This action cannot be undone.</strong> All document content, tags, and associations will be permanently lost.
                </p>
              </div>
            ) : (
              <div className="individual-deletion-confirmation">
                <div className="confirmation-icon">⚠️</div>
                <h4>Delete Document?</h4>
                <p>You are about to permanently delete:</p>
                <div className="document-to-delete">
                  <strong>{document.title}</strong> ({document.document_type || 'No type'})
                </div>
                {isGroupHead && (
                  <p className="group-head-warning">
                    This is the group head document. The system will automatically assign another document in the group as the new head.
                  </p>
                )}
                <p className="final-warning">
                  <strong>This action cannot be undone.</strong>
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn--secondary" onClick={handleCancel}>
            Go Back
          </button>
          <button className="btn btn--danger" onClick={handleConfirmDelete}>
            {selectedAction === 'group' ? `Delete All ${groupSize} Documents` : 'Delete Document'}
          </button>
        </div>
      </div>
    </div>
  );
}