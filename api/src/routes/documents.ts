import express, { Response } from 'express';
import { RequestWithUser } from '../index';
import { supabase } from '../db/supabaseClient';
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
    
    // Verify user has access to this project via RLS
    const { data: documents, error } = await supabase
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
    
    const { data: document, error } = await supabase
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
    
    // Create the document
    const { data: document, error } = await supabase
      .from('documents')
      .insert({
        project_id: projectId,
        title,
        content,
        group_id,
        document_type,
        is_composite: is_composite || false,
        components: is_composite ? components : null
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating document:', error);
      return res.status(500).json({ error: 'Failed to create document' });
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
      components 
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
    
    // Update the document
    const { data: document, error } = await supabase
      .from('documents')
      .update({
        title,
        content,
        group_id,
        document_type,
        is_composite: is_composite || false,
        components: is_composite ? components : null
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
    
    const { error } = await supabase
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

export default router;