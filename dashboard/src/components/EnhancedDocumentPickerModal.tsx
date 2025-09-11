import type { Document, Event } from '../api';
import { useDocumentFilter } from '../hooks/useDocumentFilter';
import { DocumentFilters } from './DocumentFilters';
import { DocumentList } from './DocumentList';
import { TagFilter } from './TagFilter';
import { EventFilter } from './EventFilter';

interface EnhancedDocumentPickerModalProps {
  documents: Document[];
  events: Event[];
  projectId: string;
  componentKey: string | null;
  onSelect: (documentId: string) => void;
  onCancel: () => void;
}

export function EnhancedDocumentPickerModal({ 
  documents, 
  events, 
  projectId, 
  componentKey, 
  onSelect, 
  onCancel 
}: EnhancedDocumentPickerModalProps) {
  const documentFilter = useDocumentFilter(documents, events);

  const handleDocumentSelect = (document: Document) => {
    console.debug('EnhancedDocumentPickerModal: handleDocumentSelect called', {
      document: { id: document.id, title: document.title },
      componentKey
    });
    onSelect(document.id);
    console.debug('EnhancedDocumentPickerModal: onSelect callback executed');
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content document-picker-modal">
        <div className="modal-header">
          <h3>Select Document for {componentKey}</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        
        <div className="modal-filters">
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

          <TagFilter
            projectId={projectId}
            selectedTagIds={documentFilter.selectedTagIds}
            onTagSelectionChange={documentFilter.setSelectedTagIds}
          />

          <EventFilter
            events={events}
            selectedEventIds={documentFilter.selectedEventIds}
            onEventSelectionChange={documentFilter.setSelectedEventIds}
            eventVersionFilter={documentFilter.eventVersionFilter}
            onVersionFilterChange={documentFilter.setEventVersionFilter}
          />
        </div>

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

export type { EnhancedDocumentPickerModalProps };