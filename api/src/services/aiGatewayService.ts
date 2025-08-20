import { supabaseAdmin } from '../db/supabaseClient';

export interface AIRequest {
  providerId: string;
  model: string;
  prompt: string;
  maxTokens?: number;
}

export interface AIResponse {
  content: string;
  tokensUsed: {
    input: number;
    output: number;
  };
  costCredits: number;
  apiStatus?: number;
  apiHeaders?: any;
  rateLimitRemaining?: number | null;
  rateLimitResetAt?: string | null;
}

export interface AIProvider {
  id: string;
  name: string;
  endpoint_url: string;
  models: string[];
  pricing: Record<string, { input: number; output: number }>;
  is_active: boolean;
}

export class AIGatewayService {
  private static readonly PROFIT_MULTIPLIER = 1; // Static multiplier for profit margin

  async getNextApiKey(providerId: string): Promise<{ keyId: string; apiKey: string; keyName: string } | null> {
    const { data, error } = await supabaseAdmin
      .rpc('get_next_api_key', { p_provider_id: providerId });

    if (error || !data || data.length === 0) {
      console.error(`No active API keys found for provider ${providerId}:`, error);
      return null;
    }

    const key = data[0];
    return {
      keyId: key.key_id,
      apiKey: key.api_key,
      keyName: key.key_name
    };
  }

  async getProviders(): Promise<AIProvider[]> {
    const { data, error } = await supabaseAdmin
      .from('ai_providers')
      .select('*')
      .eq('is_active', true);

    if (error) {
      throw new Error(`Failed to fetch AI providers: ${error.message}`);
    }

    return data || [];
  }

  async getProvider(providerId: string): Promise<AIProvider | null> {
    const { data, error } = await supabaseAdmin
      .from('ai_providers')
      .select('*')
      .eq('id', providerId)
      .eq('is_active', true)
      .single();

    if (error) {
      return null;
    }

    return data;
  }

  calculateTokens(text: string): number {
    // Simple token estimation: approximately 4 characters per token
    // This is a rough estimate; real implementations would use tiktoken or similar
    return Math.ceil(text.length / 4);
  }

  // Simple proxy method for direct AI requests
  async makeProxyRequest(providerId: string, model: string, prompt: string, maxTokens: number): Promise<{
    response: string;
    inputTokens: number;
    outputTokens: number;
  }> {
    const provider = await this.getProvider(providerId);
    if (!provider) {
      throw new Error(`AI provider ${providerId} not found or inactive`);
    }

    if (!provider.models.includes(model)) {
      throw new Error(`Model ${model} not supported by provider ${providerId}`);
    }

    // Get API key for round-robin
    const keyInfo = await this.getNextApiKey(provider.id);
    if (!keyInfo) {
      throw new Error(`No active API keys available for ${provider.name}`);
    }

    const request: AIRequest = { providerId, model, prompt, maxTokens };
    const aiResponse = await this.routeToProvider(provider, request, keyInfo);
    
    return {
      response: aiResponse.content,
      inputTokens: aiResponse.tokensUsed.input,
      outputTokens: aiResponse.tokensUsed.output
    };
  }

  calculateCost(provider: AIProvider, model: string, inputTokens: number, outputTokens: number): number {
    const modelPricing = provider.pricing[model];
    if (!modelPricing) {
      throw new Error(`Pricing not found for model ${model} from provider ${provider.id}`);
    }

    const inputCost = inputTokens * modelPricing.input;
    const outputCost = outputTokens * modelPricing.output;
    const totalCost = Math.ceil((inputCost + outputCost) * AIGatewayService.PROFIT_MULTIPLIER);

    return totalCost;
  }

  estimateMaxCost(provider: AIProvider, model: string, inputTokens: number, maxOutputTokens: number = 4000): number {
    return this.calculateCost(provider, model, inputTokens, maxOutputTokens);
  }

