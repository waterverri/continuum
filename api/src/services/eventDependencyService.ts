import chrono from 'chrono-node';
import { supabase } from '../db/supabaseClient';
import type { EventDependency } from '../types/events';

interface Event {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  time_start?: number;
  time_end?: number;
  display_order: number;
  parent_event_id?: string;
  created_at: string;
}

interface ProjectBaseDate {
  base_date: string;
}

/**
 * Service for managing event dependencies with natural language rules
 */
export class EventDependencyService {
  
  /**
   * Calculate the actual date for an event based on its dependencies
   */
  async calculateDependentEventDate(eventId: string, projectId: string): Promise<{ time_start?: number; time_end?: number }> {
    // Get project base date for converting to project-relative format
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('base_date')
      .eq('id', projectId)
      .single();
    
    if (projectError) {
      throw new Error(`Failed to get project base date: ${projectError.message}`);
    }
    
    if (!project) {
      throw new Error(`Project not found with ID: ${projectId}`);
    }
    
    const baseDate = new Date(project.base_date);
    
    // Get all dependencies for this event
    const { data: dependencies, error: depsError } = await supabase
      .from('event_dependencies')
      .select(`
        *,
        source_event:events!source_event_id(*)
      `)
      .eq('dependent_event_id', eventId);
    
    if (depsError) {
      throw new Error(`Failed to get dependencies: ${depsError.message}`);
    }
    
    if (!dependencies || dependencies.length === 0) {
      return {}; // No dependencies, keep manual dates
    }
    
    let calculatedStart: number | undefined;
    let calculatedEnd: number | undefined;
    
    // Process each dependency
    for (const dep of dependencies) {
      const sourceEvent = dep.source_event;
      
      if (!sourceEvent || sourceEvent.time_start == null || sourceEvent.time_end == null) {
        continue; // Skip if source event doesn't have dates
      }
      
      // Parse the natural language rule
      const result = await this.parseNaturalLanguageRule(
        dep.dependency_rule,
        sourceEvent,
        baseDate
      );
      
      // Apply the calculated dates (could have start, end, or both)
      if (result.time_start != null) {
        calculatedStart = result.time_start;
      }
      if (result.time_end != null) {
        calculatedEnd = result.time_end;
      }
    }
    
    return {
      time_start: calculatedStart,
      time_end: calculatedEnd
    };
  }
  
  /**
   * Parse natural language dependency rule and calculate the resulting date
   */
  private async parseNaturalLanguageRule(
    rule: string, 
    sourceEvent: Event, 
    projectBaseDate: Date
  ): Promise<{ time_start?: number; time_end?: number }> {
    
    // Convert source event project-relative times to actual dates
    const sourceStartDate = new Date(projectBaseDate.getTime() + (sourceEvent.time_start! * 24 * 60 * 60 * 1000));
    const sourceEndDate = new Date(projectBaseDate.getTime() + (sourceEvent.time_end! * 24 * 60 * 60 * 1000));
    
    // Replace placeholders in the rule with actual dates
    let processedRule = rule
      .replace(/\{source\.start\}/g, sourceStartDate.toDateString())
      .replace(/\{source\.end\}/g, sourceEndDate.toDateString());
    
    // Use chrono to parse the natural language date
    const parsedDates = chrono.parse(processedRule);
    
    if (parsedDates.length === 0) {
      throw new Error(`Could not parse dependency rule: "${rule}"`);
    }
    
    const parsedDate = parsedDates[0];
    let resultDate = parsedDate.start.date();
    
    // Handle specific patterns that chrono might not catch perfectly
    if (rule.includes('first monday after')) {
      resultDate = this.getNextWeekday(sourceEndDate, 1); // Monday = 1
    } else if (rule.includes('last friday before')) {
      resultDate = this.getPreviousWeekday(sourceStartDate, 5); // Friday = 5
    } else if (rule.includes('next business day')) {
      resultDate = this.getNextBusinessDay(sourceEndDate);
    } else if (rule.includes('previous business day')) {
      resultDate = this.getPreviousBusinessDay(sourceStartDate);
    }
    
    // Convert back to project-relative format (days since base date)
    const timeDiff = resultDate.getTime() - projectBaseDate.getTime();
    const daysDiff = timeDiff / (24 * 60 * 60 * 1000);
    
    // Determine if this rule affects start time, end time, or both
    const result: { time_start?: number; time_end?: number } = {};
    
    if (rule.includes('starts') || rule.includes('begin')) {
      result.time_start = daysDiff;
    } else if (rule.includes('ends') || rule.includes('finish')) {
      result.time_end = daysDiff;
    } else {
      // Default: assume it's setting the start time
      result.time_start = daysDiff;
    }
    
    return result;
  }
  
