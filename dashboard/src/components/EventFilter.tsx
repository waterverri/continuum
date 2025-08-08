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
}: EventFilterProps) {

  if (events.length === 0) {
    return null;
  }

  return (
    <div className="filter-section">
      <label className="filter-label">Filter by Events</label>
      <select 
        className="filter-select"
        value={selectedEventIds.length === 1 ? selectedEventIds[0] : ''}
        onChange={(e) => {
          const value = e.target.value;
          onEventSelectionChange(value ? [value] : []);
        }}
      >
        <option value="">All Events</option>
        {events
          .sort((a, b) => (a.time_start || 0) - (b.time_start || 0))
          .map(event => (
            <option key={event.id} value={event.id}>
              {event.name} {event.time_start ? `(${event.time_start})` : ''}
            </option>
          ))}
      </select>
    </div>
  );
}