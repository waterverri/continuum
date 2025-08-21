-- Optimize LLM call logs table by removing unnecessary fields and adding performance indexes

-- Remove unnecessary columns that are not needed for analytics
ALTER TABLE public.llm_call_logs 
DROP COLUMN IF EXISTS document_id,
DROP COLUMN IF EXISTS input_text,
DROP COLUMN IF EXISTS output_text;

-- Drop the old indexes that referenced removed columns
DROP INDEX IF EXISTS idx_llm_logs_document;

-- Update the foreign key constraint to remove document dependency
ALTER TABLE public.llm_call_logs 
DROP CONSTRAINT IF EXISTS fk_document;

-- Add performance indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_llm_logs_provider_key ON public.llm_call_logs (provider_key_id);
CREATE INDEX IF NOT EXISTS idx_llm_logs_model ON public.llm_call_logs (model);
CREATE INDEX IF NOT EXISTS idx_llm_logs_request_started ON public.llm_call_logs (request_started_at DESC);

-- Add composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_llm_logs_provider_model_date ON public.llm_call_logs (provider_id, model, request_started_at DESC);

-- Drop all existing versions of log_llm_call function to avoid conflicts
DROP FUNCTION IF EXISTS public.log_llm_call(UUID, UUID, TEXT, UUID, TEXT, TEXT, INTEGER, INTEGER, JSONB);
DROP FUNCTION IF EXISTS public.log_llm_call(UUID, UUID, UUID, TEXT, UUID, TEXT, TEXT, INTEGER, INTEGER, JSONB);

-- Update the log_llm_call function to remove document_id parameter
CREATE OR REPLACE FUNCTION public.log_llm_call(
    p_user_id UUID,
    p_ai_request_id UUID,
    p_provider_id TEXT,
    p_provider_key_id UUID,
    p_model TEXT,
    p_input_tokens INTEGER,
    p_max_output_tokens INTEGER DEFAULT NULL,
    p_request_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO public.llm_call_logs (
        user_id,
        ai_request_id,
        provider_id,
        provider_key_id,
        model,
        input_tokens,
        max_output_tokens,
        request_metadata
    ) VALUES (
        p_user_id,
        p_ai_request_id,
        p_provider_id,
        p_provider_key_id,
        p_model,
        p_input_tokens,
        p_max_output_tokens,
        p_request_metadata
    )
    RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$;

COMMENT ON FUNCTION public.log_llm_call(UUID, UUID, TEXT, UUID, TEXT, INTEGER, INTEGER, JSONB) IS 'Creates a new LLM call log entry without document dependency and returns the log ID';

-- Drop all existing versions of update_llm_call_response function to avoid conflicts
DROP FUNCTION IF EXISTS public.update_llm_call_response(UUID, TEXT, INTEGER, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, JSONB, INTEGER, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.update_llm_call_response(UUID, INTEGER, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, JSONB, INTEGER, TIMESTAMPTZ);

-- Update the update_llm_call_response function to remove output_text parameter
CREATE OR REPLACE FUNCTION public.update_llm_call_response(
    p_log_id UUID,
    p_output_tokens INTEGER,
    p_finish_reason TEXT,
    p_input_cost_credits INTEGER,
    p_output_cost_credits INTEGER,
    p_total_cost_credits INTEGER,
    p_api_response_status INTEGER DEFAULT NULL,
    p_api_response_headers JSONB DEFAULT NULL,
    p_rate_limit_remaining INTEGER DEFAULT NULL,
    p_rate_limit_reset_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.llm_call_logs
    SET 
        output_tokens = p_output_tokens,
        finish_reason = p_finish_reason,
        input_cost_credits = p_input_cost_credits,
        output_cost_credits = p_output_cost_credits,
        total_cost_credits = p_total_cost_credits,
        response_received_at = now(),
        latency_ms = EXTRACT(EPOCH FROM (now() - request_started_at)) * 1000,
        api_response_status = p_api_response_status,
        api_response_headers = p_api_response_headers,
        rate_limit_remaining = p_rate_limit_remaining,
        rate_limit_reset_at = p_rate_limit_reset_at
    WHERE id = p_log_id;
END;
$$;

COMMENT ON FUNCTION public.update_llm_call_response(UUID, INTEGER, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, JSONB, INTEGER, TIMESTAMPTZ) IS 'Updates LLM call log with response data without storing output text';

-- Update table comments to reflect the optimization
COMMENT ON TABLE public.llm_call_logs IS 'Optimized logging of LLM API calls for performance monitoring, billing, and analytics';