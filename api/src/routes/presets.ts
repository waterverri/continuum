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
          .select('id, title, is_composite')
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
      .select('id, title, is_composite')
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

export default router;