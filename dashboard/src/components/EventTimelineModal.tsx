import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { getEventTimeline } from '../api';
import type { Event } from '../api';

interface EventTimelineModalProps {
  projectId: string;
  onClose: () => void;
  onEventClick?: (event: Event) => void;
}

interface TimelineData {
  events: Event[];
  minTime: number;
  maxTime: number;
  timeRange: number;
}

export function EventTimelineModal({ projectId, onClose, onEventClick }: EventTimelineModalProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'gantt' | 'list'>('gantt');
  const [zoomLevel, setZoomLevel] = useState(1);

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
    const timeRange = Math.max(maxTime - minTime, 1);

    return {
      events,
      minTime,
      maxTime,
      timeRange
    };
  }, [events]);

  const getEventPosition = (event: Event) => {
    if (!event.time_start) return { left: 0, width: 0 };
    
    const { minTime, timeRange } = timelineData;
    const start = ((event.time_start - minTime) / timeRange) * 100;
    const end = event.time_end ? ((event.time_end - minTime) / timeRange) * 100 : start;
    const width = Math.max(end - start, 2); // Minimum 2% width for visibility
    
    return {
      left: start,
      width: width
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
    for (const [_, eventList] of parentMap) {
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
    if (!timeValue) return 'No time';
    return `T${timeValue}`;
  };

  const getEventDuration = (event: Event) => {
    if (!event.time_start || !event.time_end) return null;
    return event.time_end - event.time_start;
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
          <div className="gantt-timeline-header" style={{ transform: `scaleX(${zoomLevel})` }}>
            <div className="timeline-ruler">
              {Array.from({ length: Math.ceil(timelineData.timeRange / 10) + 1 }, (_, i) => {
                const timeValue = timelineData.minTime + (i * 10);
                return (
                  <div key={i} className="ruler-tick" style={{ left: `${(i * 10 / timelineData.timeRange) * 100}%` }}>
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
            <span className="event-name">{event.name}</span>
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
        
        <div className="gantt-timeline" style={{ transform: `scaleX(${zoomLevel})` }}>
          {hasTime && (
            <div 
              className={`gantt-bar ${event.time_end ? 'has-duration' : 'instant'}`}
              style={{
                left: `${position.left}%`,
                width: `${position.width}%`
              }}
              onClick={() => onEventClick?.(event)}
              title={`${event.name}: ${formatTimeDisplay(event.time_start)}${event.time_end ? ` - ${formatTimeDisplay(event.time_end)}` : ''}`}
            >
              <div className="gantt-bar-content">
                {position.width > 15 && (
                  <span className="gantt-bar-label">{event.name}</span>
                )}
              </div>
            </div>
          )}
          {!hasTime && (
            <div className="no-time-indicator" title="No time set for this event">
              <span>⏸</span>
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
          <div className="list-column order-column">Order</div>
        </div>
        <div className="list-body">
          {sortedEvents.map(event => {
            const duration = getEventDuration(event);
            const hasTime = event.time_start != null;
            
            return (
              <div 
                key={event.id} 
                className={`list-row ${event.parent_event_id ? 'child-event' : 'parent-event'}`}
                onClick={() => onEventClick?.(event)}
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
              <div className="zoom-controls">
                <label>Zoom:</label>
                <button 
                  className="zoom-btn"
                  onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
                  disabled={zoomLevel <= 0.5}
                >
                  −
                </button>
                <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
                <button 
                  className="zoom-btn"
                  onClick={() => setZoomLevel(Math.min(3, zoomLevel + 0.25))}
                  disabled={zoomLevel >= 3}
                >
                  +
                </button>
              </div>
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
      </div>
    </div>
  );
}