import { useMemo } from 'react';
import type { Document } from '../api';

interface GroupPickerModalProps {
  documents: Document[];
  componentKey: string | null;
  onSelect: (groupId: string) => void;
  onCancel: () => void;
}

export function GroupPickerModal({ documents, componentKey, onSelect, onCancel }: GroupPickerModalProps) {
  const documentGroups = useMemo(() => {
    const groupMap = new Map<string, { 
      groupId: string; 
      documents: Document[]; 
      representativeDoc: Document 
    }>();

    documents.forEach(doc => {
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

    return Array.from(groupMap.values());
  }, [documents]);

  const handleGroupSelect = (groupId: string) => {
    onSelect(groupId);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content document-picker-modal">
        <div className="modal-header">
          <h3>Select Document Group for "{componentKey}"</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        
        <div className="modal-body">
          {documentGroups.length > 0 ? (
            <div className="document-picker-list">
              {documentGroups.map(group => (
                <div
                  key={group.groupId}
                  className="document-picker-item"
                  onClick={() => handleGroupSelect(group.groupId)}
                >
                  <div className="document-picker-header">
                    <h4>{group.representativeDoc.title}</h4>
                    <div className="document-picker-meta">
                      Group ({group.documents.length} documents)
                    </div>
                  </div>
                  <div className="document-picker-preview">
                    Types: {[...new Set(group.documents.map(d => d.document_type || 'untitled').filter(Boolean))].join(', ')}
                  </div>
                  <div className="document-picker-id">
                    Group ID: {group.groupId}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>No document groups found.</p>
              <p>Create derivative documents to form groups.</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn--secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export type { GroupPickerModalProps };