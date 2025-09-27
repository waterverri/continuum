import { useState, useRef, useEffect } from 'react';
import type { Document } from '../api';
import { DraggableItem } from './dnd/DraggableItem';
import { DroppableZone } from './dnd/DroppableZone';

interface DocumentGroup {
  groupId: string | null;
  title: string;
  documents: Document[];
  availableTypes: string[];
  isExpanded?: boolean;
}

interface DocumentGroupListProps {
  documents: Document[];
  selectedDocumentId?: string;
  onDocumentClick?: (document: Document) => void;
  onDocumentRename?: (document: Document) => void;
  onDocumentDelete?: (documentId: string) => void;
  onCreateDerivative?: (document: Document) => void;
  onManageTags?: (document: Document) => void;
  onManageEvents?: (document: Document) => void;
  onCreateEvent?: (document: Document) => void;
  onDocumentEvolution?: (document: Document) => void;
  emptyMessage?: string;
}

interface DocumentGroupItemProps {
  group: DocumentGroup;
  selectedDocumentId?: string;
  onDocumentClick?: (document: Document) => void;
  onDocumentRename?: (document: Document) => void;
  onDocumentDelete?: (documentId: string) => void;
  onCreateDerivative?: (document: Document) => void;
  onManageTags?: (document: Document) => void;
  onManageEvents?: (document: Document) => void;
  onCreateEvent?: (document: Document) => void;
  onDocumentEvolution?: (document: Document) => void;
}

