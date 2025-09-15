import express from 'express';
import { RequestWithUser } from '../index';
import { AIGatewayService } from '../services/aiGatewayService';
import { contextAssemblyService } from '../services/contextAssemblyService';
import { supabaseAdmin } from '../db/supabaseClient';

const router = express.Router();
const aiGateway = new AIGatewayService();

// GET /ai/providers - Get available AI providers (only those with active API keys)
router.get('/providers', async (req: RequestWithUser, res) => {
  try {
    const providers = await aiGateway.getProvidersWithKeys();
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
    const providers = await aiGateway.getProvidersWithKeys();
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
    
    const providers = await aiGateway.getProvidersWithKeys();
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

    // Get API key info for proper logging
    const keyInfo = await aiGateway.getNextApiKey(providerId);
    if (!keyInfo) {
      return res.status(500).json({ error: 'No active API keys available for provider' });
    }

    // Create AI request log entry (generic logging)
    const { data: aiRequest, error: requestError } = await supabaseAdmin
      .from('ai_requests')
      .insert({
        user_id: userId,
        provider_id: providerId,
        model: model,
        input_tokens: inputTokens,
        cost_credits: estimatedCost,
        status: 'pending'
      })
      .select('id')
      .single();

    if (requestError || !aiRequest) {
      console.error('Error creating AI request log:', requestError);
      return res.status(500).json({ error: 'Failed to initialize request logging' });
    }

    // Create optimized LLM call log using updated function (no document_id needed)
    const { data: logId, error: logError } = await supabaseAdmin
      .rpc('log_llm_call', {
        p_user_id: userId,
        p_ai_request_id: aiRequest.id,
        p_provider_id: providerId,
        p_provider_key_id: keyInfo.keyId,
        p_model: model,
        p_input_tokens: inputTokens,
        p_max_output_tokens: maxTokens,
        p_request_metadata: {
          estimated_cost: estimatedCost,
          key_name: keyInfo.keyName,
          request_type: 'proxy',
          request_timestamp: new Date().toISOString(),
          temperature,
          topP,
          tools,
          toolChoice,
          thinkingMode
        }
      });

    if (logError || !logId) {
      console.error('Failed to create LLM call log:', logError);
      // Clean up AI request if logging fails
      await supabaseAdmin.from('ai_requests').delete().eq('id', aiRequest.id);
      return res.status(500).json({ error: 'Failed to initialize request logging' });
    }

    try {
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
        // Log the error in LLM call log
        await supabaseAdmin.rpc('log_llm_call_error', {
          p_log_id: logId,
          p_error_type: 'payment_error',
          p_error_message: 'Failed to deduct credits',
          p_error_details: { error: deductError }
        });
        return res.status(500).json({ error: 'Failed to process payment' });
      }

      // Update AI request with completion status
      await supabaseAdmin
        .from('ai_requests')
        .update({
          output_tokens: response.outputTokens,
          cost_credits: actualCost,
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', aiRequest.id);

      // Update LLM call log with success data using optimized function
      await supabaseAdmin.rpc('update_llm_call_response', {
        p_log_id: logId,
        p_output_tokens: response.outputTokens,
        p_finish_reason: 'completed',
        p_input_cost_credits: Math.ceil((response.inputTokens * pricing.input) / 1000000 * 10000),
        p_output_cost_credits: Math.ceil((response.outputTokens * pricing.output) / 1000000 * 10000),
        p_total_cost_credits: actualCost,
        p_api_response_status: 200,
        p_api_response_headers: null,
        p_rate_limit_remaining: null,
        p_rate_limit_reset_at: null
      });

      // Return response to frontend
      res.json({
        response: response.response,
        tokensUsed: response.inputTokens + response.outputTokens,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        costCredits: actualCost
      });

    } catch (requestError) {
      console.error('Error during AI request:', requestError);
      
      // Log the error in LLM call log
      await supabaseAdmin.rpc('log_llm_call_error', {
        p_log_id: logId,
        p_error_type: 'ai_request_error',
        p_error_message: requestError instanceof Error ? requestError.message : 'Unknown AI request error',
        p_error_details: {
          stack: requestError instanceof Error ? requestError.stack : null,
          provider: providerId,
          model: model,
          key_name: keyInfo.keyName
        }
      });

      // Update AI request status to failed
      await supabaseAdmin
        .from('ai_requests')
        .update({
          status: 'failed',
          error_message: requestError instanceof Error ? requestError.message : 'Unknown error',
          completed_at: new Date().toISOString()
        })
        .eq('id', aiRequest.id);

      // No cleanup needed for optimized logging

      res.status(500).json({ error: 'AI request failed' });
    }
  } catch (error) {
    console.error('Error in AI proxy setup:', error);
    res.status(500).json({ error: 'Failed to initialize AI request' });
  }
});

// POST /ai/chat - Chat with AI using documents as context
router.post('/chat', async (req: RequestWithUser, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { 
      documentId,
      messages, 
      providerId, 
      model, 
      maxTokens = 4000,
      contextDocuments = [], // Array of document IDs to include as context
      regenerateOnly = false // If true, don't update the document, just return response
    } = req.body;

    if (!documentId || !messages || !providerId || !model) {
      return res.status(400).json({ error: 'Document ID, messages, provider ID, and model are required' });
    }

    // Verify user has access to the document
    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .select('*, projects!inner(id)')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Verify user has access to the project
    const { data: membership } = await supabaseAdmin
      .from('project_members')
      .select('role')
      .eq('project_id', document.project_id)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Use context assembly service for intelligent context building
    // For original documents (non-chat), always include the original document as primary context
    let contextDocumentIds = contextDocuments;
    let primaryDocumentId = documentId;
    
    if (document.interaction_mode !== 'chat') {
      // When creating a new chat from an original document, 
      // the original document should always be included in the context
      if (!contextDocuments.includes(documentId)) {
        contextDocumentIds = [documentId, ...contextDocuments];
      }
      primaryDocumentId = documentId;
    } else {
      // For existing chat documents, use the chat document as primary
      primaryDocumentId = documentId;
    }
    
    const contextData = await contextAssemblyService.assembleContext(
      document.project_id,
      primaryDocumentId,
      contextDocumentIds,
      {
        includeRelated: true,
        includeEventContext: true,
        maxContextSize: 50000, // 50k tokens for chat context
        preferredTypes: ['character', 'setting', 'plot', 'lore'] // Common writing document types
      }
    );

    console.log(`Document ID: ${documentId}, Document interaction_mode: ${document.interaction_mode}`);
    console.log(`Original contextDocuments: [${contextDocuments.join(', ')}]`);
    console.log(`Final contextDocumentIds: [${contextDocumentIds.join(', ')}]`);
    console.log(`Primary document ID for assembly: ${primaryDocumentId}`);
    console.log(`Assembled context: ${contextData.tokenCount} tokens from ${contextData.documentsUsed.length} documents`);
    console.log(`Documents used in context: [${contextData.documentsUsed.join(', ')}]`);
    console.log(`Context assembly mode: ${document.interaction_mode === 'chat' ? 'existing chat' : 'new chat from original document'}`);

    // Prepare messages with context
    const enhancedMessages = [
      { role: 'system', content: `You are helping with a writing project. Here is the current context:\n\n${contextData.context}` },
      ...messages
    ];

    // Make AI request through existing proxy logic
    const response = await aiGateway.makeEnhancedProxyRequest({
      providerId,
      model,
      messages: enhancedMessages,
      maxTokens
    });

    // Get pricing for cost calculation
    const providers = await aiGateway.getProvidersWithKeys();
    const provider = providers.find(p => p.id === providerId);
    let pricing = provider?.pricing[model] || { input: 10, output: 30 };

    const actualCost = Math.ceil(
      (response.inputTokens * pricing.input + response.outputTokens * pricing.output) / 1000000 * 10000
    );

    // Deduct credits
    await supabaseAdmin.rpc('deduct_user_credits', {
      p_user_id: userId,
      p_credits: actualCost
    });

    // If regenerateOnly is true, skip document updates and return response immediately
    if (regenerateOnly) {
      return res.json({
        response: response.response,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        costCredits: actualCost
      });
    }

    let chatDocument = null;

    if (document.interaction_mode === 'chat') {
      // Case 1: Already a chat document - append messages
      let chatData;
      try {
        chatData = document.content ? JSON.parse(document.content) : {
          messages: [],
          primary_context: null,
          additional_context: contextDocuments,
          total_cost: 0,
          conversation_summary: ''
        };
      } catch {
        chatData = {
          messages: [],
          primary_context: null,
          additional_context: contextDocuments,
          total_cost: 0,
          conversation_summary: ''
        };
      }

      // Add new messages
      chatData.messages.push(...messages);
      chatData.messages.push({
        role: 'assistant',
        content: response.response,
        timestamp: new Date().toISOString(),
        tokens: response.outputTokens,
        cost: actualCost
      });

      chatData.total_cost = (chatData.total_cost || 0) + actualCost;
      chatData.additional_context = contextDocuments;

      // Update existing chat document
      await supabaseAdmin
        .from('documents')
        .update({
          content: JSON.stringify(chatData, null, 2),
          last_ai_provider_id: providerId,
          last_ai_model_id: model,
          last_ai_response: response.response,
          last_ai_max_tokens: maxTokens,
          last_ai_response_timestamp: new Date().toISOString()
        })
        .eq('id', documentId);

    } else {
      // Case 2: Original document - create new chat document
      // Find existing chat documents for this project to determine next number
      const { data: existingChats } = await supabaseAdmin
        .from('documents')
        .select('document_type')
        .eq('project_id', document.project_id)
        .eq('interaction_mode', 'chat')
        .like('document_type', 'chat_%');

      // Find the highest chat number
      let chatNumber = 1;
      if (existingChats && existingChats.length > 0) {
        const chatNumbers = existingChats
          .map(chat => {
            const match = chat.document_type?.match(/^chat_(\d+)$/);
            return match ? parseInt(match[1], 10) : 0;
          })
          .filter(num => !isNaN(num));
        
        if (chatNumbers.length > 0) {
          chatNumber = Math.max(...chatNumbers) + 1;
        }
      }

      const chatTitle = `Chat: ${document.title}`;
      const chatDocumentType = `chat_${chatNumber}`;
      const sessionId = Math.random().toString(36).substring(2, 8); // For session tracking

      const chatData = {
        messages: [
          ...messages,
          {
            role: 'assistant',
            content: response.response,
            timestamp: new Date().toISOString(),
            tokens: response.outputTokens,
            cost: actualCost
          }
        ],
        primary_context: {
          document_id: document.id,
          title: document.title,
          content_snapshot: document.content || '',
          captured_at: new Date().toISOString()
        },
        additional_context: contextDocuments,
        total_cost: actualCost,
        session_metadata: {
          started_at: new Date().toISOString(),
          session_id: sessionId,
          ai_config: {
            provider: providerId,
            model: model
          }
        }
      };

      // Create new chat document with inherited grouping
      const { data: newChatDoc, error: chatError } = await supabaseAdmin
        .from('documents')
        .insert({
          project_id: document.project_id,
          title: chatTitle,
          document_type: chatDocumentType,
          interaction_mode: 'chat',
          content: JSON.stringify(chatData, null, 2),
          group_id: document.group_id, // Inherit group from original document
          last_ai_provider_id: providerId,
          last_ai_model_id: model,
          last_ai_response: response.response,
          last_ai_max_tokens: maxTokens,
          last_ai_response_timestamp: new Date().toISOString()
        })
        .select()
        .single();

      if (chatError) {
        console.error('Error creating chat document:', chatError);
        throw new Error('Failed to create chat document');
      }

      chatDocument = newChatDoc;
      console.log(`Created new chat document: ${newChatDoc.id} for original document: ${document.id}`);

      // Copy tags from original document and add "chat" tag
      try {
        // First, get existing tags from original document
        const { data: originalTags } = await supabaseAdmin
          .from('document_tags')
          .select('tag_id')
          .eq('document_id', document.id);

        const originalTagIds = originalTags?.map(dt => dt.tag_id) || [];

        // Find or create "chat" tag
        let chatTagId: string | null = null;
        
        const { data: existingChatTag } = await supabaseAdmin
          .from('tags')
          .select('id')
          .eq('project_id', document.project_id)
          .eq('name', 'chat')
          .single();

        if (existingChatTag) {
          chatTagId = existingChatTag.id;
        } else {
          // Create "chat" tag if it doesn't exist
          const { data: newChatTag, error: createTagError } = await supabaseAdmin
            .from('tags')
            .insert({
              project_id: document.project_id,
              name: 'chat',
              color: '#6366f1' // Indigo color for chat tag
            })
            .select('id')
            .single();

          if (createTagError) {
            console.error('Error creating chat tag:', createTagError);
          } else if (newChatTag) {
            chatTagId = newChatTag.id;
          }
        }

        // Combine original tags with chat tag
        const allTagIds = [...originalTagIds];
        if (chatTagId) {
          allTagIds.push(chatTagId);
        }

        // Create document_tags entries for the new chat document
        if (allTagIds.length > 0) {
          const documentTagInserts = allTagIds.map(tagId => ({
            document_id: newChatDoc.id,
            tag_id: tagId
          }));

          const { error: tagAssignError } = await supabaseAdmin
            .from('document_tags')
            .insert(documentTagInserts);

          if (tagAssignError) {
            console.error('Error assigning tags to chat document:', tagAssignError);
          } else {
            console.log(`Inherited ${originalTagIds.length} tags and added "chat" tag to new chat document`);
          }
        }
      } catch (error) {
        console.error('Error handling tags for chat document:', error);
        // Don't fail the chat creation if tag handling fails
      }
    }

    res.json({
      response: response.response,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      costCredits: actualCost,
      chatDocument
    });

  } catch (error) {
    console.error('Error in AI chat:', error);
    res.status(500).json({ error: 'Chat request failed' });
  }
});