  async submitRequest(userId: string, documentId: string, request: AIRequest): Promise<string> {
    const provider = await this.getProvider(request.providerId);
    if (!provider) {
      throw new Error(`AI provider ${request.providerId} not found or inactive`);
    }

    if (!provider.models.includes(request.model)) {
      throw new Error(`Model ${request.model} not supported by provider ${request.providerId}`);
    }

    const inputTokens = this.calculateTokens(request.prompt);
    const maxOutputTokens = request.maxTokens || 4000;
    const estimatedCost = this.estimateMaxCost(provider, request.model, inputTokens, maxOutputTokens);

    // Get API key for round-robin
    const keyInfo = await this.getNextApiKey(provider.id);
    if (!keyInfo) {
      throw new Error(`No active API keys available for ${provider.name}`);
    }

    // Check user credits
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('credit_balance')
      .eq('user_id', userId)
      .single();

    if (!profile || profile.credit_balance < estimatedCost) {
      throw new Error('Insufficient credits for this request');
    }

    // Create AI request log
    const { data: aiRequest, error: createError } = await supabaseAdmin
      .from('ai_requests')
      .insert({
        user_id: userId,
        document_id: documentId,
        provider_id: request.providerId,
        model: request.model,
        input_tokens: inputTokens,
        cost_credits: estimatedCost,
        status: 'pending'
      })
      .select('id')
      .single();

    if (createError || !aiRequest) {
      throw new Error('Failed to create AI request log');
    }

    // Create comprehensive LLM call log
    const { data: logData, error: logError } = await supabaseAdmin
      .rpc('log_llm_call', {
        p_user_id: userId,
        p_document_id: documentId,
        p_ai_request_id: aiRequest.id,
        p_provider_id: request.providerId,
        p_provider_key_id: keyInfo.keyId,
        p_model: request.model,
        p_input_text: request.prompt,
        p_input_tokens: inputTokens,
        p_max_output_tokens: maxOutputTokens,
        p_request_metadata: {
          estimated_cost: estimatedCost,
          key_name: keyInfo.keyName,
          request_timestamp: new Date().toISOString()
        }
      });

    const logId = logData;
    if (logError || !logId) {
      console.error('Failed to create LLM call log:', logError);
      // Continue with request even if logging fails
    }

    // Deduct estimated credits immediately
    const { data: deductResult } = await supabaseAdmin
      .rpc('deduct_user_credits', {
        p_user_id: userId,
        p_credits: estimatedCost
      });

    if (!deductResult) {
      await supabaseAdmin
        .from('ai_requests')
        .update({ status: 'failed', error_message: 'Insufficient credits' })
        .eq('id', aiRequest.id);
      throw new Error('Failed to deduct credits');
    }

    // Update document status
    await supabaseAdmin
      .from('documents')
      .update({
        ai_status: 'pending',
        ai_submitted_at: new Date().toISOString()
      })
      .eq('id', documentId);

    // Route to appropriate AI connector
    try {
      const response = await this.routeToProvider(provider, request, keyInfo);
      
      // Calculate actual cost based on real token usage
      const actualCost = this.calculateCost(provider, request.model, inputTokens, response.tokensUsed.output);
      const creditDifference = estimatedCost - actualCost;

      // Refund difference if actual cost was lower
      if (creditDifference > 0) {
        await supabaseAdmin
          .from('profiles')
          .update({
            credit_balance: profile.credit_balance - actualCost
          })
          .eq('user_id', userId);
      }

      // Update AI request log with actual results
      await supabaseAdmin
        .from('ai_requests')
        .update({
          output_tokens: response.tokensUsed.output,
          cost_credits: actualCost,
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', aiRequest.id);

      // Update comprehensive LLM call log with success data
      if (logId) {
        await supabaseAdmin
          .rpc('update_llm_call_response', {
            p_log_id: logId,
            p_output_text: response.content,
            p_output_tokens: response.tokensUsed.output,
            p_finish_reason: 'completed',
            p_input_cost_credits: this.calculateCost(provider, request.model, inputTokens, 0),
            p_output_cost_credits: this.calculateCost(provider, request.model, 0, response.tokensUsed.output),
            p_total_cost_credits: actualCost,
            p_api_response_status: response.apiStatus || 200,
            p_api_response_headers: response.apiHeaders || null,
            p_rate_limit_remaining: response.rateLimitRemaining || null,
            p_rate_limit_reset_at: response.rateLimitResetAt || null
          });
      }

      // Update document with response
      await supabaseAdmin
        .from('documents')
        .update({
          ai_response: response.content,
          ai_tokens_used: inputTokens + response.tokensUsed.output,
          ai_cost_credits: actualCost,
          ai_status: 'completed',
          ai_completed_at: new Date().toISOString()
        })
        .eq('id', documentId);

      return response.content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorType = this.categorizeError(errorMessage);

      // Handle AI processing failure
      await supabaseAdmin
        .from('ai_requests')
        .update({
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString()
        })
        .eq('id', aiRequest.id);

      await supabaseAdmin
        .from('documents')
        .update({
          ai_status: 'failed',
          ai_completed_at: new Date().toISOString()
        })
        .eq('id', documentId);

      // Log the error in comprehensive logging
      if (logId) {
        await supabaseAdmin
          .rpc('log_llm_call_error', {
            p_log_id: logId,
            p_error_type: errorType,
            p_error_message: errorMessage,
            p_error_details: {
              stack: error instanceof Error ? error.stack : null,
              provider: request.providerId,
              model: request.model,
              key_name: keyInfo.keyName
            },
            p_api_response_status: this.extractStatusFromError(errorMessage)
          });
      }

      // Refund estimated credits on failure
      await supabaseAdmin
        .from('profiles')
        .update({
          credit_balance: profile.credit_balance
        })
        .eq('user_id', userId);

      throw error;
    }
  }

  private categorizeError(errorMessage: string): string {
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return 'rate_limit';
    }
    if (errorMessage.includes('quota') || errorMessage.includes('billing')) {
      return 'quota_exceeded';
    }
    if (errorMessage.includes('401') || errorMessage.includes('invalid') || errorMessage.includes('unauthorized')) {
      return 'invalid_key';
    }
    if (errorMessage.includes('400') || errorMessage.includes('bad request')) {
      return 'bad_request';
    }
    if (errorMessage.includes('500') || errorMessage.includes('internal')) {
      return 'api_error';
    }
    if (errorMessage.includes('network') || errorMessage.includes('timeout') || errorMessage.includes('connection')) {
      return 'network_error';
    }
    return 'unknown_error';
  }

  private extractStatusFromError(errorMessage: string): number | null {
    const statusMatch = errorMessage.match(/(\d{3})/);
    return statusMatch ? parseInt(statusMatch[1]) : null;
  }

  private async routeToProvider(provider: AIProvider, request: AIRequest, keyInfo: { keyId: string; apiKey: string; keyName: string }): Promise<AIResponse> {
    switch (provider.id) {
      case 'grok':
        return this.callGrokAI(provider, request, keyInfo);
      case 'vertex':
        return this.callVertexAI(provider, request, keyInfo);
      case 'openrouter':
        return this.callOpenRouter(provider, request, keyInfo);
      default:
        throw new Error(`Unsupported AI provider: ${provider.id}`);
    }
  }

  private async callGrokAI(provider: AIProvider, request: AIRequest, keyInfo: { keyId: string; apiKey: string; keyName: string }): Promise<AIResponse> {

    const response = await fetch(`${provider.endpoint_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keyInfo.apiKey}`
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: request.prompt }],
        model: request.model,
        max_tokens: request.maxTokens || 4000
      })
    });

    if (!response.ok) {
      throw new Error(`Grok AI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    const usage = data.usage || {};

    return {
      content,
      tokensUsed: {
        input: usage.prompt_tokens || 0,
        output: usage.completion_tokens || 0
      },
      costCredits: 0, // Will be calculated by caller
      apiStatus: response.status,
      apiHeaders: Object.fromEntries(response.headers.entries()),
      rateLimitRemaining: response.headers.get('x-ratelimit-remaining') ? 
        parseInt(response.headers.get('x-ratelimit-remaining')!) : null,
      rateLimitResetAt: response.headers.get('x-ratelimit-reset') || null
    };
  }

  private async callVertexAI(provider: AIProvider, request: AIRequest, keyInfo: { keyId: string; apiKey: string; keyName: string }): Promise<AIResponse> {

    // For Vertex AI, the "API key" is actually a service account key or access token
    // In a real implementation, you'd use the Google Cloud SDK with service account credentials
    const response = await fetch(`${provider.endpoint_url}/projects/your-project-id/locations/us-central1/publishers/google/models/${request.model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keyInfo.apiKey}`
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: request.prompt }]
        }],
        generationConfig: {
          maxOutputTokens: request.maxTokens || 4000
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Vertex AI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Estimate token usage since Vertex AI doesn't always provide usage stats
    const outputTokens = this.calculateTokens(content);

    return {
      content,
      tokensUsed: {
        input: this.calculateTokens(request.prompt),
        output: outputTokens
      },
      costCredits: 0, // Will be calculated by caller
      apiStatus: response.status,
      apiHeaders: Object.fromEntries(response.headers.entries()),
      rateLimitRemaining: response.headers.get('x-ratelimit-remaining') ? 
        parseInt(response.headers.get('x-ratelimit-remaining')!) : null,
      rateLimitResetAt: response.headers.get('x-ratelimit-reset') || null
    };
  }

  private async callOpenRouter(provider: AIProvider, request: AIRequest, keyInfo: { keyId: string; apiKey: string; keyName: string }): Promise<AIResponse> {

    const response = await fetch(`${provider.endpoint_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keyInfo.apiKey}`,
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'Continuum AI'
      },
      body: JSON.stringify({
        model: request.model,
        messages: [{ role: 'user', content: request.prompt }],
        max_tokens: request.maxTokens || 4000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    const usage = data.usage || {};

    return {
      content,
      tokensUsed: {
        input: usage.prompt_tokens || 0,
        output: usage.completion_tokens || 0
      },
      costCredits: 0, // Will be calculated by caller
      apiStatus: response.status,
      apiHeaders: Object.fromEntries(response.headers.entries()),
      rateLimitRemaining: response.headers.get('x-ratelimit-remaining') ? 
        parseInt(response.headers.get('x-ratelimit-remaining')!) : null,
      rateLimitResetAt: response.headers.get('x-ratelimit-reset') || null
    };
  }
}