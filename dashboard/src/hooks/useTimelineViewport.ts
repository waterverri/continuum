import { useState, useCallback, useEffect } from 'react';
import type { Event } from '../api';
import type { TimelineData, TouchState } from '../types/timeline';

export interface Viewport {
  minTime: number;
  maxTime: number;
}

export interface DragState {
  x: number;
  viewportStartTime: number; // actual start time of viewport, not percentage
  viewport: Viewport;
}

export interface UseTimelineViewportProps {
  timelineData: TimelineData;
  events: Event[];
  isCreatingEvent: boolean;
  timelineWidth: number; // ACTUAL width from DOM element, not assumed
}

export interface UseTimelineViewportResult {
  // Viewport state
  viewport: Viewport;
  setViewport: (viewport: Viewport) => void;
  viewportManuallySet: boolean;
  setViewportManuallySet: (manual: boolean) => void;
  
  // Zoom and pan state
  zoomLevel: number;
  setZoomLevel: (zoom: number | ((prev: number) => number)) => void;
  viewportStartTime: number; // actual time, not percentage
  setViewportStartTime: (startTime: number) => void;
  
  // Interaction state
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  dragStart: DragState;
  setDragStart: (start: DragState) => void;
  touchState: TouchState;
  setTouchState: (state: TouchState | ((prev: TouchState) => TouchState)) => void;
  
  // Zoom controls
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleZoomReset: () => void;
  handleZoomToFit: () => void;
  
  // Pan controls
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  
  // Wheel/trackpad controls
  handleWheel: (e: React.WheelEvent) => void;
  
  // Touch controls
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleTouchEnd: (e: React.TouchEvent, onDoubleClick: (e: any) => void) => void;
  
  // Position utilities
  calculateTimeFromMousePosition: (e: React.MouseEvent, element: HTMLElement) => number;
  getEventPosition: (event: Event) => { left: number; width: number; visible: boolean };
}

const initialTouchState: TouchState = {
  isTouching: false,
  isPointerDown: false,
  initialDistance: 0,
  initialZoom: 1,
  initialViewportStartTime: 0,
  touchStartTime: 0,
  singleTouchStart: { x: 0, y: 0 },
  lastTapTime: 0,
  lastTapPosition: { x: 0, y: 0 }
};

