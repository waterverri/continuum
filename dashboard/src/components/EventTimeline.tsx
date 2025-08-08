import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { getEventTimeline } from '../api';
import type { Event, EventHierarchy } from '../api';

interface EventTimelineProps {
  projectId: string;
  onEventClick?: (event: Event) => void;
}

export function EventTimeline({ projectId, onEventClick }: EventTimelineProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [hierarchy, setHierarchy] = useState<EventHierarchy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline');

  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const loadTimeline = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAccessToken();
      const { events: timelineEvents, hierarchy: eventHierarchy } = await getEventTimeline(projectId, token);
      setEvents(timelineEvents);
      setHierarchy(eventHierarchy);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  const formatTimeDisplay = (timeValue?: number) => {
    if (!timeValue) return 'No time set';
    return `Time ${timeValue}`;
  };

  const getEventDuration = (event: Event) => {
    if (!event.time_start || !event.time_end) return null;
    return event.time_end - event.time_start;
  };

  const getChildEvents = (parentId: string) => {
    const childIds = hierarchy
      .filter(h => h.parent_event_id === parentId)
      .map(h => h.child_event_id);
    return events.filter(e => childIds.includes(e.id));
  };

  const getRootEvents = () => {
    const childIds = new Set(hierarchy.map(h => h.child_event_id));
    return events.filter(e => !childIds.has(e.id));
  };

  const renderTimelineEvent = (event: Event, level = 0) => {
    const duration = getEventDuration(event);
    const childEvents = getChildEvents(event.id);
    const hasTime = event.time_start != null;

    return (
      <div key={event.id} className={`timeline-event level-${level}`}>
        <div 
          className={`event-card ${hasTime ? 'has-time' : 'no-time'}`}
          onClick={() => onEventClick?.(event)}
        >
          <div className="event-header">
            <h4 className="event-name">{event.name}</h4>
            <div className="event-meta">
              {hasTime && (
                <span className="time-range">
                  {formatTimeDisplay(event.time_start)}
                  {event.time_end && ` - ${formatTimeDisplay(event.time_end)}`}
                </span>
              )}
              {duration && duration > 0 && (
                <span className="duration">Duration: {duration}</span>
              )}
            </div>
          </div>
          
          {event.description && (
            <p className="event-description">{event.description}</p>
          )}
          
          <div className="event-details">
            <span className="detail-item">Order: {event.display_order}</span>
            {childEvents.length > 0 && (
              <span className="detail-item">{childEvents.length} sub-event{childEvents.length !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
        
        {childEvents.length > 0 && (
          <div className="child-events">
            {childEvents
              .sort((a, b) => (a.time_start || 0) - (b.time_start || 0) || a.display_order - b.display_order)
              .map(childEvent => renderTimelineEvent(childEvent, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderListEvent = (event: Event, level = 0) => {
    const childEvents = getChildEvents(event.id);
    
    return (
      <div key={event.id} className={`list-event level-${level}`}>
        <div 
          className="event-row"
          onClick={() => onEventClick?.(event)}
        >
          <div className="event-info">
            <span className="event-name">{event.name}</span>
            {event.description && (
              <span className="event-description">{event.description}</span>
            )}
          </div>
          <div className="event-timing">
            <span className="time-start">{formatTimeDisplay(event.time_start)}</span>
            <span className="time-end">{formatTimeDisplay(event.time_end)}</span>
            <span className="display-order">Order: {event.display_order}</span>
          </div>
        </div>
        
        {childEvents.length > 0 && (
          <div className="child-events">
            {childEvents
              .sort((a, b) => (a.time_start || 0) - (b.time_start || 0) || a.display_order - b.display_order)
              .map(childEvent => renderListEvent(childEvent, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootEvents = getRootEvents().sort((a, b) => 
    (a.time_start || 0) - (b.time_start || 0) || a.display_order - b.display_order
  );

  if (loading) {
    return (
      <div className="event-timeline">
        <div className="timeline-header">
          <h3>Event Timeline</h3>
        </div>
        <div className="loading">Loading timeline...</div>
      </div>
    );
  }

  return (
    <div className="event-timeline">
      <div className="timeline-header">
        <h3>Event Timeline</h3>
        <div className="timeline-controls">
          <div className="view-mode-toggle">
            <button 
              className={viewMode === 'timeline' ? 'active' : ''}
              onClick={() => setViewMode('timeline')}
            >
              Timeline
            </button>
            <button 
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      <div className="timeline-content">
        {events.length === 0 ? (
          <p className="empty-state">
            No events found. Create events to see them in the timeline.
          </p>
        ) : (
          <div className={`timeline-view ${viewMode}`}>
            {viewMode === 'timeline' ? (
              <div className="timeline-events">
                {rootEvents.map(event => renderTimelineEvent(event))}
              </div>
            ) : (
              <div className="list-events">
                <div className="list-header">
                  <div className="event-info-header">Event</div>
                  <div className="event-timing-header">
                    <span>Start</span>
                    <span>End</span>
                    <span>Order</span>
                  </div>
                </div>
                <div className="list-body">
                  {rootEvents.map(event => renderListEvent(event))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}