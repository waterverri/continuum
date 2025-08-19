import { useState, useMemo, useCallback } from 'react';
import type { Event } from '../api';
import type { TimelineCalculator } from '../utils/timelineCalculator';

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
  calculator?: TimelineCalculator;
}

export interface UseTimelineCollapseResult {
  collapsedSegments: Set<string>;
  timeSegments: TimeSegment[];
  toggleSegmentCollapse: (segmentId: string) => void;
  getAdjustedPosition: (originalTime: number) => number;
  getAdjustedViewportRange: () => number;
}

// Fixed pixel width for collapsed segments
const COLLAPSED_SEGMENT_PIXEL_WIDTH = 80;

export function useTimelineCollapse({ 
  events, 
  viewport,
  calculator
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
          // Calculate proper collapsible range with padding
          const nextEnd = nextEvent.time_end || nextEvent.time_start!;
          const nextDuration = Math.max(1, nextEnd - nextStart);
          
          // Define collapsible range: a.end + 2*a.duration to b.start - 2*b.duration
          const collapsibleStart = currentEnd + (2 * currentDuration);
          const collapsibleEnd = nextStart - (2 * nextDuration);
          const collapsibleDuration = Math.max(0, collapsibleEnd - collapsibleStart);
          
          // Only create collapsible segment if there's actually space to collapse
          if (collapsibleDuration > 0) {
            // Create collapsible gap - START COLLAPSED by default
            const segmentId = `gap_${collapsibleStart}_${collapsibleEnd}`;
            const isExpanded = collapsedSegments.has(segmentId); // Inverted logic - set contains expanded gaps

            segments.push({
              type: isExpanded ? 'gap' : 'collapsed',
              startTime: collapsibleStart,
              endTime: collapsibleEnd,
              duration: collapsibleDuration,
              collapsedSegment: {
                id: segmentId,
                startTime: collapsibleStart,
                endTime: collapsibleEnd,
                duration: collapsibleDuration,
                isCollapsed: !isExpanded, // Inverted
                collapseThreshold: collapsibleDuration // Store the original duration
              }
            });
          } else {
            // Regular gap - no space to collapse after padding
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
    // Use the shared calculator instance - no more silos!
    if (!calculator) {
      return originalTime; // fallback if no calculator provided
    }
    
    const pixelsPerTimeUnit = calculator.getPixelsPerTimeUnit();
    const collapsedSegmentTimeUnits = COLLAPSED_SEGMENT_PIXEL_WIDTH / pixelsPerTimeUnit;
    
    let adjustedTime = originalTime;
    let cumulativeCompression = 0;

    for (const segment of timeSegments) {
      if (segment.type === 'collapsed' && segment.collapsedSegment) {
        const { startTime, endTime, duration } = segment.collapsedSegment;
        
        if (originalTime > endTime) {
          // Time is after this collapsed segment
          // Compress the entire segment duration TO the fixed pixel width
          const compressionSavings = duration - collapsedSegmentTimeUnits;
          cumulativeCompression += Math.max(0, compressionSavings);
        } else if (originalTime > startTime) {
          // Time is within collapsed segment, map it to compressed space
          const progressInSegment = (originalTime - startTime) / duration;
          const compressedOffset = progressInSegment * collapsedSegmentTimeUnits;
          adjustedTime = startTime - cumulativeCompression + compressedOffset;
          return adjustedTime;
        }
      }
    }

    const result = originalTime - cumulativeCompression;
    return result;
  }, [timeSegments, calculator]);

  // Calculate adjusted viewport range accounting for collapsed segments
  const getAdjustedViewportRange = useCallback((): number => {
    // Use the shared calculator instance - no more silos!
    if (!calculator) {
      return viewport.maxTime - viewport.minTime; // fallback if no calculator provided
    }
    
    const pixelsPerTimeUnit = calculator.getPixelsPerTimeUnit();
    const collapsedSegmentTimeUnits = COLLAPSED_SEGMENT_PIXEL_WIDTH / pixelsPerTimeUnit;
    
    const originalRange = viewport.maxTime - viewport.minTime;
    let compressionSavings = 0;

    for (const segment of timeSegments) {
      if (segment.type === 'collapsed' && segment.collapsedSegment) {
        const { startTime, endTime, duration } = segment.collapsedSegment;
        
        // Check if collapsed segment overlaps with viewport
        const segmentInViewport = startTime < viewport.maxTime && endTime > viewport.minTime;
        
        if (segmentInViewport) {
          const overlapStart = Math.max(startTime, viewport.minTime);
          const overlapEnd = Math.min(endTime, viewport.maxTime);
          const overlapDuration = overlapEnd - overlapStart;
          
          // Calculate compression savings for the overlapping portion
          const overlapRatio = overlapDuration / duration;
          const totalCompressionSavings = duration - collapsedSegmentTimeUnits;
          const overlapSavings = Math.max(0, totalCompressionSavings * overlapRatio);
          compressionSavings += overlapSavings;
        }
      }
    }

    const result = originalRange - compressionSavings;
    return result;
  }, [viewport, timeSegments, calculator]);

  return {
    collapsedSegments,
    timeSegments,
    toggleSegmentCollapse,
    getAdjustedPosition,
    getAdjustedViewportRange
  };
}