import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { getEvents } from '../api';
import type { Event, Document } from '../api';
import { EventFilters, filterEvents, type EventFilterOptions } from './EventFilters';

interface EventAssignmentModalProps {
  projectId: string;
  document: Document;
  onClose: () => void;
  onUpdate?: () => void;
}

export function EventAssignmentModal({ projectId, document, onClose, onUpdate }: EventAssignmentModalProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
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
      const { getProject } = await import('../accessors/projectAccessor');
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleAssignEvent = async (eventId: string | null) => {
    try {
      setAssigning(true);
      const token = await getAccessToken();
      
      // Update document with event_id
      const { updateDocument } = await import('../api');
      const updatedDocument = {
        ...document,
        event_id: eventId || undefined
      };
      
      await updateDocument(projectId, document.id, updatedDocument, token);
      onUpdate?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign event');
    } finally {
      setAssigning(false);
    }
  };

  const currentEvent = document.event_id ? events.find(e => e.id === document.event_id) : null;
  const filteredEvents = filterEvents(events, filters, new Map(), baseDate);

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content event-assignment">
          <div className="modal-header">
            <h3>Assign Event</h3>
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
      <div className="modal-content event-assignment">
        <div className="modal-header">
          <h3>Assign Event to Document</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="document-info">
            <h4>📄 {document.title || 'Untitled'}</h4>
            {currentEvent ? (
              <p className="current-assignment">
                📅 Currently assigned to: <strong>{currentEvent.name}</strong>
              </p>
            ) : (
              <p className="current-assignment">
                ⭕ No event assigned (document stands alone)
              </p>
            )}
          </div>

          {error && (
            <div className="error-message">
              {error}
              <button onClick={() => setError(null)}>&times;</button>
            </div>
          )}

          {/* Quick Actions */}
          <div className="assignment-actions">
            {currentEvent && (
              <button 
                className="btn btn-secondary btn-sm"
                onClick={() => handleAssignEvent(null)}
                disabled={assigning}
              >
                ❌ Make Document Standalone
              </button>
            )}
            <p className="assignment-help">
              💡 Documents can exist without events or be assigned to exactly one event for timeline context.
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

          <div className="events-selection">
            {events.length === 0 ? (
              <p className="empty-state">
                No events found. Create events in the Event Manager to assign them to documents.
              </p>
            ) : filteredEvents.length === 0 ? (
              <p className="empty-state">
                No events match your current filter criteria. Try adjusting your filters.
              </p>
            ) : (
              <div className="events-grid">
                {filteredEvents.map(event => {
                  const isAssigned = document.event_id === event.id;
                  return (
                    <div 
                      key={event.id} 
                      className={`event-card ${isAssigned ? 'event-card--assigned' : ''}`}
                    >
                      <div className="event-card__content">
                        <h5 className="event-card__name">{event.name}</h5>
                        {event.description && (
                          <p className="event-card__description">{event.description}</p>
                        )}
                        <div className="event-card__meta">
                          <span className="event-card__date">
                            📅 {formatDateDisplay(event.time_start)}
                            {event.time_end && ` - ${formatDateDisplay(event.time_end)}`}
                          </span>
                        </div>
                      </div>
                      <div className="event-card__actions">
                        {isAssigned ? (
                          <span className="event-card__status">✓ Assigned</span>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleAssignEvent(event.id)}
                            disabled={assigning}
                          >
                            {assigning ? 'Assigning...' : 'Assign'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button onClick={onClose} className="btn btn-secondary">
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}