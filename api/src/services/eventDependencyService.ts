import chrono from 'chrono-node';
import { supabase } from '../db/supabaseClient';
import type { EventDependency } from '../types/events';

/**
 * Reusable dependency cycle detector for event dependencies
 */
class DependencyCycleDetector {
  private visited: Set<string> = new Set();
  private currentPath: Set<string> = new Set();

  /**
   * Check if adding a new dependency would create a cycle
   * @param dependentEventId The event that will depend on sourceEventId
   * @param sourceEventId The event that dependentEventId will depend on
   * @param projectId Project ID for scoping the dependency graph
   */
  async wouldCreateCycle(dependentEventId: string, sourceEventId: string, projectId: string): Promise<boolean> {
    // Reset state for new check
    this.visited.clear();
    this.currentPath.clear();

    // If source event depends on dependent event (directly or indirectly), adding this dependency would create a cycle
    return await this.hasPath(sourceEventId, dependentEventId, projectId);
  }

  /**
   * Get all events in a dependency chain starting from eventId, detecting cycles
   * @param startEventId Starting event ID
   * @param projectId Project ID for scoping
   * @param maxDepth Maximum recursion depth to prevent infinite loops (default: 100)
   * @returns Array of event IDs in dependency order, or throws error if cycle detected
   */
  async getDependencyChain(startEventId: string, projectId: string, maxDepth: number = 100): Promise<string[]> {
    this.visited.clear();
    this.currentPath.clear();
    
    const chain: string[] = [];
    await this._buildChainRecursive(startEventId, projectId, chain, maxDepth, 0);
    return chain;
  }

  /**
   * Check if there's a dependency path from startEventId to targetEventId
   */
  private async hasPath(startEventId: string, targetEventId: string, projectId: string): Promise<boolean> {
    if (startEventId === targetEventId) {
      return true;
    }

    if (this.visited.has(startEventId)) {
      return false;
    }

    if (this.currentPath.has(startEventId)) {
      // Cycle detected in current path
      return true;
    }

    this.visited.add(startEventId);
    this.currentPath.add(startEventId);

    // Get all events that startEventId depends on
    const { data: dependencies, error } = await supabase
      .from('event_dependencies')
      .select('source_event_id')
      .eq('dependent_event_id', startEventId);

    if (error) {
      throw new Error(`Failed to check dependency path: ${error.message}`);
    }

    // Recursively check each dependency
    for (const dep of dependencies || []) {
      if (await this.hasPath(dep.source_event_id, targetEventId, projectId)) {
        return true;
      }
    }

    this.currentPath.delete(startEventId);
    return false;
  }

