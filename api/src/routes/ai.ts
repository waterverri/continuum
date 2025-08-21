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

// GET /ai/providers/:providerId/models - Get available models for a provider
router.get('/providers/:providerId/models', async (req: RequestWithUser, res) => {
  try {
    const { providerId } = req.params;
    const models = await aiGateway.getProviderModels(providerId);
    res.json({ models });
  } catch (error) {
    console.error(`Error fetching models for provider ${req.params.providerId}:`, error);
    res.status(500).json({ error: 'Failed to fetch provider models' });
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
    const { providerId, model, messages, prompt } = req.body;

    if (!providerId || !model || (!messages && !prompt)) {
      return res.status(400).json({ error: 'Provider ID, model, and messages (or prompt) are required' });
    }

    // Calculate input tokens from messages or legacy prompt
    let inputTokens: number;
    if (messages) {
      const combinedText = messages.map((m: any) => m.content).join(' ');
      inputTokens = aiGateway.calculateTokens(combinedText);
    } else {
      // Legacy prompt support
      inputTokens = aiGateway.calculateTokens(prompt);
    }
    
    // Get provider pricing
    const providers = await aiGateway.getProviders();
    const provider = providers.find(p => p.id === providerId);
    
    if (!provider) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    // Note: Model validation is now done dynamically by provider APIs

    // Get pricing from provider configuration or fetch from dynamic models
    let pricing = provider.pricing[model];
    
    if (!pricing) {
      // Try to get pricing from dynamic model data
      try {
        const models = await aiGateway.getProviderModels(providerId);
        const modelData = models.find(m => m.id === model);
        if (modelData?.pricing) {
          pricing = modelData.pricing;
        }
      } catch (error) {
        console.error('Failed to fetch dynamic model pricing:', error);
      }
    }

    if (!pricing || !pricing.input || !pricing.output) {
      // Use default pricing for estimates when pricing unavailable
      console.warn(`No pricing found for model ${model} from provider ${providerId}, using default pricing for estimate`);
      pricing = { input: 10, output: 30 }; // Default pricing per million tokens
    }

    // Estimate maximum cost (input + estimated max output tokens)
    const estimatedMaxTokens = 4000; // Default max output estimate
    const estimatedMaxCost = Math.ceil(
      (inputTokens * pricing.input + estimatedMaxTokens * pricing.output) / 1000000 * 10000
    );

    res.json({
      inputTokens,
      estimatedMaxCost,
      estimatedMaxTokens,
      note: !provider.pricing[model] ? 'Estimate based on default pricing - actual cost may vary' : undefined
    });
  } catch (error) {
    console.error('Error estimating AI cost:', error);
    res.status(500).json({ error: 'Failed to estimate cost' });
  }
});

// POST /ai/proxy - AI proxy endpoint with structured message support
router.post('/proxy', async (req: RequestWithUser, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { 
      providerId, 
      model, 
      messages,
      prompt, // Legacy support
      maxTokens = 4000,
      temperature,
      topP,
      tools,
      toolChoice,
      thinkingMode = false
    } = req.body;

    if (!providerId || !model || (!messages && !prompt)) {
      return res.status(400).json({ error: 'Provider ID, model, and messages (or prompt) are required' });
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
    let inputTokens: number;
    let finalPrompt: string;
    
    if (messages) {
      // Convert messages to prompt text for token calculation
      finalPrompt = messages.map((m: any) => `${m.role}: ${m.content}`).join('\n');
      inputTokens = aiGateway.calculateTokens(finalPrompt);
    } else {
      // Legacy prompt support
      finalPrompt = prompt;
      inputTokens = aiGateway.calculateTokens(prompt);
    }
    
    const providers = await aiGateway.getProviders();
    const provider = providers.find(p => p.id === providerId);
    
    if (!provider) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    // Note: Model validation is now done dynamically by provider APIs

    // Get pricing from provider configuration or fetch from dynamic models
    let pricing = provider.pricing[model];
    
    if (!pricing) {
      // Try to get pricing from dynamic model data
      try {
        const models = await aiGateway.getProviderModels(providerId);
        const modelData = models.find(m => m.id === model);
        if (modelData?.pricing) {
          pricing = modelData.pricing;
        }
      } catch (error) {
        console.error('Failed to fetch dynamic model pricing:', error);
      }
    }

    if (!pricing || !pricing.input || !pricing.output) {
      // For models without pricing, require minimum 1000 credits to proceed
      if (profile.credit_balance < 1000) {
        return res.status(402).json({ error: 'Insufficient credits. Model pricing unavailable - minimum 1000 credits required.' });
      }
      console.warn(`No pricing found for model ${model} from provider ${providerId}, using default pricing`);
      pricing = { input: 10, output: 30 }; // Default pricing per million tokens
    }

    const estimatedCost = Math.ceil(
      (inputTokens * pricing.input + maxTokens * pricing.output) / 1000000 * 10000
    );

    if (profile.credit_balance < estimatedCost) {
      return res.status(402).json({ error: 'Insufficient credits for this request' });
    }

    // Make AI request through gateway with enhanced parameters
    const startTime = Date.now();
    const response = await aiGateway.makeEnhancedProxyRequest({
      providerId,
      model,
      messages: messages || [{ role: 'user', content: prompt }],
      maxTokens,
      temperature,
      topP,
      tools,
      toolChoice,
      thinkingMode
    });
    const endTime = Date.now();

    // Calculate actual cost using the validated pricing
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