  /**
   * Get the next occurrence of a specific weekday after a given date
   */
  private getNextWeekday(date: Date, targetWeekday: number): Date {
    const result = new Date(date);
    const currentWeekday = result.getDay();
    const daysUntilTarget = (targetWeekday - currentWeekday + 7) % 7;
    result.setDate(result.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));
    return result;
  }
  
  /**
   * Get the previous occurrence of a specific weekday before a given date
   */
  private getPreviousWeekday(date: Date, targetWeekday: number): Date {
    const result = new Date(date);
    const currentWeekday = result.getDay();
    const daysSinceTarget = (currentWeekday - targetWeekday + 7) % 7;
    result.setDate(result.getDate() - (daysSinceTarget === 0 ? 7 : daysSinceTarget));
    return result;
  }
  
  /**
   * Get the next business day (Monday-Friday) after a given date
   */
  private getNextBusinessDay(date: Date): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + 1);
    
    // If it's weekend, move to Monday
    if (result.getDay() === 0) { // Sunday
      result.setDate(result.getDate() + 1);
    } else if (result.getDay() === 6) { // Saturday
      result.setDate(result.getDate() + 2);
    }
    
    return result;
  }
  
  /**
   * Get the previous business day (Monday-Friday) before a given date
   */
  private getPreviousBusinessDay(date: Date): Date {
    const result = new Date(date);
    result.setDate(result.getDate() - 1);
    
    // If it's weekend, move to Friday
    if (result.getDay() === 0) { // Sunday
      result.setDate(result.getDate() - 2);
    } else if (result.getDay() === 6) { // Saturday
      result.setDate(result.getDate() - 1);
    }
    
    return result;
  }
  
  /**
   * Create a new event dependency
   */
  async createDependency(
    dependentEventId: string,
    sourceEventId: string, 
    rule: string
  ): Promise<EventDependency> {
    const { data, error } = await supabase
      .from('event_dependencies')
      .insert({
        dependent_event_id: dependentEventId,
        source_event_id: sourceEventId,
        dependency_rule: rule
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create dependency: ${error.message}`);
    }
    
    return data;
  }
  
  /**
   * Update an event's calculated dates and trigger recalculation of dependent events
   */
  async recalculateEventDates(eventId: string, projectId: string): Promise<void> {
    // First, calculate this event's dates based on its dependencies
    const calculatedDates = await this.calculateDependentEventDate(eventId, projectId);
    
    // Update the event if we have calculated dates
    if (calculatedDates.time_start != null || calculatedDates.time_end != null) {
      const updateData: any = {};
      if (calculatedDates.time_start != null) {
        updateData.time_start = calculatedDates.time_start;
      }
      if (calculatedDates.time_end != null) {
        updateData.time_end = calculatedDates.time_end;
      }
      
      const { error } = await supabase
        .from('events')
        .update(updateData)
        .eq('id', eventId);
      
      if (error) {
        throw new Error(`Failed to update event dates: ${error.message}`);
      }
    }
    
    // Find all events that depend on this event and recalculate them
    const { data: dependentEvents, error: depsError } = await supabase
      .from('event_dependencies')
      .select('dependent_event_id')
      .eq('source_event_id', eventId);
    
    if (depsError) {
      throw new Error(`Failed to get dependent events: ${depsError.message}`);
    }
    
    // Recursively recalculate dependent events
    for (const dep of dependentEvents || []) {
      await this.recalculateEventDates(dep.dependent_event_id, projectId);
    }
  }
  
  /**
   * Get all dependencies for an event
   */
  async getEventDependencies(eventId: string): Promise<EventDependency[]> {
    const { data, error } = await supabase
      .from('event_dependencies')
      .select('*')
      .eq('dependent_event_id', eventId);
    
    if (error) {
      throw new Error(`Failed to get dependencies: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Delete an event dependency
   */
  async deleteDependency(dependencyId: string): Promise<void> {
    const { error } = await supabase
      .from('event_dependencies')
      .delete()
      .eq('id', dependencyId);
    
    if (error) {
      throw new Error(`Failed to delete dependency: ${error.message}`);
    }
  }
}

export const eventDependencyService = new EventDependencyService();