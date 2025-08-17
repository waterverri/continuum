import type { Event } from '../api';

export interface TimelineListViewProps {
  events: Event[];
  formatDateDisplay: (timeValue?: number) => string;
  onEventClick: (event: Event) => void;
}

export function TimelineListView({
  events,
  formatDateDisplay,
  onEventClick
}: TimelineListViewProps) {
  
  const getEventDuration = (event: Event) => {
    if (!event.time_start || !event.time_end) return null;
    return event.time_end - event.time_start;
  };

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
              onClick={() => onEventClick(event)}
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
                  {formatDateDisplay(event.time_start)}
                </span>
              </div>
              <div className="list-column time-column">
                <span className={event.time_end ? 'has-time' : 'no-time'}>
                  {formatDateDisplay(event.time_end)}
                </span>
              </div>
              <div className="list-column duration-column">
                <span>{duration ? `${duration} days` : '-'}</span>
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
}