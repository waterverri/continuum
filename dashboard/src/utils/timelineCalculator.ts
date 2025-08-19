import type { Event } from '../api';

export interface TimelineViewport {
  minTime: number;
  maxTime: number;
}

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
  private viewport: TimelineViewport;
  private zoomLevel: number;
  private panOffset: number;
  private timelineWidth: number;
  private getAdjustedPosition: (time: number) => number;
  private formatDateDisplay: (timeValue?: number) => string;

  // Calculated viewport properties
  private baseViewportRange!: number;
  private zoomedViewportRange!: number;
  private zoomedViewportStart!: number;
  private adjustedZoomedViewportStart!: number;
  private adjustedZoomedViewportEnd!: number;
  private adjustedZoomedViewportRange!: number;

  constructor(
    viewport: TimelineViewport,
    zoomLevel: number,
    panOffset: number,
    timelineWidth: number,
    getAdjustedPosition: (time: number) => number,
    formatDateDisplay: (timeValue?: number) => string
  ) {
    this.viewport = viewport;
    this.zoomLevel = zoomLevel;
    this.panOffset = panOffset;
    this.timelineWidth = timelineWidth;
    this.getAdjustedPosition = getAdjustedPosition;
    this.formatDateDisplay = formatDateDisplay;

    // Calculate all viewport properties once
    this.calculateViewportProperties();
  }

  private calculateViewportProperties(): void {
    this.baseViewportRange = this.viewport.maxTime - this.viewport.minTime;
    this.zoomedViewportRange = this.baseViewportRange / this.zoomLevel;
    this.zoomedViewportStart = this.viewport.minTime - (this.panOffset * this.zoomedViewportRange / 100);
    this.adjustedZoomedViewportStart = this.getAdjustedPosition(this.zoomedViewportStart);
    this.adjustedZoomedViewportEnd = this.getAdjustedPosition(this.zoomedViewportStart + this.zoomedViewportRange);
    this.adjustedZoomedViewportRange = this.adjustedZoomedViewportEnd - this.adjustedZoomedViewportStart;
  }

  /**
   * Convert time value to pixel position
   */
  timeToPixel(timeValue: number): number {
    const adjustedTime = this.getAdjustedPosition(timeValue);
    const percentage = ((adjustedTime - this.adjustedZoomedViewportStart) / this.adjustedZoomedViewportRange) * 100;
    return (percentage / 100) * this.timelineWidth;
  }

  /**
   * Convert pixel position to time value
   */
  pixelToTime(pixel: number): number {
    const percentage = (pixel / this.timelineWidth) * 100;
    const adjustedTime = this.adjustedZoomedViewportStart + (percentage / 100) * this.adjustedZoomedViewportRange;
    
    // Convert back from adjusted time to original time
    // This is an approximation - exact inverse depends on collapse implementation
    return adjustedTime;
  }

  /**
   * Convert time value to percentage position
   */
  timeToPercentage(timeValue: number): number {
    const adjustedTime = this.getAdjustedPosition(timeValue);
    return ((adjustedTime - this.adjustedZoomedViewportStart) / this.adjustedZoomedViewportRange) * 100;
  }

  /**
   * Convert percentage to time value
   */
  percentageToTime(percentage: number): number {
    return this.adjustedZoomedViewportStart + (percentage / 100) * this.adjustedZoomedViewportRange;
  }

  /**
   * Get pixels per time unit
   */
  getPixelsPerTimeUnit(): number {
    return this.timelineWidth / this.adjustedZoomedViewportRange;
  }

  /**
   * Calculate position for a time range
   */
  calculatePosition(startTime: number, endTime?: number): PositionResult {
    const start = this.timeToPercentage(startTime);
    const end = this.timeToPercentage(endTime || startTime);
    
    const left = start;
    const width = Math.max(0.5, end - start);
    const leftPixel = this.timeToPixel(startTime);
    const widthPixel = Math.max(0.5 * this.timelineWidth / 100, this.timeToPixel(endTime || startTime) - leftPixel);
    
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
    const rawInterval = this.zoomedViewportRange / targetTickCount;
    
    // Round to nice intervals
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)));
    const normalized = rawInterval / magnitude;
    
    let niceInterval;
    if (normalized <= 1) niceInterval = 1;
    else if (normalized <= 2) niceInterval = 2;
    else if (normalized <= 5) niceInterval = 5;
    else niceInterval = 10;
    
    const tickInterval = niceInterval * magnitude;
    const startTick = Math.floor(this.zoomedViewportStart / tickInterval) * tickInterval;
    const endTick = Math.ceil((this.zoomedViewportStart + this.zoomedViewportRange) / tickInterval) * tickInterval;
    
    const ticks: Array<{ timeValue: number; position: PositionResult; label: string }> = [];
    
    for (let timeValue = startTick; timeValue <= endTick; timeValue += tickInterval) {
      const position = this.calculatePosition(timeValue);
      
      if (position.visible) {
        ticks.push({
          timeValue,
          position,
          label: this.formatDateDisplay(timeValue)
        });
      }
    }
    
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
    
    // Convert to tick objects
    const ticks: Array<{ timeValue: number; position: PositionResult; label: string }> = [];
    
    filteredTicks.forEach(timeValue => {
      const position = this.calculatePosition(timeValue);
      
      if (position.visible) {
        // Format date for ticker display (short format)
        const fullDate = this.formatDateDisplay(timeValue);
        let label = fullDate;
        
        try {
          const date = new Date(fullDate);
          label = date.toLocaleDateString('en-US', {
            day: '2-digit',
            month: 'short',
            year: '2-digit'
          });
        } catch (error) {
          label = fullDate;
        }
        
        ticks.push({
          timeValue,
          position,
          label
        });
      }
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
      zoomLevel: this.zoomLevel,
      panOffset: this.panOffset,
      timelineWidth: this.timelineWidth,
      baseViewportRange: this.baseViewportRange,
      zoomedViewportRange: this.zoomedViewportRange,
      zoomedViewportStart: this.zoomedViewportStart,
      adjustedZoomedViewportRange: this.adjustedZoomedViewportRange,
      pixelsPerTimeUnit: this.getPixelsPerTimeUnit()
    };
  }
}