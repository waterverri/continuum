import React, { useState, useMemo } from 'react';
import type { Document } from '../api';

interface ExtractTextModalProps {
  sourceDocument: Document | null;
  selectedText: string;
  allDocuments?: Document[];
  onConfirm: (title: string, documentType: string, groupId?: string) => void;
  onCancel: () => void;
}

export function ExtractTextModal({ sourceDocument, selectedText, allDocuments = [], onConfirm, onCancel }: ExtractTextModalProps) {
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState(sourceDocument?.document_type || '');
  const [groupSelectionMode, setGroupSelectionMode] = useState<'same' | 'new' | 'other' | 'none'>(() => {
    // Default: same group if source has one, otherwise create new group
    return sourceDocument?.group_id ? 'same' : 'new';
  });
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(sourceDocument?.group_id || null);

  // Get available groups based on source document type
  const availableGroups = useMemo(() => {
    if (!sourceDocument || !allDocuments.length) return [];
    
    const groupMap = new Map<string, { 
      groupId: string; 
      documents: Document[]; 
      representativeDoc: Document;
    }>();

    // Build group map from all documents
    allDocuments.forEach(doc => {
      if (doc.group_id) {
        if (!groupMap.has(doc.group_id)) {
          groupMap.set(doc.group_id, {
            groupId: doc.group_id,
            documents: [],
            representativeDoc: doc
          });
        }
        groupMap.get(doc.group_id)!.documents.push(doc);
        
        // Update representative doc (prefer document where id = group_id)
        if (doc.id === doc.group_id) {
          groupMap.get(doc.group_id)!.representativeDoc = doc;
        }
      }
    });

    const allGroups = Array.from(groupMap.values());
    
    // Filter groups based on source document type
    if (sourceDocument.components && Object.keys(sourceDocument.components).length > 0) {
      // For composite documents, only show component root groups
      const componentGroupIds = new Set(
        Object.values(sourceDocument.components)
          .map(docId => {
            const doc = allDocuments.find(d => d.id === docId);
            return doc?.group_id;
          })
          .filter(Boolean)
      );
      
      return allGroups.filter(group => componentGroupIds.has(group.groupId));
    } else {
      // For non-composite documents, show all root groups
      return allGroups;
    }
  }, [sourceDocument, allDocuments]);


  const getEffectiveGroupId = () => {
    switch (groupSelectionMode) {
      case 'same':
        return sourceDocument?.group_id || undefined;
      case 'new':
        return 'CREATE_NEW_GROUP';
      case 'other':
        return selectedGroupId || undefined;
      case 'none':
        return undefined;
      default:
        return undefined;
    }
  };

  const handleConfirm = () => {
    if (title.trim() && documentType.trim()) {
      onConfirm(title.trim(), documentType.trim(), getEffectiveGroupId());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleGroupSelectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'same' || value === 'new' || value === 'none') {
      setGroupSelectionMode(value);
    } else if (value === 'other') {
      setGroupSelectionMode('other');
    } else {
      // Specific group selected
      setGroupSelectionMode('other');
      setSelectedGroupId(value);
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

            <div className="group-selection-section">
              <label className="form-label">
                Group:
                <select
                  className="form-input"
                  value={groupSelectionMode === 'other' && selectedGroupId ? selectedGroupId : groupSelectionMode}
                  onChange={handleGroupSelectionChange}
                >
                  {sourceDocument?.group_id && (
                    <option value="same">
                      Same group ({allDocuments.find(d => d.id === sourceDocument.group_id)?.title || 'Unknown'})
                    </option>
                  )}
                  <option value="new">Create new group</option>
                  <option value="none">No group</option>

                  {availableGroups.length > 0 && (
                    <>
                      <optgroup label="Existing Groups">
                        {availableGroups.map(group => (
                          <option key={group.groupId} value={group.groupId}>
                            {group.representativeDoc.title} ({group.documents.length} documents)
                          </option>
                        ))}
                      </optgroup>
                    </>
                  )}
                </select>
              </label>

              {sourceDocument?.components && Object.keys(sourceDocument.components || {}).length > 0 && (
                <small className="group-selection-hint">
                  ℹ️ Showing only groups from this composite document's components
                </small>
              )}
            </div>
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