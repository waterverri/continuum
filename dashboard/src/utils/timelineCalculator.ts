import type { Event } from '../api';

export interface CollapsedSegment {
  id: string;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface TimeSegment {
  type: 'normal' | 'collapsed' | 'expandable';
  collapsedSegment?: CollapsedSegment;
}

export interface PositionResult {
  left: number; // percentage (0-100)
  width: number; // percentage (0-100)
  leftPixel: number; // pixels
  widthPixel: number; // pixels
  visible: boolean;
}

export interface EventWithPosition extends Event {
  position: PositionResult;
}

export interface CollapsedSegmentWithPosition {
  segment: CollapsedSegment;
  position: PositionResult;
}

export interface TimelineElements {
  events: EventWithPosition[];
  collapsedSegments: CollapsedSegmentWithPosition[];
  ticks: Array<{
    timeValue: number;
    position: PositionResult;
    label: string;
  }>;
}

export class TimelineCalculator {
  private viewportStartTime: number;
  private zoomLevel: number;
  private timelineWidth: number;
  private getAdjustedPosition: (time: number) => number;
  private formatDateDisplay: (timeValue?: number) => string;

  // Calculated viewport properties
  private viewportEndTime!: number;
  private pixelsPerTimeUnit!: number;

  constructor(
    viewportStartTime: number,
    zoomLevel: number,
    timelineWidth: number,
    getAdjustedPosition: (time: number) => number,
    formatDateDisplay: (timeValue?: number) => string
  ) {
    this.viewportStartTime = viewportStartTime;
    this.zoomLevel = zoomLevel;
    this.timelineWidth = timelineWidth;
    this.getAdjustedPosition = getAdjustedPosition;
    this.formatDateDisplay = formatDateDisplay;

    // Calculate viewport properties
    this.calculateViewportProperties();
  }

  private calculateViewportProperties(): void {
    // Define reasonable base scale: pixels per day
    const basePixelsPerDay = 50; // At zoom 1x: 1 day = 50 pixels
    
    // Calculate pixels per time unit based on zoom level (zoom only affects this)
    this.pixelsPerTimeUnit = basePixelsPerDay * this.zoomLevel;
    
    // Calculate viewport end time: start + (pixels / pixelsPerTimeUnit) ± collapsed adjustments
    const baseTimeRange = this.timelineWidth / this.pixelsPerTimeUnit;
    
    // The actual viewport end time accounts for collapsed segments
    this.viewportEndTime = this.viewportStartTime + baseTimeRange;
  }

  /**
   * Convert time value to pixel position
   */
  timeToPixel(timeValue: number): number {
    const adjustedTime = this.getAdjustedPosition(timeValue);
    const adjustedStartTime = this.getAdjustedPosition(this.viewportStartTime);
    
    // Calculate pixel position: (time - startTime) * pixelsPerTimeUnit
    const pixelPosition = (adjustedTime - adjustedStartTime) * this.pixelsPerTimeUnit;
    return pixelPosition;
  }

  /**
   * Convert pixel position to time value
   */
  pixelToTime(pixel: number): number {
    // Calculate time: startTime + (pixel / pixelsPerTimeUnit)
    const adjustedStartTime = this.getAdjustedPosition(this.viewportStartTime);
    const timeValue = adjustedStartTime + (pixel / this.pixelsPerTimeUnit);
    
    // Note: This gives adjusted time. Converting back to original time
    // would require inverse collapse calculation - keeping simple for now
    return timeValue;
  }

  /**
   * Convert time value to percentage position
   */
  timeToPercentage(timeValue: number): number {
    const pixelPosition = this.timeToPixel(timeValue);
    return (pixelPosition / this.timelineWidth) * 100;
  }

  /**
   * Convert percentage to time value
   */
  percentageToTime(percentage: number): number {
    const pixelPosition = (percentage / 100) * this.timelineWidth;
    return this.pixelToTime(pixelPosition);
  }

