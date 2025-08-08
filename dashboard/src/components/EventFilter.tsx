import { useState } from 'react';
import type { Event } from '../api';

interface EventFilterProps {
  events: Event[];
  selectedEventIds: string[];
  onEventSelectionChange: (eventIds: string[]) => void;
  eventVersionFilter: 'all' | 'base' | 'versions';
  onVersionFilterChange: (filter: 'all' | 'base' | 'versions') => void;
}

export function EventFilter({ 
  events, 
  selectedEventIds, 
  onEventSelectionChange,
  eventVersionFilter,
  onVersionFilterChange
}: EventFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleEventToggle = (eventId: string) => {
    const newSelection = selectedEventIds.includes(eventId)
      ? selectedEventIds.filter(id => id !== eventId)
      : [...selectedEventIds, eventId];
    onEventSelectionChange(newSelection);
  };

  const handleClearAll = () => {
    onEventSelectionChange([]);
  };

  const formatTimeDisplay = (timeValue?: number) => {
    if (!timeValue) return 'No time';
    return `T${timeValue}`;
  };

  const groupEventsByParent = () => {
    const grouped: { [key: string]: Event[] } = {};
    const rootEvents: Event[] = [];

    events.forEach(event => {
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

  const renderEventOption = (event: Event, isChild = false) => {
    const isSelected = selectedEventIds.includes(event.id);
    
    return (
      <label key={event.id} className={`event-option ${isChild ? 'child-event' : ''} ${isSelected ? 'selected' : ''}`}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => handleEventToggle(event.id)}
        />
        <span className="event-info">
          <span className="event-name">{event.name}</span>
          <span className="event-time">{formatTimeDisplay(event.time_start)}</span>
        </span>
      </label>
    );
  };

  const { rootEvents, grouped } = groupEventsByParent();
  const selectedCount = selectedEventIds.length;

  if (events.length === 0) {
    return (
      <div className="filter-section event-filter">
        <h4 className="filter-title">Events</h4>
        <p className="empty-state">No events available</p>
      </div>
    );
  }

  return (
    <div className="filter-section event-filter">
      <div className="filter-header">
        <button 
          className="filter-title"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          Events
          {selectedCount > 0 && (
            <span className="filter-count">({selectedCount})</span>
          )}
          <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▼</span>
        </button>
      </div>

      {isExpanded && (
        <div className="filter-content">
          {/* Version Filter */}
          <div className="version-filter-section">
            <h5>Document Type</h5>
            <div className="version-options">
              <label className={eventVersionFilter === 'all' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="eventVersionFilter"
                  value="all"
                  checked={eventVersionFilter === 'all'}
                  onChange={(e) => onVersionFilterChange(e.target.value as 'all')}
                />
                <span>All Documents</span>
              </label>
              <label className={eventVersionFilter === 'base' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="eventVersionFilter"
                  value="base"
                  checked={eventVersionFilter === 'base'}
                  onChange={(e) => onVersionFilterChange(e.target.value as 'base')}
                />
                <span>Base Versions Only</span>
              </label>
              <label className={eventVersionFilter === 'versions' ? 'selected' : ''}>
                <input
                  type="radio"
                  name="eventVersionFilter"
                  value="versions"
                  checked={eventVersionFilter === 'versions'}
                  onChange={(e) => onVersionFilterChange(e.target.value as 'versions')}
                />
                <span>Event Versions Only</span>
              </label>
            </div>
          </div>

          {/* Event Selection */}
          <div className="event-selection-section">
            <div className="section-header">
              <h5>Filter by Events</h5>
              {selectedCount > 0 && (
                <button onClick={handleClearAll} className="clear-all-btn">
                  Clear All
                </button>
              )}
            </div>
            
            <div className="events-list">
              {rootEvents.map(event => (
                <div key={event.id} className="event-group">
                  {renderEventOption(event)}
                  {grouped[event.id] && (
                    <div className="child-events">
                      {grouped[event.id].map(childEvent => 
                        renderEventOption(childEvent, true)
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}