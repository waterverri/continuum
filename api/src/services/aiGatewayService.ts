import { supabaseAdmin } from '../db/supabaseClient';

export interface AIRequest {
  providerId: string;
  model: string;
  prompt: string;
  maxTokens?: number;
}

export interface EnhancedAIRequest {
  providerId: string;
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string; }>;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  tools?: Array<any>;
  toolChoice?: string | any;
  thinkingMode?: boolean;
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
  models_endpoint: string | null;
  pricing: Record<string, { input: number; output: number }>;
  is_active: boolean;
}

export interface ProviderModel {
  id: string;
  name: string;
  description?: string;
  pricing?: { input: number; output: number };
  context_length?: number;
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

  async getProviderModels(providerId: string): Promise<ProviderModel[]> {
    const provider = await this.getProvider(providerId);
    if (!provider) {
      throw new Error(`AI provider ${providerId} not found or inactive`);
    }

    // Get API key for the provider
    const keyInfo = await this.getNextApiKey(provider.id);
    if (!keyInfo) {
      throw new Error(`No active API keys available for ${provider.name}`);
    }

    try {
      switch (provider.id) {
        case 'grok':
          return this.fetchGrokModels(provider, keyInfo);
        case 'vertex':
          return this.fetchVertexModels(provider, keyInfo);
        case 'openrouter':
          return this.fetchOpenRouterModels(provider, keyInfo);
        default:
          throw new Error(`Model fetching not implemented for provider: ${provider.id}`);
      }
    } catch (error) {
      console.error(`Failed to fetch models for ${providerId}:`, error);
      // Fallback to cached pricing models if API fails
      return Object.keys(provider.pricing).map(modelId => ({
        id: modelId,
        name: modelId,
        pricing: provider.pricing[modelId]
      }));
    }
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

  // Simple proxy method for direct AI requests (legacy support)
  async makeProxyRequest(providerId: string, model: string, prompt: string, maxTokens: number): Promise<{
    response: string;
    inputTokens: number;
    outputTokens: number;
  }> {
    return this.makeEnhancedProxyRequest({
      providerId,
      model,
      messages: [{ role: 'user', content: prompt }],
      maxTokens
    });
  }

  // Enhanced proxy method with full LLM feature support
  async makeEnhancedProxyRequest(request: EnhancedAIRequest): Promise<{
    response: string;
    inputTokens: number;
    outputTokens: number;
    thinking?: string;
    toolCalls?: Array<any>;
  }> {
    const provider = await this.getProvider(request.providerId);
    if (!provider) {
      throw new Error(`AI provider ${request.providerId} not found or inactive`);
    }

    // Check if model exists for the provider (skip validation for now since models are dynamic)
    // Model validation will be handled by the provider API

    // Get API key for round-robin
    const keyInfo = await this.getNextApiKey(provider.id);
    if (!keyInfo) {
      throw new Error(`No active API keys available for ${provider.name}`);
    }

    const aiResponse = await this.routeToProviderEnhanced(provider, request, keyInfo);
    
    return {
      response: aiResponse.content,
      inputTokens: aiResponse.tokensUsed.input,
      outputTokens: aiResponse.tokensUsed.output,
      thinking: (aiResponse as any).thinking,
      toolCalls: (aiResponse as any).toolCalls
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

    // Check if model exists for the provider (skip validation for now since models are dynamic)
    // Model validation will be handled by the provider API

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

  private async routeToProviderEnhanced(provider: AIProvider, request: EnhancedAIRequest, keyInfo: { keyId: string; apiKey: string; keyName: string }): Promise<AIResponse> {
    switch (provider.id) {
      case 'grok':
        return this.callGrokAIEnhanced(provider, request, keyInfo);
      case 'vertex':
        return this.callVertexAIEnhanced(provider, request, keyInfo);
      case 'openrouter':
        return this.callOpenRouterEnhanced(provider, request, keyInfo);
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
    // Handle authentication for Vertex AI
    let accessToken: string;
    let projectId: string;

    if (keyInfo.apiKey.startsWith('{')) {
      // Service account JSON
      accessToken = await this.generateGoogleAccessToken(keyInfo.apiKey);
      projectId = this.extractProjectId(keyInfo.apiKey);
    } else {
      // Assume it's an access token
      accessToken = keyInfo.apiKey;
      projectId = 'your-project-id'; // TODO: Get from provider configuration
    }

    // Construct proper Vertex AI model endpoint
    let modelEndpoint: string;
    if (request.model.startsWith('projects/')) {
      // Full model path provided
      modelEndpoint = `https://us-central1-aiplatform.googleapis.com/v1/${request.model}:generateContent`;
    } else {
      // Short model name, construct full path
      modelEndpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/${request.model}:generateContent`;
    }

    const response = await fetch(modelEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
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

  // Enhanced provider methods with full LLM feature support
  private async callGrokAIEnhanced(provider: AIProvider, request: EnhancedAIRequest, keyInfo: { keyId: string; apiKey: string; keyName: string }): Promise<AIResponse> {
    const payload = {
      model: request.model,
      messages: request.messages,
      max_tokens: request.maxTokens || 4000,
      ...(request.temperature !== undefined && { temperature: request.temperature }),
      ...(request.topP !== undefined && { top_p: request.topP }),
      ...(request.tools && { tools: request.tools }),
      ...(request.toolChoice && { tool_choice: request.toolChoice }),
      stream: false
    };

    const response = await fetch(`${provider.endpoint_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keyInfo.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Grok AI request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const message = data.choices[0]?.message;
    const content = message?.content || '';
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
      rateLimitResetAt: response.headers.get('x-ratelimit-reset') || null,
      // Enhanced features
      toolCalls: message?.tool_calls,
      thinking: request.thinkingMode ? data.thinking : undefined
    } as any;
  }

  private async callVertexAIEnhanced(provider: AIProvider, request: EnhancedAIRequest, keyInfo: { keyId: string; apiKey: string; keyName: string }): Promise<AIResponse> {
    // Handle authentication for Vertex AI
    let accessToken: string;
    let projectId: string;

    if (keyInfo.apiKey.startsWith('{')) {
      // Service account JSON
      accessToken = await this.generateGoogleAccessToken(keyInfo.apiKey);
      projectId = this.extractProjectId(keyInfo.apiKey);
    } else {
      // Assume it's an access token
      accessToken = keyInfo.apiKey;
      projectId = 'your-project-id'; // TODO: Get from provider configuration
    }

    // Convert messages to Vertex AI format
    const contents = request.messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : msg.role,
      parts: [{ text: msg.content }]
    }));

    const payload = {
      contents,
      generationConfig: {
        maxOutputTokens: request.maxTokens || 4000,
        ...(request.temperature !== undefined && { temperature: request.temperature }),
        ...(request.topP !== undefined && { topP: request.topP })
      },
      ...(request.tools && { tools: request.tools })
    };

    // Construct proper Vertex AI model endpoint
    let modelEndpoint: string;
    if (request.model.startsWith('projects/')) {
      // Full model path provided
      modelEndpoint = `https://us-central1-aiplatform.googleapis.com/v1/${request.model}:generateContent`;
    } else {
      // Short model name, construct full path
      modelEndpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/${request.model}:generateContent`;
    }

    const response = await fetch(modelEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Vertex AI request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text || '';
    const usage = data.usageMetadata || {};

    return {
      content,
      tokensUsed: {
        input: usage.promptTokenCount || 0,
        output: usage.candidatesTokenCount || 0
      },
      costCredits: 0, // Will be calculated by caller
      apiStatus: response.status,
      apiHeaders: Object.fromEntries(response.headers.entries())
    };
  }

  private async callOpenRouterEnhanced(provider: AIProvider, request: EnhancedAIRequest, keyInfo: { keyId: string; apiKey: string; keyName: string }): Promise<AIResponse> {
    const payload = {
      model: request.model,
      messages: request.messages,
      max_tokens: request.maxTokens || 4000,
      ...(request.temperature !== undefined && { temperature: request.temperature }),
      ...(request.topP !== undefined && { top_p: request.topP }),
      ...(request.tools && { tools: request.tools }),
      ...(request.toolChoice && { tool_choice: request.toolChoice }),
      stream: false
    };

    const response = await fetch(`${provider.endpoint_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keyInfo.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://continuum.ai',
        'X-Title': 'Continuum AI'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`OpenRouter request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const message = data.choices[0]?.message;
    const content = message?.content || '';
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
      rateLimitResetAt: response.headers.get('x-ratelimit-reset') || null,
      // Enhanced features
      toolCalls: message?.tool_calls
    } as any;
  }

  // Helper method to generate Google Cloud access token from service account JSON
  private async generateGoogleAccessToken(serviceAccountJson: string): Promise<string> {
    try {
      const credentials = JSON.parse(serviceAccountJson);
      const { client_email, private_key, project_id } = credentials;

      if (!client_email || !private_key || !project_id) {
        throw new Error('Invalid service account JSON: missing required fields');
      }

      // Create JWT assertion for Google OAuth2
      const now = Math.floor(Date.now() / 1000);
      const header = {
        alg: 'RS256',
        typ: 'JWT'
      };
      
      const payload = {
        iss: client_email,
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600, // 1 hour expiry
        iat: now
      };

      // Create JWT (simplified - in production, use a proper JWT library)
      const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
      
      // Sign with private key (simplified - use crypto library in production)
      const crypto = require('crypto');
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(`${encodedHeader}.${encodedPayload}`);
      const signature = sign.sign(private_key, 'base64url');
      
      const jwt = `${encodedHeader}.${encodedPayload}.${signature}`;

      // Exchange JWT for access token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt
        })
      });

      if (!tokenResponse.ok) {
        throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
      }

      const tokenData = await tokenResponse.json();
      return tokenData.access_token;

    } catch (error) {
      console.error('Failed to generate Google access token:', error);
      throw new Error('Invalid Google Cloud service account credentials');
    }
  }

  // Helper method to extract project ID from service account JSON
  private extractProjectId(serviceAccountJson: string): string {
    try {
      const credentials = JSON.parse(serviceAccountJson);
      return credentials.project_id;
    } catch (error) {
      throw new Error('Invalid service account JSON');
    }
  }

  // Provider-specific model fetching methods
  private async fetchGrokModels(provider: AIProvider, keyInfo: { keyId: string; apiKey: string; keyName: string }): Promise<ProviderModel[]> {
    const modelsEndpoint = provider.models_endpoint || '/models';
    const response = await fetch(`${provider.endpoint_url}${modelsEndpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${keyInfo.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Grok models: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Parse Grok AI models response
    if (data.data && Array.isArray(data.data)) {
      return data.data.map((model: any) => ({
        id: model.id,
        name: model.id,
        description: model.description || `Grok AI ${model.id}`,
        pricing: provider.pricing[model.id] || { input: 5, output: 15 }, // Default Grok pricing
        context_length: model.context_length
      }));
    }

    return [];
  }

  private async fetchVertexModels(provider: AIProvider, keyInfo: { keyId: string; apiKey: string; keyName: string }): Promise<ProviderModel[]> {
    try {
      // Check if apiKey is JSON (service account) or access token
      let accessToken: string;
      let projectId: string;

      if (keyInfo.apiKey.startsWith('{')) {
        // Service account JSON
        accessToken = await this.generateGoogleAccessToken(keyInfo.apiKey);
        projectId = this.extractProjectId(keyInfo.apiKey);
      } else {
        // Assume it's an access token
        accessToken = keyInfo.apiKey;
        // For access tokens, we need project ID from somewhere - use a default or configuration
        projectId = 'your-project-id'; // TODO: Get from provider configuration
      }

      // Use Google Cloud Discovery API to fetch available Vertex AI models
      // This is specific to Google Cloud and different from OpenAI-compatible endpoints
      const discoveryResponse = await fetch(
        `https://discoveryengine.googleapis.com/v1/projects/${projectId}/locations/global/collections/default_collection/dataStores/default_data_store/models`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // If discovery API fails, try the Vertex AI Model Garden API
      if (!discoveryResponse.ok) {
        console.log(`Discovery API failed with ${discoveryResponse.status}: ${discoveryResponse.statusText}, trying Model Garden API...`);
        
        const modelGardenResponse = await fetch(
          `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/models`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!modelGardenResponse.ok) {
          console.log(`Model Garden API failed with ${modelGardenResponse.status}: ${modelGardenResponse.statusText}, trying publisher models...`);
          
          // Try the publisher models endpoint specifically for Google models
          const publisherResponse = await fetch(
            `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (!publisherResponse.ok) {
            throw new Error(`All Vertex AI model APIs failed. Last error: ${publisherResponse.status} ${publisherResponse.statusText}`);
          }

          const publisherData = await publisherResponse.json();
          return this.parseVertexPublisherModels(publisherData, projectId, provider);
        }

        const modelGardenData = await modelGardenResponse.json();
        return this.parseVertexModelGardenModels(modelGardenData, projectId, provider);
      }

      const discoveryData = await discoveryResponse.json();
      return this.parseVertexDiscoveryModels(discoveryData, projectId, provider);

    } catch (error) {
      console.error('Failed to fetch Vertex AI models:', error);
      
      // Fallback to known models from pricing configuration
      const knownModels = Object.keys(provider.pricing).map(modelId => {
        // For fallback, construct proper model path if we have project ID
        let fullModelId = modelId;
        try {
          if (keyInfo.apiKey.startsWith('{')) {
            const projectId = this.extractProjectId(keyInfo.apiKey);
            fullModelId = `projects/${projectId}/locations/us-central1/publishers/google/models/${modelId}`;
          }
        } catch (e) {
          // If we can't extract project ID, use short name
        }
        
        return {
          id: fullModelId,
          name: modelId,
          description: `Google ${modelId}`,
          pricing: provider.pricing[modelId],
          context_length: this.getVertexContextLength(modelId)
        };
      });

      return knownModels;
    }
  }

  private getVertexContextLength(modelName: string): number {
    if (modelName.includes('1.5') || modelName.includes('pro-002')) {
      return 2000000; // Gemini 1.5 models have 2M context
    } else if (modelName.includes('1.0') || modelName.includes('pro')) {
      return 128000; // Gemini 1.0 Pro has 128k context
    }
    return 32000; // Default context length
  }

  // Parse Google Cloud Discovery Engine response
  private parseVertexDiscoveryModels(data: any, projectId: string, provider: AIProvider): ProviderModel[] {
    if (data.models && Array.isArray(data.models)) {
      return data.models
        .filter((model: any) => model.name && model.displayName)
        .map((model: any) => {
          const shortModelName = model.name.split('/').pop();
          return {
            id: model.name, // Full path for API calls
            name: model.displayName,
            description: model.description || `Google ${model.displayName}`,
            pricing: provider.pricing[shortModelName] || { input: 1, output: 3 },
            context_length: this.getVertexContextLength(model.displayName)
          };
        });
    }
    return [];
  }

  // Parse Vertex AI Model Garden response
  private parseVertexModelGardenModels(data: any, projectId: string, provider: AIProvider): ProviderModel[] {
    if (data.models && Array.isArray(data.models)) {
      return data.models
        .filter((model: any) => model.name && model.displayName)
        .map((model: any) => {
          const shortModelName = model.name.split('/').pop();
          return {
            id: model.name, // Full path for API calls
            name: model.displayName,
            description: model.description || `Google ${model.displayName}`,
            pricing: provider.pricing[shortModelName] || { input: 1, output: 3 },
            context_length: this.getVertexContextLength(model.displayName)
          };
        });
    }
    return [];
  }

  // Parse Vertex AI Publisher models response (Google-specific models)
  private parseVertexPublisherModels(data: any, projectId: string, provider: AIProvider): ProviderModel[] {
    const models: ProviderModel[] = [];
    
    // Handle different response formats from Google's publisher API
    if (data.models && Array.isArray(data.models)) {
      // Standard models array format
      data.models.forEach((model: any) => {
        if (model.name && model.displayName) {
          const shortModelName = model.name.split('/').pop();
          models.push({
            id: model.name, // Full path for API calls
            name: model.displayName,
            description: model.description || `Google ${model.displayName}`,
            pricing: provider.pricing[shortModelName] || { input: 1, output: 3 },
            context_length: this.getVertexContextLength(model.displayName)
          });
        }
      });
    } else if (data.publisherModels && Array.isArray(data.publisherModels)) {
      // Alternative publisher models format
      data.publisherModels.forEach((model: any) => {
        if (model.name && model.displayName) {
          const shortModelName = model.name.split('/').pop();
          models.push({
            id: model.name,
            name: model.displayName,
            description: model.description || `Google ${model.displayName}`,
            pricing: provider.pricing[shortModelName] || { input: 1, output: 3 },
            context_length: this.getVertexContextLength(model.displayName)
          });
        }
      });
    } else {
      // Fallback: construct known Google models with proper paths
      const knownGoogleModels = [
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-1.0-pro',
        'gemini-1.0-pro-vision',
        'text-bison',
        'chat-bison',
        'code-bison'
      ];

      knownGoogleModels.forEach(modelName => {
        const fullPath = `projects/${projectId}/locations/us-central1/publishers/google/models/${modelName}`;
        models.push({
          id: fullPath,
          name: modelName,
          description: `Google ${modelName}`,
          pricing: provider.pricing[modelName] || { input: 1, output: 3 },
          context_length: this.getVertexContextLength(modelName)
        });
      });
    }

    return models;
  }

  private async fetchOpenRouterModels(provider: AIProvider, keyInfo: { keyId: string; apiKey: string; keyName: string }): Promise<ProviderModel[]> {
    const modelsEndpoint = provider.models_endpoint || '/models';
    const response = await fetch(`${provider.endpoint_url}${modelsEndpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${keyInfo.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://continuum.ai',
        'X-Title': 'Continuum AI'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch OpenRouter models: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Parse OpenRouter models response
    if (data.data && Array.isArray(data.data)) {
      return data.data.map((model: any) => ({
        id: model.id,
        name: model.name || model.id,
        description: model.description,
        pricing: model.pricing ? {
          input: parseFloat(model.pricing.prompt) * 1000000, // Convert to per-million tokens
          output: parseFloat(model.pricing.completion) * 1000000
        } : { input: 0, output: 0 },
        context_length: model.context_length
      }));
    }

    return [];
  }
}