export function useTimelineViewport({ 
  timelineData, 
  events, 
  isCreatingEvent,
  timelineWidth 
}: UseTimelineViewportProps): UseTimelineViewportResult {
  
  // Viewport and zoom state
  const [viewport, setViewport] = useState<Viewport>({ minTime: 0, maxTime: 100 });
  const [viewportManuallySet, setViewportManuallySet] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewportStartTime, setViewportStartTime] = useState(0);
  
  // Interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<DragState>({ x: 0, viewportStartTime: 0, viewport: { minTime: 0, maxTime: 100 } });
  const [touchState, setTouchState] = useState<TouchState>(initialTouchState);
  
  // Touch utilities
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const touch1 = touches[0];
    const touch2 = touches[1];
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };
  
  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => {
      const newZoom = prev * 1.5;
      
      // Calculate current center time and maintain it
      const basePixelsPerDay = 50;
      const oldPixelsPerTimeUnit = basePixelsPerDay * prev;
      const newPixelsPerTimeUnit = basePixelsPerDay * newZoom;
      const oldViewportTimeWidth = timelineWidth / oldPixelsPerTimeUnit;
      const newViewportTimeWidth = timelineWidth / newPixelsPerTimeUnit;
      
      const currentCenterTime = viewportStartTime + (oldViewportTimeWidth / 2);
      const newStartTime = currentCenterTime - (newViewportTimeWidth / 2);
      
      setViewportStartTime(newStartTime);
      return newZoom;
    });
  }, [viewportStartTime, timelineWidth]);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => {
      const newZoom = prev / 1.5; // Proportional zoom out
      
      // Calculate current center time and maintain it
      const basePixelsPerDay = 50;
      const oldPixelsPerTimeUnit = basePixelsPerDay * prev;
      const newPixelsPerTimeUnit = basePixelsPerDay * newZoom;
      const oldViewportTimeWidth = timelineWidth / oldPixelsPerTimeUnit;
      const newViewportTimeWidth = timelineWidth / newPixelsPerTimeUnit;
      
      const currentCenterTime = viewportStartTime + (oldViewportTimeWidth / 2);
      const newStartTime = currentCenterTime - (newViewportTimeWidth / 2);
      
      setViewportStartTime(newStartTime);
      
      // Only reset to events center when zooming out significantly (and user wants reset)
      if (newZoom <= 1 && prev > 1) {
        setViewportManuallySet(false); // Allow auto-centering on events
      }
      
      return newZoom;
    });
  }, [viewportStartTime, timelineWidth]);

  const handleZoomReset = useCallback(() => {
    setZoomLevel(1);
    setViewportManuallySet(false); // Allow viewport to be recalculated to center on events
  }, []);

  const handleZoomToFit = useCallback(() => {
    // Calculate optimal zoom to fit all events
    const eventsWithTime = events.filter(e => e.time_start != null);
    if (eventsWithTime.length === 0) return;
    
    // Get event data range
    const startTimes = eventsWithTime.map(e => e.time_start!);
    const endTimes = eventsWithTime.map(e => e.time_end || e.time_start!);
    const dataMinTime = Math.min(...startTimes);
    const dataMaxTime = Math.max(...endTimes);
    
    const dataRange = Math.max(1, dataMaxTime - dataMinTime); // Prevent division by zero
    const paddedRange = dataRange * 1.4; // Add 40% padding for better visibility
    
    // Calculate zoom to fit events with padding
    const optimalZoom = timelineData.timeRange / paddedRange;
    setZoomLevel(Math.max(0.001, optimalZoom)); // No upper limit
    
    // Reset viewport manually set flag to allow auto-centering on events
    setViewportManuallySet(false);
    
    // Set viewport to show the fitted range
    const dataCenter = (dataMinTime + dataMaxTime) / 2;
    const newMinTime = dataCenter - paddedRange / 2;
    const newMaxTime = dataCenter + paddedRange / 2;
    
    // Update viewport directly
    setTimeout(() => {
      setViewport({
        minTime: newMinTime,
        maxTime: newMaxTime
      });
      setViewportManuallySet(false); // Keep it as auto-managed
    }, 10);
  }, [events, timelineData.timeRange]);
  
  // Pan functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isCreatingEvent) return; // Don't pan when creating events
    setIsDragging(true);
    setDragStart({ x: e.clientX, viewportStartTime, viewport: { ...viewport } });
    e.preventDefault();
  }, [viewportStartTime, isCreatingEvent, viewport]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || isCreatingEvent) return;
    
    const deltaX = e.clientX - dragStart.x;
    const basePixelsPerDay = 50;
    const pixelsPerTimeUnit = basePixelsPerDay * zoomLevel;
    
    // Convert pixel movement to time movement using ACTUAL timeline width
    const deltaTime = deltaX / pixelsPerTimeUnit;
    const newStartTime = dragStart.viewportStartTime - deltaTime; // Negative because dragging right = go back in time
    
    setViewportStartTime(newStartTime);
  }, [isDragging, dragStart, isCreatingEvent, zoomLevel, timelineWidth]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      // With the new architecture, viewportStartTime is already the source of truth
      // We could optionally update the viewport state here, but it's derived from viewportStartTime
      setViewportManuallySet(true); // Mark viewport as manually set
    }
    setIsDragging(false);
  }, [isDragging]);
  
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
        const newZoom = Math.max(0.001, prev + deltaZoom); // Minimal floor to prevent divide-by-zero
        
        // Calculate current center time and maintain it
        const basePixelsPerDay = 50;
        const oldPixelsPerTimeUnit = basePixelsPerDay * prev;
        const newPixelsPerTimeUnit = basePixelsPerDay * newZoom;
        const oldViewportTimeWidth = timelineWidth / oldPixelsPerTimeUnit;
        const newViewportTimeWidth = timelineWidth / newPixelsPerTimeUnit;
        
        const currentCenterTime = viewportStartTime + (oldViewportTimeWidth / 2);
        const newStartTime = currentCenterTime - (newViewportTimeWidth / 2);
        
        setViewportStartTime(newStartTime);
        
        // Reset to events center when zooming out significantly
        if (newZoom <= 1 && prev > 1) {
          setViewportManuallySet(false); // Allow viewport to be recalculated
        }
        
        return newZoom;
      });
    } 
    // Handle horizontal scrolling for panning (common on trackpads)
    else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      
      // Convert pixel delta to time movement using actual timeline width
      const isMacLike = navigator.platform.includes('Mac');
      const baseSensitivity = isMacLike ? 0.5 : 1;
      const basePixelsPerDay = 50;
      const pixelsPerTimeUnit = basePixelsPerDay * zoomLevel;
      const deltaTime = (e.deltaX * baseSensitivity) / pixelsPerTimeUnit;
      
      setViewportStartTime(prev => prev - deltaTime);
    }
    // Handle vertical scrolling for zooming when shift is held (alternative zoom method)
    else if (e.shiftKey && Math.abs(e.deltaY) > 0) {
      e.preventDefault();
      
      const zoomSensitivity = 0.002;
      const deltaZoom = -e.deltaY * zoomSensitivity;
      
      setZoomLevel(prev => {
        const newZoom = Math.max(0.001, prev + deltaZoom); // Minimal floor to prevent divide-by-zero
        
        // Calculate current center time and maintain it
        const basePixelsPerDay = 50;
        const oldPixelsPerTimeUnit = basePixelsPerDay * prev;
        const newPixelsPerTimeUnit = basePixelsPerDay * newZoom;
        const oldViewportTimeWidth = timelineWidth / oldPixelsPerTimeUnit;
        const newViewportTimeWidth = timelineWidth / newPixelsPerTimeUnit;
        
        const currentCenterTime = viewportStartTime + (oldViewportTimeWidth / 2);
        const newStartTime = currentCenterTime - (newViewportTimeWidth / 2);
        
        setViewportStartTime(newStartTime);
        
        // Reset to events center when zooming out significantly
        if (newZoom <= 1 && prev > 1) {
          setViewportManuallySet(false); // Allow viewport to be recalculated
        }
        
        return newZoom;
      });
    }
  }, [zoomLevel, viewportStartTime, timelineWidth]);
  
  // Touch event handlers
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
        initialViewportStartTime: viewportStartTime
      }));
    }
  }, [zoomLevel, viewportStartTime]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchState.isTouching) return;

    if (e.touches.length === 2) {
      // Two finger pinch/zoom
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches);
      const scale = currentDistance / touchState.initialDistance;
      const newZoom = Math.max(0.001, touchState.initialZoom * scale); // Minimal floor to prevent divide-by-zero
      
      // Calculate current center time and maintain it
      const basePixelsPerDay = 50;
      const oldPixelsPerTimeUnit = basePixelsPerDay * zoomLevel;
      const newPixelsPerTimeUnit = basePixelsPerDay * newZoom;
      const oldViewportTimeWidth = timelineWidth / oldPixelsPerTimeUnit;
      const newViewportTimeWidth = timelineWidth / newPixelsPerTimeUnit;
      
      const currentCenterTime = viewportStartTime + (oldViewportTimeWidth / 2);
      const newStartTime = currentCenterTime - (newViewportTimeWidth / 2);
      
      setZoomLevel(newZoom);
      setViewportStartTime(newStartTime);
      
      // Reset to events center when zooming out significantly
      if (newZoom <= 1 && touchState.initialZoom > 1) {
        setViewportManuallySet(false); // Allow auto-centering on events
      }
    } else if (e.touches.length === 1 && !isCreatingEvent) {
      // Single finger pan
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchState.singleTouchStart.x;
      
      // Only start panning if moved more than a threshold (to distinguish from taps)
      if (Math.abs(deltaX) > 10) {
        const basePixelsPerDay = 50;
        const pixelsPerTimeUnit = basePixelsPerDay * zoomLevel;
        const deltaTime = -deltaX / pixelsPerTimeUnit; // Negative because touch direction is inverted
        
        setViewportStartTime(touchState.initialViewportStartTime + deltaTime);
      }
    }
  }, [touchState, isCreatingEvent, zoomLevel]);

  const handleTouchEnd = useCallback((e: React.TouchEvent, onDoubleClick: (e: any) => void) => {
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
        
        onDoubleClick(fakeMouseEvent);
        
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
      initialViewportStartTime: 0,
      touchStartTime: 0,
      singleTouchStart: { x: 0, y: 0 }
    }));
  }, [touchState, isCreatingEvent]);
  
  // Position utilities
  const calculateTimeFromMousePosition = useCallback((e: React.MouseEvent, element: HTMLElement, zoom: number = zoomLevel) => {
    const rect = element.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    
    // Convert pixel position to time using the new architecture
    const basePixelsPerDay = 50;
    const pixelsPerTimeUnit = basePixelsPerDay * zoom;
    const timeValue = viewportStartTime + (relativeX / pixelsPerTimeUnit);
    
    return Math.round(timeValue);
  }, [viewportStartTime, zoomLevel]);

  const getEventPosition = useCallback((event: Event, zoom: number = zoomLevel) => {
    if (!event.time_start) return { left: 0, width: 0, visible: false };
    
    // Convert time positions to pixel positions using the new architecture
    const basePixelsPerDay = 50;
    const pixelsPerTimeUnit = basePixelsPerDay * zoom;
    
    const startPixel = (event.time_start - viewportStartTime) * pixelsPerTimeUnit;
    const endTime = event.time_end || (event.time_start + 1); // Default 1 unit width for instant events
    const endPixel = (endTime - viewportStartTime) * pixelsPerTimeUnit;
    
    // Convert to percentages (assuming timelineWidth will be used later)
    const startPercent = (startPixel / timelineWidth) * 100;
    const endPercent = (endPixel / timelineWidth) * 100;
    
    const finalLeft = startPercent;
    const finalWidth = Math.max(0.5, endPercent - startPercent);
    
    // Check if event is visible (including some margin for smooth transitions)
    const visible = finalLeft < 110 && (finalLeft + finalWidth) > -10 && finalWidth > 0;
    
    return {
      left: finalLeft,
      width: finalWidth,
      visible
    };
  }, [viewportStartTime, zoomLevel, timelineWidth]);
  
  // Update viewport when zoom changes (always) or when timeline data changes (if not manually panned)
  useEffect(() => {
    if (timelineData.timeRange > 0 && !isDragging) {
      // Calculate viewport width in time units
      const basePixelsPerDay = 50;
      const pixelsPerTimeUnit = basePixelsPerDay * zoomLevel;
      const viewportTimeWidth = timelineWidth / pixelsPerTimeUnit;
      
      if (!viewportManuallySet) {
        // First time or reset - center viewport on the center point of all events
        const eventsWithTime = events.filter(e => e.time_start != null);
        
        if (eventsWithTime.length > 0) {
          // Calculate the center point of all events (disregarding collapse)
          const eventTimes = eventsWithTime.flatMap(e => [
            e.time_start!,
            e.time_end || e.time_start!
          ]);
          const minEventTime = Math.min(...eventTimes);
          const maxEventTime = Math.max(...eventTimes);
          const eventsCenterTime = (minEventTime + maxEventTime) / 2;
          
          // Set viewport start time to center the events
          const newStartTime = eventsCenterTime - (viewportTimeWidth / 2);
          setViewportStartTime(newStartTime);
        } else {
          // No events - center on timeline data
          const dataCenter = (timelineData.minTime + timelineData.maxTime) / 2;
          const newStartTime = dataCenter - (viewportTimeWidth / 2);
          setViewportStartTime(newStartTime);
        }
        
        // Update viewport state for compatibility
        const startTime = viewportStartTime;
        setViewport({
          minTime: startTime,
          maxTime: startTime + viewportTimeWidth
        });
      } else {
        // User has panned - maintain current center while adjusting for zoom
        const currentCenter = viewportStartTime + (viewportTimeWidth / 2);
        const newStartTime = currentCenter - (viewportTimeWidth / 2);
        setViewportStartTime(newStartTime);
        
        setViewport({
          minTime: newStartTime,
          maxTime: newStartTime + viewportTimeWidth
        });
      }
    }
  }, [timelineData, zoomLevel, isDragging, viewportManuallySet, events, timelineWidth, viewportStartTime]);
  
  return {
    // Viewport state
    viewport,
    setViewport,
    viewportManuallySet,
    setViewportManuallySet,
    
    // Zoom and pan state
    zoomLevel,
    setZoomLevel,
    viewportStartTime,
    setViewportStartTime,
    
    // Interaction state
    isDragging,
    setIsDragging,
    dragStart,
    setDragStart,
    touchState,
    setTouchState,
    
    // Zoom controls
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    handleZoomToFit,
    
    // Pan controls
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    
    // Wheel/trackpad controls
    handleWheel,
    
    // Touch controls
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    
    // Position utilities
    calculateTimeFromMousePosition,
    getEventPosition
  };
}