// GET /ai/project-prompts/:projectId - Get prompt templates for a project
router.get('/project-prompts/:projectId', async (req: RequestWithUser, res) => {
  try {
    const userId = req.user?.id;
    const { projectId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify user has access to project
    const { data: membership } = await supabaseAdmin
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get project prompts with document details
    const { data: prompts, error } = await supabaseAdmin
      .from('prompt_templates_with_documents')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching project prompts:', error);
      return res.status(500).json({ error: 'Failed to fetch project prompts' });
    }

    res.json({ prompts: prompts || [] });
  } catch (error) {
    console.error('Error in project prompts endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch project prompts' });
  }
});

// POST /ai/project-prompts - Create a new prompt template
router.post('/project-prompts', async (req: RequestWithUser, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { projectId, documentId, name, description, variables } = req.body;

    if (!projectId || !documentId || !name) {
      return res.status(400).json({ error: 'Project ID, document ID, and name are required' });
    }

    // Verify user has editor/owner access to project
    const { data: membership } = await supabaseAdmin
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (!membership || !['owner', 'editor'].includes(membership.role)) {
      return res.status(403).json({ error: 'Editor access required' });
    }

    // Create prompt template
    const { data: prompt, error } = await supabaseAdmin
      .from('project_prompts')
      .insert({
        project_id: projectId,
        document_id: documentId,
        name,
        description,
        variables: variables || {},
        created_by: userId
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating project prompt:', error);
      return res.status(500).json({ error: 'Failed to create project prompt' });
    }

    res.json({ prompt });
  } catch (error) {
    console.error('Error in create project prompt:', error);
    res.status(500).json({ error: 'Failed to create project prompt' });
  }
});

