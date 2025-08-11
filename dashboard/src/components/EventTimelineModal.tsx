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
  onCloseAllModals?: () => void;
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

export function EventTimelineModal({ projectId, onClose, onDocumentView, onDocumentEdit, onDocumentDelete, onCloseAllModals }: EventTimelineModalProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'gantt' | 'list'>('gantt');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, panOffset: 0 });
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [touchState, setTouchState] = useState({
    isTouching: false,
    isPointerDown: false,
    initialDistance: 0,
    initialZoom: 1,
    initialPan: 0,
    touchStartTime: 0,
    singleTouchStart: { x: 0, y: 0 },
    lastTapTime: 0,
    lastTapPosition: { x: 0, y: 0 }
  });
  const [createEventPosition, setCreateEventPosition] = useState({ timeStart: 0, timeEnd: 0 });
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set());
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
    if (isCreatingEvent) return; // Don't pan when creating events
    setIsDragging(true);
    setDragStart({ x: e.clientX, panOffset });
    e.preventDefault();
  }, [panOffset, isCreatingEvent]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || isCreatingEvent) return;
    
    const deltaX = e.clientX - dragStart.x;
    const panSensitivity = 1 / zoomLevel; // More sensitive when zoomed in
    const newPanOffset = dragStart.panOffset - (deltaX * panSensitivity);
    
    // Constrain pan to reasonable bounds
    const maxPan = Math.max(0, (zoomLevel - 1) * 50);
    const constrainedPan = Math.max(-maxPan, Math.min(maxPan, newPanOffset));
    
    setPanOffset(constrainedPan);
  }, [isDragging, dragStart, zoomLevel, isCreatingEvent]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Enhanced wheel/trackpad functionality
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Handle pinch-to-zoom on trackpads (deltaY with ctrlKey)
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      
      // Adjust sensitivity based on device - Mac trackpads send different delta values
      const isMacLike = navigator.platform.includes('Mac');
      const zoomSensitivity = isMacLike ? 0.01 : 0.001;
      const deltaZoom = -e.deltaY * zoomSensitivity;
      
      setZoomLevel(prev => {
        const newZoom = Math.max(0.1, prev + deltaZoom);
        // Reset pan when zooming out significantly
        if (newZoom <= 1 && prev > 1) {
          setPanOffset(0);
        }
        return newZoom;
      });
    } 
    // Handle horizontal scrolling for panning (common on trackpads)
    else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      
      // Adjust pan sensitivity based on zoom level and device
      const isMacLike = navigator.platform.includes('Mac');
      const baseSensitivity = isMacLike ? 0.5 : 1;
      const panSensitivity = baseSensitivity / Math.max(zoomLevel, 0.25);
      const deltaPan = e.deltaX * panSensitivity;
      
      setPanOffset(prev => {
        const maxPan = Math.max(0, (zoomLevel - 1) * 50);
        return Math.max(-maxPan, Math.min(maxPan, prev - deltaPan));
      });
    }
    // Handle vertical scrolling for zooming when shift is held (alternative zoom method)
    else if (e.shiftKey && Math.abs(e.deltaY) > 0) {
      e.preventDefault();
      
      const zoomSensitivity = 0.002;
      const deltaZoom = -e.deltaY * zoomSensitivity;
      
      setZoomLevel(prev => {
        const newZoom = Math.max(0.1, prev + deltaZoom);
        if (newZoom <= 1 && prev > 1) {
          setPanOffset(0);
        }
        return newZoom;
      });
    }
  }, [zoomLevel]);


  // Enhanced zoom functionality
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(5, prev + 0.5));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => {
      const newZoom = Math.max(0.1, prev - 0.5);
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
    
    // Reset zoom first
    setZoomLevel(1);
    setPanOffset(0);
    
    // Focus on the data range rather than the full padded range
    setTimeout(() => {
      const startTimes = eventsWithTime.map(e => e.time_start!);
      const endTimes = eventsWithTime.map(e => e.time_end || e.time_start!);
      const dataMinTime = Math.min(...startTimes);
      const dataMaxTime = Math.max(...endTimes);
      
      // Calculate center offset to focus on data range
      const dataCenterTime = (dataMinTime + dataMaxTime) / 2;
      const timelineCenterTime = (timelineData.minTime + timelineData.maxTime) / 2;
      const offsetRatio = (timelineCenterTime - dataCenterTime) / timelineData.timeRange;
      const pixelOffset = offsetRatio * window.innerWidth * 0.5; // Approximate timeline width
      
      setPanOffset(pixelOffset);
    }, 50); // Small delay to let zoom reset first
  };


  const handleCreateEventSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Event name is required');
      return;
    }

    try {
      setLoading(true);
      const token = await getAccessToken();
      
      const eventData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        time_start: formData.time_start ? parseInt(formData.time_start) : undefined,
        time_end: formData.time_end ? parseInt(formData.time_end) : undefined,
        display_order: formData.display_order,
        parent_event_id: formData.parent_event_id || undefined
      };

      const { createEvent } = await import('../api');
      await createEvent(projectId, eventData, token);
      await loadTimeline();
      
      // Reset form
      setIsCreatingEvent(false);
      setFormData({
        name: '',
        description: '',
        time_start: '',
        time_end: '',
        display_order: 0,
        parent_event_id: ''
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  const cancelCreateEvent = () => {
    setIsCreatingEvent(false);
    setFormData({
      name: '',
      description: '',
      time_start: '',
      time_end: '',
      display_order: 0,
      parent_event_id: ''
    });
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
    
    const dataMinTime = Math.min(...startTimes);
    const dataMaxTime = Math.max(...endTimes);
    const dataRange = Math.max(dataMaxTime - dataMinTime, 10);
    
    // Add padding (25% on each side) to allow creating events outside the existing range
    const padding = Math.max(dataRange * 0.25, 20); // At least 20 time units padding
    const minTime = dataMinTime - padding;
    const maxTime = dataMaxTime + padding;
    const timeRange = maxTime - minTime;

    return {
      events,
      minTime,
      maxTime,
      timeRange
    };
  }, [events]);

  // Click-to-create event functionality
  const calculateTimeFromMousePosition = useCallback((e: React.MouseEvent, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const elementWidth = rect.width;
    
    // Account for zoom and pan transformations
    const adjustedX = (relativeX / zoomLevel) - (panOffset / zoomLevel);
    const percentageX = Math.max(0, Math.min(100, (adjustedX / (elementWidth / zoomLevel)) * 100));
    
    // Convert percentage to time value
    const timeValue = timelineData.minTime + (percentageX / 100) * timelineData.timeRange;
    return Math.max(timelineData.minTime, Math.min(timelineData.maxTime, Math.round(timeValue)));
  }, [zoomLevel, panOffset, timelineData]);

  const handleTimelineDoubleClick = useCallback((e: React.MouseEvent) => {
    if (isDragging) return;
    
    const timelineElement = e.currentTarget as HTMLElement;
    const clickTime = calculateTimeFromMousePosition(e, timelineElement);
    
    // Create event with 5-unit duration by default
    const startTime = clickTime;
    const endTime = clickTime + 5;
    
    setCreateEventPosition({ timeStart: startTime, timeEnd: endTime });
    setFormData({
      name: '',
      description: '',
      time_start: startTime.toString(),
      time_end: endTime.toString(),
      display_order: 0,
      parent_event_id: ''
    });
    setIsCreatingEvent(true);
    e.preventDefault();
    e.stopPropagation();
  }, [isDragging, calculateTimeFromMousePosition]);

  // Touch event handlers for mobile support
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const touch1 = touches[0];
    const touch2 = touches[1];
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const currentTime = Date.now();
    
    if (e.touches.length === 1) {
      // Single touch - potential pan or create event
      setTouchState(prev => ({
        ...prev,
        isTouching: true,
        touchStartTime: currentTime,
        singleTouchStart: {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY
        }
      }));
    } else if (e.touches.length === 2) {
      // Two finger touch - pinch to zoom
      e.preventDefault();
      const distance = getTouchDistance(e.touches);
      setTouchState(prev => ({
        ...prev,
        isTouching: true,
        initialDistance: distance,
        initialZoom: zoomLevel,
        initialPan: panOffset
      }));
    }
  }, [zoomLevel, panOffset]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchState.isTouching) return;

    if (e.touches.length === 2) {
      // Two finger pinch/zoom
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches);
      const scale = currentDistance / touchState.initialDistance;
      const newZoom = Math.max(0.1, touchState.initialZoom * scale);
      
      setZoomLevel(newZoom);
      
      // Reset pan when zooming out significantly
      if (newZoom <= 1 && touchState.initialZoom > 1) {
        setPanOffset(0);
      }
    } else if (e.touches.length === 1 && !isCreatingEvent) {
      // Single finger pan
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchState.singleTouchStart.x;
      
      // Only start panning if moved more than a threshold (to distinguish from taps)
      if (Math.abs(deltaX) > 10) {
        const panSensitivity = 1 / zoomLevel;
        const deltaPan = -deltaX * panSensitivity;
        const maxPan = Math.max(0, (zoomLevel - 1) * 50);
        const newPan = Math.max(-maxPan, Math.min(maxPan, touchState.initialPan + deltaPan));
        
        setPanOffset(newPan);
      }
    }
  }, [touchState, isCreatingEvent, zoomLevel]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const currentTime = Date.now();
    const touchDuration = currentTime - touchState.touchStartTime;
    const wasQuickTap = touchDuration < 300;
    const wasPan = Math.abs(e.changedTouches[0]?.clientX - touchState.singleTouchStart.x) > 10;
    
    // Handle double-tap to create event (if no remaining touches and wasn't a pan)
    if (e.touches.length === 0 && wasQuickTap && !wasPan && !isCreatingEvent) {
      const tapInterval = currentTime - touchState.lastTapTime;
      const tapDistance = Math.sqrt(
        Math.pow(e.changedTouches[0]?.clientX - touchState.lastTapPosition.x, 2) +
        Math.pow(e.changedTouches[0]?.clientY - touchState.lastTapPosition.y, 2)
      );
      
      // Double-tap detected (within 500ms and 50px)
      if (tapInterval < 500 && tapDistance < 50) {
        const timelineElement = e.currentTarget as HTMLElement;
        const touch = e.changedTouches[0];
        const fakeMouseEvent = {
          clientX: touch.clientX,
          currentTarget: timelineElement,
          preventDefault: () => {},
          stopPropagation: () => {}
        } as any;
        
        handleTimelineDoubleClick(fakeMouseEvent);
        
        // Reset double-tap tracking
        setTouchState(prev => ({
          ...prev,
          lastTapTime: 0,
          lastTapPosition: { x: 0, y: 0 }
        }));
      } else {
        // First tap - remember for potential double-tap
        setTouchState(prev => ({
          ...prev,
          lastTapTime: currentTime,
          lastTapPosition: {
            x: e.changedTouches[0]?.clientX || 0,
            y: e.changedTouches[0]?.clientY || 0
          }
        }));
      }
    }
    
    setTouchState(prev => ({
      ...prev,
      isTouching: false,
      isPointerDown: false,
      initialDistance: 0,
      initialZoom: 1,
      initialPan: 0,
      touchStartTime: 0,
      singleTouchStart: { x: 0, y: 0 }
    }));
  }, [touchState, isCreatingEvent, handleTimelineDoubleClick]);

  // Collapse/expand functionality
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
              cursor: isDragging ? 'grabbing' : (isCreatingEvent ? 'crosshair' : 'grab'),
              touchAction: 'none' // Prevent default touch scrolling
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleTimelineDoubleClick}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            title="Double-click/tap to create event. Pinch to zoom, drag to pan"
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
              {eventsByParent.has(event.id) && !isParentCollapsed(event.id) && (
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
    const eventsByParent = getEventsByParent();
    const hasChildren = eventsByParent.has(event.id);
    const isCollapsed = isParentCollapsed(event.id);

    return (
      <div key={event.id} className={`gantt-row ${isChild ? 'child-row' : ''} level-${level}`}>
        <div className="gantt-event-label">
          <div className="event-label-content">
            <div className="event-label-header">
              <div className="event-name-group">
                {hasChildren && (
                  <button
                    className="collapse-btn"
                    onClick={() => toggleParentCollapse(event.id)}
                    title={isCollapsed ? 'Expand child events' : 'Collapse child events'}
                  >
                    {isCollapsed ? '▶' : '▼'}
                  </button>
                )}
                <span className="event-name">{event.name}</span>
                {hasChildren && (
                  <span className="child-count">
                    ({eventsByParent.get(event.id)!.length})
                  </span>
                )}
              </div>
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
            cursor: isDragging ? 'grabbing' : (isCreatingEvent ? 'crosshair' : 'grab'),
            touchAction: 'none' // Prevent default touch scrolling
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleTimelineDoubleClick}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          title="Double-click/tap to create event. Pinch to zoom, drag to pan"
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
                  <label title="Current pan position. Drag timeline to pan, pinch to zoom, or double-tap to create events">
                    {panOffset === 0 ? 'Centered' : `Pan: ${panOffset > 0 ? '+' : ''}${panOffset.toFixed(0)}px`}
                  </label>
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
                                  onClick={() => {
                                    onCloseAllModals?.();
                                    onDocumentView?.(docAssoc.documents);
                                  }}
                                  title="View document"
                                >
                                  👁️
                                </button>
                                <button
                                  className="document-action-btn edit"
                                  onClick={() => {
                                    onCloseAllModals?.();
                                    onDocumentEdit?.(docAssoc.documents);
                                  }}
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

        {/* Create Event Modal */}
        {isCreatingEvent && (
          <div className="event-details-overlay">
            <div className="event-details-modal">
              <div className="event-details-header">
                <h3>Create Event at T{createEventPosition.timeStart}</h3>
                <button 
                  className="modal-close"
                  onClick={cancelCreateEvent}
                >
                  &times;
                </button>
              </div>
              
              <div className="event-details-body">
                <div className="event-edit-form">
                  <div className="form-group">
                    <label>Event Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter event name"
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      placeholder="Optional description"
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
                  {events.length > 0 && (
                    <div className="form-group">
                      <label>Parent Event</label>
                      <select
                        value={formData.parent_event_id}
                        onChange={(e) => setFormData(prev => ({ ...prev, parent_event_id: e.target.value }))}
                      >
                        <option value="">No parent event</option>
                        {events.map(event => (
                          <option key={event.id} value={event.id}>
                            {event.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="form-actions">
                    <button 
                      className="btn btn-secondary"
                      onClick={cancelCreateEvent}
                    >
                      Cancel
                    </button>
                    <button 
                      className="btn btn-primary"
                      onClick={handleCreateEventSubmit}
                      disabled={loading}
                    >
                      {loading ? 'Creating...' : 'Create Event'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}