  /**
   * Recursively build dependency chain with cycle detection
   */
  private async _buildChainRecursive(eventId: string, projectId: string, chain: string[], maxDepth: number, currentDepth: number): Promise<void> {
    if (currentDepth > maxDepth) {
      throw new Error(`Maximum dependency depth (${maxDepth}) exceeded - possible cycle detected`);
    }

    if (this.currentPath.has(eventId)) {
      throw new Error(`Dependency cycle detected involving event: ${eventId}`);
    }

    if (this.visited.has(eventId)) {
      return; // Already processed this event
    }

    this.visited.add(eventId);
    this.currentPath.add(eventId);
    chain.push(eventId);

    // Get events that depend on this event
    const { data: dependentEvents, error } = await supabase
      .from('event_dependencies')
      .select('dependent_event_id')
      .eq('source_event_id', eventId);

    if (error) {
      throw new Error(`Failed to get dependent events: ${error.message}`);
    }

    // Recursively process dependent events
    for (const dep of dependentEvents || []) {
      await this._buildChainRecursive(dep.dependent_event_id, projectId, chain, maxDepth, currentDepth + 1);
    }

    this.currentPath.delete(eventId);
  }
}

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
  private cycleDetector = new DependencyCycleDetector();
  
  /**
   * Calculate the actual date for an event based on its dependencies
   */
  async calculateDependentEventDate(eventId: string, projectId: string, baseDateString: string): Promise<{ time_start?: number; time_end?: number }> {
    const baseDate = new Date(baseDateString);
    
    // Get all dependencies for this event, separated by type
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
    
    // Separate start and end dependencies
    const startDeps = dependencies.filter(dep => dep.dependency_type === 'start');
    const endDeps = dependencies.filter(dep => dep.dependency_type === 'end');
    
    // Process start dependencies
    for (const dep of startDeps) {
      if (!dep.is_duration) {
        const sourceEvent = dep.source_event;
        if (!sourceEvent || sourceEvent.time_start == null || sourceEvent.time_end == null) {
          continue; // Skip if source event doesn't have dates
        }
        
        const result = await this.parseNaturalLanguageRule(
          dep.dependency_rule,
          sourceEvent,
          baseDate
        );
        
        if (result.time_start != null) {
          calculatedStart = result.time_start;
        }
      }
    }
    
    // Process end dependencies
    for (const dep of endDeps) {
      if (dep.is_duration) {
        // Duration rule - calculate end based on start time
        if (calculatedStart != null) {
          const durationDays = this.parseDurationRule(dep.dependency_rule);
          calculatedEnd = calculatedStart + durationDays;
        }
      } else {
        // Natural language rule with source event
        const sourceEvent = dep.source_event;
        if (!sourceEvent || sourceEvent.time_start == null || sourceEvent.time_end == null) {
          continue; // Skip if source event doesn't have dates
        }
        
        const result = await this.parseNaturalLanguageRule(
          dep.dependency_rule,
          sourceEvent,
          baseDate
        );
        
        if (result.time_start != null) {
          calculatedEnd = result.time_start; // For end deps, we treat the calculated date as the end time
        }
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
    
    // Always return as time_start - the caller will decide how to use it based on dependency type
    return {
      time_start: daysDiff
    };
  }
  
  /**
   * Parse duration rule and return number of days
   */
  private parseDurationRule(rule: string): number {
    // Handle various duration formats
    const normalizedRule = rule.toLowerCase().trim();
    
    // Match patterns like "3 days", "2 weeks", "1 month", "5 business days"
    const durationMatch = normalizedRule.match(/(\d+)\s*(day|days|week|weeks|month|months|business\s*day|business\s*days)/);
    
    if (!durationMatch) {
      throw new Error(`Invalid duration rule: ${rule}`);
    }
    
    const amount = parseInt(durationMatch[1]);
    const unit = durationMatch[2].replace(/\s+/g, ' '); // Normalize spaces
    
    switch (unit) {
      case 'day':
      case 'days':
        return amount;
      case 'week':
      case 'weeks':
        return amount * 7;
      case 'month':
      case 'months':
        return amount * 30; // Approximate
      case 'business day':
      case 'business days':
        // Convert business days to calendar days (rough approximation)
        return Math.ceil(amount * 1.4); // Accounts for weekends
      default:
        throw new Error(`Unsupported duration unit: ${unit}`);
    }
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
  async recalculateEventDates(eventId: string, projectId: string, baseDate: string): Promise<void> {
    // Use cycle detector to safely recalculate dependency chain
    try {
      const dependencyChain = await this.cycleDetector.getDependencyChain(eventId, projectId);
      
      // Calculate dates for each event in the chain
      for (const chainEventId of dependencyChain) {
        const calculatedDates = await this.calculateDependentEventDate(chainEventId, projectId, baseDate);
        
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
            .eq('id', chainEventId);
          
          if (error) {
            throw new Error(`Failed to update event dates for ${chainEventId}: ${error.message}`);
          }
        }
      }
    } catch (error: any) {
      if (error.message?.includes('cycle detected') || error.message?.includes('Maximum dependency depth')) {
        throw new Error(`Cannot recalculate dates: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Check if creating a dependency would create a cycle
   */
  async wouldCreateCycle(dependentEventId: string, sourceEventId: string, projectId: string): Promise<boolean> {
    return await this.cycleDetector.wouldCreateCycle(dependentEventId, sourceEventId, projectId);
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