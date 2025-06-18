"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express")); // Import express directly
const supabaseClient_1 = require("../db/supabaseClient");
const router = express_1.default.Router(); // Create the router from the express object
// GET /
router.get('/', async (req, res) => {
    const { data, error } = await supabaseClient_1.supabase
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
router.post('/', async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Project name is required' });
    }
    const { data, error } = await supabaseClient_1.supabase
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
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Project name is required' });
    }
    const { data, error } = await supabaseClient_1.supabase
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
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabaseClient_1.supabase
        .from('projects')
        .delete()
        .eq('id', id);
    if (error) {
        console.error('Error deleting project:', error);
        return res.status(500).json({ error: error.message });
    }
    res.status(204).send();
});
exports.default = router;
