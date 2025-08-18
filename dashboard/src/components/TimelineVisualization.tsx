import React from 'react';
import type { Event } from '../api';
import type { Viewport } from '../hooks/useTimelineViewport';
import { useTimelineCollapse } from '../hooks/useTimelineCollapse';

export interface TimelineVisualizationProps {
  events: Event[];
  viewport: Viewport;
  isDragging: boolean;
  panOffset: number;
  zoomLevel: number;
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
  zoomLevel,
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
  
  // Initialize timeline collapse functionality
  const {
    timeSegments,
    toggleSegmentCollapse,
    getAdjustedPosition,
    getAdjustedViewportRange
  } = useTimelineCollapse({ events, viewport, zoomLevel });

  // Format date for ticker display (dd MMM yy format)
  const formatDateForTicker = (timeValue: number) => {
    // Use the existing formatDateDisplay which handles project base date correctly
    const fullDate = formatDateDisplay(timeValue);
    
    // Convert to shorter format: parse the date and reformat
    try {
      const date = new Date(fullDate);
      return date.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: '2-digit'
      });
    } catch (error) {
      // Fallback to original if parsing fails
      return fullDate;
    }
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
    const adjustedViewportRange = getAdjustedViewportRange();
    const originalViewportRange = viewport.maxTime - viewport.minTime;
    const ticks: React.ReactElement[] = [];
    
    // Get events with time
    const eventsWithTime = events.filter(e => e.time_start != null);
    
    // If no events, fall back to static interval tickers
    if (eventsWithTime.length === 0) {
      const targetTickCount = 15;
      const rawInterval = originalViewportRange / targetTickCount;
      
      // Round to nice intervals using powers of 10 and common factors (1, 2, 5)
      const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)));
      const normalized = rawInterval / magnitude;
      
      let niceInterval;
      if (normalized <= 1) niceInterval = 1;
      else if (normalized <= 2) niceInterval = 2;
      else if (normalized <= 5) niceInterval = 5;
      else niceInterval = 10;
      
      const tickInterval = niceInterval * magnitude;
      const startTick = Math.floor(viewport.minTime / tickInterval) * tickInterval;
      const endTick = Math.ceil(viewport.maxTime / tickInterval) * tickInterval;
      
      for (let timeValue = startTick; timeValue <= endTick; timeValue += tickInterval) {
        const adjustedTime = getAdjustedPosition(timeValue);
        const position = ((adjustedTime - getAdjustedPosition(viewport.minTime)) / adjustedViewportRange) * 100;
        const finalPosition = position;
        
        if (finalPosition > -10 && finalPosition < 110) {
          ticks.push(
            <div key={timeValue} className="ruler-tick" style={{ left: `${finalPosition}%` }}>
              <span className="ruler-label">{formatDateDisplay(timeValue)}</span>
            </div>
          );
        }
      }
    } else {
      // Event-based tickers: event start, end, midpoint, 2x, 3x
      const tickSet = new Set<number>();
      
      eventsWithTime.forEach((event, index) => {
        const eventStart = event.time_start!;
        const eventEnd = event.time_end || event.time_start!;
        const eventDuration = Math.max(1, eventEnd - eventStart);
        
        // Add event start and end
        tickSet.add(eventStart);
        tickSet.add(eventEnd);
        
        // Add midpoint
        const midpoint = eventStart + eventDuration / 2;
        tickSet.add(midpoint);
        
        // Add 2x and 3x positions after event end
        const twoX = eventEnd + eventDuration;
        const threeX = eventEnd + (eventDuration * 2);
        tickSet.add(twoX);
        tickSet.add(threeX);
        
        // Check if there's a gap that would be collapsible at 3x position
        const nextEvent = eventsWithTime[index + 1];
        if (nextEvent) {
          const nextStart = nextEvent.time_start!;
          const nextEnd = nextEvent.time_end || nextEvent.time_start!;
          const nextDuration = Math.max(1, nextEnd - nextStart);
          const averageDuration = (eventDuration + nextDuration) / 2;
          const collapseThreshold = averageDuration * 3;
          const gapDuration = nextStart - eventEnd;
          
          // Mark 3x tick as collapse boundary if gap exceeds threshold
          if (gapDuration > collapseThreshold && threeX <= nextStart) {
            // We'll add a special class to this tick later
          }
        }
      });
      
      // Convert set to sorted array and filter for minimum pixel spacing
      const sortedTicks = Array.from(tickSet).sort((a, b) => a - b);
      const filteredTicks: number[] = [];
      const minPixelSpacing = 80; // Minimum 80px between tickers
      
      // Filter ticks based on pixel spacing
      sortedTicks.forEach(timeValue => {
        const adjustedTime = getAdjustedPosition(timeValue);
        const position = ((adjustedTime - getAdjustedPosition(viewport.minTime)) / adjustedViewportRange) * 100;
        const pixelPosition = (position / 100) * 1000; // Assume 1000px timeline width
        
        // Check if this tick is too close to any existing tick
        const tooClose = filteredTicks.some(existingTick => {
          const existingAdjustedTime = getAdjustedPosition(existingTick);
          const existingPosition = ((existingAdjustedTime - getAdjustedPosition(viewport.minTime)) / adjustedViewportRange) * 100;
          const existingPixelPosition = (existingPosition / 100) * 1000;
          return Math.abs(pixelPosition - existingPixelPosition) < minPixelSpacing;
        });
        
        if (!tooClose) {
          filteredTicks.push(timeValue);
        }
      });
      
      // First add all regular tickers
      filteredTicks.forEach(timeValue => {
        const adjustedTime = getAdjustedPosition(timeValue);
        const position = ((adjustedTime - getAdjustedPosition(viewport.minTime)) / adjustedViewportRange) * 100;
        const finalPosition = position;
        
        if (finalPosition > -10 && finalPosition < 110) {
          // Check if this is a 3x collapse boundary
          let isCollapseBoundary = false;
          eventsWithTime.forEach((event, index) => {
            const eventEnd = event.time_end || event.time_start!;
            const eventDuration = Math.max(1, eventEnd - event.time_start!);
            const threeX = eventEnd + (eventDuration * 2);
            
            if (Math.abs(timeValue - threeX) < 0.1) { // Close enough to 3x position
              const nextEvent = eventsWithTime[index + 1];
              if (nextEvent) {
                const nextStart = nextEvent.time_start!;
                const nextEnd = nextEvent.time_end || nextEvent.time_start!;
                const nextDuration = Math.max(1, nextEnd - nextStart);
                const averageDuration = (eventDuration + nextDuration) / 2;
                const collapseThreshold = averageDuration * 3;
                const gapDuration = nextStart - eventEnd;
                
                if (gapDuration > collapseThreshold && threeX <= nextStart) {
                  isCollapseBoundary = true;
                }
              }
            }
          });
          
          // Render regular ticker
          ticks.push(
            <div 
              key={timeValue} 
              className={`ruler-tick ${isCollapseBoundary ? 'collapse-boundary' : ''}`} 
              style={{ left: `${finalPosition}%` }}
            >
              <span className="ruler-label">{formatDateForTicker(timeValue)}</span>
              {isCollapseBoundary && (
                <div className="collapse-indicator" title="Collapse boundary - gaps beyond this point can be collapsed">
                  ⚡
                </div>
              )}
            </div>
          );
        }
      });
      
      // Then add collapse/expand buttons for collapsible segments
      console.log('Adding collapse button tickers, segments:', timeSegments.length);
      timeSegments.forEach(segment => {
        // Show buttons for both collapsed AND expanded segments that can be collapsed
        if (segment.collapsedSegment) {
          const segmentData = segment.collapsedSegment;
          const segmentMidpoint = segmentData.startTime + (segmentData.endTime - segmentData.startTime) / 2;
          
          const adjustedTime = getAdjustedPosition(segmentMidpoint);
          const position = ((adjustedTime - getAdjustedPosition(viewport.minTime)) / adjustedViewportRange) * 100;
          const transformOffset = isDragging ? (panOffset / 10) : 0;
          const finalPosition = position + transformOffset;
          
          const isCollapsed = segment.type === 'collapsed';
          console.log(`${isCollapsed ? 'Collapse' : 'Expand'} button: segment ${segmentData.id}, position ${finalPosition}%`);
          
          if (finalPosition > -10 && finalPosition < 110) {
            ticks.push(
              <div 
                key={`toggle-${segmentData.id}`}
                className={`ruler-tick ${isCollapsed ? 'collapse-tick' : 'expand-tick'}`}
                style={{ left: `${finalPosition}%` }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleSegmentCollapse(segmentData.id);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <div className={isCollapsed ? 'collapse-button' : 'expand-button'}>
                  <span className="collapse-icon">{isCollapsed ? '⋯' : '⤴'}</span>
                  <span className="collapse-duration">{Math.round(segmentData.duration)}d</span>
                </div>
              </div>
            );
          }
        }
      });
    }
    
    return ticks;
  };

  const renderGanttRow = (event: Event, level: number, isChild = false) => {
    const originalPosition = getEventPosition(event);
    
    // Calculate adjusted position using collapse functionality
    const adjustedPosition = (() => {
      if (!event.time_start) return originalPosition;
      
      const adjustedStart = getAdjustedPosition(event.time_start);
      const adjustedEnd = getAdjustedPosition(event.time_end || event.time_start);
      const adjustedViewportRange = getAdjustedViewportRange();
      const adjustedViewportStart = getAdjustedPosition(viewport.minTime);
      
      const startPercent = ((adjustedStart - adjustedViewportStart) / adjustedViewportRange) * 100;
      const endPercent = ((adjustedEnd - adjustedViewportStart) / adjustedViewportRange) * 100;
      
      const finalLeft = startPercent;
      const finalWidth = Math.max(0.5, endPercent - startPercent);
      
      // Check if event is visible
      const visible = finalLeft < 110 && (finalLeft + finalWidth) > -10 && finalWidth > 0;
      
      return {
        left: finalLeft,
        width: finalWidth,
        visible
      };
    })();
    
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