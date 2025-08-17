import type { Event } from '../api';

// Core Timeline Types
export interface TimelineData {
  events: Event[];
  minTime: number;
  maxTime: number;
  timeRange: number;
}

export interface Viewport {
  minTime: number;
  maxTime: number;
}

export interface CreateEventPosition {
  timeStart: number;
  timeEnd: number;
}

export interface EventFormData {
  name: string;
  description: string;
  time_start: string;
  time_end: string;
  display_order: number;
  parent_event_id: string;
}

export interface TouchState {
  isTouching: boolean;
  isPointerDown: boolean;
  initialDistance: number;
  initialZoom: number;
  initialPan: number;
  touchStartTime: number;
  singleTouchStart: { x: number; y: number };
  lastTapTime: number;
  lastTapPosition: { x: number; y: number };
}

export interface DragState {
  x: number;
  panOffset: number;
  viewport: Viewport;
}

export interface EventPosition {
  left: number;
  width: number;
  visible: boolean;
}

// Re-export types from API
export type { Event, Document, EventDocument, Tag } from '../api';