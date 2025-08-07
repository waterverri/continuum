import express, { Response } from 'express';
import { RequestWithUser } from '../index';
import { createUserSupabaseClient } from '../db/supabaseClient';

const router = express.Router();

export interface Tag {
  id: string;
  project_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface DocumentTag {
  document_id: string;
  tag_id: string;
  created_at: string;
}

/**
 * GET /api/tags/:projectId
 * List all tags for a project
 */
router.get('/:projectId', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId } = req.params;
    const userToken = req.token!;
    
    // Create user-authenticated client for RLS
    const userSupabase = createUserSupabaseClient(userToken);
    
    // Verify user has access to this project and get tags
    const { data: tags, error } = await userSupabase
      .from('tags')
      .select('*')
      .eq('project_id', projectId)
      .order('name');
    
    if (error) {
      console.error('Error fetching tags:', error);
      return res.status(500).json({ error: 'Failed to fetch tags' });
    }
    
    res.json({ tags });
  } catch (error) {
    console.error('Error in GET /tags/:projectId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/tags/:projectId
 * Create a new tag
 */
router.post('/:projectId', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId } = req.params;
    const { name, color = '#6366f1' } = req.body;
    const userToken = req.token!;
    
    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Tag name is required' });
    }
    
    // Validate color format (basic hex color validation)
    if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return res.status(400).json({ error: 'Color must be a valid hex color (e.g., #6366f1)' });
    }
    
    // Create user-authenticated client for RLS
    const userSupabase = createUserSupabaseClient(userToken);
    
    // Check if tag with same name already exists in this project
    const { data: existing } = await userSupabase
      .from('tags')
      .select('id')
      .eq('project_id', projectId)
      .eq('name', name.trim())
      .single();
    
    if (existing) {
      return res.status(409).json({ error: 'A tag with this name already exists in this project' });
    }
    
    // Create the tag
    const { data: tag, error } = await userSupabase
      .from('tags')
      .insert({
        project_id: projectId,
        name: name.trim(),
        color: color || '#6366f1'
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating tag:', error);
      return res.status(500).json({ error: 'Failed to create tag' });
    }
    
    res.status(201).json({ tag });
  } catch (error) {
    console.error('Error in POST /tags/:projectId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/tags/:projectId/:tagId
 * Update a tag
 */
router.put('/:projectId/:tagId', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId, tagId } = req.params;
    const { name, color } = req.body;
    const userToken = req.token!;
    
    // Validate at least one field to update
    if (!name && !color) {
      return res.status(400).json({ error: 'At least one field (name or color) must be provided' });
    }
    
    // Validate name if provided
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return res.status(400).json({ error: 'Tag name must be a non-empty string' });
    }
    
    // Validate color if provided
    if (color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return res.status(400).json({ error: 'Color must be a valid hex color (e.g., #6366f1)' });
    }
    
    // Create user-authenticated client for RLS
    const userSupabase = createUserSupabaseClient(userToken);
    
    // If updating name, check for duplicates
    if (name) {
      const { data: existing } = await userSupabase
        .from('tags')
        .select('id')
        .eq('project_id', projectId)
        .eq('name', name.trim())
        .neq('id', tagId)
        .single();
      
      if (existing) {
        return res.status(409).json({ error: 'A tag with this name already exists in this project' });
      }
    }
    
    // Build update object
    const updateData: Partial<Tag> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (color !== undefined) updateData.color = color;
    
    // Update the tag
    const { data: tag, error } = await userSupabase
      .from('tags')
      .update(updateData)
      .eq('id', tagId)
      .eq('project_id', projectId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating tag:', error);
      return res.status(500).json({ error: 'Failed to update tag' });
    }
    
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }
    
    res.json({ tag });
  } catch (error) {
    console.error('Error in PUT /tags/:projectId/:tagId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/tags/:projectId/:tagId
 * Delete a tag (this will also remove all document-tag associations)
 */
router.delete('/:projectId/:tagId', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId, tagId } = req.params;
    const userToken = req.token!;
    
    // Create user-authenticated client for RLS
    const userSupabase = createUserSupabaseClient(userToken);
    
    // Delete the tag (cascading deletes will handle document_tags)
    const { error } = await userSupabase
      .from('tags')
      .delete()
      .eq('id', tagId)
      .eq('project_id', projectId);
    
    if (error) {
      console.error('Error deleting tag:', error);
      return res.status(500).json({ error: 'Failed to delete tag' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error in DELETE /tags/:projectId/:tagId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/tags/:projectId/documents/:documentId
 * Get all tags for a specific document
 */
router.get('/:projectId/documents/:documentId', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId, documentId } = req.params;
    const userToken = req.token!;
    
    // Create user-authenticated client for RLS
    const userSupabase = createUserSupabaseClient(userToken);
    
    // Get tags associated with the document
    const { data: documentTags, error } = await userSupabase
      .from('document_tags')
      .select(`
        tag_id,
        created_at,
        tags!inner(
          id,
          project_id,
          name,
          color,
          created_at
        )
      `)
      .eq('document_id', documentId)
      .eq('tags.project_id', projectId);
    
    if (error) {
      console.error('Error fetching document tags:', error);
      return res.status(500).json({ error: 'Failed to fetch document tags' });
    }
    
    // Transform the data to return just the tags
    const tags = documentTags?.map((dt: any) => dt.tags) || [];
    
    res.json({ tags });
  } catch (error) {
    console.error('Error in GET /tags/:projectId/documents/:documentId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/tags/:projectId/documents/:documentId
 * Add tags to a document
 */
router.post('/:projectId/documents/:documentId', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId, documentId } = req.params;
    const { tagIds } = req.body;
    const userToken = req.token!;
    
    // Validate tagIds
    if (!Array.isArray(tagIds) || tagIds.length === 0) {
      return res.status(400).json({ error: 'tagIds must be a non-empty array' });
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
    
    // Verify all tags exist and belong to the project
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
    
    // Get existing associations to avoid duplicates
    const { data: existing } = await userSupabase
      .from('document_tags')
      .select('tag_id')
      .eq('document_id', documentId)
      .in('tag_id', tagIds);
    
    const existingTagIds = existing?.map((dt: any) => dt.tag_id) || [];
    const newTagIds = tagIds.filter(id => !existingTagIds.includes(id));
    
    if (newTagIds.length === 0) {
      return res.status(409).json({ error: 'All specified tags are already associated with this document' });
    }
    
    // Create new associations
    const associations = newTagIds.map(tagId => ({
      document_id: documentId,
      tag_id: tagId
    }));
    
    const { data: documentTags, error } = await userSupabase
      .from('document_tags')
      .insert(associations)
      .select();
    
    if (error) {
      console.error('Error creating document-tag associations:', error);
      return res.status(500).json({ error: 'Failed to associate tags with document' });
    }
    
    res.status(201).json({ 
      message: `Added ${newTagIds.length} tag(s) to document`,
      associations: documentTags 
    });
  } catch (error) {
    console.error('Error in POST /tags/:projectId/documents/:documentId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/tags/:projectId/documents/:documentId/:tagId
 * Remove a specific tag from a document
 */
router.delete('/:projectId/documents/:documentId/:tagId', async (req: RequestWithUser, res: Response) => {
  try {
    const { projectId, documentId, tagId } = req.params;
    const userToken = req.token!;
    
    // Create user-authenticated client for RLS
    const userSupabase = createUserSupabaseClient(userToken);
    
    // Verify document and tag belong to the project
    const [docResult, tagResult] = await Promise.all([
      userSupabase.from('documents').select('id').eq('id', documentId).eq('project_id', projectId).single(),
      userSupabase.from('tags').select('id').eq('id', tagId).eq('project_id', projectId).single()
    ]);
    
    if (docResult.error || !docResult.data) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    if (tagResult.error || !tagResult.data) {
      return res.status(404).json({ error: 'Tag not found' });
    }
    
    // Remove the association
    const { error } = await userSupabase
      .from('document_tags')
      .delete()
      .eq('document_id', documentId)
      .eq('tag_id', tagId);
    
    if (error) {
      console.error('Error removing document-tag association:', error);
      return res.status(500).json({ error: 'Failed to remove tag from document' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error in DELETE /tags/:projectId/documents/:documentId/:tagId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;