// POST /ai/transform - Transform document content using a prompt template
router.post('/transform', async (req: RequestWithUser, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { 
      documentId, 
      promptTemplateId, 
      variables = {}, 
      providerId, 
      model, 
      maxTokens = 4000 
    } = req.body;

    if (!documentId || !promptTemplateId || !providerId || !model) {
      return res.status(400).json({ error: 'Document ID, prompt template ID, provider ID, and model are required' });
    }

    // Get document and prompt template
    const { data: document } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    const { data: promptTemplate } = await supabaseAdmin
      .from('prompt_templates_with_documents')
      .select('*')
      .eq('id', promptTemplateId)
      .single();

    if (!document || !promptTemplate) {
      return res.status(404).json({ error: 'Document or prompt template not found' });
    }

    // Verify access to project
    const { data: membership } = await supabaseAdmin
      .from('project_members')
      .select('role')
      .eq('project_id', document.project_id)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Replace template variables in prompt
    let promptContent = promptTemplate.document_content || '';
    Object.entries(variables).forEach(([key, value]) => {
      promptContent = promptContent.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
    });

    // Prepare messages with document context
    const messages: Array<{ role: 'user' | 'system' | 'assistant'; content: string }> = [
      { role: 'system', content: promptContent },
      { role: 'user', content: `Document Title: ${document.title}\nDocument Type: ${document.document_type || 'Document'}\nContent:\n${document.content || ''}` }
    ];

    // Make AI request
    const response = await aiGateway.makeEnhancedProxyRequest({
      providerId,
      model,
      messages,
      maxTokens
    });

    // Calculate cost and deduct credits
    const providers = await aiGateway.getProvidersWithKeys();
    const provider = providers.find(p => p.id === providerId);
    const pricing = provider?.pricing[model] || { input: 10, output: 30 };

    const actualCost = Math.ceil(
      (response.inputTokens * pricing.input + response.outputTokens * pricing.output) / 1000000 * 10000
    );

    await supabaseAdmin.rpc('deduct_user_credits', {
      p_user_id: userId,
      p_credits: actualCost
    });

    // Update document with AI transformation tracking info (not content)
    await supabaseAdmin
      .from('documents')
      .update({
        last_ai_response: response.response,
        last_ai_provider_id: providerId,
        last_ai_model_id: model,
        last_ai_max_tokens: maxTokens,
        last_ai_cost_estimate: {
          input_tokens: response.inputTokens,
          output_tokens: response.outputTokens,
          total_cost_credits: actualCost
        },
        last_ai_response_timestamp: new Date().toISOString()
      })
      .eq('id', documentId);

    res.json({
      response: response.response,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      costCredits: actualCost
    });

  } catch (error) {
    console.error('Error in AI transform:', error);
    res.status(500).json({ error: 'Transform request failed' });
  }
});

