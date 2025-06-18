import { Router } from 'express';
import { supabase } from '../db/supabaseClient';

const router = Router();

// == PROJECTS CRUD ENDPOINTS ==
// Note: All these routes are automatically prefixed with '/api/projects'

// GET / - Get all projects for the user
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching projects:', error);
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

// POST / - Create a new project
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const { data, error } = await supabase
    .from('projects')
    .insert([{ name }])
    .select()
    .single();

  if (error) {
    console.error('Error creating project:', error);
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(data);
});

// PUT /:id - Update a project
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const { data, error } = await supabase
    .from('projects')
    .update({ name })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating project:', error);
    if (error.code === 'PGRST204') {
        return res.status(404).json({ error: 'Project not found or you do not have permission to update it.' });
    }
    return res.status(500).json({ error: error.message });
  }
  res.json(data);
});

// DELETE /:id - Delete a project
router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting project:', error);
        return res.status(500).json({ error: error.message });
    }

    res.status(204).send();
});

export default router;