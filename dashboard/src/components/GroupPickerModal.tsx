import { useMemo } from 'react';
import type { Document } from '../api';
import { useDocumentFilter } from '../hooks/useDocumentFilter';
import { DocumentFilters } from './DocumentFilters';
import { DocumentList } from './DocumentList';

interface GroupPickerModalProps {
  documents: Document[];
  componentKey?: string | null;
  onSelect: (groupId: string) => void;
  onCancel: () => void;
  mode?: 'component' | 'group-assignment';
}

export function GroupPickerModal({ documents, componentKey, onSelect, onCancel, mode = 'component' }: GroupPickerModalProps) {
  // For group assignment mode, show group head documents with filtering
  const groupHeadDocuments = useMemo(() => {
    if (mode === 'group-assignment') {
      return documents.filter(doc => {
        // Show group head documents (documents that can be group heads)
        // These are documents without group_id or documents where group_id equals their own id
        return !doc.group_id || doc.group_id === doc.id;
      });
    }
    return [];
  }, [documents, mode]);

  // For component mode, show existing groups
  const documentGroups = useMemo(() => {
    if (mode === 'component') {
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
    }
    return [];
  }, [documents, mode]);

  // Use document filter for group assignment mode
  const documentFilter = useDocumentFilter(groupHeadDocuments);

  const handleGroupSelect = (groupId: string) => {
    onSelect(groupId);
  };

  const handleDocumentSelect = (document: Document) => {
    onSelect(document.id);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content document-picker-modal">
        <div className="modal-header">
          <h3>
            {mode === 'group-assignment' 
              ? 'Select Group Head Document' 
              : `Select Document Group for "${componentKey}"`
            }
          </h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        
        {mode === 'group-assignment' && (
          <DocumentFilters
            searchTerm={documentFilter.searchTerm}
            onSearchChange={documentFilter.setSearchTerm}
            typeFilter={documentFilter.typeFilter}
            onTypeChange={documentFilter.setTypeFilter}
            formatFilter={documentFilter.formatFilter}
            onFormatChange={documentFilter.setFormatFilter}
            availableTypes={documentFilter.availableTypes}
            searchPlaceholder="Search group head documents..."
          />
        )}
        
        <div className="modal-body">
          {mode === 'group-assignment' ? (
            <>
              <div className="group-picker-info">
                <p>Select a document to assign this document to its group. Only group head documents are shown.</p>
              </div>
              <DocumentList
                documents={documentFilter.filteredDocuments.map(doc => {
                  // Enhance document display with group information
                  const groupDocuments = documents.filter(d => d.group_id === doc.id);
                  const groupSize = groupDocuments.length;
                  const isExistingGroup = groupSize > 0;
                  
                  return {
                    ...doc,
                    // Add group info to content for display
                    content: `${doc.content || ''}\n\n[Group info: ${isExistingGroup ? `Existing group with ${groupSize} documents` : 'Can become group head'}]`
                  };
                })}
                onDocumentClick={handleDocumentSelect}
                variant="picker"
                emptyMessage="No group head documents found matching your criteria."
              />
            </>
          ) : (
            // Component mode - existing groups
            documentGroups.length > 0 ? (
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
            )
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