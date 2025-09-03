import express, { Response } from 'express';
import { RequestWithUser } from '../index';
import { createUserSupabaseClient } from '../db/supabaseClient';
import { 
  validateNoCyclicDependencies, 
  resolveCompositeDocument, 
  Document 
} from '../services/documentService';

const router = express.Router();

/**
 * GET /api/documents/:projectId
 * List all documents for a project
 */
router.get('/:projectId', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId } = req.params;
    const userToken = req.token!;
    
    // Create user-authenticated client for RLS
    const userSupabase = createUserSupabaseClient(userToken);
    
    // Verify user has access to this project via RLS
    const { data: documents, error } = await userSupabase
      .from('documents')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching documents:', error);
      return res.status(500).json({ error: 'Failed to fetch documents' });
    }
    
    res.json({ documents });
  } catch (error) {
    console.error('Error in GET /documents/:projectId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/documents/:projectId/:documentId
 * Get a specific document, with optional resolution for composite documents
 */
router.get('/:projectId/:documentId', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId, documentId } = req.params;
    const { resolve } = req.query; // ?resolve=true to get resolved content
    const userToken = req.token!;
    
    // Create user-authenticated client for RLS
    const userSupabase = createUserSupabaseClient(userToken);
    
    const { data: document, error } = await userSupabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('project_id', projectId)
      .single();
    
    if (error || !document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // If resolve=true and it's a composite document, resolve it
    if (resolve === 'true' && document.is_composite) {
      const { content: resolvedContent, error: resolveError } = await resolveCompositeDocument(
        document as Document,
        projectId,
        userToken
      );
      
      if (resolveError) {
        return res.status(500).json({ error: resolveError });
      }
      
      res.json({ 
        document: { 
          ...document, 
          resolved_content: resolvedContent 
        } 
      });
    } else {
      res.json({ document });
    }
  } catch (error) {
    console.error('Error in GET /documents/:projectId/:documentId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/documents/:projectId
 * Create a new document with validation for composite documents
 */
router.post('/:projectId', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId } = req.params;
    const { 
      title, 
      content, 
      group_id, 
      document_type, 
      is_composite, 
      is_prompt,
      ai_model,
      components 
    } = req.body;
    const userToken = req.token!;
    
    // Validate required fields
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    // If composite, validate components and check for cycles
    if (is_composite) {
      if (!components || typeof components !== 'object') {
        return res.status(400).json({ 
          error: 'Components object is required for composite documents' 
        });
      }
      
      // For new documents, we need to create a temporary ID for cycle checking
      const tempId = 'temp-' + Date.now();
      const { valid, error: validationError } = await validateNoCyclicDependencies(
        tempId,
        components,
        projectId,
        userToken
      );
      
      if (!valid) {
        return res.status(400).json({ error: validationError });
      }
    }
    
    // Create user-authenticated client for RLS
    const userSupabase = createUserSupabaseClient(userToken);
    
    // Create the document
    const { data: document, error } = await userSupabase
      .from('documents')
      .insert({
        project_id: projectId,
        title,
        content,
        group_id,
        document_type,
        is_composite: is_composite || false,
        is_prompt: is_prompt || false,
        ai_model: is_prompt ? ai_model : null,
        components: is_composite ? components : null
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating document:', error);
      return res.status(500).json({ error: 'Failed to create document' });
    }
    
    // Create initial history entry for document creation
    try {
      const userId = req.user?.id;
      if (userId && document) {
        await userSupabase.rpc('create_document_history_entry', {
          p_document_id: document.id,
          p_change_type: 'create',
          p_change_description: `Document "${title}" created`,
          p_user_id: userId
        });
      }
    } catch (historyError) {
      console.error('Error creating initial history entry:', historyError);
      // Don't fail the creation if history creation fails
    }
    
    res.status(201).json({ document });
  } catch (error) {
    console.error('Error in POST /documents/:projectId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/documents/:projectId/:documentId
 * Update a document with validation for composite documents
 */
router.put('/:projectId/:documentId', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId, documentId } = req.params;
    const { 
      title, 
      content, 
      group_id, 
      document_type, 
      is_composite, 
      is_prompt,
      ai_model,
      components,
      event_id
    } = req.body;
    const userToken = req.token!;
    
    // If updating to composite or updating components, validate for cycles
    if (is_composite && components) {
      const { valid, error: validationError } = await validateNoCyclicDependencies(
        documentId,
        components,
        projectId,
        userToken
      );
      
      if (!valid) {
        return res.status(400).json({ error: validationError });
      }
    }
    
    // Create user-authenticated client for RLS
    const userSupabase = createUserSupabaseClient(userToken);
    
    // First get the current document state to compare changes
    const { data: currentDoc, error: currentError } = await userSupabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('project_id', projectId)
      .single();
    
    if (currentError || !currentDoc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Create history entry before update
    try {
      const userId = req.user?.id;
      if (userId) {
        let changeType = 'update_content';
        let changeDescription = 'Document updated';
        
        // Determine specific change type
        if (title !== undefined && title !== currentDoc.title) {
          changeType = 'update_title';
          changeDescription = `Title changed from "${currentDoc.title}" to "${title}"`;
        } else if (document_type !== undefined && document_type !== currentDoc.document_type) {
          changeType = 'update_type';
          changeDescription = `Type changed from "${currentDoc.document_type || 'none'}" to "${document_type || 'none'}"`;
        } else if (group_id !== undefined && group_id !== currentDoc.group_id) {
          changeType = 'move_group';
          changeDescription = `Moved to different group`;
        } else if (is_composite !== undefined && JSON.stringify(components) !== JSON.stringify(currentDoc.components)) {
          changeType = 'update_components';
          changeDescription = 'Component structure updated';
        }
        
        await userSupabase.rpc('create_document_history_entry', {
          p_document_id: documentId,
          p_change_type: changeType,
          p_change_description: changeDescription,
          p_user_id: userId
        });
      }
    } catch (historyError) {
      console.error('Error creating history entry:', historyError);
      // Don't fail the update if history creation fails
    }
    
    // Update the document
    const { data: document, error } = await userSupabase
      .from('documents')
      .update({
        title,
        content,
        group_id,
        document_type,
        is_composite: is_composite || false,
        is_prompt: is_prompt || false,
        ai_model: is_prompt ? ai_model : null,
        components: is_composite ? components : null,
        event_id
      })
      .eq('id', documentId)
      .eq('project_id', projectId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating document:', error);
      return res.status(500).json({ error: 'Failed to update document' });
    }
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json({ document });
  } catch (error) {
    console.error('Error in PUT /documents/:projectId/:documentId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/documents/:projectId/:documentId
 * Delete a document
 */
router.delete('/:projectId/:documentId', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId, documentId } = req.params;
    const userToken = req.token!;
    
    // Create user-authenticated client for RLS
    const userSupabase = createUserSupabaseClient(userToken);
    
    // Get document info before deletion for history entry
    const { data: documentToDelete } = await userSupabase
      .from('documents')
      .select('title')
      .eq('id', documentId)
      .eq('project_id', projectId)
      .single();
    
    // Create history entry before deletion
    try {
      const userId = req.user?.id;
      if (userId && documentToDelete) {
        await userSupabase.rpc('create_document_history_entry', {
          p_document_id: documentId,
          p_change_type: 'delete',
          p_change_description: `Document "${documentToDelete.title}" deleted`,
          p_user_id: userId
        });
      }
    } catch (historyError) {
      console.error('Error creating deletion history entry:', historyError);
      // Don't fail the deletion if history creation fails
    }
    
    const { error } = await userSupabase
      .from('documents')
      .delete()
      .eq('id', documentId)
      .eq('project_id', projectId);
    
    if (error) {
      console.error('Error deleting document:', error);
      return res.status(500).json({ error: 'Failed to delete document' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error in DELETE /documents/:projectId/:documentId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/documents/:projectId/groups
 * List all document groups for a project
 */
router.get('/:projectId/groups', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId } = req.params;
    const userToken = req.token!;
    
    // Create user-authenticated client for RLS
    const userSupabase = createUserSupabaseClient(userToken);
    
    // Get all documents with group_id for this project
    const { data: documents, error } = await userSupabase
      .from('documents')
      .select('*')
      .eq('project_id', projectId)
      .not('group_id', 'is', null)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching grouped documents:', error);
      return res.status(500).json({ error: 'Failed to fetch document groups' });
    }
    
    // Group documents by group_id
    const groupMap = new Map<string, {
      groupId: string;
      documents: Document[];
      representativeDoc: Document;
    }>();
    
    documents.forEach((doc: Document) => {
      if (!groupMap.has(doc.group_id!)) {
        groupMap.set(doc.group_id!, {
          groupId: doc.group_id!,
          documents: [],
          representativeDoc: doc
        });
      }
      
      const group = groupMap.get(doc.group_id!)!;
      group.documents.push(doc);
      
      // Update representative doc (prefer document where id = group_id)
      if (doc.id === doc.group_id) {
        group.representativeDoc = doc;
      }
    });
    
    const groups = Array.from(groupMap.values());
    res.json({ groups });
  } catch (error) {
    console.error('Error in GET /documents/:projectId/groups:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/documents/:projectId/groups/:groupId
 * Get all documents in a specific group
 */
router.get('/:projectId/groups/:groupId', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId, groupId } = req.params;
    const userToken = req.token!;
    
    // Create user-authenticated client for RLS
    const userSupabase = createUserSupabaseClient(userToken);
    
    const { data: documents, error } = await userSupabase
      .from('documents')
      .select('*')
      .eq('project_id', projectId)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching group documents:', error);
      return res.status(500).json({ error: 'Failed to fetch group documents' });
    }
    
    if (documents.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    // Find representative document (document where id = group_id)
    const representativeDoc = documents.find(doc => doc.id === groupId) || documents[0];
    
    res.json({ 
      groupId,
      documents, 
      representativeDoc,
      totalCount: documents.length
    });
  } catch (error) {
    console.error('Error in GET /documents/:projectId/groups/:groupId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/documents/:projectId/groups/:groupId/resolve
 * Get the representative document content for a group (used for composite document resolution)
 */
router.get('/:projectId/groups/:groupId/resolve', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId, groupId } = req.params;
    const { preferredType } = req.query; // Optional: prefer specific document type
    const userToken = req.token!;
    
    // Create user-authenticated client for RLS
    const userSupabase = createUserSupabaseClient(userToken);
    
    const { data: documents, error } = await userSupabase
      .from('documents')
      .select('*')
      .eq('project_id', projectId)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching group documents for resolution:', error);
      return res.status(500).json({ error: 'Failed to resolve group' });
    }
    
    if (documents.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    let selectedDoc: Document;
    
    // If preferredType is specified, try to find that type first
    if (preferredType && typeof preferredType === 'string') {
      selectedDoc = documents.find(doc => doc.document_type === preferredType) || documents[0];
    } else {
      // Default selection logic: prefer document where id = group_id
      selectedDoc = documents.find(doc => doc.id === groupId) || documents[0];
    }
    
    // If selected document is composite, resolve it
    if (selectedDoc.is_composite) {
      try {
        const { content: resolvedContent } = await resolveCompositeDocument(
          selectedDoc as Document,
          projectId,
          userToken
        );
        res.json({ 
          document: selectedDoc,
          resolvedContent,
          groupId,
          selectedFromGroup: true,
          availableTypes: [...new Set(documents.map(d => d.document_type).filter(Boolean))]
        });
      } catch (resolveError) {
        console.error('Error resolving composite document in group:', resolveError);
        res.json({ 
          document: selectedDoc,
          resolvedContent: selectedDoc.content,
          groupId,
          selectedFromGroup: true,
          resolutionError: 'Failed to resolve composite content',
          availableTypes: [...new Set(documents.map(d => d.document_type).filter(Boolean))]
        });
      }
    } else {
      res.json({ 
        document: selectedDoc,
        resolvedContent: selectedDoc.content,
        groupId,
        selectedFromGroup: true,
        availableTypes: [...new Set(documents.map(d => d.document_type).filter(Boolean))]
      });
    }
  } catch (error) {
    console.error('Error in GET /documents/:projectId/groups/:groupId/resolve:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/documents/:documentId/tags
 * Update all tags for a document (replaces existing tags)
 * Note: This endpoint exists for completeness but frontend uses individual add/remove operations
 */
router.put('/:documentId/tags', async (req: RequestWithUser, res: Response) => {
  try {
    const { documentId } = req.params;
    const { tagIds } = req.body;
    const userToken = req.token!;
    
    // Validate tagIds
    if (!Array.isArray(tagIds)) {
      return res.status(400).json({ error: 'tagIds must be an array' });
    }
    
    // Create user-authenticated client for RLS
    const userSupabase = createUserSupabaseClient(userToken);
    
    // Verify document exists and get its project_id
    const { data: document, error: docError } = await userSupabase
      .from('documents')
      .select('id, project_id')
      .eq('id', documentId)
      .single();
    
    if (docError || !document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const { project_id: projectId } = document;
    
    // If tagIds is not empty, verify all tags exist and belong to the project
    if (tagIds.length > 0) {
      const { data: tags, error: tagsError } = await userSupabase
        .from('tags')
        .select('id')
        .eq('project_id', projectId)
        .in('id', tagIds);
      
      if (tagsError) {
        console.error('Error verifying tags:', tagsError);
        return res.status(500).json({ error: 'Failed to verify tags' });
      }
      
      if (!tags || tags.length !== tagIds.length) {
        return res.status(400).json({ error: 'One or more tags not found or do not belong to this project' });
      }
    }
    
    // Remove all existing tags for this document
    const { error: deleteError } = await userSupabase
      .from('document_tags')
      .delete()
      .eq('document_id', documentId);
    
    if (deleteError) {
      console.error('Error removing existing tags:', deleteError);
      return res.status(500).json({ error: 'Failed to remove existing tags' });
    }
    
    // Add new tag associations if any
    if (tagIds.length > 0) {
      const associations = tagIds.map(tagId => ({
        document_id: documentId,
        tag_id: tagId
      }));
      
      const { error: insertError } = await userSupabase
        .from('document_tags')
        .insert(associations);
      
      if (insertError) {
        console.error('Error creating document-tag associations:', insertError);
        return res.status(500).json({ error: 'Failed to update document tags' });
      }
    }
    
    res.json({ 
      message: `Document tags updated successfully`,
      tagCount: tagIds.length
    });
  } catch (error) {
    console.error('Error in PUT /documents/:documentId/tags:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/documents/:projectId/:documentId/history
 * Get the complete history for a document
 */
router.get('/:projectId/:documentId/history', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId, documentId } = req.params;
    const { limit = '50', offset = '0' } = req.query;
    const userToken = req.token!;
    
    // Create user-authenticated client for RLS
    const userSupabase = createUserSupabaseClient(userToken);
    
    // Verify document exists and user has access
    const { data: document, error: docError } = await userSupabase
      .from('documents')
      .select('id, title')
      .eq('id', documentId)
      .eq('project_id', projectId)
      .single();
    
    if (docError || !document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Get document history
    const { data: history, error: historyError } = await userSupabase
      .from('document_history')
      .select(`
        id,
        title,
        content,
        document_type,
        group_id,
        is_composite,
        components,
        event_id,
        change_type,
        change_description,
        user_id,
        created_at,
        previous_version_id
      `)
      .eq('document_id', documentId)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string))
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);
    
    if (historyError) {
      console.error('Error fetching document history:', historyError);
      return res.status(500).json({ error: 'Failed to fetch document history' });
    }
    
    // Get total count for pagination
    const { count, error: countError } = await userSupabase
      .from('document_history')
      .select('id', { count: 'exact' })
      .eq('document_id', documentId)
      .eq('project_id', projectId);
    
    if (countError) {
      console.error('Error counting document history:', countError);
    }
    
    res.json({
      document: {
        id: document.id,
        title: document.title
      },
      history: history || [],
      pagination: {
        total: count || 0,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });
  } catch (error) {
    console.error('Error in GET /documents/:projectId/:documentId/history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/documents/:projectId/:documentId/history
 * Create a history entry for the current document state
 */
router.post('/:projectId/:documentId/history', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId, documentId } = req.params;
    const { change_type, change_description } = req.body;
    const userToken = req.token!;
    const userId = req.user?.id;
    
    if (!change_type) {
      return res.status(400).json({ error: 'change_type is required' });
    }
    
    // Valid change types
    const validChangeTypes = [
      'create', 'update_content', 'update_title', 'update_type', 
      'update_components', 'move_group', 'link_event', 'unlink_event', 'delete'
    ];
    
    if (!validChangeTypes.includes(change_type)) {
      return res.status(400).json({ 
        error: `Invalid change_type. Must be one of: ${validChangeTypes.join(', ')}` 
      });
    }
    
    // Create user-authenticated client for RLS
    const userSupabase = createUserSupabaseClient(userToken);
    
    // Verify document exists and user has access
    const { data: document, error: docError } = await userSupabase
      .from('documents')
      .select('id')
      .eq('id', documentId)
      .eq('project_id', projectId)
      .single();
    
    if (docError || !document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Call the database function to create history entry
    const { data, error } = await userSupabase
      .rpc('create_document_history_entry', {
        p_document_id: documentId,
        p_change_type: change_type,
        p_change_description: change_description || null,
        p_user_id: userId
      });
    
    if (error) {
      console.error('Error creating document history entry:', error);
      return res.status(500).json({ error: 'Failed to create history entry' });
    }
    
    res.status(201).json({
      message: 'History entry created successfully',
      historyId: data
    });
  } catch (error) {
    console.error('Error in POST /documents/:projectId/:documentId/history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/documents/:projectId/:documentId/rollback/:historyId
 * Rollback a document to a specific history version
 */
router.post('/:projectId/:documentId/rollback/:historyId', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId, documentId, historyId } = req.params;
    const userToken = req.token!;
    const userId = req.user?.id;
    
    // Create user-authenticated client for RLS
    const userSupabase = createUserSupabaseClient(userToken);
    
    // Verify document exists and user has access
    const { data: document, error: docError } = await userSupabase
      .from('documents')
      .select('id, title')
      .eq('id', documentId)
      .eq('project_id', projectId)
      .single();
    
    if (docError || !document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Verify history entry exists and belongs to this document
    const { data: historyEntry, error: historyError } = await userSupabase
      .from('document_history')
      .select('id, created_at, change_description')
      .eq('id', historyId)
      .eq('document_id', documentId)
      .eq('project_id', projectId)
      .single();
    
    if (historyError || !historyEntry) {
      return res.status(404).json({ error: 'History entry not found' });
    }
    
    // Call the database function to rollback
    const { data, error } = await userSupabase
      .rpc('rollback_document_to_version', {
        p_document_id: documentId,
        p_history_id: historyId,
        p_user_id: userId
      });
    
    if (error) {
      console.error('Error rolling back document:', error);
      return res.status(500).json({ error: 'Failed to rollback document' });
    }
    
    // Get the updated document to return
    const { data: updatedDocument, error: fetchError } = await userSupabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('project_id', projectId)
      .single();
    
    if (fetchError || !updatedDocument) {
      console.error('Error fetching updated document:', fetchError);
      return res.status(500).json({ error: 'Rollback completed but failed to fetch updated document' });
    }
    
    res.json({
      message: 'Document rolled back successfully',
      rolledBackFrom: historyEntry.created_at,
      document: updatedDocument
    });
  } catch (error) {
    console.error('Error in POST /documents/:projectId/:documentId/rollback/:historyId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/documents/:projectId/:documentId/history/:historyId
 * Get details of a specific history entry
 */
router.get('/:projectId/:documentId/history/:historyId', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId, documentId, historyId } = req.params;
    const userToken = req.token!;
    
    // Create user-authenticated client for RLS
    const userSupabase = createUserSupabaseClient(userToken);
    
    // Get the specific history entry
    const { data: historyEntry, error } = await userSupabase
      .from('document_history')
      .select('*')
      .eq('id', historyId)
      .eq('document_id', documentId)
      .eq('project_id', projectId)
      .single();
    
    if (error || !historyEntry) {
      return res.status(404).json({ error: 'History entry not found' });
    }
    
    res.json({ historyEntry });
  } catch (error) {
    console.error('Error in GET /documents/:projectId/:documentId/history/:historyId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/documents/:projectId/:documentId/save-response
 * Save LLM response and metadata for a promptable document
 */
router.post('/:projectId/:documentId/save-response', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId, documentId } = req.params;
    const { 
      response, 
      provider_id, 
      model_id, 
      max_tokens, 
      cost_estimate 
    } = req.body;
    const userToken = req.token!;
    
    // Validate required fields
    if (!response || !provider_id || !model_id) {
      return res.status(400).json({ 
        error: 'response, provider_id, and model_id are required' 
      });
    }
    
    // Create user-authenticated client for RLS
    const userSupabase = createUserSupabaseClient(userToken);
    
    // Verify document exists, is prompt-enabled, and user has access
    const { data: document, error: docError } = await userSupabase
      .from('documents')
      .select('id, title, is_prompt')
      .eq('id', documentId)
      .eq('project_id', projectId)
      .single();
    
    if (docError || !document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    if (!document.is_prompt) {
      return res.status(400).json({ 
        error: 'Document is not configured for AI prompts' 
      });
    }
    
    // Update document with LLM response data
    const { data: updatedDocument, error } = await userSupabase
      .from('documents')
      .update({
        last_ai_response: response,
        last_ai_provider_id: provider_id,
        last_ai_model_id: model_id,
        last_ai_max_tokens: max_tokens,
        last_ai_cost_estimate: cost_estimate,
        last_ai_response_timestamp: new Date().toISOString()
      })
      .eq('id', documentId)
      .eq('project_id', projectId)
      .select()
      .single();
    
    if (error) {
      console.error('Error saving LLM response:', error);
      return res.status(500).json({ error: 'Failed to save LLM response' });
    }
    
    // Create history entry for response save
    try {
      const userId = req.user?.id;
      if (userId) {
        await userSupabase.rpc('create_document_history_entry', {
          p_document_id: documentId,
          p_change_type: 'ai_response',
          p_change_description: `AI response saved (${provider_id}/${model_id})`,
          p_user_id: userId
        });
      }
    } catch (historyError) {
      console.error('Error creating AI response history entry:', historyError);
      // Don't fail the save if history creation fails
    }
    
    res.json({ 
      message: 'LLM response saved successfully',
      document: updatedDocument
    });
  } catch (error) {
    console.error('Error in POST /documents/:projectId/:documentId/save-response:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;