import express from 'express';
import { RequestWithUser } from '../index';
import { AIGatewayService } from '../services/aiGatewayService';
import { supabaseAdmin } from '../db/supabaseClient';

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
      console.error('Error fetching user credits:', error);
      return res.status(500).json({ error: 'Failed to fetch user credits' });
    }

    res.json({ credits: profile?.credit_balance || 0 });
  } catch (error) {
    console.error('Error in credits endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch user credits' });
  }
});

// POST /ai/estimate-cost - Estimate cost for AI request
router.post('/estimate-cost', async (req: RequestWithUser, res) => {
  try {
    const { providerId, model, prompt } = req.body;

    if (!providerId || !model || !prompt) {
      return res.status(400).json({ error: 'Provider ID, model, and prompt are required' });
    }

    // Calculate input tokens from the prompt text
    const inputTokens = aiGateway.calculateTokens(prompt);
    
    // Get provider pricing
    const providers = await aiGateway.getProviders();
    const provider = providers.find(p => p.id === providerId);
    
    if (!provider || !provider.models.includes(model)) {
      return res.status(400).json({ error: 'Invalid provider or model' });
    }

    const pricing = provider.pricing[model];
    if (!pricing) {
      return res.status(400).json({ error: 'Pricing not available for this model' });
    }

    // Estimate maximum cost (input + estimated max output tokens)
    const estimatedMaxTokens = 4000; // Default max output estimate
    const estimatedMaxCost = Math.ceil(
      (inputTokens * pricing.input + estimatedMaxTokens * pricing.output) / 1000000 * 10000
    );

    res.json({
      inputTokens,
      estimatedMaxCost,
      estimatedMaxTokens
    });
  } catch (error) {
    console.error('Error estimating AI cost:', error);
    res.status(500).json({ error: 'Failed to estimate cost' });
  }
});

// POST /ai/proxy - Simple AI proxy endpoint
router.post('/proxy', async (req: RequestWithUser, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { providerId, model, prompt, maxTokens = 4000 } = req.body;

    if (!providerId || !model || !prompt) {
      return res.status(400).json({ error: 'Provider ID, model, and prompt are required' });
    }

    // Check user credits
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('credit_balance')
      .eq('user_id', userId)
      .single();

    if (!profile || profile.credit_balance <= 0) {
      return res.status(402).json({ error: 'Insufficient credits' });
    }

    // Calculate input tokens and estimate cost
    const inputTokens = aiGateway.calculateTokens(prompt);
    const providers = await aiGateway.getProviders();
    const provider = providers.find(p => p.id === providerId);
    
    if (!provider || !provider.models.includes(model)) {
      return res.status(400).json({ error: 'Invalid provider or model' });
    }

    const pricing = provider.pricing[model];
    const estimatedCost = Math.ceil(
      (inputTokens * pricing.input + maxTokens * pricing.output) / 1000000 * 10000
    );

    if (profile.credit_balance < estimatedCost) {
      return res.status(402).json({ error: 'Insufficient credits for this request' });
    }

    // Make AI request through gateway
    const startTime = Date.now();
    const response = await aiGateway.makeProxyRequest(providerId, model, prompt, maxTokens);
    const endTime = Date.now();

    // Calculate actual cost
    const actualCost = Math.ceil(
      (response.inputTokens * pricing.input + response.outputTokens * pricing.output) / 1000000 * 10000
    );

    // Deduct credits
    const { error: deductError } = await supabaseAdmin.rpc('deduct_user_credits', {
      p_user_id: userId,
      p_credits: actualCost
    });

    if (deductError) {
      console.error('Error deducting credits:', deductError);
      return res.status(500).json({ error: 'Failed to process payment' });
    }

    // Log the request for analytics
    await supabaseAdmin.from('llm_call_logs').insert({
      user_id: userId,
      provider_id: providerId,
      model,
      input_text: prompt,
      input_tokens: response.inputTokens,
      max_output_tokens: maxTokens,
      output_text: response.response,
      output_tokens: response.outputTokens,
      finish_reason: 'completed',
      cost_credits: actualCost,
      latency_ms: endTime - startTime,
      request_timestamp: new Date().toISOString(),
      response_timestamp: new Date().toISOString()
    });

    // Return response to frontend
    res.json({
      response: response.response,
      tokensUsed: response.inputTokens + response.outputTokens,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      costCredits: actualCost
    });
  } catch (error) {
    console.error('Error in AI proxy:', error);
    res.status(500).json({ error: 'AI request failed' });
  }
});

export default router;