function DocumentGroupItem({
  group,
  selectedDocumentId,
  onDocumentClick,
  onDocumentRename,
  onDocumentDelete,
  onCreateDerivative,
  onManageTags,
  onManageEvents,
  onCreateEvent,
  onDocumentEvolution
}: DocumentGroupItemProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find the main document (group representative: where group_id == id OR group_id is null)
  const mainDocument = group.documents.find(doc => 
    doc.group_id === null || doc.group_id === doc.id
  ) || group.documents[0]; // Fallback to first document if no representative found

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setSelectedDocument(null);
      }
    };
    
    if (showDropdown) {
      window.document.addEventListener('mousedown', handleClickOutside);
      return () => window.document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  const handleGroupClick = () => {
    // BY DESIGN: Only the group head (mainDocument) is selectable from the sidebar list.
    // Individual documents within a group are selected via dropdown in the document viewer header.
    if (onDocumentClick && mainDocument) {
      onDocumentClick(mainDocument);
    }
  };

  const handleMenuClick = (e: React.MouseEvent, document: Document) => {
    e.stopPropagation();
    setSelectedDocument(document);
    setShowDropdown(!showDropdown);
  };

  const handleDropdownAction = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    action();
    setShowDropdown(false);
    setSelectedDocument(null);
  };

  const isSelected = group.documents.some(doc => doc.id === selectedDocumentId);
  const hasMultipleTypes = group.availableTypes.length > 1;

  return (
    <div className={`document-group-item ${isSelected ? 'document-group-item--selected' : ''}`}>
      <div className="document-group-item__content" onClick={handleGroupClick}>
        <div className="document-group-item__header">
          <h4>{group.title}</h4>
          <div className="document-group-item__meta">
            {mainDocument.components && Object.keys(mainDocument.components).length > 0 ? '🔗 Composite' : '📄 Static'}
            {hasMultipleTypes && (
              <span className="group-types-indicator">
                {' • '}👥 {group.availableTypes.join(', ')}
              </span>
            )}
            <span className="group-count">
              {' • '}{group.documents.length} doc{group.documents.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Show tags from main document */}
        {mainDocument.tags && mainDocument.tags.length > 0 && (
          <div className="document-group-item__tags">
            {mainDocument.tags.slice(0, 3).map(tag => (
              <DraggableItem
                key={tag.id}
                id={`doc-tag-${tag.id}`}
                type="tag"
                item={tag}
              >
                <span
                  className="tag-badge tag-badge--xs"
                  style={{ backgroundColor: tag.color, color: 'white' }}
                  title={tag.name}
                >
                  {tag.name}
                </span>
              </DraggableItem>
            ))}
            {mainDocument.tags.length > 3 && (
              <span className="tag-badge tag-badge--xs tag-badge--more">
                +{mainDocument.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="document-group-item__actions">
        <div className="document-action-dropdown" ref={dropdownRef}>
          <button 
            className="document-action-btn document-action-btn--menu"
            onClick={(e) => handleMenuClick(e, mainDocument)}
            title="More actions"
          >
            ⋯
          </button>
          {showDropdown && selectedDocument && (
            <div className="document-dropdown-menu">
              {onDocumentRename && (
                <button 
                  className="document-dropdown-item"
                  onClick={handleDropdownAction(() => onDocumentRename(selectedDocument))}
                >
                  ✏️ Rename
                </button>
              )}
              {onCreateDerivative && (
                <button 
                  className="document-dropdown-item"
                  onClick={handleDropdownAction(() => onCreateDerivative(selectedDocument))}
                >
                  + Derivative
                </button>
              )}
              {onManageTags && (
                <button 
                  className="document-dropdown-item"
                  onClick={handleDropdownAction(() => onManageTags(selectedDocument))}
                >
                  🏷️ Tags
                </button>
              )}
              {onCreateEvent && (
                <button 
                  className="document-dropdown-item"
                  onClick={handleDropdownAction(() => onCreateEvent(selectedDocument))}
                >
                  ➕ Create Event
                </button>
              )}
              {onManageEvents && (
                <button 
                  className="document-dropdown-item"
                  onClick={handleDropdownAction(() => onManageEvents(selectedDocument))}
                >
                  📅 Assign Event
                </button>
              )}
              {onDocumentEvolution && (
                <button 
                  className="document-dropdown-item"
                  onClick={handleDropdownAction(() => onDocumentEvolution(selectedDocument))}
                >
                  🔄 Evolution
                </button>
              )}
              {onDocumentDelete && (
                <button 
                  className="document-dropdown-item document-dropdown-item--danger"
                  onClick={handleDropdownAction(() => onDocumentDelete(selectedDocument.id))}
                >
                  🗑️ Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DocumentGroupList({
  documents,
  selectedDocumentId,
  onDocumentClick,
  onDocumentRename,
  onDocumentDelete,
  onCreateDerivative,
  onManageTags,
  onManageEvents,
  onCreateEvent,
  onDocumentEvolution,
  emptyMessage = 'No documents found.'
}: DocumentGroupListProps) {
  // Group documents by group_id
  const documentGroups = documents.reduce<DocumentGroup[]>((acc, doc) => {
    const groupId = doc.group_id || null;
    
    // For documents with null group_id (singletons), each document is its own group
    // For documents with actual group_id, group them together
    let group: DocumentGroup | undefined;
    if (groupId === null) {
      // Each null group_id document is its own singleton group - don't search for existing
      group = undefined;
    } else {
      // For actual group_ids, find existing group
      group = acc.find(g => g.groupId === groupId);
    }
    
    if (!group) {
      group = {
        groupId,
        title: '', // Will be set after finding representative
        documents: [],
        availableTypes: []
      };
      acc.push(group);
    }
    
    group.documents.push(doc);
    
    // Collect available types
    if (doc.document_type && !group.availableTypes.includes(doc.document_type)) {
      group.availableTypes.push(doc.document_type);
    }
    
    return acc;
  }, []);

  // Set group titles based on representative documents
  documentGroups.forEach(group => {
    const representative = group.documents.find(doc => 
      doc.group_id === null || doc.group_id === doc.id
    ) || group.documents[0]; // Fallback to first document
    group.title = representative.title;
  });

  if (documentGroups.length === 0) {
    return (
      <div className="empty-state">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="document-group-list">
      {documentGroups.map((group, index) => {
        // Use the representative document for dragging
        const representativeDoc = group.documents.find(d => d.id === group.groupId) || group.documents[0];

        return (
          <DraggableItem
            key={group.groupId || `singleton-${index}`}
            id={`document-${representativeDoc.id}`}
            type="document"
            item={representativeDoc}
          >
            <DroppableZone
              id={`drop-document-${representativeDoc.id}`}
              type="document"
              item={representativeDoc}
              acceptsTypes={['tag', 'event', 'document']}
              className="document-drop-zone"
            >
              <DocumentGroupItem
                group={group}
                selectedDocumentId={selectedDocumentId}
                onDocumentClick={onDocumentClick}
                onDocumentRename={onDocumentRename}
                onDocumentDelete={onDocumentDelete}
                onCreateDerivative={onCreateDerivative}
                onManageTags={onManageTags}
                onManageEvents={onManageEvents}
                onCreateEvent={onCreateEvent}
                onDocumentEvolution={onDocumentEvolution}
              />
            </DroppableZone>
          </DraggableItem>
        );
      })}
    </div>
  );
}

export type { DocumentGroupListProps, DocumentGroup };