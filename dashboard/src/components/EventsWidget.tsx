import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { createEvent, updateEvent, deleteEvent, getEvent } from '../api';
import type { Event, Document, EventDocument } from '../api';

interface EventsWidgetProps {
  projectId: string;
  events: Event[];
  onEventsChange: () => void;
  onTimelineClick?: () => void;
  onDocumentView?: (document: Document) => void;
  onDocumentEdit?: (document: Document) => void;
  onDocumentDelete?: (documentId: string) => void;
}

interface EventFormData {
  name: string;
  description: string;
  time_start: string;
  time_end: string;
  display_order: number;
  parent_event_id: string;
}

export function EventsWidget({ projectId, events, onEventsChange, onTimelineClick, onDocumentView, onDocumentEdit, onDocumentDelete }: EventsWidgetProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventDocuments, setEventDocuments] = useState<(EventDocument & {documents: Document})[]>([]);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [formData, setFormData] = useState<EventFormData>({
    name: '',
    description: '',
    time_start: '',
    time_end: '',
    display_order: 0,
    parent_event_id: ''
  });

  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      time_start: '',
      time_end: '',
      display_order: 0,
      parent_event_id: ''
    });
    setEditingEvent(null);
    setIsCreating(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Event name is required');
      return;
    }

    try {
      setLoading(true);
      const token = await getAccessToken();
      
      const eventData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        time_start: formData.time_start ? parseInt(formData.time_start) : undefined,
        time_end: formData.time_end ? parseInt(formData.time_end) : undefined,
        display_order: formData.display_order,
        parent_event_id: formData.parent_event_id || undefined
      };

      if (editingEvent) {
        await updateEvent(projectId, editingEvent.id, eventData, token);
      } else {
        await createEvent(projectId, eventData, token);
      }
      
      onEventsChange();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  const loadEventDetails = async (event: Event) => {
    try {
      const token = await getAccessToken();
      const eventDetails = await getEvent(projectId, event.id, token);
      setEventDocuments(eventDetails.documents as (EventDocument & {documents: Document})[] || []);
      setSelectedEvent(event);
      setShowEventDetails(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event details');
    }
  };

  const handleEdit = (event: Event) => {
    setFormData({
      name: event.name,
      description: event.description || '',
      time_start: event.time_start?.toString() || '',
      time_end: event.time_end?.toString() || '',
      display_order: event.display_order,
      parent_event_id: event.parent_event_id || ''
    });
    setEditingEvent(event);
    setIsCreating(true);
    setError(null);
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event? This will also remove all associated document relationships.')) {
      return;
    }

    try {
      setLoading(true);
      const token = await getAccessToken();
      await deleteEvent(projectId, eventId, token);
      onEventsChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event');
    } finally {
      setLoading(false);
    }
  };

  const formatTimeDisplay = (timeValue?: number) => {
    if (!timeValue) return 'Not set';
    return `T${timeValue}`;
  };

  const getEventDuration = (event: Event) => {
    if (!event.time_start || !event.time_end) return null;
    return event.time_end - event.time_start;
  };

  const getParentEventName = (parentId?: string) => {
    if (!parentId) return null;
    const parent = events.find(e => e.id === parentId);
    return parent?.name || 'Unknown Parent';
  };

  const sortedEvents = events
    .sort((a, b) => (a.time_start || 0) - (b.time_start || 0));

  return (
    <div className="events-widget">
      {/* Header with Create Button */}
      <div className="events-widget__header">
        <h4>📅 Events ({events.length})</h4>
        <div className="events-widget__actions">
          <button 
            className="btn btn--xs btn--secondary"
            onClick={() => {
              setIsCreating(!isCreating);
              setError(null);
              if (!isCreating) resetForm();
            }}
            disabled={loading}
          >
            {isCreating ? '✕' : '＋'}
          </button>
          {events.length > 0 && (
            <button 
              className="btn btn--xs btn--ghost"
              onClick={onTimelineClick}
            >
              Timeline
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="events-widget__error">
          {error}
          <button onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      {/* Create/Edit Form */}
      {isCreating && (
        <form onSubmit={handleSubmit} className="event-form--compact">
          <div className="event-form__group">
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Event name"
              className="event-form__input event-form__input--main"
              required
              disabled={loading}
            />
          </div>
          
          <div className="event-form__row">
            <input
              type="number"
              value={formData.time_start}
              onChange={(e) => setFormData(prev => ({ ...prev, time_start: e.target.value }))}
              placeholder="Start time"
              className="event-form__input event-form__input--small"
              disabled={loading}
            />
            <input
              type="number"
              value={formData.time_end}
              onChange={(e) => setFormData(prev => ({ ...prev, time_end: e.target.value }))}
              placeholder="End time"
              className="event-form__input event-form__input--small"
              disabled={loading}
            />
          </div>

          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Description (optional)"
            className="event-form__textarea"
            rows={2}
            disabled={loading}
          />

          {events.length > 0 && (
            <select
              value={formData.parent_event_id}
              onChange={(e) => setFormData(prev => ({ ...prev, parent_event_id: e.target.value }))}
              className="event-form__select"
              disabled={loading}
            >
              <option value="">No parent event</option>
              {events
                .filter(e => !editingEvent || e.id !== editingEvent.id)
                .map(event => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
            </select>
          )}

          <div className="event-form__actions">
            <button 
              type="button" 
              onClick={resetForm} 
              className="btn btn--xs btn--ghost"
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn--xs btn--primary"
              disabled={loading}
            >
              {loading ? '...' : (editingEvent ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      )}

      {/* Events List */}
      <div className="events-widget__content">
        {events.length === 0 ? (
          <div className="empty-state empty-state--compact">
            <p>No events yet</p>
            <p>Create events to organize your timeline.</p>
          </div>
        ) : (
          <div className="event-cards">
            {sortedEvents.map((event) => (
              <div key={event.id} className="event-card">
                <div className="event-card__main">
                  <div className="event-card__header">
                    <h5 className="event-card__name">{event.name}</h5>
                    <div className="event-card__actions">
                      <button
                        className="event-card__action"
                        onClick={() => loadEventDetails(event)}
                        disabled={loading}
                        title="View details"
                      >
                        ℹ️
                      </button>
                      <button
                        className="event-card__action"
                        onClick={() => handleEdit(event)}
                        disabled={loading}
                        title="Edit event"
                      >
                        ✎
                      </button>
                      <button
                        className="event-card__action event-card__action--danger"
                        onClick={() => handleDelete(event.id)}
                        disabled={loading}
                        title="Delete event"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  
                  {event.description && (
                    <p className="event-card__description">{event.description}</p>
                  )}
                  
                  <div className="event-card__meta">
                    {formatTimeDisplay(event.time_start) && (
                      <span className="event-card__time">
                        {formatTimeDisplay(event.time_start)}
                        {event.time_end && ` - ${formatTimeDisplay(event.time_end)}`}
                      </span>
                    )}
                    {event.parent_event_id && (
                      <span className="event-card__parent">
                        ↳ {getParentEventName(event.parent_event_id)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Event Details Modal */}
      {showEventDetails && selectedEvent && (
        <div className="event-details-overlay">
          <div className="event-details-modal">
            <div className="event-details-header">
              <h3>{selectedEvent.name}</h3>
              <button 
                className="modal-close"
                onClick={() => {
                  setShowEventDetails(false);
                  setSelectedEvent(null);
                }}
              >
                &times;
              </button>
            </div>
            
            <div className="event-details-body">
              <div className="event-info">
                {selectedEvent.description && (
                  <p className="event-description">{selectedEvent.description}</p>
                )}
                <div className="event-timing">
                  <span><strong>Start:</strong> {formatTimeDisplay(selectedEvent.time_start)}</span>
                  <span><strong>End:</strong> {formatTimeDisplay(selectedEvent.time_end)}</span>
                  {getEventDuration(selectedEvent) && (
                    <span><strong>Duration:</strong> {getEventDuration(selectedEvent)} units</span>
                  )}
                </div>
              </div>

              <div className="event-documents">
                <h4>Associated Documents ({eventDocuments.length})</h4>
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
                              setShowEventDetails(false);
                              setSelectedEvent(null);
                              onDocumentView?.(docAssoc.documents);
                            }}
                            title="View document"
                          >
                            👁️
                          </button>
                          <button
                            className="document-action-btn edit"
                            onClick={() => {
                              setShowEventDetails(false);
                              setSelectedEvent(null);
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}