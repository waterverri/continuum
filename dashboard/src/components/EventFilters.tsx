import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { getTags } from '../api';
import type { Event, Tag } from '../api';

export interface EventFilterOptions {
  searchTerm: string;
  selectedTagIds: string[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

interface EventFiltersProps {
  projectId: string;
  events: Event[];
  filters: EventFilterOptions;
  onFiltersChange: (filters: EventFilterOptions) => void;
  baseDate: Date;
}

export function EventFilters({ 
  projectId, 
  events,
  filters, 
  onFiltersChange,
  baseDate
}: EventFiltersProps) {
  const [tags, setTags] = useState<Tag[]>([]);

  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const loadTags = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const projectTags = await getTags(projectId, token);
      setTags(projectTags);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  }, [projectId]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const timeToDate = (timeValue: number): Date => {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + timeValue);
    return date;
  };

  const getDateRange = () => {
    if (events.length === 0) return { min: '', max: '' };
    
    const eventsWithDates = events.filter(e => e.time_start != null);
    if (eventsWithDates.length === 0) return { min: '', max: '' };
    
    const minTime = Math.min(...eventsWithDates.map(e => e.time_start!));
    const maxTime = Math.max(...eventsWithDates.map(e => e.time_end || e.time_start!));
    
    return {
      min: timeToDate(minTime).toISOString().split('T')[0],
      max: timeToDate(maxTime).toISOString().split('T')[0]
    };
  };

  const dateRange = getDateRange();

  const updateFilters = (updates: Partial<EventFilterOptions>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  return (
    <div className="event-filters">
      <div className="event-filters__row">
        {/* Search by name */}
        <div className="filter-section">
          <label className="filter-label">Search Events</label>
          <input
            type="text"
            value={filters.searchTerm}
            onChange={(e) => updateFilters({ searchTerm: e.target.value })}
            placeholder="Search by name..."
            className="filter-input"
          />
        </div>

        {/* Date range filter */}
        {dateRange.min && (
          <div className="filter-section">
            <label className="filter-label">Date Range</label>
            <div className="date-range-inputs">
              <input
                type="date"
                value={filters.dateRange.startDate}
                onChange={(e) => updateFilters({ 
                  dateRange: { ...filters.dateRange, startDate: e.target.value }
                })}
                min={dateRange.min}
                max={dateRange.max}
                className="filter-input filter-input--date"
                placeholder="Start date"
              />
              <span className="date-range-separator">–</span>
              <input
                type="date"
                value={filters.dateRange.endDate}
                onChange={(e) => updateFilters({ 
                  dateRange: { ...filters.dateRange, endDate: e.target.value }
                })}
                min={dateRange.min}
                max={dateRange.max}
                className="filter-input filter-input--date"
                placeholder="End date"
              />
            </div>
          </div>
        )}

        {/* Tag filter */}
        {tags.length > 0 && (
          <div className="filter-section">
            <label className="filter-label">Filter by Tags</label>
            <select 
              className="filter-select"
              value={filters.selectedTagIds.length === 1 ? filters.selectedTagIds[0] : ''}
              onChange={(e) => {
                const value = e.target.value;
                updateFilters({ selectedTagIds: value ? [value] : [] });
              }}
            >
              <option value="">All Tags</option>
              {tags.map(tag => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Clear filters */}
        {(filters.searchTerm || filters.selectedTagIds.length > 0 || 
          filters.dateRange.startDate || filters.dateRange.endDate) && (
          <div className="filter-section">
            <button
              type="button"
              onClick={() => updateFilters({
                searchTerm: '',
                selectedTagIds: [],
                dateRange: { startDate: '', endDate: '' }
              })}
              className="btn btn--xs btn--ghost"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to filter events based on the current filter options
export function filterEvents(
  events: Event[], 
  filters: EventFilterOptions, 
  eventTags: Map<string, Tag[]>,
  baseDate: Date
): Event[] {
  return events.filter(event => {
    // Search term filter
    if (filters.searchTerm && filters.searchTerm.trim()) {
      const searchLower = filters.searchTerm.toLowerCase();
      const nameMatch = event.name.toLowerCase().includes(searchLower);
      const descMatch = event.description?.toLowerCase().includes(searchLower) || false;
      if (!nameMatch && !descMatch) {
        return false;
      }
    }

    // Tag filter
    if (filters.selectedTagIds.length > 0) {
      const eventTagList = eventTags.get(event.id);
      // If eventTags Map is not populated yet, don't filter by tags
      if (eventTags.size === 0) {
        // Map not loaded yet, don't apply tag filter
      } else {
        const eventTagIds = eventTagList?.map(t => t.id) || [];
        const hasSelectedTag = filters.selectedTagIds.some(tagId => eventTagIds.includes(tagId));
        if (!hasSelectedTag) {
          return false;
        }
      }
    }

    // Date range filter
    if (filters.dateRange.startDate || filters.dateRange.endDate) {
      if (event.time_start == null) {
        return false; // Events without dates are excluded when date filtering is active
      }

      const timeToDate = (timeValue: number): Date => {
        const date = new Date(baseDate);
        date.setDate(date.getDate() + timeValue);
        return date;
      };

      const eventStartDate = timeToDate(event.time_start);
      const eventEndDate = event.time_end ? timeToDate(event.time_end) : eventStartDate;

      if (filters.dateRange.startDate) {
        const filterStartDate = new Date(filters.dateRange.startDate);
        if (eventEndDate < filterStartDate) {
          return false;
        }
      }

      if (filters.dateRange.endDate) {
        const filterEndDate = new Date(filters.dateRange.endDate);
        if (eventStartDate > filterEndDate) {
          return false;
        }
      }
    }

    return true;
  });
}