  /**
   * Get pixels per time unit
   */
  getPixelsPerTimeUnit(): number {
    return this.pixelsPerTimeUnit;
  }

  /**
   * Get timeline width in pixels
   */
  getTimelineWidth(): number {
    return this.timelineWidth;
  }

  /**
   * Calculate position for a time range
   */
  calculatePosition(startTime: number, endTime?: number): PositionResult {
    const leftPixel = this.timeToPixel(startTime);
    const rightPixel = this.timeToPixel(endTime || startTime);
    
    const left = (leftPixel / this.timelineWidth) * 100;
    const right = (rightPixel / this.timelineWidth) * 100;
    const width = Math.max(0.1, right - left); // Minimum 0.1% width
    
    const widthPixel = Math.max(1, rightPixel - leftPixel); // Minimum 1px width
    
    // Check visibility with margin
    const visible = left < 110 && (left + width) > -10 && width > 0;

    return {
      left,
      width,
      leftPixel,
      widthPixel,
      visible
    };
  }

  /**
   * Calculate positions for all events
   */
  calculateEventPositions(events: Event[]): EventWithPosition[] {
    return events.map(event => ({
      ...event,
      position: this.calculatePosition(event.time_start || 0, event.time_end || undefined)
    }));
  }

  /**
   * Calculate positions for collapsed segments
   */
  calculateCollapsedSegmentPositions(timeSegments: TimeSegment[]): CollapsedSegmentWithPosition[] {
    return timeSegments
      .filter(segment => segment.collapsedSegment)
      .map(segment => ({
        segment: segment.collapsedSegment!,
        position: this.calculatePosition(segment.collapsedSegment!.startTime, segment.collapsedSegment!.endTime)
      }));
  }

  /**
   * Generate ruler ticks based on events or static intervals
   */
  generateTicks(events: Event[]): Array<{ timeValue: number; position: PositionResult; label: string }> {
    const eventsWithTime = events.filter(e => e.time_start != null);
    
    if (eventsWithTime.length === 0) {
      return this.generateStaticTicks();
    } else {
      return this.generateEventBasedTicks(eventsWithTime);
    }
  }

