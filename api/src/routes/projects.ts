import { Router, Response } from 'express';
import { Request as JWTRequest } from 'express-jwt'; // Use the typed Request
import { supabase } from '../db/supabaseClient';

const router = Router();

// == PROJECTS CRUD ENDPOINTS ==

// GET / - Get all projects for the user
// We use JWTRequest to tell TypeScript that req.auth exists and has a specific shape.
router.get('/', async (req: JWTRequest, res: Response) => {
    // RLS policy automatically uses the user ID from the JWT attached by the middleware.
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
router.post('/', async (req: JWTRequest, res: Response) => {
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
router.put('/:id', async (req: JWTRequest, res: Response) => {
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
router.delete('/:id', async (req: JWTRequest, res: Response) => {
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