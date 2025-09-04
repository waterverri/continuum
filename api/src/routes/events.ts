import express, { Response } from 'express';
import { RequestWithUser } from '../index';
import { createUserSupabaseClient } from '../db/supabaseClient';
import { eventDependencyService } from '../services/eventDependencyService';

const router = express.Router();

/**
 * POST /api/events/validate-dependency-rule  
 * Validate a natural language dependency rule and check for cycles
 * IMPORTANT: This must come before parameterized routes to avoid conflicts
 */
router.post('/validate-dependency-rule', async (req: RequestWithUser, res: Response) => {
  try {
    const { rule, source_event_start, source_event_end, dependent_event_id, source_event_id, project_id } = req.body;
    
    
    if (!rule || typeof rule !== 'string') {
      return res.status(400).json({ error: 'Rule is required and must be a string' });
    }
    
    // Check for cycles if event IDs are provided
    if (dependent_event_id && source_event_id && project_id) {
      try {
        const wouldCreateCycle = await eventDependencyService.wouldCreateCycle(
          dependent_event_id,
          source_event_id,
          project_id
        );
        
        if (wouldCreateCycle) {
          return res.status(400).json({ 
            error: 'Creating this dependency would create a cycle',
            valid: false,
            cycle_detected: true
          });
        }
      } catch (cycleError) {
        console.error('Error checking for cycles:', cycleError);
        return res.status(500).json({ error: 'Failed to check for dependency cycles' });
      }
    }
    
    // Mock source event dates for validation
    const mockSourceStartDate = new Date(source_event_start || '2024-01-01');
    const mockSourceEndDate = new Date(source_event_end || '2024-01-05');
    
    try {
      // Test the rule parsing using the eventDependencyService logic
      const processedRule = rule
        .replace(/\{source\.start\}/g, mockSourceStartDate.toDateString())
        .replace(/\{source\.end\}/g, mockSourceEndDate.toDateString());
      
      // Try to parse with chrono
      const chrono = require('chrono-node');
      const parsedDates = chrono.parse(processedRule);
      
      if (parsedDates.length === 0) {
        return res.status(400).json({ 
          error: `Could not parse dependency rule: "${rule}"`,
          valid: false 
        });
      }
      
      const parsedDate = parsedDates[0].start.date();
      
      res.json({ 
        valid: true, 
        parsed_date: parsedDate.toISOString(),
        processed_rule: processedRule
      });
      
    } catch (parseError) {
      console.error('Error parsing dependency rule:', parseError);
      return res.status(400).json({ 
        error: `Invalid dependency rule: ${parseError}`,
        valid: false 
      });
    }
    
  } catch (error) {
    console.error('Error in POST /events/validate-dependency-rule:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export interface Event {
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

export interface EventHierarchy {
  parent_event_id: string;
  child_event_id: string;
  created_at: string;
}

export interface EventDocument {
  event_id: string;
  document_id: string;
  created_at: string;
}

/**
 * GET /api/events/:projectId
 * List all events for a project with optional hierarchy information
 */
router.get('/:projectId', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId } = req.params;
    const { include_hierarchy } = req.query;
    const userToken = req.token!;
    
    const userSupabase = createUserSupabaseClient(userToken);
    
    // Base query for events
    let query = userSupabase
      .from('events')
      .select('*')
      .eq('project_id', projectId)
      .order('display_order', { ascending: true });

    const { data: events, error } = await query;
    
    if (error) {
      console.error('Error fetching events:', error);
      return res.status(500).json({ error: 'Failed to fetch events' });
    }

    let hierarchyData = null;
    if (include_hierarchy === 'true') {
      // Fetch hierarchy relationships for this project's events
      const eventIds = events?.map(e => e.id) || [];
      if (eventIds.length > 0) {
        const { data: hierarchy, error: hierarchyError } = await userSupabase
          .from('event_hierarchy')
          .select('*')
          .or(`parent_event_id.in.(${eventIds.join(',')}),child_event_id.in.(${eventIds.join(',')})`);
        
        if (!hierarchyError) {
          hierarchyData = hierarchy;
        }
      }
    }
    
    res.json({ 
      events, 
      hierarchy: hierarchyData 
    });
  } catch (error) {
    console.error('Error in GET /events/:projectId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/events/:projectId/timeline
 * Get events in timeline order with hierarchy information
 */
router.get('/:projectId/timeline', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId } = req.params;
    const userToken = req.token!;
    
    const userSupabase = createUserSupabaseClient(userToken);
    
    // Get all events ordered by time_start, then display_order
    const { data: events, error } = await userSupabase
      .from('events')
      .select('*')
      .eq('project_id', projectId)
      .order('time_start', { ascending: true, nullsFirst: false })
      .order('display_order', { ascending: true });
    
    if (error) {
      console.error('Error fetching timeline events:', error);
      return res.status(500).json({ error: 'Failed to fetch timeline events' });
    }

    // Get hierarchy information
    const eventIds = events?.map(e => e.id) || [];
    let hierarchyData = [];
    
    if (eventIds.length > 0) {
      const { data: hierarchy, error: hierarchyError } = await userSupabase
        .from('event_hierarchy')
        .select('*')
        .or(`parent_event_id.in.(${eventIds.join(',')}),child_event_id.in.(${eventIds.join(',')})`);
      
      if (!hierarchyError) {
        hierarchyData = hierarchy || [];
      }
    }
    
    res.json({ 
      events,
      hierarchy: hierarchyData
    });
  } catch (error) {
    console.error('Error in GET /events/:projectId/timeline:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/events/:projectId/:eventId
 * Get a specific event with related documents and hierarchy
 */
router.get('/:projectId/:eventId', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId, eventId } = req.params;
    const userToken = req.token!;
    
    const userSupabase = createUserSupabaseClient(userToken);
    
    // Get the event
    const { data: event, error } = await userSupabase
      .from('events')
      .select('*')
      .eq('project_id', projectId)
      .eq('id', eventId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Event not found' });
      }
      console.error('Error fetching event:', error);
      return res.status(500).json({ error: 'Failed to fetch event' });
    }

    // Get related documents
    const { data: eventDocuments, error: docError } = await userSupabase
      .from('event_documents')
      .select(`
        document_id,
        created_at,
        documents (*)
      `)
      .eq('event_id', eventId);

    // Get parent and child events
    const { data: parentEvents, error: parentError } = await userSupabase
      .from('event_hierarchy')
      .select('parent_event_id, events!fk_parent_event(*)')
      .eq('child_event_id', eventId);

    const { data: childEvents, error: childError } = await userSupabase
      .from('event_hierarchy')
      .select('child_event_id, events!fk_child_event(*)')
      .eq('parent_event_id', eventId);

    res.json({
      event,
      documents: eventDocuments || [],
      parentEvents: parentEvents || [],
      childEvents: childEvents || []
    });
  } catch (error) {
    console.error('Error in GET /events/:projectId/:eventId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/events/:projectId
 * Create a new event
 */
router.post('/:projectId', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId } = req.params;
    const userToken = req.token!;
    
    const {
      name,
      description,
      time_start,
      time_end,
      display_order,
      parent_event_id
    } = req.body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Event name is required' });
    }

    if (time_start != null && typeof time_start !== 'number') {
      return res.status(400).json({ error: 'time_start must be a number' });
    }

    if (time_end != null && typeof time_end !== 'number') {
      return res.status(400).json({ error: 'time_end must be a number' });
    }

    if (time_start != null && time_end != null && time_end < time_start) {
      return res.status(400).json({ error: 'time_end cannot be before time_start' });
    }
    
    const userSupabase = createUserSupabaseClient(userToken);
    
    // Verify user has access to this project and parent event (if provided)
    if (parent_event_id) {
      const { data: parentEvent, error: parentError } = await userSupabase
        .from('events')
        .select('id')
        .eq('project_id', projectId)
        .eq('id', parent_event_id)
        .single();
      
      if (parentError || !parentEvent) {
        return res.status(400).json({ error: 'Invalid parent event' });
      }
    }
    
    const { data: event, error } = await userSupabase
      .from('events')
      .insert({
        project_id: projectId,
        name: name.trim(),
        description: description?.trim() || null,
        time_start: time_start || null,
        time_end: time_end || null,
        display_order: display_order || 0,
        parent_event_id: parent_event_id || null
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating event:', error);
      return res.status(500).json({ error: 'Failed to create event' });
    }
    
    res.status(201).json({ event });
  } catch (error) {
    console.error('Error in POST /events/:projectId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/events/:projectId/:eventId
 * Update an existing event
 */
router.put('/:projectId/:eventId', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId, eventId } = req.params;
    const userToken = req.token!;
    
    const {
      name,
      description,
      time_start,
      time_end,
      display_order,
      parent_event_id
    } = req.body;

    // Validation
    if (name !== undefined && (!name || typeof name !== 'string' || name.trim().length === 0)) {
      return res.status(400).json({ error: 'Event name cannot be empty' });
    }

    if (time_start !== undefined && time_start != null && typeof time_start !== 'number') {
      return res.status(400).json({ error: 'time_start must be a number' });
    }

    if (time_end !== undefined && time_end != null && typeof time_end !== 'number') {
      return res.status(400).json({ error: 'time_end must be a number' });
    }

    const finalTimeStart = time_start !== undefined ? time_start : null;
    const finalTimeEnd = time_end !== undefined ? time_end : null;
    
    if (finalTimeStart != null && finalTimeEnd != null && finalTimeEnd < finalTimeStart) {
      return res.status(400).json({ error: 'time_end cannot be before time_start' });
    }
    
    const userSupabase = createUserSupabaseClient(userToken);

    // Verify parent event exists (if provided)
    if (parent_event_id) {
      const { data: parentEvent, error: parentError } = await userSupabase
        .from('events')
        .select('id')
        .eq('project_id', projectId)
        .eq('id', parent_event_id)
        .single();
      
      if (parentError || !parentEvent) {
        return res.status(400).json({ error: 'Invalid parent event' });
      }
    }
    
    // Build update object
    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (time_start !== undefined) updates.time_start = time_start || null;
    if (time_end !== undefined) updates.time_end = time_end || null;
    if (display_order !== undefined) updates.display_order = display_order || 0;
    if (parent_event_id !== undefined) updates.parent_event_id = parent_event_id || null;
    
    const { data: event, error } = await userSupabase
      .from('events')
      .update(updates)
      .eq('project_id', projectId)
      .eq('id', eventId)
      .select()
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Event not found' });
      }
      console.error('Error updating event:', error);
      return res.status(500).json({ error: 'Failed to update event' });
    }
    
    res.json({ event });
  } catch (error) {
    console.error('Error in PUT /events/:projectId/:eventId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/events/:projectId/:eventId
 * Delete an event
 */
router.delete('/:projectId/:eventId', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId, eventId } = req.params;
    const userToken = req.token!;
    
    const userSupabase = createUserSupabaseClient(userToken);
    
    const { error } = await userSupabase
      .from('events')
      .delete()
      .eq('project_id', projectId)
      .eq('id', eventId);
    
    if (error) {
      console.error('Error deleting event:', error);
      return res.status(500).json({ error: 'Failed to delete event' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error in DELETE /events/:projectId/:eventId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/events/:projectId/:eventId/documents
 * Associate a document with an event
 */
router.post('/:projectId/:eventId/documents', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId, eventId } = req.params;
    const { document_id } = req.body;
    const userToken = req.token!;

    if (!document_id) {
      return res.status(400).json({ error: 'document_id is required' });
    }
    
    const userSupabase = createUserSupabaseClient(userToken);

    // Verify both event and document exist and belong to the project
    const [eventResult, documentResult] = await Promise.all([
      userSupabase
        .from('events')
        .select('id')
        .eq('project_id', projectId)
        .eq('id', eventId)
        .single(),
      userSupabase
        .from('documents')
        .select('id')
        .eq('project_id', projectId)
        .eq('id', document_id)
        .single()
    ]);

    if (eventResult.error || !eventResult.data) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (documentResult.error || !documentResult.data) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const { data, error } = await userSupabase
      .from('event_documents')
      .insert({
        event_id: eventId,
        document_id: document_id
      })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({ error: 'Document is already associated with this event' });
      }
      console.error('Error associating document with event:', error);
      return res.status(500).json({ error: 'Failed to associate document with event' });
    }
    
    res.status(201).json({ association: data });
  } catch (error) {
    console.error('Error in POST /events/:projectId/:eventId/documents:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/events/:projectId/:eventId/documents/:documentId
 * Remove document association from an event
 */
router.delete('/:projectId/:eventId/documents/:documentId', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId, eventId, documentId } = req.params;
    const userToken = req.token!;
    
    const userSupabase = createUserSupabaseClient(userToken);
    
    // Verify the event belongs to the project (RLS will handle the rest)
    const { data: event, error: eventError } = await userSupabase
      .from('events')
      .select('id')
      .eq('project_id', projectId)
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const { error } = await userSupabase
      .from('event_documents')
      .delete()
      .eq('event_id', eventId)
      .eq('document_id', documentId);
    
    if (error) {
      console.error('Error removing document association:', error);
      return res.status(500).json({ error: 'Failed to remove document association' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error in DELETE /events/:projectId/:eventId/documents/:documentId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Old dependency CRUD endpoints removed - now handled client-side with RLS

/**
 * POST /api/events/:projectId/:eventId/recalculate
 * Manually trigger recalculation of an event's dates based on its dependencies
 */
router.post('/:projectId/:eventId/recalculate', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId, eventId } = req.params;
    const userToken = req.token!;
    
    const userSupabase = createUserSupabaseClient(userToken);
    
    // Verify event exists and belongs to project, and get project base_date
    const [eventResult, projectResult] = await Promise.all([
      userSupabase
        .from('events')
        .select('*')
        .eq('project_id', projectId)
        .eq('id', eventId)
        .single(),
      userSupabase
        .from('projects')
        .select('base_date')
        .eq('id', projectId)
        .single()
    ]);

    if (eventResult.error || !eventResult.data) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (projectResult.error || !projectResult.data) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Recalculate dates with base_date from user context
    await eventDependencyService.recalculateEventDates(eventId, projectId, projectResult.data.base_date);
    
    // Get the updated event
    const { data: updatedEvent, error: updateError } = await userSupabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();
    
    if (updateError) {
      console.error('Error fetching updated event:', updateError);
      return res.status(500).json({ error: 'Failed to fetch updated event' });
    }
    
    res.json({ event: updatedEvent });
  } catch (error: any) {
    console.error('Error in POST /events/:projectId/:eventId/recalculate:', error);
    
    if (error.message?.includes('Could not parse dependency rule')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Complex document evolution endpoints removed - using simplified frontend approach

export default router;