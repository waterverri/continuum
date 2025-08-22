import { useState, useRef, useEffect } from 'react';
import type { Document } from '../api';

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
  onDocumentEdit?: (document: Document) => void;
  onDocumentRename?: (document: Document) => void;
  onDocumentDelete?: (documentId: string) => void;
  onCreateDerivative?: (document: Document) => void;
  onManageTags?: (document: Document) => void;
  onManageEvents?: (document: Document) => void;
  onDocumentEvolution?: (document: Document) => void;
  emptyMessage?: string;
}

interface DocumentGroupItemProps {
  group: DocumentGroup;
  selectedDocumentId?: string;
  onDocumentClick?: (document: Document) => void;
  onDocumentEdit?: (document: Document) => void;
  onDocumentRename?: (document: Document) => void;
  onDocumentDelete?: (documentId: string) => void;
  onCreateDerivative?: (document: Document) => void;
  onManageTags?: (document: Document) => void;
  onManageEvents?: (document: Document) => void;
  onDocumentEvolution?: (document: Document) => void;
}

function DocumentGroupItem({
  group,
  selectedDocumentId,
  onDocumentClick,
  onDocumentEdit,
  onDocumentRename,
  onDocumentDelete,
  onCreateDerivative,
  onManageTags,
  onManageEvents,
  onDocumentEvolution
}: DocumentGroupItemProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find the main document (first document in the group or the one without specific type)
  const mainDocument = group.documents[0];

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
            {mainDocument.is_composite ? '🔗 Composite' : '📄 Static'}
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
              <span 
                key={tag.id}
                className="tag-badge tag-badge--xs"
                style={{ backgroundColor: tag.color, color: 'white' }}
                title={tag.name}
              >
                {tag.name}
              </span>
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
              {onDocumentEdit && (
                <button 
                  className="document-dropdown-item"
                  onClick={handleDropdownAction(() => onDocumentEdit(selectedDocument))}
                >
                  ✏️ Edit
                </button>
              )}
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
              {onManageEvents && (
                <button 
                  className="document-dropdown-item"
                  onClick={handleDropdownAction(() => onManageEvents(selectedDocument))}
                >
                  📅 Events
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
  onDocumentEdit,
  onDocumentRename,
  onDocumentDelete,
  onCreateDerivative,
  onManageTags,
  onManageEvents,
  onDocumentEvolution,
  emptyMessage = 'No documents found.'
}: DocumentGroupListProps) {
  // Group documents by group_id
  const documentGroups = documents.reduce<DocumentGroup[]>((acc, doc) => {
    const groupId = doc.group_id || null;
    let group = acc.find(g => g.groupId === groupId);
    
    if (!group) {
      group = {
        groupId,
        title: doc.title,
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

  if (documentGroups.length === 0) {
    return (
      <div className="empty-state">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="document-group-list">
      {documentGroups.map((group, index) => (
        <DocumentGroupItem
          key={group.groupId || `singleton-${index}`}
          group={group}
          selectedDocumentId={selectedDocumentId}
          onDocumentClick={onDocumentClick}
          onDocumentEdit={onDocumentEdit}
          onDocumentRename={onDocumentRename}
          onDocumentDelete={onDocumentDelete}
          onCreateDerivative={onCreateDerivative}
          onManageTags={onManageTags}
          onManageEvents={onManageEvents}
          onDocumentEvolution={onDocumentEvolution}
        />
      ))}
    </div>
  );
}

export type { DocumentGroupListProps, DocumentGroup };