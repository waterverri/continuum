import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { getEventTimeline, getEvent, updateEvent, deleteEvent } from '../api';
import type { Event, Document, EventDocument } from '../api';

interface EventTimelineModalProps {
  projectId: string;
  onClose: () => void;
  onEventClick?: (event: Event) => void;
  onDocumentView?: (document: Document) => void;
  onDocumentEdit?: (document: Document) => void;
  onDocumentDelete?: (documentId: string) => void;
}

interface TimelineData {
  events: Event[];
  minTime: number;
  maxTime: number;
  timeRange: number;
}

interface EventFormData {
  name: string;
  description: string;
  time_start: string;
  time_end: string;
  display_order: number;
  parent_event_id: string;
}

export function EventTimelineModal({ projectId, onClose, onDocumentView, onDocumentEdit, onDocumentDelete }: EventTimelineModalProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'gantt' | 'list'>('gantt');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, panOffset: 0 });
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventDocuments, setEventDocuments] = useState<(EventDocument & {documents: Document})[]>([]);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
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

  const loadTimeline = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAccessToken();
      const { events: timelineEvents } = await getEventTimeline(projectId, token);
      setEvents(timelineEvents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

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

  const handleEditEvent = async () => {
    if (!editingEvent) return;
    
    try {
      const token = await getAccessToken();
      const eventData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        time_start: formData.time_start ? parseInt(formData.time_start) : undefined,
        time_end: formData.time_end ? parseInt(formData.time_end) : undefined,
        display_order: formData.display_order,
        parent_event_id: formData.parent_event_id || undefined
      };

      await updateEvent(projectId, editingEvent.id, eventData, token);
      await loadTimeline();
      setEditingEvent(null);
      setShowEventDetails(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update event');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event? This will also remove all associated document relationships.')) {
      return;
    }

    try {
      const token = await getAccessToken();
      await deleteEvent(projectId, eventId, token);
      await loadTimeline();
      if (selectedEvent?.id === eventId) {
        setShowEventDetails(false);
        setSelectedEvent(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event');
    }
  };

  const startEditEvent = (event: Event) => {
    setFormData({
      name: event.name,
      description: event.description || '',
      time_start: event.time_start?.toString() || '',
      time_end: event.time_end?.toString() || '',
      display_order: event.display_order,
      parent_event_id: event.parent_event_id || ''
    });
    setEditingEvent(event);
  };

  // Pan functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, panOffset });
    e.preventDefault();
  }, [panOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStart.x;
    const panSensitivity = 1 / zoomLevel; // More sensitive when zoomed in
    const newPanOffset = dragStart.panOffset - (deltaX * panSensitivity);
    
    // Constrain pan to reasonable bounds
    const maxPan = Math.max(0, (zoomLevel - 1) * 50);
    const constrainedPan = Math.max(-maxPan, Math.min(maxPan, newPanOffset));
    
    setPanOffset(constrainedPan);
  }, [isDragging, dragStart, zoomLevel]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Enhanced zoom functionality
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(5, prev + 0.5));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => {
      const newZoom = Math.max(0.25, prev - 0.5);
      // Reset pan when zooming out significantly
      if (newZoom <= 1) {
        setPanOffset(0);
      }
      return newZoom;
    });
  };

  const handleZoomReset = () => {
    setZoomLevel(1);
    setPanOffset(0);
  };

  const handleZoomToFit = () => {
    // Calculate optimal zoom to fit all events
    const eventsWithTime = events.filter(e => e.time_start != null);
    if (eventsWithTime.length === 0) return;
    
    setZoomLevel(1);
    setPanOffset(0);
  };

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  const timelineData: TimelineData = useMemo(() => {
    const eventsWithTime = events.filter(e => e.time_start != null);
    
    if (eventsWithTime.length === 0) {
      return {
        events,
        minTime: 0,
        maxTime: 100,
        timeRange: 100
      };
    }

    const startTimes = eventsWithTime.map(e => e.time_start!);
    const endTimes = eventsWithTime.map(e => e.time_end || e.time_start!);
    
    const minTime = Math.min(...startTimes);
    const maxTime = Math.max(...endTimes);
    const timeRange = Math.max(maxTime - minTime, 10); // Minimum range for visibility

    return {
      events,
      minTime,
      maxTime,
      timeRange
    };
  }, [events]);

  const getEventPosition = (event: Event) => {
    if (!event.time_start) return { left: 0, width: 0, visible: false };
    
    const { minTime, timeRange } = timelineData;
    const start = ((event.time_start - minTime) / timeRange) * 100;
    const end = event.time_end ? ((event.time_end - minTime) / timeRange) * 100 : start + 1;
    const width = Math.max(end - start, 1); // Minimum 1% width for visibility
    
    return {
      left: Math.max(0, start),
      width: Math.min(width, 100 - start),
      visible: true
    };
  };

  const getEventsByParent = () => {
    const parentMap = new Map<string | null, Event[]>();
    
    events.forEach(event => {
      const parentId = event.parent_event_id || null;
      if (!parentMap.has(parentId)) {
        parentMap.set(parentId, []);
      }
      parentMap.get(parentId)!.push(event);
    });

    // Sort events within each parent group
    for (const [, eventList] of parentMap) {
      eventList.sort((a, b) => {
        // Sort by time first, then by display order
        const aTime = a.time_start || 0;
        const bTime = b.time_start || 0;
        if (aTime !== bTime) return aTime - bTime;
        return a.display_order - b.display_order;
      });
    }

    return parentMap;
  };

  const formatTimeDisplay = (timeValue?: number) => {
    if (!timeValue) return 'Not set';
    return `T${timeValue}`;
  };

  const getEventDuration = (event: Event) => {
    if (!event.time_start || !event.time_end) return null;
    return event.time_end - event.time_start;
  };

  const getEventColor = (eventId: string) => {
    // Simple hash function to generate consistent colors
    let hash = 0;
    for (let i = 0; i < eventId.length; i++) {
      const char = eventId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Generate HSL color with good saturation and lightness
    const hue = Math.abs(hash) % 360;
    const saturation = 65 + (Math.abs(hash) % 20); // 65-85%
    const lightness = 45 + (Math.abs(hash) % 15); // 45-60%
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  const renderGanttView = () => {
    const eventsByParent = getEventsByParent();
    const rootEvents = eventsByParent.get(null) || [];
    
    return (
      <div className="timeline-gantt">
        <div className="gantt-header">
          <div className="gantt-labels">
            <div className="gantt-label">Events</div>
          </div>
          <div 
            className="gantt-timeline-header" 
            style={{ 
              transform: `scaleX(${zoomLevel}) translateX(${panOffset}px)`,
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div className="timeline-ruler">
              {Array.from({ length: Math.ceil(timelineData.timeRange / 5) + 1 }, (_, i) => {
                const timeValue = timelineData.minTime + (i * 5);
                const position = (i * 5 / timelineData.timeRange) * 100;
                return (
                  <div key={i} className="ruler-tick" style={{ left: `${position}%` }}>
                    <span className="ruler-label">T{timeValue}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="gantt-body">
          {rootEvents.map(event => (
            <div key={event.id} className="gantt-row-group">
              {renderGanttRow(event, 0)}
              {eventsByParent.has(event.id) && (
                <div className="child-rows">
                  {eventsByParent.get(event.id)!.map(childEvent => 
                    renderGanttRow(childEvent, 1, true)
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderGanttRow = (event: Event, level: number, isChild = false) => {
    const position = getEventPosition(event);
    const duration = getEventDuration(event);
    const hasTime = event.time_start != null;

    return (
      <div key={event.id} className={`gantt-row ${isChild ? 'child-row' : ''} level-${level}`}>
        <div className="gantt-event-label">
          <div className="event-label-content">
            <div className="event-label-header">
              <span className="event-name">{event.name}</span>
              <div className="event-actions">
                <button 
                  className="event-action-btn info"
                  onClick={() => loadEventDetails(event)}
                  title="View details"
                >
                  ℹ️
                </button>
                <button 
                  className="event-action-btn edit"
                  onClick={() => startEditEvent(event)}
                  title="Edit event"
                >
                  ✎
                </button>
                <button 
                  className="event-action-btn delete"
                  onClick={() => handleDeleteEvent(event.id)}
                  title="Delete event"
                >
                  🗑️
                </button>
              </div>
            </div>
            {event.description && (
              <span className="event-description">{event.description}</span>
            )}
            <div className="event-meta">
              {hasTime && (
                <span className="event-time">
                  {formatTimeDisplay(event.time_start)}
                  {event.time_end && ` - ${formatTimeDisplay(event.time_end)}`}
                </span>
              )}
              {duration && duration > 0 && (
                <span className="event-duration">({duration} units)</span>
              )}
            </div>
          </div>
        </div>
        
        <div 
          className="gantt-timeline" 
          style={{ 
            transform: `scaleX(${zoomLevel}) translateX(${panOffset}px)`,
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {position.visible && (
            <div 
              className={`gantt-bar ${event.time_end ? 'has-duration' : 'instant'}`}
              style={{
                left: `${position.left}%`,
                width: `${position.width}%`,
                backgroundColor: getEventColor(event.id),
                borderColor: getEventColor(event.id)
              }}
              onClick={() => loadEventDetails(event)}
              title={`${event.name}: ${formatTimeDisplay(event.time_start)}${event.time_end ? ` - ${formatTimeDisplay(event.time_end)}` : ''}`}
            >
              <div className="gantt-bar-content">
                {position.width > 10 && (
                  <span className="gantt-bar-label">{event.name}</span>
                )}
              </div>
            </div>
          )}
          {!hasTime && (
            <div className="no-time-indicator" title="No time set for this event">
              <span>⏸️</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderListView = () => {
    const sortedEvents = [...events].sort((a, b) => {
      const aTime = a.time_start || 0;
      const bTime = b.time_start || 0;
      if (aTime !== bTime) return aTime - bTime;
      return a.display_order - b.display_order;
    });

    return (
      <div className="timeline-list">
        <div className="list-header">
          <div className="list-column event-column">Event</div>
          <div className="list-column time-column">Start Time</div>
          <div className="list-column time-column">End Time</div>
          <div className="list-column duration-column">Duration</div>
          <div className="list-column order-column">Priority</div>
        </div>
        <div className="list-body">
          {sortedEvents.map(event => {
            const duration = getEventDuration(event);
            const hasTime = event.time_start != null;
            
            return (
              <div 
                key={event.id} 
                className={`list-row ${event.parent_event_id ? 'child-event' : 'parent-event'}`}
                onClick={() => loadEventDetails(event)}
              >
                <div className="list-column event-column">
                  <div className="event-info">
                    <span className="event-name">{event.name}</span>
                    {event.description && (
                      <span className="event-description">{event.description}</span>
                    )}
                    {event.parent_event_id && (
                      <span className="parent-indicator">↳ Child Event</span>
                    )}
                  </div>
                </div>
                <div className="list-column time-column">
                  <span className={hasTime ? 'has-time' : 'no-time'}>
                    {formatTimeDisplay(event.time_start)}
                  </span>
                </div>
                <div className="list-column time-column">
                  <span className={event.time_end ? 'has-time' : 'no-time'}>
                    {formatTimeDisplay(event.time_end)}
                  </span>
                </div>
                <div className="list-column duration-column">
                  <span>{duration ? `${duration} units` : '-'}</span>
                </div>
                <div className="list-column order-column">
                  <span>{event.display_order}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="modal-overlay modal-overlay--fullscreen">
        <div className="timeline-modal">
          <div className="timeline-modal__header">
            <h2>📅 Event Timeline</h2>
            <button className="modal-close" onClick={onClose}>&times;</button>
          </div>
          <div className="timeline-modal__body">
            <div className="timeline-loading">
              <div className="loading-spinner"></div>
              <p>Loading timeline...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay modal-overlay--fullscreen">
      <div className="timeline-modal">
        <div className="timeline-modal__header">
          <div className="timeline-modal__title">
            <h2>📅 Event Timeline</h2>
            <p>{events.length} events • {timelineData.timeRange} time units</p>
          </div>
          
          <div className="timeline-modal__controls">
            <div className="view-mode-toggle">
              <button 
                className={`toggle-btn ${viewMode === 'gantt' ? 'active' : ''}`}
                onClick={() => setViewMode('gantt')}
              >
                📊 Gantt
              </button>
              <button 
                className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                📋 List
              </button>
            </div>
            
            {viewMode === 'gantt' && (
              <>
                <div className="zoom-controls">
                  <label>Zoom:</label>
                  <button 
                    className="zoom-btn"
                    onClick={handleZoomOut}
                    disabled={zoomLevel <= 0.25}
                    title="Zoom out"
                  >
                    −
                  </button>
                  <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
                  <button 
                    className="zoom-btn"
                    onClick={handleZoomIn}
                    disabled={zoomLevel >= 5}
                    title="Zoom in"
                  >
                    +
                  </button>
                  <button 
                    className="zoom-btn"
                    onClick={handleZoomReset}
                    title="Reset zoom"
                  >
                    ⌂
                  </button>
                  <button 
                    className="zoom-btn"
                    onClick={handleZoomToFit}
                    title="Fit to view"
                  >
                    ⛶
                  </button>
                </div>
                <div className="pan-controls">
                  <label>Pan: {panOffset.toFixed(0)}px</label>
                </div>
              </>
            )}
          </div>
          
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {error && (
          <div className="timeline-modal__error">
            {error}
            <button onClick={() => setError(null)}>&times;</button>
          </div>
        )}

        <div className="timeline-modal__body">
          {events.length === 0 ? (
            <div className="timeline-empty">
              <div className="empty-icon">📅</div>
              <h3>No Events Found</h3>
              <p>Create events to visualize them on the timeline.</p>
            </div>
          ) : (
            <div className={`timeline-content ${viewMode}`}>
              {viewMode === 'gantt' ? renderGanttView() : renderListView()}
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
                    setEditingEvent(null);
                  }}
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
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label>Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Start Time</label>
                        <input
                          type="number"
                          value={formData.time_start}
                          onChange={(e) => setFormData(prev => ({ ...prev, time_start: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label>End Time</label>
                        <input
                          type="number"
                          value={formData.time_end}
                          onChange={(e) => setFormData(prev => ({ ...prev, time_end: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="form-actions">
                      <button 
                        className="btn btn-secondary"
                        onClick={() => setEditingEvent(null)}
                      >
                        Cancel
                      </button>
                      <button 
                        className="btn btn-primary"
                        onClick={handleEditEvent}
                      >
                        Save Changes
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
                                  onClick={() => onDocumentView?.(docAssoc.documents)}
                                  title="View document"
                                >
                                  👁️
                                </button>
                                <button
                                  className="document-action-btn edit"
                                  onClick={() => onDocumentEdit?.(docAssoc.documents)}
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
        )}
      </div>
    </div>
  );
}