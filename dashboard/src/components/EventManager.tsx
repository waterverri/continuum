import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { getEvents, createEvent, updateEvent, deleteEvent } from '../api';
import type { Event } from '../api';

interface EventManagerProps {
  projectId: string;
  onClose: () => void;
  onEventSelect?: (event: Event) => void;
}

interface EventFormData {
  name: string;
  description: string;
  time_start: string;
  time_end: string;
  display_order: number;
  parent_event_id: string;
}

export function EventManager({ projectId, onClose, onEventSelect }: EventManagerProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
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

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAccessToken();
      const { events: projectEvents } = await getEvents(projectId, token, true);
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

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      time_start: '',
      time_end: '',
      display_order: 0,
      parent_event_id: ''
    });
    setEditingEvent(null);
    setIsCreating(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Event name is required');
      return;
    }

    try {
      const token = await getAccessToken();
      
      // Convert time strings to numbers (or null)
      const eventData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        time_start: formData.time_start ? parseInt(formData.time_start) : undefined,
        time_end: formData.time_end ? parseInt(formData.time_end) : undefined,
        display_order: formData.display_order,
        parent_event_id: formData.parent_event_id || undefined
      };

      if (editingEvent) {
        await updateEvent(projectId, editingEvent.id, eventData, token);
      } else {
        await createEvent(projectId, eventData, token);
      }
      
      await loadEvents();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event');
    }
  };

  const handleEdit = (event: Event) => {
    setFormData({
      name: event.name,
      description: event.description || '',
      time_start: event.time_start?.toString() || '',
      time_end: event.time_end?.toString() || '',
      display_order: event.display_order,
      parent_event_id: event.parent_event_id || ''
    });
    setEditingEvent(event);
    setIsCreating(true);
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event? This will also remove all associated document relationships.')) {
      return;
    }

    try {
      const token = await getAccessToken();
      await deleteEvent(projectId, eventId, token);
      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event');
    }
  };

  const formatTimeDisplay = (timeValue?: number) => {
    if (!timeValue) return 'Not set';
    return `Time ${timeValue}`;
  };

  const getParentEventName = (parentId?: string) => {
    if (!parentId) return null;
    const parent = events.find(e => e.id === parentId);
    return parent?.name || 'Unknown Parent';
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

  const renderEventItem = (event: Event, isChild = false) => (
    <div key={event.id} className={`event-item ${isChild ? 'child-event' : ''}`}>
      <div className="event-info">
        <div className="event-header">
          <h4 className="event-name">{event.name}</h4>
          <div className="event-actions">
            {onEventSelect && (
              <button
                type="button"
                onClick={() => onEventSelect(event)}
                className="btn-link"
              >
                Select
              </button>
            )}
            <button
              type="button"
              onClick={() => handleEdit(event)}
              className="btn-link"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => handleDelete(event.id)}
              className="btn-link danger"
            >
              Delete
            </button>
          </div>
        </div>
        
        {event.description && (
          <p className="event-description">{event.description}</p>
        )}
        
        <div className="event-details">
          <span className="detail-item">
            <strong>Start:</strong> {formatTimeDisplay(event.time_start)}
          </span>
          <span className="detail-item">
            <strong>End:</strong> {formatTimeDisplay(event.time_end)}
          </span>
          <span className="detail-item">
            <strong>Order:</strong> {event.display_order}
          </span>
          {event.parent_event_id && (
            <span className="detail-item">
              <strong>Parent:</strong> {getParentEventName(event.parent_event_id)}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  const { rootEvents, grouped } = groupEventsByParent();

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content event-manager">
          <div className="modal-header">
            <h3>Event Manager</h3>
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
      <div className="modal-content event-manager">
        <div className="modal-header">
          <h3>Event Manager</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-message">
              {error}
              <button onClick={() => setError(null)}>&times;</button>
            </div>
          )}

          <div className="event-actions">
            <button 
              className="btn btn-primary"
              onClick={() => setIsCreating(true)}
            >
              Create New Event
            </button>
          </div>

          {isCreating && (
            <form onSubmit={handleSubmit} className="event-form">
              <h4>{editingEvent ? 'Edit Event' : 'Create New Event'}</h4>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="event-name">Name *</label>
                  <input
                    id="event-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Event name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="display-order">Display Order</label>
                  <input
                    id="display-order"
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="event-description">Description</label>
                <textarea
                  id="event-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Event description (optional)"
                  rows={3}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="time-start">Start Time</label>
                  <input
                    id="time-start"
                    type="number"
                    value={formData.time_start}
                    onChange={(e) => setFormData(prev => ({ ...prev, time_start: e.target.value }))}
                    placeholder="Start time (number)"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="time-end">End Time</label>
                  <input
                    id="time-end"
                    type="number"
                    value={formData.time_end}
                    onChange={(e) => setFormData(prev => ({ ...prev, time_end: e.target.value }))}
                    placeholder="End time (number)"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="parent-event">Parent Event</label>
                <select
                  id="parent-event"
                  value={formData.parent_event_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, parent_event_id: e.target.value }))}
                >
                  <option value="">None (Root Event)</option>
                  {events
                    .filter(e => !editingEvent || e.id !== editingEvent.id) // Don't allow self-parenting
                    .map(event => (
                      <option key={event.id} value={event.id}>
                        {event.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="form-actions">
                <button type="button" onClick={resetForm} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingEvent ? 'Update Event' : 'Create Event'}
                </button>
              </div>
            </form>
          )}

          <div className="events-list">
            <h4>Events ({events.length})</h4>
            
            {events.length === 0 ? (
              <p className="empty-state">No events found. Create your first event to get started.</p>
            ) : (
              <div className="events-hierarchy">
                {rootEvents.map(event => (
                  <div key={event.id} className="event-group">
                    {renderEventItem(event)}
                    {grouped[event.id] && (
                      <div className="child-events">
                        {grouped[event.id].map(childEvent => 
                          renderEventItem(childEvent, true)
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}