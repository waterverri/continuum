import type { Event, Document, EventDocument } from '../api';
import type { EventFormData } from '../types/timeline';

export interface EventDetailsModalProps {
  isOpen: boolean;
  selectedEvent: Event | null;
  editingEvent: Event | null;
  eventDocuments: (EventDocument & {documents: Document})[];
  formData: EventFormData;
  loading: boolean;
  formatDateDisplay: (timeValue?: number) => string;
  onClose: () => void;
  onStartEdit: (event: Event) => EventFormData;
  onFormDataChange: (data: EventFormData | ((prev: EventFormData) => EventFormData)) => void;
  onSaveEdit: (eventId: string, formData: EventFormData) => Promise<void>;
  onCancelEdit: () => void;
  onDocumentView?: (document: Document) => void;
  onDocumentEdit?: (document: Document) => void;
  onDocumentDelete?: (documentId: string) => void;
  onCloseAllModals?: () => void;
}

export function EventDetailsModal({
  isOpen,
  selectedEvent,
  editingEvent,
  eventDocuments,
  formData,
  loading,
  formatDateDisplay,
  onClose,
  onStartEdit,
  onFormDataChange,
  onSaveEdit,
  onCancelEdit,
  onDocumentView,
  onDocumentEdit,
  onDocumentDelete,
  onCloseAllModals
}: EventDetailsModalProps) {
  
  if (!isOpen || !selectedEvent) return null;

  const getEventDuration = (event: Event) => {
    if (!event.time_start || !event.time_end) return null;
    return event.time_end - event.time_start;
  };

  const handleStartEdit = () => {
    const editFormData = onStartEdit(selectedEvent);
    onFormDataChange(editFormData);
  };

  const handleSaveEdit = async () => {
    if (editingEvent) {
      await onSaveEdit(editingEvent.id, formData);
    }
  };

  return (
    <div className="event-details-overlay">
      <div className="event-details-modal">
        <div className="event-details-header">
          <h3>{selectedEvent.name}</h3>
          <button 
            className="modal-close"
            onClick={onClose}
          >
            &times;
          </button>
        </div>
        
        <div className="event-details-body">
          {editingEvent ? (
            <div className="event-edit-form">
              <h4>Edit Event</h4>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => onFormDataChange((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => onFormDataChange((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Start DateTime</label>
                  <input
                    type="datetime-local"
                    value={formData.time_start}
                    onChange={(e) => onFormDataChange((prev) => ({ ...prev, time_start: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>End DateTime</label>
                  <input
                    type="datetime-local"
                    value={formData.time_end}
                    onChange={(e) => onFormDataChange((prev) => ({ ...prev, time_end: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-actions">
                <button 
                  className="btn btn-secondary"
                  onClick={onCancelEdit}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={handleSaveEdit}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="event-info">
                {selectedEvent.description && (
                  <p className="event-description">{selectedEvent.description}</p>
                )}
                <div className="event-timing">
                  <span><strong>Start:</strong> {formatDateDisplay(selectedEvent.time_start)}</span>
                  <span><strong>End:</strong> {formatDateDisplay(selectedEvent.time_end)}</span>
                  {getEventDuration(selectedEvent) && (
                    <span><strong>Duration:</strong> {getEventDuration(selectedEvent)} days</span>
                  )}
                </div>
              </div>

              <div className="event-documents">
                <div className="documents-header">
                  <h4>Associated Documents ({eventDocuments.length})</h4>
                  <button
                    className="event-edit-btn"
                    onClick={handleStartEdit}
                    title="Edit this event"
                  >
                    ✎ Edit Event
                  </button>
                </div>
                {eventDocuments.length === 0 ? (
                  <p className="no-documents">No documents associated with this event.</p>
                ) : (
                  <div className="documents-list">
                    {eventDocuments.map((docAssoc) => (
                      <div key={docAssoc.document_id} className="document-item">
                        <div className="document-info">
                          <span className="document-title">{docAssoc.documents.title}</span>
                          <span className="document-type">{docAssoc.documents.document_type || 'Document'}</span>
                        </div>
                        <div className="document-actions">
                          <button
                            className="document-action-btn view"
                            onClick={() => {
                              onCloseAllModals?.();
                              onDocumentView?.(docAssoc.documents);
                            }}
                            title="View document"
                          >
                            👁️
                          </button>
                          <button
                            className="document-action-btn edit"
                            onClick={() => {
                              onCloseAllModals?.();
                              onDocumentEdit?.(docAssoc.documents);
                            }}
                            title="Edit document"
                          >
                            ✎
                          </button>
                          <button
                            className="document-action-btn delete"
                            onClick={() => onDocumentDelete?.(docAssoc.document_id)}
                            title="Delete document"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}