import type { Document } from '../api';

interface DocumentListItemProps {
  document: Document;
  allDocuments?: Document[];
  isSelected?: boolean;
  onClick?: (document: Document) => void;
  showPreview?: boolean;
  showActions?: boolean;
  onEdit?: (document: Document) => void;
  onDelete?: (documentId: string) => void;
  onCreateDerivative?: (document: Document) => void;
  onManageTags?: (document: Document) => void;
  variant?: 'sidebar' | 'picker';
}

function DocumentListItem({ 
  document, 
  allDocuments = [],
  isSelected = false, 
  onClick, 
  showPreview = false,
  showActions = false,
  onEdit,
  onDelete,
  onCreateDerivative,
  onManageTags,
  variant = 'sidebar'
}: DocumentListItemProps) {
  const handleClick = () => {
    if (onClick) {
      onClick(document);
    }
  };

  const getGroupInfo = () => {
    if (!document.group_id) return null;
    
    const groupMembers = allDocuments.filter(doc => doc.group_id === document.group_id);
    const memberCount = groupMembers.length;
    
    if (memberCount <= 1) return null;
    
    const groupTypes = [...new Set(groupMembers.map(doc => doc.document_type).filter(Boolean))];
    
    return {
      count: memberCount,
      types: groupTypes,
      groupId: document.group_id
    };
  };

  const groupInfo = getGroupInfo();

  const className = variant === 'sidebar' 
    ? `document-item ${isSelected ? 'document-item--selected' : ''}` 
    : 'document-picker-item';

  return (
    <div className={className} onClick={handleClick}>
      <div className={variant === 'sidebar' ? 'document-item__header' : 'document-picker-header'}>
        <h4>{document.title}</h4>
        <span className={variant === 'sidebar' ? 'document-item__meta' : 'document-picker-meta'}>
          {document.is_composite ? '🔗 Composite' : '📄 Static'}
          {document.document_type && ` • ${document.document_type}`}
          {groupInfo && (
            <span 
              className="group-indicator" 
              title={`Part of group with ${groupInfo.count} members: ${groupInfo.types.join(', ')}`}
            >
              {' • '}👥 Group ({groupInfo.count})
            </span>
          )}
        </span>
      </div>
      
      {/* Tags display */}
      {document.tags && document.tags.length > 0 && (
        <div className={variant === 'sidebar' ? 'document-item__tags' : 'document-picker-tags'}>
          {document.tags.slice(0, 3).map(tag => (
            <span 
              key={tag.id}
              className="tag-badge tag-badge--xs"
              style={{ backgroundColor: tag.color, color: 'white' }}
              title={tag.name}
            >
              {tag.name}
            </span>
          ))}
          {document.tags.length > 3 && (
            <span className="tag-badge tag-badge--xs tag-badge--more">
              +{document.tags.length - 3}
            </span>
          )}
        </div>
      )}
      
      {showPreview && document.content && (
        <div className="document-picker-preview">
          {document.content.substring(0, 150)}
          {document.content.length > 150 && '...'}
        </div>
      )}
      
      {variant === 'picker' && (
        <div className="document-picker-id">
          ID: {document.id.substring(0, 8)}...
        </div>
      )}
      
      {showActions && (
        <div className="document-item__actions">
          {onEdit && (
            <button 
              className="btn btn--sm"
              onClick={(e) => { 
                e.stopPropagation(); 
                onEdit(document); 
              }}
            >
              Edit
            </button>
          )}
          {onCreateDerivative && (
            <button 
              className="btn btn--sm btn--secondary"
              onClick={(e) => { 
                e.stopPropagation(); 
                onCreateDerivative(document); 
              }}
            >
              + Derivative
            </button>
          )}
          {onManageTags && (
            <button 
              className="btn btn--sm btn--secondary"
              onClick={(e) => { 
                e.stopPropagation(); 
                onManageTags(document); 
              }}
            >
              Tags
            </button>
          )}
          {onDelete && (
            <button 
              className="btn btn--sm btn--danger"
              onClick={(e) => { 
                e.stopPropagation(); 
                onDelete(document.id); 
              }}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface DocumentListProps {
  documents: Document[];
  allDocuments?: Document[];
  selectedDocumentId?: string;
  onDocumentClick?: (document: Document) => void;
  onDocumentEdit?: (document: Document) => void;
  onDocumentDelete?: (documentId: string) => void;
  onCreateDerivative?: (document: Document) => void;
  onManageTags?: (document: Document) => void;
  variant?: 'sidebar' | 'picker';
  emptyMessage?: string;
}

export function DocumentList({ 
  documents, 
  allDocuments,
  selectedDocumentId, 
  onDocumentClick, 
  onDocumentEdit, 
  onDocumentDelete,
  onCreateDerivative,
  onManageTags,
  variant = 'sidebar',
  emptyMessage = 'No documents found.'
}: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="empty-state">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={variant === 'sidebar' ? 'document-list' : 'document-picker-list'}>
      {documents.map(doc => (
        <DocumentListItem
          key={doc.id}
          document={doc}
          allDocuments={allDocuments || documents}
          isSelected={selectedDocumentId === doc.id}
          onClick={onDocumentClick}
          onEdit={onDocumentEdit}
          onDelete={onDocumentDelete}
          onCreateDerivative={onCreateDerivative}
          onManageTags={onManageTags}
          showPreview={variant === 'picker'}
          showActions={variant === 'sidebar'}
          variant={variant}
        />
      ))}
    </div>
  );
}

export { DocumentListItem };
export type { DocumentListProps, DocumentListItemProps };