  private generateStaticTicks(): Array<{ timeValue: number; position: PositionResult; label: string }> {
    const targetTickCount = 15;
    const timeRange = this.viewportEndTime - this.viewportStartTime;
    const rawInterval = timeRange / targetTickCount;
    
    // Round to nice intervals
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)));
    const normalized = rawInterval / magnitude;
    
    let niceInterval;
    if (normalized <= 1) niceInterval = 1;
    else if (normalized <= 2) niceInterval = 2;
    else if (normalized <= 5) niceInterval = 5;
    else niceInterval = 10;
    
    const tickInterval = niceInterval * magnitude;
    const startTick = Math.floor(this.viewportStartTime / tickInterval) * tickInterval;
    const endTick = Math.ceil(this.viewportEndTime / tickInterval) * tickInterval;
    
    const ticks: Array<{ timeValue: number; position: PositionResult; label: string }> = [];
    const dateLabels = new Map<string, number>(); // Track date label usage
    
    // First pass: collect all tick data and count date duplicates
    const basicTicks = [];
    for (let timeValue = startTick; timeValue <= endTick; timeValue += tickInterval) {
      const position = this.calculatePosition(timeValue);
      
      if (position.visible) {
        const fullDate = this.formatDateDisplay(timeValue);
        let dateLabel = fullDate;
        
        try {
          const date = new Date(fullDate);
          dateLabel = date.toLocaleDateString('en-US', {
            day: '2-digit',
            month: 'short',
            year: '2-digit'
          });
        } catch (error) {
          dateLabel = fullDate;
        }
        
        // Count how many times this date appears
        dateLabels.set(dateLabel, (dateLabels.get(dateLabel) || 0) + 1);
        
        basicTicks.push({ timeValue, position, dateLabel, fullDate });
      }
    }
    
    // Second pass: add time for repeated dates
    basicTicks.forEach(tick => {
      const isRepeated = dateLabels.get(tick.dateLabel)! > 1;
      let finalLabel = tick.dateLabel;
      
      if (isRepeated) {
        // Add time on second row for repeated dates
        try {
          const date = new Date(tick.fullDate);
          const timeStr = date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
          finalLabel = `${tick.dateLabel}\n${timeStr}`;
        } catch (error) {
          finalLabel = tick.dateLabel;
        }
      }
      
      ticks.push({
        timeValue: tick.timeValue,
        position: tick.position,
        label: finalLabel
      });
    });
    
    return ticks;
  }

  private generateEventBasedTicks(eventsWithTime: Event[]): Array<{ timeValue: number; position: PositionResult; label: string }> {
    const tickSet = new Set<number>();
    
    // Generate ticks based on event positions
    eventsWithTime.forEach((event) => {
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
    });
    
    // Convert to array and filter by pixel spacing
    const sortedTicks = Array.from(tickSet).sort((a, b) => a - b);
    const filteredTicks: number[] = [];
    const minPixelSpacing = 80;
    
    sortedTicks.forEach(timeValue => {
      const pixelPosition = this.timeToPixel(timeValue);
      
      const tooClose = filteredTicks.some(existingTick => {
        const existingPixelPosition = this.timeToPixel(existingTick);
        return Math.abs(pixelPosition - existingPixelPosition) < minPixelSpacing;
      });
      
      if (!tooClose) {
        filteredTicks.push(timeValue);
      }
    });
    
    // Convert to tick objects and detect repeated date labels
    const ticks: Array<{ timeValue: number; position: PositionResult; label: string }> = [];
    const dateLabels = new Map<string, number>(); // Track date label usage
    
    // First pass: generate basic labels and count duplicates
    const basicTicks = filteredTicks.map(timeValue => {
      const position = this.calculatePosition(timeValue);
      
      if (position.visible) {
        const fullDate = this.formatDateDisplay(timeValue);
        let dateLabel = fullDate;
        
        try {
          const date = new Date(fullDate);
          dateLabel = date.toLocaleDateString('en-US', {
            day: '2-digit',
            month: 'short',
            year: '2-digit'
          });
        } catch (error) {
          dateLabel = fullDate;
        }
        
        // Count how many times this date appears
        dateLabels.set(dateLabel, (dateLabels.get(dateLabel) || 0) + 1);
        
        return { timeValue, position, dateLabel, fullDate };
      }
      return null;
    }).filter(Boolean);
    
    // Second pass: add time for repeated dates
    basicTicks.forEach(tick => {
      if (!tick) return;
      
      const isRepeated = dateLabels.get(tick.dateLabel)! > 1;
      let finalLabel = tick.dateLabel;
      
      if (isRepeated) {
        // Add time on second row for repeated dates
        try {
          const date = new Date(tick.fullDate);
          const timeStr = date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
          finalLabel = `${tick.dateLabel}\n${timeStr}`;
        } catch (error) {
          finalLabel = tick.dateLabel;
        }
      }
      
      ticks.push({
        timeValue: tick.timeValue,
        position: tick.position,
        label: finalLabel
      });
    });
    
    return ticks;
  }

  /**
   * Calculate all timeline elements at once
   */
  calculateAllElements(events: Event[], timeSegments: TimeSegment[]): TimelineElements {
    return {
      events: this.calculateEventPositions(events),
      collapsedSegments: this.calculateCollapsedSegmentPositions(timeSegments),
      ticks: this.generateTicks(events)
    };
  }

  /**
   * Get debug information
   */
  getDebugInfo(): object {
    return {
      viewportStartTime: this.viewportStartTime,
      viewportEndTime: this.viewportEndTime,
      zoomLevel: this.zoomLevel,
      timelineWidth: this.timelineWidth,
      pixelsPerTimeUnit: this.pixelsPerTimeUnit,
      timeRange: this.viewportEndTime - this.viewportStartTime
    };
  }
}