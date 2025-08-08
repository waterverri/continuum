import express, { Response } from 'express';
import { RequestWithUser } from '../index';
import { createUserSupabaseClient } from '../db/supabaseClient';

const router = express.Router();

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

    if (time_start != null && (typeof time_start !== 'number' || time_start < 0)) {
      return res.status(400).json({ error: 'time_start must be a non-negative number' });
    }

    if (time_end != null && (typeof time_end !== 'number' || time_end < 0)) {
      return res.status(400).json({ error: 'time_end must be a non-negative number' });
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

    if (time_start !== undefined && time_start != null && (typeof time_start !== 'number' || time_start < 0)) {
      return res.status(400).json({ error: 'time_start must be a non-negative number' });
    }

    if (time_end !== undefined && time_end != null && (typeof time_end !== 'number' || time_end < 0)) {
      return res.status(400).json({ error: 'time_end must be a non-negative number' });
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
 * GET /api/events/:projectId/:eventId/document-versions/:groupId
 * Get all document versions for a specific group at or before this event
 */
router.get('/:projectId/:eventId/document-versions/:groupId', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId, eventId, groupId } = req.params;
    const userToken = req.token!;
    
    const userSupabase = createUserSupabaseClient(userToken);
    
    // Verify event exists and user has access
    const { data: event, error: eventError } = await userSupabase
      .from('events')
      .select('*')
      .eq('project_id', projectId)
      .eq('id', eventId)
      .single();
    
    if (eventError || !event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get all documents in the group
    const { data: allGroupDocs, error: groupError } = await userSupabase
      .from('documents')
      .select('*')
      .eq('project_id', projectId)
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });

    if (groupError) {
      console.error('Error fetching group documents:', groupError);
      return res.status(500).json({ error: 'Failed to fetch group documents' });
    }

    // Filter documents that are applicable at this event time
    // For now, we'll use a simple approach: documents without event_id are base versions,
    // documents with event_id that are <= this event's time are versions for that event
    const applicableVersions = allGroupDocs?.filter(doc => {
      if (!doc.event_id) return true; // Base document always applicable
      
      // If the document has an event_id, we need to check if that event occurs before or at our target event
      // For now, we'll do a simple comparison - in production you might want timeline-based comparison
      return doc.event_id === eventId;
    }) || [];

    res.json({ 
      event,
      groupId,
      versions: applicableVersions
    });
  } catch (error) {
    console.error('Error in GET /events/:projectId/:eventId/document-versions/:groupId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/events/:projectId/:eventId/document-versions
 * Create a new document version for a specific event
 */
router.post('/:projectId/:eventId/document-versions', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId, eventId } = req.params;
    const { source_document_id, title, content, document_type } = req.body;
    const userToken = req.token!;

    // Validation
    if (!source_document_id) {
      return res.status(400).json({ error: 'source_document_id is required' });
    }
    
    const userSupabase = createUserSupabaseClient(userToken);

    // Verify event exists and user has access
    const { data: event, error: eventError } = await userSupabase
      .from('events')
      .select('*')
      .eq('project_id', projectId)
      .eq('id', eventId)
      .single();
    
    if (eventError || !event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get the source document to inherit group_id and other properties
    const { data: sourceDoc, error: sourceError } = await userSupabase
      .from('documents')
      .select('*')
      .eq('project_id', projectId)
      .eq('id', source_document_id)
      .single();

    if (sourceError || !sourceDoc) {
      return res.status(404).json({ error: 'Source document not found' });
    }

    // Create the new version
    const { data: newVersion, error: createError } = await userSupabase
      .from('documents')
      .insert({
        project_id: projectId,
        group_id: sourceDoc.group_id,
        title: title || `${sourceDoc.title || 'Document'} (${event.name})`,
        content: content || sourceDoc.content,
        document_type: document_type || sourceDoc.document_type,
        event_id: eventId,
        is_composite: false, // Event versions are typically not composite
        components: null
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating document version:', createError);
      return res.status(500).json({ error: 'Failed to create document version' });
    }

    res.status(201).json({ 
      version: newVersion,
      source_document: sourceDoc,
      event
    });
  } catch (error) {
    console.error('Error in POST /events/:projectId/:eventId/document-versions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/events/:projectId/document-evolution/:groupId
 * Get the evolution timeline of a document group across all events
 */
router.get('/:projectId/document-evolution/:groupId', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId, groupId } = req.params;
    const userToken = req.token!;
    
    const userSupabase = createUserSupabaseClient(userToken);

    // Get all documents in the group
    const { data: groupDocs, error: groupError } = await userSupabase
      .from('documents')
      .select(`
        *,
        events (
          id,
          name,
          time_start,
          time_end,
          display_order
        )
      `)
      .eq('project_id', projectId)
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });

    if (groupError) {
      console.error('Error fetching document evolution:', groupError);
      return res.status(500).json({ error: 'Failed to fetch document evolution' });
    }

    // Separate base documents (no event_id) from event-specific versions
    const baseDocuments = groupDocs?.filter(doc => !doc.event_id) || [];
    const eventVersions = groupDocs?.filter(doc => doc.event_id) || [];

    // Group by document type
    const evolutionByType: Record<string, { base: any | null, versions: any[] }> = {};
    
    [...baseDocuments, ...eventVersions].forEach(doc => {
      const docType = doc.document_type || 'default';
      if (!evolutionByType[docType]) {
        evolutionByType[docType] = {
          base: null,
          versions: []
        };
      }

      if (!doc.event_id) {
        evolutionByType[docType].base = doc;
      } else {
        evolutionByType[docType].versions.push(doc);
      }
    });

    // Sort versions by event time/order
    Object.values(evolutionByType).forEach((typeData) => {
      typeData.versions.sort((a: any, b: any) => {
        const aEvent = a.events;
        const bEvent = b.events;
        
        // Sort by time_start, then by display_order
        if (aEvent?.time_start !== bEvent?.time_start) {
          return (aEvent?.time_start || 0) - (bEvent?.time_start || 0);
        }
        return (aEvent?.display_order || 0) - (bEvent?.display_order || 0);
      });
    });

    res.json({
      groupId,
      evolution: evolutionByType,
      totalDocuments: groupDocs?.length || 0
    });
  } catch (error) {
    console.error('Error in GET /events/:projectId/document-evolution/:groupId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;