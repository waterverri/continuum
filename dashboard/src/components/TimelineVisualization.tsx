import React from 'react';
import type { Event } from '../api';
import type { Viewport } from '../hooks/useTimelineViewport';

export interface TimelineVisualizationProps {
  events: Event[];
  viewport: Viewport;
  isDragging: boolean;
  panOffset: number;
  isCreatingEvent: boolean;
  collapsedParents: Set<string>;
  formatDateDisplay: (timeValue?: number) => string;
  getEventPosition: (event: Event) => { left: number; width: number; visible: boolean };
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onWheel: (e: React.WheelEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onEventClick: (event: Event) => void;
  onEventEdit: (event: Event) => void;
  onEventDelete: (eventId: string) => void;
  onParentToggle: (parentEventId: string) => void;
}

export function TimelineVisualization({
  events,
  viewport,
  isDragging,
  panOffset,
  isCreatingEvent,
  collapsedParents,
  formatDateDisplay,
  getEventPosition,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onDoubleClick,
  onWheel,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onEventClick,
  onEventEdit,
  onEventDelete,
  onParentToggle
}: TimelineVisualizationProps) {
  
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

  const getEventDuration = (event: Event) => {
    if (!event.time_start || !event.time_end) return null;
    return event.time_end - event.time_start;
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

  const isParentCollapsed = (parentEventId: string) => {
    return collapsedParents.has(parentEventId);
  };

  const renderTimelineRuler = () => {
    const viewportRange = viewport.maxTime - viewport.minTime;
    
    // Formulaic tick interval calculation
    // Target: ~10-20 ticks visible at any zoom level for optimal readability
    const targetTickCount = 15;
    const rawInterval = viewportRange / targetTickCount;
    
    // Round to nice intervals using powers of 10 and common factors (1, 2, 5)
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)));
    const normalized = rawInterval / magnitude; // Now between 1 and 10
    
    let niceInterval;
    if (normalized <= 1) niceInterval = 1;
    else if (normalized <= 2) niceInterval = 2;
    else if (normalized <= 5) niceInterval = 5;
    else niceInterval = 10;
    
    const tickInterval = niceInterval * magnitude;
    
    const startTick = Math.floor(viewport.minTime / tickInterval) * tickInterval;
    const endTick = Math.ceil(viewport.maxTime / tickInterval) * tickInterval;
    const ticks = [];
    
    for (let timeValue = startTick; timeValue <= endTick; timeValue += tickInterval) {
      const position = ((timeValue - viewport.minTime) / viewportRange) * 100;
      const transformOffset = isDragging ? (panOffset / 10) : 0;
      const finalPosition = position + transformOffset;
      
      // Only show ticks that are visible
      if (finalPosition > -10 && finalPosition < 110) {
        ticks.push(
          <div key={timeValue} className="ruler-tick" style={{ left: `${finalPosition}%` }}>
            <span className="ruler-label">{formatDateDisplay(timeValue)}</span>
          </div>
        );
      }
    }
    
    return ticks;
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
                    onClick={() => onParentToggle(event.id)}
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
                  onClick={() => onEventClick(event)}
                  title="View details"
                >
                  ℹ️
                </button>
                <button 
                  className="event-action-btn edit"
                  onClick={() => onEventEdit(event)}
                  title="Edit event"
                >
                  ✎
                </button>
                <button 
                  className="event-action-btn delete"
                  onClick={() => onEventDelete(event.id)}
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
                  {formatDateDisplay(event.time_start)}
                  {event.time_end && ` - ${formatDateDisplay(event.time_end)}`}
                </span>
              )}
              {duration && duration > 0 && (
                <span className="event-duration">({duration} days)</span>
              )}
            </div>
          </div>
        </div>
        
        <div 
          className="gantt-timeline" 
          style={{ 
            transform: isDragging ? `translateX(${panOffset}px)` : 'none',
            cursor: isDragging ? 'grabbing' : (isCreatingEvent ? 'crosshair' : 'grab'),
            touchAction: 'none' // Prevent default touch scrolling
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onDoubleClick={onDoubleClick}
          onWheel={onWheel}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
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
              onClick={() => onEventClick(event)}
              title={`${event.name}: ${formatDateDisplay(event.time_start)}${event.time_end ? ` - ${formatDateDisplay(event.time_end)}` : ''}`}
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
              transform: isDragging ? `translateX(${panOffset}px)` : 'none',
              cursor: isDragging ? 'grabbing' : (isCreatingEvent ? 'crosshair' : 'grab'),
              touchAction: 'none' // Prevent default touch scrolling
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onDoubleClick={onDoubleClick}
            onWheel={onWheel}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            title="Double-click/tap to create event. Pinch to zoom, drag to pan"
          >
            <div className="timeline-ruler">
              {renderTimelineRuler()}
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

  return renderGanttView();
}