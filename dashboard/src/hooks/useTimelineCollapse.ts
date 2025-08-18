import { useState, useMemo, useCallback } from 'react';
import type { Event } from '../api';

export interface CollapsedSegment {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
  isCollapsed: boolean;
  collapseThreshold?: number;
}

export interface TimeSegment {
  type: 'event' | 'gap' | 'collapsed';
  startTime: number;
  endTime: number;
  duration: number;
  eventIds?: string[];
  collapsedSegment?: CollapsedSegment;
}

export interface UseTimelineCollapseProps {
  events: Event[];
  viewport: { minTime: number; maxTime: number };
}

export interface UseTimelineCollapseResult {
  collapsedSegments: Set<string>;
  timeSegments: TimeSegment[];
  toggleSegmentCollapse: (segmentId: string) => void;
  getAdjustedPosition: (originalTime: number) => number;
  getAdjustedViewportRange: () => number;
}

export function useTimelineCollapse({ 
  events, 
  viewport 
}: UseTimelineCollapseProps): UseTimelineCollapseResult {
  
  const [collapsedSegments, setCollapsedSegments] = useState<Set<string>>(new Set());

  // Calculate time segments with potential collapse areas
  const timeSegments = useMemo(() => {
    const eventsWithTime = events
      .filter(e => e.time_start != null)
      .sort((a, b) => a.time_start! - b.time_start!);

    if (eventsWithTime.length === 0) return [];

    const segments: TimeSegment[] = [];
    
    for (let i = 0; i < eventsWithTime.length; i++) {
      const currentEvent = eventsWithTime[i];
      const currentStart = currentEvent.time_start!;
      const currentEnd = currentEvent.time_end || currentEvent.time_start!;
      const currentDuration = Math.max(1, currentEnd - currentStart);

      // Add event segment
      segments.push({
        type: 'event',
        startTime: currentStart,
        endTime: currentEnd,
        duration: currentDuration,
        eventIds: [currentEvent.id]
      });

      // Check for gap to next event
      const nextEvent = eventsWithTime[i + 1];
      if (nextEvent) {
        const nextStart = nextEvent.time_start!;
        const gapStart = currentEnd;
        const gapEnd = nextStart;
        const gapDuration = gapEnd - gapStart;

        if (gapDuration > 0) {
          // Calculate surrounding event durations for threshold
          const nextEnd = nextEvent.time_end || nextEvent.time_start!;
          const nextDuration = Math.max(1, nextEnd - nextStart);
          const averageSurroundingDuration = (currentDuration + nextDuration) / 2;
          const collapseThreshold = averageSurroundingDuration * 3;

          if (gapDuration > collapseThreshold) {
            // Create collapsible gap - START COLLAPSED by default
            const segmentId = `gap_${gapStart}_${gapEnd}`;
            const isExpanded = collapsedSegments.has(segmentId); // Inverted logic - set contains expanded gaps

            segments.push({
              type: isExpanded ? 'gap' : 'collapsed',
              startTime: gapStart,
              endTime: gapEnd,
              duration: gapDuration,
              collapsedSegment: {
                id: segmentId,
                startTime: gapStart,
                endTime: gapEnd,
                duration: gapDuration,
                isCollapsed: !isExpanded, // Inverted
                collapseThreshold // Store the threshold for visual indication
              }
            });
          } else {
            // Regular gap - too small to collapse
            segments.push({
              type: 'gap',
              startTime: gapStart,
              endTime: gapEnd,
              duration: gapDuration
            });
          }
        }
      }
    }

    return segments;
  }, [events, collapsedSegments]);

  // Toggle collapse state of a segment
  const toggleSegmentCollapse = useCallback((segmentId: string) => {
    setCollapsedSegments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(segmentId)) {
        newSet.delete(segmentId);
      } else {
        newSet.add(segmentId);
      }
      return newSet;
    });
  }, []);

  // Calculate adjusted time position accounting for collapsed segments
  const getAdjustedPosition = useCallback((originalTime: number): number => {
    let adjustedTime = originalTime;
    let cumulativeCompression = 0;

    for (const segment of timeSegments) {
      if (segment.type === 'collapsed' && segment.collapsedSegment) {
        const { startTime, endTime, duration } = segment.collapsedSegment;
        
        if (originalTime > endTime) {
          // Time is after this collapsed segment, apply full compression
          const compressionRatio = 0.1; // Collapse to 10% of original duration
          const savedTime = duration * (1 - compressionRatio);
          cumulativeCompression += savedTime;
        } else if (originalTime > startTime) {
          // Time is within collapsed segment, map it to compressed space
          const progressInSegment = (originalTime - startTime) / duration;
          const compressedDuration = duration * 0.1;
          const compressedOffset = progressInSegment * compressedDuration;
          adjustedTime = startTime - cumulativeCompression + compressedOffset;
          return adjustedTime;
        }
      }
    }

    return originalTime - cumulativeCompression;
  }, [timeSegments]);

  // Calculate adjusted viewport range accounting for collapsed segments
  const getAdjustedViewportRange = useCallback((): number => {
    const originalRange = viewport.maxTime - viewport.minTime;
    let compressionSavings = 0;

    for (const segment of timeSegments) {
      if (segment.type === 'collapsed' && segment.collapsedSegment) {
        const { startTime, endTime } = segment.collapsedSegment;
        
        // Check if collapsed segment overlaps with viewport
        const segmentInViewport = startTime < viewport.maxTime && endTime > viewport.minTime;
        
        if (segmentInViewport) {
          const overlapStart = Math.max(startTime, viewport.minTime);
          const overlapEnd = Math.min(endTime, viewport.maxTime);
          const overlapDuration = overlapEnd - overlapStart;
          
          // Calculate compression savings for the overlapping portion
          const compressionRatio = 0.9; // Save 90% of the space
          const overlapSavings = overlapDuration * compressionRatio;
          compressionSavings += overlapSavings;
        }
      }
    }

    return originalRange - compressionSavings;
  }, [viewport, timeSegments]);

  return {
    collapsedSegments,
    timeSegments,
    toggleSegmentCollapse,
    getAdjustedPosition,
    getAdjustedViewportRange
  };
}