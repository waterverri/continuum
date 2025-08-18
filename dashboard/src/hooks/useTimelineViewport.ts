import { useState, useCallback, useEffect } from 'react';
import type { Event } from '../api';
import type { TimelineData, TouchState } from '../types/timeline';

export interface Viewport {
  minTime: number;
  maxTime: number;
}

export interface DragState {
  x: number;
  panOffset: number;
  viewport: Viewport;
}

export interface UseTimelineViewportProps {
  timelineData: TimelineData;
  events: Event[];
  isCreatingEvent: boolean;
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
  panOffset: number;
  setPanOffset: (offset: number) => void;
  
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
  initialPan: 0,
  touchStartTime: 0,
  singleTouchStart: { x: 0, y: 0 },
  lastTapTime: 0,
  lastTapPosition: { x: 0, y: 0 }
};

export function useTimelineViewport({ 
  timelineData, 
  events, 
  isCreatingEvent 
}: UseTimelineViewportProps): UseTimelineViewportResult {
  
  // Viewport and zoom state
  const [viewport, setViewport] = useState<Viewport>({ minTime: 0, maxTime: 100 });
  const [viewportManuallySet, setViewportManuallySet] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  
  // Interaction state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<DragState>({ x: 0, panOffset: 0, viewport: { minTime: 0, maxTime: 100 } });
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
    setZoomLevel(prev => prev * 1.5); // Proportional zoom in
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => {
      const newZoom = prev / 1.5; // Proportional zoom out
      // Reset pan when zooming out significantly
      if (newZoom <= 1 && prev > 1) {
        setPanOffset(0);
      }
      return newZoom;
    });
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoomLevel(1);
    setPanOffset(0);
    setViewportManuallySet(false); // Allow viewport to be recalculated
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
    
    // Reset pan and viewport manually set flag
    setPanOffset(0);
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
    setDragStart({ x: e.clientX, panOffset, viewport: { ...viewport } });
    e.preventDefault();
  }, [panOffset, isCreatingEvent, viewport]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || isCreatingEvent) return;
    
    const deltaX = e.clientX - dragStart.x;
    // Convert pixel delta to percentage of viewport - zoom is already integrated
    const timelinePseudoWidth = 1000; // Assume 1000px timeline for percentage calculation
    const deltaPercentage = (deltaX / timelinePseudoWidth) * 100;
    const newPanOffset = dragStart.panOffset - deltaPercentage;
    
    // No pan constraints - allow unlimited panning
    setPanOffset(newPanOffset);
  }, [isDragging, dragStart, isCreatingEvent]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      // Convert pan offset percentage to actual time shift using zoom-integrated calculations
      const baseViewportRange = viewport.maxTime - viewport.minTime;
      const zoomedViewportRange = baseViewportRange / zoomLevel;
      const timeShift = (panOffset / 100) * zoomedViewportRange;
      
      // Create new viewport shifted by the pan amount
      const newViewport = {
        minTime: viewport.minTime - timeShift, // Negative because pan left = show earlier times
        maxTime: viewport.maxTime - timeShift
      };
      
      setViewport(newViewport);
      setViewportManuallySet(true); // Mark viewport as manually set
      
      // Reset pan offset since we're now rendering at the new position
      setPanOffset(0);
    }
    setIsDragging(false);
  }, [isDragging, panOffset, viewport, zoomLevel]);
  
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
        // Reset pan when zooming out significantly
        if (newZoom <= 1 && prev > 1) {
          setPanOffset(0);
          setViewportManuallySet(false); // Allow viewport to be recalculated
        }
        return newZoom;
      });
    } 
    // Handle horizontal scrolling for panning (common on trackpads)
    else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      e.preventDefault();
      
      // Convert pixel delta to percentage of viewport using consistent calculations
      const isMacLike = navigator.platform.includes('Mac');
      const baseSensitivity = isMacLike ? 0.5 : 1;
      const timelinePseudoWidth = 1000;
      const deltaPercentage = (e.deltaX * baseSensitivity / timelinePseudoWidth) * 100;
      
      setPanOffset(prev => prev - deltaPercentage);
    }
    // Handle vertical scrolling for zooming when shift is held (alternative zoom method)
    else if (e.shiftKey && Math.abs(e.deltaY) > 0) {
      e.preventDefault();
      
      const zoomSensitivity = 0.002;
      const deltaZoom = -e.deltaY * zoomSensitivity;
      
      setZoomLevel(prev => {
        const newZoom = Math.max(0.001, prev + deltaZoom); // Minimal floor to prevent divide-by-zero
        if (newZoom <= 1 && prev > 1) {
          setPanOffset(0);
          setViewportManuallySet(false); // Allow viewport to be recalculated
        }
        return newZoom;
      });
    }
  }, [zoomLevel]);
  
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
      const newZoom = Math.max(0.001, touchState.initialZoom * scale); // Minimal floor to prevent divide-by-zero
      
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
        const timelinePseudoWidth = 1000;
        const deltaPercentage = (-deltaX / timelinePseudoWidth) * 100;
        const newPan = touchState.initialPan + deltaPercentage;
        
        setPanOffset(newPan);
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
      initialPan: 0,
      touchStartTime: 0,
      singleTouchStart: { x: 0, y: 0 }
    }));
  }, [touchState, isCreatingEvent]);
  
  // Position utilities
  const calculateTimeFromMousePosition = useCallback((e: React.MouseEvent, element: HTMLElement, zoom: number = zoomLevel) => {
    const rect = element.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const elementWidth = rect.width;
    
    // Apply zoom to the mouse position calculation
    const zoomedRelativeX = relativeX + (panOffset * zoom);
    const percentageX = Math.max(0, Math.min(100, (zoomedRelativeX / elementWidth) * 100));
    
    // Convert percentage to time value using current viewport with zoom consideration
    const baseViewportRange = viewport.maxTime - viewport.minTime;
    const zoomedViewportRange = baseViewportRange / zoom;
    const timeValue = viewport.minTime + (percentageX / 100) * zoomedViewportRange;
    
    return Math.round(timeValue);
  }, [viewport, zoomLevel, panOffset]);

  const getEventPosition = useCallback((event: Event, zoom: number = zoomLevel) => {
    if (!event.time_start) return { left: 0, width: 0, visible: false };
    
    const baseViewportRange = viewport.maxTime - viewport.minTime;
    if (baseViewportRange <= 0) return { left: 0, width: 0, visible: false };
    
    // Calculate zoomed viewport range
    const zoomedViewportRange = baseViewportRange / zoom;
    const zoomedViewportStart = viewport.minTime - (panOffset * zoomedViewportRange / 100);
    
    // Calculate position relative to zoomed viewport
    const startPercent = ((event.time_start - zoomedViewportStart) / zoomedViewportRange) * 100;
    const endTime = event.time_end || (event.time_start + 1); // Default 1 unit width for instant events
    const endPercent = ((endTime - zoomedViewportStart) / zoomedViewportRange) * 100;
    
    const finalLeft = startPercent;
    const finalWidth = Math.max(0.5, endPercent - startPercent);
    
    // Check if event is visible (including some margin for smooth transitions)
    const visible = finalLeft < 110 && (finalLeft + finalWidth) > -10 && finalWidth > 0;
    
    return {
      left: finalLeft,
      width: finalWidth,
      visible
    };
  }, [viewport, zoomLevel, panOffset]);
  
  // Update viewport when zoom changes (always) or when timeline data changes (if not manually panned)
  useEffect(() => {
    if (timelineData.timeRange > 0 && !isDragging) {
      const viewportRange = timelineData.timeRange / zoomLevel;
      
      if (!viewportManuallySet) {
        // First time or reset - center the viewport
        setViewport({
          minTime: timelineData.minTime,
          maxTime: timelineData.minTime + viewportRange
        });
      } else {
        // User has panned - maintain current center while adjusting for zoom
        const currentCenter = (viewport.minTime + viewport.maxTime) / 2;
        const newMinTime = currentCenter - viewportRange / 2;
        const newMaxTime = currentCenter + viewportRange / 2;
        
        setViewport({
          minTime: newMinTime,
          maxTime: newMaxTime
        });
      }
    }
  }, [timelineData, zoomLevel, isDragging, viewportManuallySet, viewport.minTime, viewport.maxTime]);
  
  return {
    // Viewport state
    viewport,
    setViewport,
    viewportManuallySet,
    setViewportManuallySet,
    
    // Zoom and pan state
    zoomLevel,
    setZoomLevel,
    panOffset,
    setPanOffset,
    
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