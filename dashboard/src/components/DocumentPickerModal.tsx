import type { Document } from '../api';
import { useDocumentFilter } from '../hooks/useDocumentFilter';
import { DocumentFilters } from './DocumentFilters';
import { DocumentList } from './DocumentList';

interface DocumentPickerModalProps {
  documents: Document[];
  componentKey: string | null;
  onSelect: (documentId: string) => void;
  onCancel: () => void;
}

export function DocumentPickerModal({ documents, componentKey, onSelect, onCancel }: DocumentPickerModalProps) {
  const documentFilter = useDocumentFilter(documents);

  const handleDocumentSelect = (document: Document) => {
    console.debug('DocumentPickerModal: handleDocumentSelect called', {
      document: { id: document.id, title: document.title },
      componentKey
    });
    onSelect(document.id);
    console.debug('DocumentPickerModal: onSelect callback executed');
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content document-picker-modal">
        <div className="modal-header">
          <h3>Select Document for {componentKey && `{{${componentKey}}}`}</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        
        <DocumentFilters
          searchTerm={documentFilter.searchTerm}
          onSearchChange={documentFilter.setSearchTerm}
          typeFilter={documentFilter.typeFilter}
          onTypeChange={documentFilter.setTypeFilter}
          formatFilter={documentFilter.formatFilter}
          onFormatChange={documentFilter.setFormatFilter}
          availableTypes={documentFilter.availableTypes}
          searchPlaceholder="Search by title or content..."
        />

        <div className="modal-body">
          <DocumentList
            documents={documentFilter.filteredDocuments}
            onDocumentClick={handleDocumentSelect}
            variant="picker"
            emptyMessage="No documents found matching your criteria."
          />
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

export type { DocumentPickerModalProps };