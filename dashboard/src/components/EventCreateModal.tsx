import type { Event } from '../api';
import type { EventFormData, CreateEventPosition } from '../types/timeline';

export interface EventCreateModalProps {
  isOpen: boolean;
  events: Event[];
  formData: EventFormData;
  createEventPosition: CreateEventPosition;
  loading: boolean;
  formatDateDisplay: (timeValue?: number) => string;
  onFormDataChange: (data: EventFormData | ((prev: EventFormData) => EventFormData)) => void;
  onSubmit: (formData: EventFormData) => Promise<void>;
  onCancel: () => void;
}

export function EventCreateModal({
  isOpen,
  events,
  formData,
  createEventPosition,
  loading,
  formatDateDisplay,
  onFormDataChange,
  onSubmit,
  onCancel
}: EventCreateModalProps) {
  
  if (!isOpen) return null;

  const handleSubmit = async () => {
    await onSubmit(formData);
  };

  return (
    <div className="event-details-overlay">
      <div className="event-details-modal">
        <div className="event-details-header">
          <h3>Create Event at {formatDateDisplay(createEventPosition.timeStart)}</h3>
          <button 
            className="modal-close"
            onClick={onCancel}
          >
            &times;
          </button>
        </div>
        
        <div className="event-details-body">
          <div className="event-edit-form">
            <div className="form-group">
              <label>Event Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => onFormDataChange((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Enter event name"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => onFormDataChange((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
                placeholder="Optional description"
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
            {events.length > 0 && (
              <div className="form-group">
                <label>Parent Event</label>
                <select
                  value={formData.parent_event_id}
                  onChange={(e) => onFormDataChange((prev) => ({ ...prev, parent_event_id: e.target.value }))}
                >
                  <option value="">No parent event</option>
                  {events.map(event => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-actions">
              <button 
                className="btn btn-secondary"
                onClick={onCancel}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={loading || !formData.name.trim()}
              >
                {loading ? 'Creating...' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}