// GET /ai/context/:documentId - Preview context assembly for a document  
router.get('/context/:documentId', async (req: RequestWithUser, res) => {
  try {
    const userId = req.user?.id;
    const { documentId } = req.params;
    const { contextDocuments = '' } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify user has access to the document
    const { data: document } = await supabaseAdmin
      .from('documents')
      .select('*, projects!inner(id)')
      .eq('id', documentId)
      .single();

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Verify user has access to the project
    const { data: membership } = await supabaseAdmin
      .from('project_members')
      .select('role')
      .eq('project_id', document.project_id)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Parse additional context documents
    const additionalDocs = contextDocuments ? 
      (contextDocuments as string).split(',').filter(id => id.trim()) : [];

    // Assemble context
    const contextData = await contextAssemblyService.assembleContext(
      document.project_id,
      documentId,
      additionalDocs,
      {
        includeRelated: true,
        includeEventContext: true,
        maxContextSize: 50000,
        preferredTypes: ['character', 'setting', 'plot', 'lore']
      }
    );

    res.json({
      tokenCount: contextData.tokenCount,
      documentsUsed: contextData.documentsUsed,
      contextPreview: contextData.context.substring(0, 1000) + (contextData.context.length > 1000 ? '...' : '')
    });

  } catch (error) {
    console.error('Error getting context preview:', error);
    res.status(500).json({ error: 'Failed to get context preview' });
  }
});

