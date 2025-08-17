import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { getEvents, addDocumentToEvent, removeDocumentFromEvent, getEvent } from '../api';
import { getProject } from '../accessors/projectAccessor';
import type { Event, Document } from '../api';
import { EventFilters, filterEvents, type EventFilterOptions } from './EventFilters';

interface EventSelectorProps {
  projectId: string;
  document: Document;
  onClose: () => void;
  onUpdate?: () => void;
}

export function EventSelector({ projectId, document, onClose, onUpdate }: EventSelectorProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [associatedEventIds, setAssociatedEventIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set());
  const [baseDate, setBaseDate] = useState(new Date());
  const [filters, setFilters] = useState<EventFilterOptions>({
    searchTerm: '',
    selectedTagIds: [],
    dateRange: { startDate: '', endDate: '' }
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
    }
  }, [projectId]);

  useEffect(() => {
    loadProjectBaseDate();
  }, [loadProjectBaseDate]);

  const timeToDate = (timeValue: number): Date => {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + timeValue);
    return date;
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

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAccessToken();
      const { events: projectEvents } = await getEvents(projectId, token);
      setEvents(projectEvents);

      // Load existing associations for this document
      // We need to check each event to see if it's associated with this document
      const associations = new Set<string>();
      
      for (const event of projectEvents) {
        try {
          const eventDetails = await getEvent(projectId, event.id, token);
          const isAssociated = eventDetails.documents.some(
            (doc) => doc.document_id === document.id
          );
          if (isAssociated) {
            associations.add(event.id);
          }
        } catch (err) {
          console.warn(`Failed to check association for event ${event.id}:`, err);
        }
      }
      
      setAssociatedEventIds(associations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [projectId, document.id]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleToggleAssociation = async (eventId: string, isCurrentlyAssociated: boolean) => {
    try {
      setPendingChanges(prev => new Set(prev).add(eventId));
      const token = await getAccessToken();

      if (isCurrentlyAssociated) {
        await removeDocumentFromEvent(projectId, eventId, document.id, token);
        setAssociatedEventIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(eventId);
          return newSet;
        });
      } else {
        await addDocumentToEvent(projectId, eventId, document.id, token);
        setAssociatedEventIds(prev => new Set(prev).add(eventId));
      }
      
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update event association');
    } finally {
      setPendingChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(eventId);
        return newSet;
      });
    }
  };


  const getParentEventName = (parentId?: string) => {
    if (!parentId) return null;
    const parent = events.find(e => e.id === parentId);
    return parent?.name || 'Unknown Parent';
  };

  const groupEventsByParent = (eventsToGroup: Event[]) => {
    const grouped: { [key: string]: Event[] } = {};
    const rootEvents: Event[] = [];

    eventsToGroup.forEach(event => {
      if (event.parent_event_id) {
        if (!grouped[event.parent_event_id]) {
          grouped[event.parent_event_id] = [];
        }
        grouped[event.parent_event_id].push(event);
      } else {
        rootEvents.push(event);
      }
    });

    return { rootEvents, grouped };
  };

  const renderEventItem = (event: Event, isChild = false) => {
    const isAssociated = associatedEventIds.has(event.id);
    const isPending = pendingChanges.has(event.id);

    return (
      <div key={event.id} className={`event-selector-item ${isChild ? 'child-event' : ''}`}>
        <div className="event-checkbox">
          <label>
            <input
              type="checkbox"
              checked={isAssociated}
              onChange={() => handleToggleAssociation(event.id, isAssociated)}
              disabled={isPending}
            />
            <span className="checkmark"></span>
          </label>
        </div>
        
        <div className="event-info">
          <div className="event-header">
            <h4 className="event-name">{event.name}</h4>
            {isPending && <span className="pending-indicator">Updating...</span>}
          </div>
          
          {event.description && (
            <p className="event-description">{event.description}</p>
          )}
          
          <div className="event-details">
            <span className="detail-item detail-item--date">
              <strong>Start:</strong> {formatDateDisplay(event.time_start)}
            </span>
            {event.time_end && (
              <span className="detail-item detail-item--date">
                <strong>End:</strong> {formatDateDisplay(event.time_end)}
              </span>
            )}
            {event.parent_event_id && (
              <span className="detail-item">
                <strong>Parent:</strong> {getParentEventName(event.parent_event_id)}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const filteredEvents = filterEvents(events, filters, new Map(), baseDate);
  const { rootEvents, grouped } = groupEventsByParent(filteredEvents);
  const totalAssociated = associatedEventIds.size;

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content event-selector">
          <div className="modal-header">
            <h3>Associate Events</h3>
            <button className="modal-close" onClick={onClose}>&times;</button>
          </div>
          <div className="modal-body">
            <div className="loading">Loading events...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content event-selector">
        <div className="modal-header">
          <h3>Associate Events</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="document-info">
            <h4>Document: {document.title || 'Untitled'}</h4>
            <p className="association-summary">
              {totalAssociated} event{totalAssociated !== 1 ? 's' : ''} associated
              {filteredEvents.length !== events.length && (
                <span> • Showing {filteredEvents.length} of {events.length} events</span>
              )}
            </p>
          </div>

          {events.length > 0 && (
            <EventFilters
              projectId={projectId}
              events={events}
              filters={filters}
              onFiltersChange={setFilters}
              baseDate={baseDate}
            />
          )}

          {error && (
            <div className="error-message">
              {error}
              <button onClick={() => setError(null)}>&times;</button>
            </div>
          )}

          <div className="events-list">
            {events.length === 0 ? (
              <p className="empty-state">
                No events found. Create events in the Event Manager to associate them with documents.
              </p>
            ) : filteredEvents.length === 0 ? (
              <p className="empty-state">
                No events match your current filter criteria. Try adjusting your filters or clearing them.
              </p>
            ) : (
              <div className="events-hierarchy">
                {rootEvents.map(event => (
                  <div key={event.id} className="event-group">
                    {renderEventItem(event)}
                    {grouped[event.id] && (
                      <div className="child-events">
                        {grouped[event.id].map(childEvent => 
                          renderEventItem(childEvent, true)
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button onClick={onClose} className="btn btn-primary">
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}