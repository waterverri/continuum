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
    
    // Create user-authenticated client for RLS
    const userSupabase = createUserSupabaseClient(userToken);
    
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
    const userToken = req.token!;
    
    // Create user-authenticated client for RLS
    const userSupabase = createUserSupabaseClient(userToken);
    
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

export default router;