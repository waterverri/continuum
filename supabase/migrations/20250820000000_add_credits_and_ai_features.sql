-- Add credit balance to profiles table
ALTER TABLE public.profiles 
ADD COLUMN credit_balance INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.credit_balance IS 'User credit balance for AI services. 1 dollar = 10000 credits';

-- Add AI-related columns to documents table for prompt document type
ALTER TABLE public.documents 
ADD COLUMN is_prompt BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN ai_model TEXT NULL,
ADD COLUMN ai_response TEXT NULL,
ADD COLUMN ai_tokens_used INTEGER NULL,
ADD COLUMN ai_cost_credits INTEGER NULL,
ADD COLUMN ai_status TEXT NULL CHECK (ai_status IN ('pending', 'processing', 'completed', 'failed')),
ADD COLUMN ai_submitted_at TIMESTAMPTZ NULL,
ADD COLUMN ai_completed_at TIMESTAMPTZ NULL;

-- Add column comments for AI features
COMMENT ON COLUMN public.documents.is_prompt IS 'System flag indicating this is a prompt document with AI functionality';
COMMENT ON COLUMN public.documents.ai_model IS 'AI model used for prompt documents (e.g., grok-beta, gemini-pro, etc.)';
COMMENT ON COLUMN public.documents.ai_response IS 'Response from AI model for prompt documents';
COMMENT ON COLUMN public.documents.ai_tokens_used IS 'Total tokens consumed for the AI request';
COMMENT ON COLUMN public.documents.ai_cost_credits IS 'Credits deducted for this AI request';
COMMENT ON COLUMN public.documents.ai_status IS 'Status of AI processing for prompt documents';
COMMENT ON COLUMN public.documents.ai_submitted_at IS 'Timestamp when AI request was submitted';
COMMENT ON COLUMN public.documents.ai_completed_at IS 'Timestamp when AI request was completed';

-- Create table for AI provider configurations
CREATE TABLE public.ai_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    endpoint_url TEXT NOT NULL,
    models JSONB NOT NULL DEFAULT '[]'::jsonb,
    pricing JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_providers IS 'Configuration for AI service providers and their models';
COMMENT ON COLUMN public.ai_providers.models IS 'Array of supported model names';
COMMENT ON COLUMN public.ai_providers.pricing IS 'Pricing structure for input/output tokens per model';

-- Insert default AI providers
INSERT INTO public.ai_providers (id, name, endpoint_url, models, pricing) VALUES
('grok', 'Grok AI', 'https://api.x.ai/v1', 
 '["grok-beta"]'::jsonb,
 '{"grok-beta": {"input": 5, "output": 15}}'::jsonb),
('vertex', 'Google Vertex AI', 'https://us-central1-aiplatform.googleapis.com/v1', 
 '["gemini-pro", "gemini-pro-vision"]'::jsonb,
 '{"gemini-pro": {"input": 1, "output": 3}, "gemini-pro-vision": {"input": 1, "output": 3}}'::jsonb),
('openrouter', 'OpenRouter', 'https://openrouter.ai/api/v1', 
 '["anthropic/claude-3-sonnet", "openai/gpt-4-turbo", "meta-llama/llama-2-70b-chat"]'::jsonb,
 '{"anthropic/claude-3-sonnet": {"input": 3, "output": 15}, "openai/gpt-4-turbo": {"input": 10, "output": 30}, "meta-llama/llama-2-70b-chat": {"input": 1, "output": 1}}'::jsonb);

-- Create table for AI request logs
CREATE TABLE public.ai_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    document_id UUID NOT NULL,
    provider_id TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NULL,
    cost_credits INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ NULL,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_document FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE,
    CONSTRAINT fk_provider FOREIGN KEY (provider_id) REFERENCES public.ai_providers(id)
);

COMMENT ON TABLE public.ai_requests IS 'Log of all AI requests for auditing and cost tracking';

-- Add constraint to ensure AI columns are only used with prompt documents
ALTER TABLE public.documents 
ADD CONSTRAINT check_ai_prompt_fields 
CHECK (
    (is_prompt = FALSE AND ai_model IS NULL AND ai_response IS NULL) OR
    (is_prompt = TRUE)
);

-- Function to deduct credits from user balance
CREATE OR REPLACE FUNCTION public.deduct_user_credits(
    p_user_id UUID,
    p_credits INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_balance INTEGER;
BEGIN
    -- Get current balance with row lock
    SELECT credit_balance INTO current_balance
    FROM public.profiles
    WHERE user_id = p_user_id
    FOR UPDATE;
    
    -- Check if user exists and has sufficient credits
    IF current_balance IS NULL THEN
        RETURN FALSE;
    END IF;
    
    IF current_balance < p_credits THEN
        RETURN FALSE;
    END IF;
    
    -- Deduct credits
    UPDATE public.profiles
    SET credit_balance = credit_balance - p_credits
    WHERE user_id = p_user_id;
    
    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.deduct_user_credits IS 'Safely deducts credits from user balance with atomic transaction';