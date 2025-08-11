import express from 'express';
import { RequestWithUser } from '../index';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Create Supabase client for server-side operations
const getSupabaseClient = (userToken: string) => {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    },
  });
};

// GET /api/presets/:projectId - Get all presets for a project
router.get('/:projectId', async (req: RequestWithUser, res) => {
  try {
    const { projectId } = req.params;
    const supabase = getSupabaseClient(req.token!);

    const { data: presets, error } = await supabase
      .from('presets')
      .select('id, name, rules, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching presets:', error);
      return res.status(500).json({ error: 'Failed to fetch presets' });
    }

    // Enhance presets with document info
    const enhancedPresets = await Promise.all((presets || []).map(async (preset) => {
      const documentId = preset.rules?.document_id;
      if (documentId) {
        const { data: document } = await supabase
          .from('documents')
          .select('id, title, is_composite, content, components, document_type')
          .eq('id', documentId)
          .single();
        
        return {
          ...preset,
          document
        };
      }
      return preset;
    }));

    res.json(enhancedPresets);
  } catch (error) {
    console.error('Error in GET /presets/:projectId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/presets/:projectId - Create a new preset
router.post('/:projectId', async (req: RequestWithUser, res) => {
  try {
    const { projectId } = req.params;
    const { name, documentId } = req.body;

    if (!name || !documentId) {
      return res.status(400).json({ error: 'Name and documentId are required' });
    }

    const supabase = getSupabaseClient(req.token!);

    // Verify the document exists and belongs to this project
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, title, is_composite, content, components, document_type')
      .eq('id', documentId)
      .eq('project_id', projectId)
      .single();

    if (docError || !document) {
      return res.status(404).json({ error: 'Document not found in this project' });
    }

    // Create the preset with document_id in rules
    const { data: preset, error } = await supabase
      .from('presets')
      .insert({
        project_id: projectId,
        name,
        rules: { document_id: documentId }
      })
      .select('id, name, rules, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'A preset with this name already exists in this project' });
      }
      console.error('Error creating preset:', error);
      return res.status(500).json({ error: 'Failed to create preset' });
    }

    res.status(201).json({
      ...preset,
      document
    });
  } catch (error) {
    console.error('Error in POST /presets/:projectId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/presets/:presetId - Update a preset
router.put('/:presetId', async (req: RequestWithUser, res) => {
  try {
    const { presetId } = req.params;
    const { name, documentId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const supabase = getSupabaseClient(req.token!);

    // Get the existing preset to verify ownership
    const { data: existingPreset, error: fetchError } = await supabase
      .from('presets')
      .select('project_id, rules')
      .eq('id', presetId)
      .single();

    if (fetchError || !existingPreset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    let updateData: any = { name };

    // If documentId is provided, verify it exists in the same project
    if (documentId) {
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('id, title, is_composite, content, components, document_type')
        .eq('id', documentId)
        .eq('project_id', existingPreset.project_id)
        .single();

      if (docError || !document) {
        return res.status(404).json({ error: 'Document not found in this project' });
      }

      updateData.rules = { document_id: documentId };
    }

    // Update the preset
    const { data: preset, error } = await supabase
      .from('presets')
      .update(updateData)
      .eq('id', presetId)
      .select('id, name, rules, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'A preset with this name already exists in this project' });
      }
      console.error('Error updating preset:', error);
      return res.status(500).json({ error: 'Failed to update preset' });
    }

    // Get the document info if available
    let document = null;
    const documentId_final = preset.rules?.document_id;
    if (documentId_final) {
      const { data: docData } = await supabase
        .from('documents')
        .select('id, title, is_composite, content, components, document_type')
        .eq('id', documentId_final)
        .single();
      document = docData;
    }

    res.json({
      ...preset,
      document
    });
  } catch (error) {
    console.error('Error in PUT /presets/:presetId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/presets/:presetId - Delete a preset
router.delete('/:presetId', async (req: RequestWithUser, res) => {
  try {
    const { presetId } = req.params;
    const supabase = getSupabaseClient(req.token!);

    const { error } = await supabase
      .from('presets')
      .delete()
      .eq('id', presetId);

    if (error) {
      console.error('Error deleting preset:', error);
      return res.status(500).json({ error: 'Failed to delete preset' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error in DELETE /presets/:presetId:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/presets/:presetId/overrides - Update component overrides for a preset
router.put('/:presetId/overrides', async (req: RequestWithUser, res) => {
  try {
    const { presetId } = req.params;
    const { overrides } = req.body;

    if (!overrides || typeof overrides !== 'object') {
      return res.status(400).json({ error: 'Overrides must be provided as an object' });
    }

    const supabase = getSupabaseClient(req.token!);

    // Get the existing preset to verify ownership and get current rules
    const { data: existingPreset, error: fetchError } = await supabase
      .from('presets')
      .select('project_id, rules')
      .eq('id', presetId)
      .single();

    if (fetchError || !existingPreset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    // Validate that all override document IDs exist in the same project
    const documentIds = Object.values(overrides).filter(Boolean) as string[];
    if (documentIds.length > 0) {
      const { data: documents, error: docsError } = await supabase
        .from('documents')
        .select('id')
        .eq('project_id', existingPreset.project_id)
        .in('id', documentIds);

      if (docsError || !documents || documents.length !== documentIds.length) {
        return res.status(400).json({ error: 'One or more override documents not found in this project' });
      }
    }

    // Update the preset rules to include component overrides
    const updatedRules = {
      ...existingPreset.rules,
      component_overrides: overrides
    };

    const { data: preset, error } = await supabase
      .from('presets')
      .update({ rules: updatedRules })
      .eq('id', presetId)
      .select('id, name, rules, created_at')
      .single();

    if (error) {
      console.error('Error updating preset overrides:', error);
      return res.status(500).json({ error: 'Failed to update preset overrides' });
    }

    res.json(preset);
  } catch (error) {
    console.error('Error in PUT /presets/:presetId/overrides:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/presets/:presetId/context - Generate context with component overrides applied
router.get('/:presetId/context', async (req: RequestWithUser, res) => {
  try {
    const { presetId } = req.params;
    const supabase = getSupabaseClient(req.token!);

    // Get the preset with document info
    const { data: preset, error: presetError } = await supabase
      .from('presets')
      .select('id, name, rules, project_id')
      .eq('id', presetId)
      .single();

    if (presetError || !preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    const documentId = preset.rules?.document_id;
    if (!documentId) {
      return res.status(400).json({ error: 'Preset has no associated document' });
    }

    // Get the base document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, title, content, is_composite, components')
      .eq('id', documentId)
      .eq('project_id', preset.project_id)
      .single();

    if (docError || !document) {
      return res.status(404).json({ error: 'Preset document not found' });
    }

    // Recursive function to resolve composite documents with overrides
    const resolveWithOverrides = async (
      docContent: string, 
      docComponents: Record<string, string> = {},
      overrides: Record<string, string> = {},
      visited: Set<string> = new Set()
    ): Promise<string> => {
      let resolvedContent = docContent;
      
      // Find all component references in the content
      const componentRegex = /{{([^}]+)}}/g;
      const matches = [...docContent.matchAll(componentRegex)];
      
      for (const match of matches) {
        const componentKey = match[1];
        if (!componentKey) continue;
        
        // Check if this component has an override
        let targetDocId = overrides[componentKey] || docComponents[componentKey];
        
        if (!targetDocId) continue;
        
        // Prevent infinite recursion
        if (visited.has(targetDocId)) {
          console.warn(`Circular reference detected for document ${targetDocId}`);
          continue;
        }
        
        // Get the component document
        const { data: componentDoc, error: componentError } = await supabase
          .from('documents')
          .select('id, content, is_composite, components')
          .eq('id', targetDocId)
          .eq('project_id', preset.project_id)
          .single();
          
        if (componentError || !componentDoc) {
          console.warn(`Component document ${targetDocId} not found`);
          continue;
        }
        
        let componentContent = componentDoc.content || '';
        
        // If the component is also composite, recursively resolve it
        if (componentDoc.is_composite && componentDoc.components) {
          const newVisited = new Set(visited);
          newVisited.add(targetDocId);
          componentContent = await resolveWithOverrides(
            componentContent,
            componentDoc.components,
            overrides, // Pass through the same overrides for nested resolution
            newVisited
          );
        }
        
        // Replace the component reference with the resolved content
        resolvedContent = resolvedContent.replace(match[0], componentContent);
      }
      
      return resolvedContent;
    };

    // Apply overrides and resolve the document
    const overrides = preset.rules.component_overrides || {};
    let resolvedContent = document.content || '';
    
    if (document.is_composite && document.components) {
      resolvedContent = await resolveWithOverrides(
        document.content || '',
        document.components,
        overrides
      );
    }

    res.json({
      preset_id: preset.id,
      preset_name: preset.name,
      base_document_id: document.id,
      base_document_title: document.title,
      content: resolvedContent,
      applied_overrides: Object.keys(overrides).length > 0 ? overrides : null
    });
  } catch (error) {
    console.error('Error in GET /presets/:presetId/context:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;