import express from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { RequestWithUser } from '../index'; // Import our custom request type

const router = express.Router();

// Helper function to create a Supabase client scoped to the user
const getSupabaseClientForUser = (req: RequestWithUser): SupabaseClient | null => {
    if (req.token) {
        return createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_ANON_KEY!,
            {
                global: {
                    headers: {
                        Authorization: `Bearer ${req.token}`
                    }
                }
            }
        );
    }
    return null;
};


// GET /
router.get('/', async (req: RequestWithUser, res) => {
    const supabase = getSupabaseClientForUser(req);
    if (!supabase) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

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

// POST /
router.post('/', async (req: RequestWithUser, res) => {
    const supabase = getSupabaseClientForUser(req);
    if (!supabase) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Project name is required' });
    }

    // The 'insert' will now be performed by the authenticated user.
    // Your 'assign_project_owner' trigger will still work correctly.
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

// PUT /:id
router.put('/:id', async (req: RequestWithUser, res) => {
    const supabase = getSupabaseClientForUser(req);
    if (!supabase) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Project name is required' });
    }

    // RLS policy will check if the user is an 'owner' before allowing this update.
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

// DELETE /:id
router.delete('/:id', async (req: RequestWithUser, res) => {
    const supabase = getSupabaseClientForUser(req);
    if (!supabase) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    // RLS policy will check if the user is an 'owner' before allowing this deletion.
    const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);
        
    if (error) {
        console.error('Error deleting project:', error);
        // RLS will prevent deletion and may return a specific error, handle as needed
        if (error.code === '42501') { // "permission_denied" in postgres
             return res.status(403).json({ error: 'You do not have permission to delete this project.' });
        }
        return res.status(500).json({ error: error.message });
    }

    res.status(204).send();
});

export default router;