// PUT /ai/chat/:documentId/messages - Update chat messages
router.put('/chat/:documentId/messages', async (req: RequestWithUser, res) => {
  try {
    const userId = req.user?.id;
    const { documentId } = req.params;
    const { messages } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Verify user has access to the document
    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .select('*, projects!inner(id)')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Verify user has access to the project
    const { data: membership } = await supabaseAdmin
      .from('project_members')
      .select('role')
      .eq('project_id', document.project_id)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only allow updates to chat documents
    if (document.interaction_mode !== 'chat') {
      return res.status(400).json({ error: 'Document is not a chat document' });
    }

    // Parse existing chat data
    let chatData;
    try {
      chatData = document.content ? JSON.parse(document.content) : {
        messages: [],
        primary_context: null,
        additional_context: [],
        total_cost: 0,
        conversation_summary: ''
      };
    } catch {
      chatData = {
        messages: [],
        primary_context: null,
        additional_context: [],
        total_cost: 0,
        conversation_summary: ''
      };
    }

    // Update messages
    chatData.messages = messages;

    // Update the document
    const { data: updatedDocument, error: updateError } = await supabaseAdmin
      .from('documents')
      .update({
        content: JSON.stringify(chatData, null, 2),
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating chat document:', updateError);
      return res.status(500).json({ error: 'Failed to update chat document' });
    }

    res.json({ document: updatedDocument });
  } catch (error) {
    console.error('Error updating chat messages:', error);
    res.status(500).json({ error: 'Failed to update chat messages' });
  }
});

// DELETE /ai/chat/:documentId/clear - Clear all chat messages
router.delete('/chat/:documentId/clear', async (req: RequestWithUser, res) => {
  try {
    const userId = req.user?.id;
    const { documentId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify user has access to the document
    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .select('*, projects!inner(id)')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Verify user has access to the project
    const { data: membership } = await supabaseAdmin
      .from('project_members')
      .select('role')
      .eq('project_id', document.project_id)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only allow clearing chat documents
    if (document.interaction_mode !== 'chat') {
      return res.status(400).json({ error: 'Document is not a chat document' });
    }

    // Clear chat data
    const clearedChatData = {
      messages: [],
      primary_context: null,
      additional_context: [],
      total_cost: 0,
      conversation_summary: ''
    };

    // Update the document
    const { data: updatedDocument, error: updateError } = await supabaseAdmin
      .from('documents')
      .update({
        content: JSON.stringify(clearedChatData, null, 2),
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId)
      .select()
      .single();

    if (updateError) {
      console.error('Error clearing chat document:', updateError);
      return res.status(500).json({ error: 'Failed to clear chat document' });
    }

    res.json({ document: updatedDocument });
  } catch (error) {
    console.error('Error clearing chat messages:', error);
    res.status(500).json({ error: 'Failed to clear chat messages' });
  }
});

export default router;