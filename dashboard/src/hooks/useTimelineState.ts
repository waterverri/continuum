import { useState, useMemo } from 'react';
import type { EventFilterOptions } from '../components/EventFilters';
import { filterEvents } from '../components/EventFilters';
import type { TimelineData, EventFormData, CreateEventPosition } from '../types/timeline';
import type { Event, EventDocument, Document, Tag } from '../api';



export interface UseTimelineStateResult {
  // Core data
  events: Event[];
  setEvents: (events: Event[]) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  
  // UI state
  viewMode: 'gantt' | 'list';
  setViewMode: (mode: 'gantt' | 'list') => void;
  
  // Event interaction state
  selectedEvent: Event | null;
  setSelectedEvent: (event: Event | null) => void;
  editingEvent: Event | null;
  setEditingEvent: (event: Event | null) => void;
  showEventDetails: boolean;
  setShowEventDetails: (show: boolean) => void;
  eventDocuments: (EventDocument & {documents: Document})[];
  setEventDocuments: (docs: (EventDocument & {documents: Document})[]) => void;
  
  // Event creation state
  isCreatingEvent: boolean;
  setIsCreatingEvent: (creating: boolean) => void;
  createEventPosition: CreateEventPosition;
  setCreateEventPosition: (position: CreateEventPosition) => void;
  formData: EventFormData;
  setFormData: (data: EventFormData | ((prev: EventFormData) => EventFormData)) => void;
  
  // Base date and modals
  baseDate: Date;
  setBaseDate: (date: Date) => void;
  showBaseDateModal: boolean;
  setShowBaseDateModal: (show: boolean) => void;
  
  // Filtering and tags
  eventTags: Map<string, Tag[]>;
  setEventTags: (tags: Map<string, Tag[]>) => void;
  filters: EventFilterOptions;
  setFilters: (filters: EventFilterOptions) => void;
  
  // Hierarchical state
  collapsedParents: Set<string>;
  setCollapsedParents: (parents: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  
  // Computed data
  filteredEvents: Event[];
  timelineData: TimelineData;
  
  // Helper functions
  resetForm: () => void;
  toggleParentCollapse: (parentEventId: string) => void;
  isParentCollapsed: (parentEventId: string) => boolean;
}

const initialFormData: EventFormData = {
  name: '',
  description: '',
  time_start: '',
  time_end: '',
  display_order: 0,
  parent_event_id: ''
};


export function useTimelineState(): UseTimelineStateResult {
  // Core data state
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI state
  const [viewMode, setViewMode] = useState<'gantt' | 'list'>('gantt');
  
  // Event interaction state
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [eventDocuments, setEventDocuments] = useState<(EventDocument & {documents: Document})[]>([]);
  
  // Event creation state
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [createEventPosition, setCreateEventPosition] = useState<CreateEventPosition>({ timeStart: 0, timeEnd: 0 });
  const [formData, setFormData] = useState<EventFormData>(initialFormData);
  
  // Base date and modals
  const [baseDate, setBaseDate] = useState(new Date());
  const [showBaseDateModal, setShowBaseDateModal] = useState(false);
  
  // Filtering and tags
  const [eventTags, setEventTags] = useState<Map<string, Tag[]>>(new Map());
  const [filters, setFilters] = useState<EventFilterOptions>({
    searchTerm: '',
    selectedTagIds: [],
    dateRange: { startDate: '', endDate: '' }
  });
  
  // Hierarchical state
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set());
  
  // Computed filtered events
  const filteredEvents = useMemo(() => {
    // Only apply tag filters if we have tag data loaded or no tag filter is applied
    const hasTagFilter = filters.selectedTagIds.length > 0;
    const hasTagData = eventTags.size > 0;
    
    // If we're trying to filter by tags but don't have tag data yet, return all events
    if (hasTagFilter && !hasTagData && events.length > 0) {
      return events;
    }
    
    return filterEvents(events, filters, eventTags, baseDate);
  }, [events, filters, eventTags, baseDate]);
  
  // Computed timeline data
  const timelineData: TimelineData = useMemo(() => {
    const eventsWithTime = filteredEvents.filter(e => e.time_start != null);
    
    if (eventsWithTime.length === 0) {
      return {
        events: filteredEvents,
        minTime: 0,
        maxTime: 100,
        timeRange: 100
      };
    }

    const startTimes = eventsWithTime.map(e => e.time_start!);
    const endTimes = eventsWithTime.map(e => e.time_end || e.time_start!);
    
    const dataMinTime = Math.min(...startTimes);
    const dataMaxTime = Math.max(...endTimes);
    const dataRange = Math.max(dataMaxTime - dataMinTime, 10);
    
    // Add padding (25% on each side) to allow creating events outside the existing range
    const padding = Math.max(dataRange * 0.25, 20); // At least 20 time units padding
    const minTime = dataMinTime - padding;
    const maxTime = dataMaxTime + padding;
    const timeRange = maxTime - minTime;

    return {
      events: filteredEvents,
      minTime,
      maxTime,
      timeRange
    };
  }, [filteredEvents]);
  
  // Helper functions
  const resetForm = () => {
    setFormData(initialFormData);
  };
  
  const toggleParentCollapse = (parentEventId: string) => {
    setCollapsedParents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(parentEventId)) {
        newSet.delete(parentEventId);
      } else {
        newSet.add(parentEventId);
      }
      return newSet;
    });
  };
  
  const isParentCollapsed = (parentEventId: string) => {
    return collapsedParents.has(parentEventId);
  };
  
  return {
    // Core data
    events,
    setEvents,
    loading,
    setLoading,
    error,
    setError,
    
    // UI state
    viewMode,
    setViewMode,
    
    // Event interaction state
    selectedEvent,
    setSelectedEvent,
    editingEvent,
    setEditingEvent,
    showEventDetails,
    setShowEventDetails,
    eventDocuments,
    setEventDocuments,
    
    // Event creation state
    isCreatingEvent,
    setIsCreatingEvent,
    createEventPosition,
    setCreateEventPosition,
    formData,
    setFormData,
    
    // Base date and modals
    baseDate,
    setBaseDate,
    showBaseDateModal,
    setShowBaseDateModal,
    
    // Filtering and tags
    eventTags,
    setEventTags,
    filters,
    setFilters,
    
    // Hierarchical state
    collapsedParents,
    setCollapsedParents,
    
    // Computed data
    filteredEvents,
    timelineData,
    
    // Helper functions
    resetForm,
    toggleParentCollapse,
    isParentCollapsed
  };
}