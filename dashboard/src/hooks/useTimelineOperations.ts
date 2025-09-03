import { useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { getEventTimeline, getEvent, updateEvent, deleteEvent, getEventTags, createEvent } from '../api';
import { getProject, updateProjectBaseDate } from '../accessors/projectAccessor';
import type { Event, Document, EventDocument, Tag } from '../api';
import type { EventFormData } from '../types/timeline';
import { 
  datetimeInputToProjectDays, 
  projectDaysToDatetimeInput, 
  formatProjectDateTime,
  projectDaysToDate 
} from '../utils/datetime';

export interface UseTimelineOperationsProps {
  projectId: string;
  baseDate: Date;
  setEvents: (events: Event[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setEventTags: (tags: Map<string, Tag[]>) => void;
  setEventDocuments: (docs: (EventDocument & {documents: Document})[]) => void;
  setSelectedEvent: (event: Event | null) => void;
  setEditingEvent: (event: Event | null) => void;
  setShowEventDetails: (show: boolean) => void;
  setIsCreatingEvent: (creating: boolean) => void;
  setBaseDate: (date: Date) => void;
  setFormData: (data: EventFormData | ((prev: EventFormData) => EventFormData)) => void;
  resetForm: () => void;
  onEventsChange?: () => void;
}

export interface UseTimelineOperationsResult {
  // API operations
  loadTimeline: () => Promise<void>;
  loadEventDetails: (event: Event) => Promise<void>;
  loadProjectBaseDate: () => Promise<void>;
  
  // Event operations
  handleCreateEvent: (formData: EventFormData) => Promise<void>;
  handleEditEvent: (eventId: string, formData: EventFormData) => Promise<void>;
  handleDeleteEvent: (eventId: string) => Promise<void>;
  startEditEvent: (event: Event) => void;
  
  // Base date operations
  handleBaseDateChange: (newDate: Date) => Promise<void>;
  
  // Date utilities
  timeToDate: (timeValue: number) => Date;
  dateToTime: (date: Date) => number;
  formatDateDisplay: (timeValue?: number) => string;
  
  // Token management
  getAccessToken: () => Promise<string>;
}

export function useTimelineOperations({
  projectId,
  baseDate,
  setEvents,
  setLoading,
  setError,
  setEventTags,
  setEventDocuments,
  setSelectedEvent,
  setEditingEvent,
  setShowEventDetails,
  setIsCreatingEvent,
  setBaseDate,
  setFormData,
  resetForm,
  onEventsChange
}: UseTimelineOperationsProps): UseTimelineOperationsResult {
  
  const getAccessToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  }, []);

  // Date conversion utilities
  const timeToDate = useCallback((timeValue: number): Date => {
    return projectDaysToDate(timeValue, baseDate);
  }, [baseDate]);

  const formatDateDisplay = useCallback((timeValue?: number): string => {
    if (timeValue === null || timeValue === undefined) return 'Not set';
    return formatProjectDateTime(timeValue, baseDate);
  }, [baseDate]);

  const dateToTime = useCallback((date: Date): number => {
    return datetimeInputToProjectDays(date.toISOString(), baseDate);
  }, [baseDate]);

  const loadEventTags = useCallback(async (eventList: Event[]) => {
    try {
      const token = await getAccessToken();
      const tagMap = new Map<string, Tag[]>();
      
      await Promise.all(eventList.map(async (event) => {
        try {
          const tags = await getEventTags(projectId, event.id, token);
          tagMap.set(event.id, tags);
        } catch (err) {
          console.warn(`Failed to load tags for event ${event.id}:`, err);
          tagMap.set(event.id, []);
        }
      }));
      
      setEventTags(tagMap);
    } catch (err) {
      console.error('Failed to load event tags:', err);
    }
  }, [projectId, getAccessToken, setEventTags]);

  const loadTimeline = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAccessToken();
      const { events: timelineEvents } = await getEventTimeline(projectId, token);
      setEvents(timelineEvents);
      
      // Load tags for all events
      if (timelineEvents.length > 0) {
        await loadEventTags(timelineEvents);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  }, [projectId, getAccessToken, setLoading, setError, setEvents, loadEventTags]);

  const loadEventDetails = useCallback(async (event: Event) => {
    try {
      const token = await getAccessToken();
      const eventDetails = await getEvent(projectId, event.id, token);
      setEventDocuments(eventDetails.documents as (EventDocument & {documents: Document})[] || []);
      setSelectedEvent(event);
      setShowEventDetails(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event details');
    }
  }, [projectId, getAccessToken, setEventDocuments, setSelectedEvent, setShowEventDetails, setError]);

  const loadProjectBaseDate = useCallback(async () => {
    try {
      const project = await getProject(projectId);
      if (project.base_date) {
        setBaseDate(new Date(project.base_date));
      }
    } catch (err) {
      console.error('Failed to load project base date:', err);
      // Continue with default date if loading fails
    }
  }, [projectId, setBaseDate]);

  const handleCreateEvent = useCallback(async (formData: EventFormData) => {
    if (!formData.name.trim()) {
      setError('Event name is required');
      return;
    }

    try {
      setLoading(true);
      const token = await getAccessToken();
      
      const timeStartConverted = formData.time_start ? datetimeInputToProjectDays(formData.time_start, baseDate) : undefined;
      const timeEndConverted = formData.time_end ? datetimeInputToProjectDays(formData.time_end, baseDate) : undefined;
      
      const eventData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        time_start: timeStartConverted,
        time_end: timeEndConverted,
        display_order: formData.display_order,
        parent_event_id: formData.parent_event_id || undefined
      };

      await createEvent(projectId, eventData, token);
      await loadTimeline();
      onEventsChange?.();
      
      // Reset form and close modal
      setIsCreatingEvent(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setLoading(false);
    }
  }, [projectId, dateToTime, getAccessToken, setLoading, setError, loadTimeline, onEventsChange, setIsCreatingEvent, resetForm]);

  const handleEditEvent = useCallback(async (eventId: string, formData: EventFormData) => {
    try {
      const token = await getAccessToken();
      const eventData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        time_start: (formData.time_start && formData.time_start.trim()) ? datetimeInputToProjectDays(formData.time_start, baseDate) : undefined,
        time_end: (formData.time_end && formData.time_end.trim()) ? datetimeInputToProjectDays(formData.time_end, baseDate) : undefined,
        display_order: formData.display_order,
        parent_event_id: formData.parent_event_id || undefined
      };

      await updateEvent(projectId, eventId, eventData, token);
      await loadTimeline();
      setEditingEvent(null);
      setShowEventDetails(false);
      onEventsChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update event');
    }
  }, [projectId, dateToTime, getAccessToken, loadTimeline, setEditingEvent, setShowEventDetails, onEventsChange, setError]);

  const handleDeleteEvent = useCallback(async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event? This will also remove all associated document relationships.')) {
      return;
    }

    try {
      const token = await getAccessToken();
      await deleteEvent(projectId, eventId, token);
      await loadTimeline();
      
      // Close details modal if this event was selected  
      setSelectedEvent(null);
      setShowEventDetails(false);
      
      onEventsChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event');
    }
  }, [projectId, getAccessToken, loadTimeline, setSelectedEvent, setShowEventDetails, onEventsChange, setError]);

  const startEditEvent = useCallback((event: Event) => {
    const formDataToSet = {
      name: event.name,
      description: event.description || '',
      time_start: event.time_start !== null && event.time_start !== undefined ? projectDaysToDatetimeInput(event.time_start, baseDate) : '',
      time_end: event.time_end !== null && event.time_end !== undefined ? projectDaysToDatetimeInput(event.time_end, baseDate) : '',
      display_order: event.display_order,
      parent_event_id: event.parent_event_id || ''
    };
    
    setFormData(formDataToSet);
    setEditingEvent(event);
    setSelectedEvent(event); // Ensure the event is selected
    setShowEventDetails(true); // Ensure the modal is open
  }, [baseDate, setFormData, setEditingEvent, setSelectedEvent, setShowEventDetails]);

  const handleBaseDateChange = useCallback(async (newDate: Date) => {
    try {
      const dateString = newDate.toISOString().split('T')[0];
      await updateProjectBaseDate(projectId, dateString);
      setBaseDate(newDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update base date');
    }
  }, [projectId, setBaseDate, setError]);

  return {
    // API operations
    loadTimeline,
    loadEventDetails,
    loadProjectBaseDate,
    
    // Event operations
    handleCreateEvent,
    handleEditEvent,
    handleDeleteEvent,
    startEditEvent,
    
    // Base date operations
    handleBaseDateChange,
    
    // Date utilities
    timeToDate,
    dateToTime,
    formatDateDisplay,
    
    // Token management
    getAccessToken
  };
}