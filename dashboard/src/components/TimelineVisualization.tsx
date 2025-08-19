import React, { useRef, useLayoutEffect, useState, useMemo } from 'react';
import type { Event } from '../api';
import type { Viewport } from '../hooks/useTimelineViewport';
import { useTimelineCollapse } from '../hooks/useTimelineCollapse';
import { TimelineCalculator, type TimeSegment as CalculatorTimeSegment } from '../utils/timelineCalculator';

export interface TimelineVisualizationProps {
  events: Event[];
  viewport: Viewport;
  isDragging: boolean;
  viewportStartTime: number; // actual start time, not percentage
  zoomLevel: number;
  isCreatingEvent: boolean;
  collapsedParents: Set<string>;
  formatDateDisplay: (timeValue?: number) => string;
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
  viewportStartTime,
  zoomLevel,
  isCreatingEvent,
  collapsedParents,
  formatDateDisplay,
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
  
  // Timeline container ref for getting actual width
  const timelineRef = useRef<HTMLDivElement>(null);
  const [timelineWidth, setTimelineWidth] = useState(1000); // fallback width
  
  // Update timeline width when component mounts or resizes
  useLayoutEffect(() => {
    const updateWidth = () => {
      if (timelineRef.current) {
        const width = timelineRef.current.getBoundingClientRect().width;
        if (width > 0) {
          setTimelineWidth(width);
        }
      }
    };
    
    updateWidth();
    
    // Listen for resize events
    const resizeObserver = new ResizeObserver(updateWidth);
    if (timelineRef.current) {
      resizeObserver.observe(timelineRef.current);
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  }, []);
  
  // Create calculator without collapse adjustment first (bootstrap)
  const baseCalculator = useMemo(() => {
    return new TimelineCalculator(
      viewportStartTime,
      zoomLevel,
      timelineWidth,
      (time) => time, // no collapse adjustment yet
      formatDateDisplay
    );
  }, [viewportStartTime, zoomLevel, timelineWidth, formatDateDisplay]);

  // Initialize timeline collapse functionality with the calculator
  const {
    timeSegments,
    toggleSegmentCollapse,
    getAdjustedPosition
  } = useTimelineCollapse({ events, viewport, calculator: baseCalculator });

  // Create final calculator with collapse adjustments
  const calculator = useMemo(() => {
    return new TimelineCalculator(
      viewportStartTime,
      zoomLevel,
      timelineWidth,
      getAdjustedPosition,
      formatDateDisplay
    );
  }, [viewportStartTime, zoomLevel, timelineWidth, getAdjustedPosition, formatDateDisplay]);

  // Convert timeSegments to calculator format
  const calculatorTimeSegments: CalculatorTimeSegment[] = useMemo(() => {
    return timeSegments.map(segment => ({
      type: segment.type === 'collapsed' ? 'collapsed' : 
            segment.type === 'gap' ? 'expandable' : 'normal',
      collapsedSegment: segment.collapsedSegment
    }));
  }, [timeSegments]);

  // Calculate all timeline elements using the centralized calculator
  const timelineElements = useMemo(() => {
    return calculator.calculateAllElements(events, calculatorTimeSegments);
  }, [calculator, events, calculatorTimeSegments]);

  // Helper functions
  
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

  const formatEventDuration = (duration: number) => {
    if (duration < 1) {
      // Less than 1 day - show hours and minutes
      const hours = Math.floor(duration * 24);
      const minutes = Math.floor((duration * 24 * 60) % 60);
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      } else {
        return `${minutes}m`;
      }
    } else if (duration < 30) {
      // Less than 1 month (30 days) - show days with one decimal
      return `${duration.toFixed(1)} days`;
    } else if (duration < 365) {
      // Less than 1 year - show months and days (no decimals)
      const months = Math.floor(duration / 30);
      const days = Math.floor(duration % 30);
      if (days > 0) {
        return `${months}mo ${days}d`;
      } else {
        return `${months}mo`;
      }
    } else {
      // 1 year or more - show years and months
      const years = Math.floor(duration / 365);
      const months = Math.floor((duration % 365) / 30);
      if (months > 0) {
        return `${years}yr ${months}mo`;
      } else {
        return `${years}yr`;
      }
    }
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
    const ticks: React.ReactElement[] = [];
    
    // Render regular ticks using centralized calculator
    timelineElements.ticks.forEach(tick => {
      ticks.push(
        <div 
          key={tick.timeValue} 
          className="ruler-tick" 
          style={{ left: `${tick.position.left}%` }}
        >
          <span className="ruler-label">
            {tick.label.split('\n').map((line, index) => (
              <React.Fragment key={index}>
                {line}
                {index < tick.label.split('\n').length - 1 && <br />}
              </React.Fragment>
            ))}
          </span>
        </div>
      );
    });
    
    // Add collapse/expand buttons for collapsible segments
    timelineElements.collapsedSegments.forEach(({ segment }) => {
      const segmentData = timeSegments.find(ts => ts.collapsedSegment?.id === segment.id);
      if (!segmentData) return;
      
      const isCollapsed = segmentData.type === 'collapsed';
      const midpoint = segment.startTime + (segment.endTime - segment.startTime) / 2;
      const midpointPosition = calculator.calculatePosition(midpoint);
      
      if (midpointPosition.visible) {
        ticks.push(
          <div 
            key={`toggle-${segment.id}`}
            className={`ruler-tick ${isCollapsed ? 'collapse-tick' : 'expand-tick'}`}
            style={{ left: `${midpointPosition.left}%` }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleSegmentCollapse(segment.id);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className={isCollapsed ? 'collapse-button' : 'expand-button'}>
              <span className="collapse-icon">{isCollapsed ? '⋯' : '⤴'}</span>
              <span className="collapse-duration">{Math.round(segment.duration)}d</span>
            </div>
          </div>
        );
      }
    });
    
    return ticks;
  };

  const renderGanttRow = (event: Event, level: number, isChild = false) => {
    // Find the event position from our calculated elements
    const eventWithPosition = timelineElements.events.find(e => e.id === event.id);
    const adjustedPosition = eventWithPosition 
      ? eventWithPosition.position 
      : calculator.calculatePosition(event.time_start || 0, event.time_end);
    
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
                <span className="event-duration">({formatEventDuration(duration)})</span>
              )}
            </div>
          </div>
        </div>
        
        <div 
          className="gantt-timeline" 
          style={{ 
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
          {adjustedPosition.visible && (
            <div 
              className={`gantt-bar ${event.time_end ? 'has-duration' : 'instant'}`}
              style={{
                left: `${adjustedPosition.left}%`,
                width: `${adjustedPosition.width}%`,
                backgroundColor: getEventColor(event.id),
                borderColor: getEventColor(event.id)
              }}
              onClick={() => onEventClick(event)}
              title={`${event.name}: ${formatDateDisplay(event.time_start)}${event.time_end ? ` - ${formatDateDisplay(event.time_end)}` : ''}`}
            >
              <div className="gantt-bar-content">
                {adjustedPosition.width > 10 && (
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
            ref={timelineRef}
            className="gantt-timeline-header" 
            style={{ 
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