import express from 'express';
import { RequestWithUser } from '../index';
import { AIGatewayService } from '../services/aiGatewayService';
import { supabaseAdmin } from '../db/supabaseClient';
import { resolveDocumentWithOverrides } from '../services/documentResolutionService';

const router = express.Router();
const aiGateway = new AIGatewayService();

// GET /ai/providers - Get available AI providers
router.get('/providers', async (req: RequestWithUser, res) => {
  try {
    const providers = await aiGateway.getProviders();
    res.json({ providers });
  } catch (error) {
    console.error('Error fetching AI providers:', error);
    res.status(500).json({ error: 'Failed to fetch AI providers' });
  }
});

// GET /ai/credits - Get user credit balance
router.get('/credits', async (req: RequestWithUser, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('credit_balance')
      .eq('user_id', userId)
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch credit balance' });
    }

    res.json({ credits: profile?.credit_balance || 0 });
  } catch (error) {
    console.error('Error fetching credit balance:', error);
    res.status(500).json({ error: 'Failed to fetch credit balance' });
  }
});

// POST /ai/estimate-cost - Estimate cost for an AI request
router.post('/estimate-cost', async (req: RequestWithUser, res) => {
  try {
    const { providerId, model, documentId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!providerId || !model || !documentId) {
      return res.status(400).json({ error: 'Provider ID, model, and document ID are required' });
    }

    // Get the document and resolve its content
    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Resolve document content if it's composite
    let promptContent: string;
    if (document.is_composite) {
      promptContent = await resolveDocumentWithOverrides(
        supabaseAdmin,
        document.project_id,
        document.content || '',
        document.components || {},
        {},
        document.id
      );
    } else {
      promptContent = document.content || '';
    }

    const provider = await aiGateway.getProvider(providerId);
    if (!provider) {
      return res.status(404).json({ error: 'AI provider not found' });
    }

    const inputTokens = aiGateway.calculateTokens(promptContent);
    const estimatedCost = aiGateway.estimateMaxCost(provider, model, inputTokens);

    res.json({
      inputTokens,
      estimatedMaxCost: estimatedCost,
      estimatedMaxTokens: 4000
    });
  } catch (error) {
    console.error('Error estimating AI cost:', error);
    res.status(500).json({ error: 'Failed to estimate cost' });
  }
});

// POST /ai/submit - Submit an AI request
router.post('/submit', async (req: RequestWithUser, res) => {
  try {
    const { documentId, providerId, model, maxTokens } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!documentId || !providerId || !model) {
      return res.status(400).json({ error: 'Document ID, provider ID, and model are required' });
    }

    // Verify user has access to the document
    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .select(`
        *,
        projects!inner (
          project_members!inner (
            user_id,
            role
          )
        )
      `)
      .eq('id', documentId)
      .eq('projects.project_members.user_id', userId)
      .single();

    if (docError || !document) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }

    // Verify it's a prompt document
    if (document.document_type !== 'prompt') {
      return res.status(400).json({ error: 'Document must be of type "prompt"' });
    }

    // Check if there's already a pending/processing request
    if (document.ai_status === 'pending' || document.ai_status === 'processing') {
      return res.status(409).json({ error: 'AI request already in progress for this document' });
    }

    // Resolve document content if it's composite
    let promptContent: string;
    if (document.is_composite) {
      promptContent = await resolveDocumentWithOverrides(
        supabaseAdmin,
        document.project_id,
        document.content || '',
        document.components || {},
        {},
        document.id
      );
    } else {
      promptContent = document.content || '';
    }

    if (!promptContent.trim()) {
      return res.status(400).json({ error: 'Document content cannot be empty' });
    }

    // Update document with selected model
    await supabaseAdmin
      .from('documents')
      .update({ ai_model: model })
      .eq('id', documentId);

    // Submit the AI request
    const response = await aiGateway.submitRequest(userId, documentId, {
      providerId,
      model,
      prompt: promptContent,
      maxTokens
    });

    res.json({ success: true, message: 'AI request submitted successfully' });
  } catch (error) {
    console.error('Error submitting AI request:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Insufficient credits')) {
        return res.status(402).json({ error: 'Insufficient credits for this request' });
      }
      if (error.message.includes('not found') || error.message.includes('not supported')) {
        return res.status(400).json({ error: error.message });
      }
    }
    
    res.status(500).json({ error: 'Failed to submit AI request' });
  }
});

// GET /ai/status/:documentId - Get AI request status for a document
router.get('/status/:documentId', async (req: RequestWithUser, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get document with AI status, ensuring user has access
    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .select(`
        ai_status,
        ai_model,
        ai_response,
        ai_tokens_used,
        ai_cost_credits,
        ai_submitted_at,
        ai_completed_at,
        projects!inner (
          project_members!inner (
            user_id,
            role
          )
        )
      `)
      .eq('id', documentId)
      .eq('projects.project_members.user_id', userId)
      .single();

    if (docError || !document) {
      return res.status(404).json({ error: 'Document not found or access denied' });
    }

    res.json({
      status: document.ai_status,
      model: document.ai_model,
      response: document.ai_response,
      tokensUsed: document.ai_tokens_used,
      costCredits: document.ai_cost_credits,
      submittedAt: document.ai_submitted_at,
      completedAt: document.ai_completed_at
    });
  } catch (error) {
    console.error('Error fetching AI status:', error);
    res.status(500).json({ error: 'Failed to fetch AI status' });
  }
});

// POST /ai/credits/add - Add credits to user account (admin/payment endpoint)
router.post('/credits/add', async (req: RequestWithUser, res) => {
  try {
    const { amount, userId: targetUserId } = req.body;
    const requestingUserId = req.user?.id;

    if (!requestingUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // For now, allow users to add credits to their own account
    // In production, this would be protected by payment processing
    const userId = targetUserId || requestingUserId;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid positive amount required' });
    }

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .update({
        credit_balance: (await supabaseAdmin
          .from('profiles')
          .select('credit_balance')
          .eq('user_id', userId)
          .single()
        ).data?.credit_balance + amount
      })
      .eq('user_id', userId)
      .select('credit_balance')
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to add credits' });
    }

    res.json({ success: true, newBalance: profile?.credit_balance });
  } catch (error) {
    console.error('Error adding credits:', error);
    res.status(500).json({ error: 'Failed to add credits' });
  }
});

export default router;