import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';
import { createEvent, updateEvent, deleteEvent, getEvent, getEventTags } from '../api';
import { getProject } from '../accessors/projectAccessor';
import { EventFilters, filterEvents, type EventFilterOptions } from './EventFilters';
import { TagSelector } from './TagSelector';
import type { Event, Document, EventDocument, Tag } from '../api';

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
  const [baseDate, setBaseDate] = useState(new Date());
  const [eventTags, setEventTags] = useState<Map<string, Tag[]>>(new Map());
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [tagSelectorEvent, setTagSelectorEvent] = useState<Event | null>(null);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [filters, setFilters] = useState<EventFilterOptions>({
    searchTerm: '',
    selectedTagIds: [],
    dateRange: { startDate: '', endDate: '' }
  });
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

  const loadProjectBaseDate = useCallback(async () => {
    try {
      const project = await getProject(projectId);
      if (project.base_date) {
        setBaseDate(new Date(project.base_date));
      }
    } catch (err) {
      console.error('Failed to load project base date:', err);
      // Continue with default date if loading fails
    }
  }, [projectId]);

  useEffect(() => {
    loadProjectBaseDate();
  }, [loadProjectBaseDate]);

  const loadEventTags = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const tagMap = new Map<string, Tag[]>();
      
      await Promise.all(events.map(async (event) => {
        try {
          const tags = await getEventTags(projectId, event.id, token);
          tagMap.set(event.id, tags);
        } catch (err) {
          console.warn(`Failed to load tags for event ${event.id}:`, err);
          tagMap.set(event.id, []);
        }
      }));
      
      setEventTags(tagMap);
    } catch (err) {
      console.error('Failed to load event tags:', err);
    }
  }, [projectId, events]);

  useEffect(() => {
    if (events.length > 0) {
      loadEventTags();
    }
  }, [loadEventTags]);


  const timeToDate = (timeValue: number): Date => {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + timeValue);
    return date;
  };

  const dateToTime = (date: Date): number => {
    const diffTime = date.getTime() - baseDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatDateDisplay = (timeValue?: number): string => {
    if (!timeValue && timeValue !== 0) return 'Not set';
    const date = timeToDate(timeValue);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const resetFormData = () => {
    setFormData({
      name: '',
      description: '',
      time_start: '',
      time_end: '',
      display_order: 0,
      parent_event_id: ''
    });
    setEditingEvent(null);
  };

  const resetForm = () => {
    resetFormData();
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
        time_start: (formData.time_start && formData.time_start.trim()) ? dateToTime(new Date(formData.time_start)) : undefined,
        time_end: (formData.time_end && formData.time_end.trim()) ? dateToTime(new Date(formData.time_end)) : undefined,
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
      time_start: event.time_start ? timeToDate(event.time_start).toISOString().split('T')[0] : '',
      time_end: event.time_end ? timeToDate(event.time_end).toISOString().split('T')[0] : '',
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

  const handleTagsManagement = (event: Event) => {
    setTagSelectorEvent(event);
    setShowTagSelector(true);
  };

  const handleTagsUpdate = async () => {
    await loadEventTags();
    // Don't close the modal - let user close it manually
  };
  
  const handleTagSelectorClose = () => {
    setShowTagSelector(false);
    setTagSelectorEvent(null);
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

  const hasActiveFilters = filters.searchTerm || 
    filters.selectedTagIds.length > 0 || 
    filters.dateRange.startDate || 
    filters.dateRange.endDate;

  const filteredEvents = filterEvents(events, filters, eventTags, baseDate);
  const sortedEvents = filteredEvents
    .sort((a, b) => (a.time_start || 0) - (b.time_start || 0));

  return (
    <div className="events-widget">
      {/* Header with Create Button */}
      <div className="events-widget__header">
        <h4>📅 Events ({filteredEvents.length}{events.length !== filteredEvents.length ? `/${events.length}` : ''})</h4>
        <div className="events-widget__actions">
          {events.length > 0 && (
            <button 
              className={`btn btn--xs ${hasActiveFilters ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => setShowFiltersModal(true)}
              title={hasActiveFilters ? 'Filters active - click to edit' : 'Filter events'}
            >
              🔍 {hasActiveFilters ? '●' : ''}
            </button>
          )}
          <button 
            className="btn btn--xs btn--secondary"
            onClick={() => {
              setIsCreating(!isCreating);
              setError(null);
              if (!isCreating) {
                resetFormData();
              }
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
              type="date"
              value={formData.time_start}
              onChange={(e) => setFormData(prev => ({ ...prev, time_start: e.target.value }))}
              placeholder="Start date"
              className="event-form__input event-form__input--small"
              disabled={loading}
            />
            <input
              type="date"
              value={formData.time_end}
              onChange={(e) => setFormData(prev => ({ ...prev, time_end: e.target.value }))}
              placeholder="End date"
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
                        onClick={() => handleTagsManagement(event)}
                        disabled={loading}
                        title="Manage tags"
                      >
                        🏷️
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
                    {(event.time_start != null) && (
                      <span className="event-card__time">
                        {formatDateDisplay(event.time_start)}
                        {event.time_end && ` - ${formatDateDisplay(event.time_end)}`}
                      </span>
                    )}
                    {event.parent_event_id && (
                      <span className="event-card__parent">
                        ↳ {getParentEventName(event.parent_event_id)}
                      </span>
                    )}
                    {eventTags.get(event.id) && eventTags.get(event.id)!.length > 0 && (
                      <div className="event-card__tags">
                        {eventTags.get(event.id)!.map(tag => (
                          <span 
                            key={tag.id} 
                            className="tag-chip"
                            style={{ backgroundColor: tag.color }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Event Details Modal */}
      {showEventDetails && selectedEvent && createPortal(
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
                  <span><strong>Start:</strong> {formatDateDisplay(selectedEvent.time_start)}</span>
                  <span><strong>End:</strong> {formatDateDisplay(selectedEvent.time_end)}</span>
                  {getEventDuration(selectedEvent) && (
                    <span><strong>Duration:</strong> {getEventDuration(selectedEvent)} days</span>
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
        </div>,
        document.getElementById('modal-portal')!
      )}

      {/* Tag Selector Modal */}
      {showTagSelector && tagSelectorEvent && createPortal(
        <TagSelector
          projectId={projectId}
          entityType="event"
          entityId={tagSelectorEvent.id}
          entityName={tagSelectorEvent.name}
          onClose={handleTagSelectorClose}
          onUpdate={handleTagsUpdate}
        />,
        document.getElementById('modal-portal')!
      )}

      {/* Event Filters Modal */}
      {showFiltersModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Filter Events</h3>
              <button className="modal-close" onClick={() => setShowFiltersModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <EventFilters
                projectId={projectId}
                events={events}
                filters={filters}
                onFiltersChange={setFilters}
                baseDate={baseDate}
              />
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn--ghost" 
                onClick={() => {
                  setFilters({
                    searchTerm: '',
                    selectedTagIds: [],
                    dateRange: { startDate: '', endDate: '' }
                  });
                }}
              >
                Clear All
              </button>
              <button 
                className="btn btn--primary" 
                onClick={() => setShowFiltersModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.getElementById('modal-portal')!
      )}
    </div>
  );
}