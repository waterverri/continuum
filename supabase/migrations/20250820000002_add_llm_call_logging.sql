-- Create comprehensive LLM call logging table
CREATE TABLE public.llm_call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Request identification
    user_id UUID NOT NULL,
    document_id UUID NOT NULL,
    ai_request_id UUID NULL, -- Reference to ai_requests table
    
    -- Provider and model information
    provider_id TEXT NOT NULL,
    provider_key_id UUID NOT NULL,
    model TEXT NOT NULL,
    
    -- Request details
    input_text TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    max_output_tokens INTEGER NULL,
    
    -- Response details
    output_text TEXT NULL,
    output_tokens INTEGER NULL,
    finish_reason TEXT NULL, -- 'completed', 'length', 'content_filter', 'error'
    
    -- Cost and billing
    input_cost_credits INTEGER NOT NULL DEFAULT 0,
    output_cost_credits INTEGER NOT NULL DEFAULT 0,
    total_cost_credits INTEGER NOT NULL DEFAULT 0,
    
    -- Performance metrics
    request_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    response_received_at TIMESTAMPTZ NULL,
    latency_ms INTEGER NULL, -- Calculated: response_received_at - request_started_at
    
    -- API response metadata
    api_response_status INTEGER NULL, -- HTTP status code
    api_response_headers JSONB NULL,
    rate_limit_remaining INTEGER NULL,
    rate_limit_reset_at TIMESTAMPTZ NULL,
    
    -- Error handling
    error_occurred BOOLEAN NOT NULL DEFAULT false,
    error_type TEXT NULL, -- 'api_error', 'network_error', 'quota_exceeded', 'invalid_key', etc.
    error_message TEXT NULL,
    error_details JSONB NULL,
    
    -- Additional metadata
    request_metadata JSONB NULL, -- Custom metadata, API parameters, etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Foreign key constraints
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_document FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE,
    CONSTRAINT fk_ai_request FOREIGN KEY (ai_request_id) REFERENCES public.ai_requests(id) ON DELETE SET NULL,
    CONSTRAINT fk_provider FOREIGN KEY (provider_id) REFERENCES public.ai_providers(id),
    CONSTRAINT fk_provider_key FOREIGN KEY (provider_key_id) REFERENCES public.ai_provider_keys(id)
);

-- Add table and column comments
COMMENT ON TABLE public.llm_call_logs IS 'Comprehensive logging of all LLM API calls for monitoring, billing, and analytics';
COMMENT ON COLUMN public.llm_call_logs.user_id IS 'User who initiated the request';
COMMENT ON COLUMN public.llm_call_logs.document_id IS 'Document used for the prompt';
COMMENT ON COLUMN public.llm_call_logs.ai_request_id IS 'Reference to the AI request (if applicable)';
COMMENT ON COLUMN public.llm_call_logs.provider_key_id IS 'Specific API key used for round-robin tracking';
COMMENT ON COLUMN public.llm_call_logs.input_text IS 'Full prompt sent to the LLM (for debugging and audit)';
COMMENT ON COLUMN public.llm_call_logs.output_text IS 'Response received from the LLM';
COMMENT ON COLUMN public.llm_call_logs.finish_reason IS 'Why the LLM stopped generating (completed, length, etc.)';
COMMENT ON COLUMN public.llm_call_logs.latency_ms IS 'Response time in milliseconds';
COMMENT ON COLUMN public.llm_call_logs.rate_limit_remaining IS 'Remaining API calls from rate limit headers';
COMMENT ON COLUMN public.llm_call_logs.error_type IS 'Category of error for analytics and alerting';
COMMENT ON COLUMN public.llm_call_logs.request_metadata IS 'Additional request parameters and context';

-- Create indexes for efficient querying
CREATE INDEX idx_llm_logs_user_date ON public.llm_call_logs (user_id, created_at DESC);
CREATE INDEX idx_llm_logs_provider_date ON public.llm_call_logs (provider_id, created_at DESC);
CREATE INDEX idx_llm_logs_document ON public.llm_call_logs (document_id);
CREATE INDEX idx_llm_logs_ai_request ON public.llm_call_logs (ai_request_id);
CREATE INDEX idx_llm_logs_provider_key ON public.llm_call_logs (provider_key_id);
CREATE INDEX idx_llm_logs_error ON public.llm_call_logs (error_occurred, error_type);
CREATE INDEX idx_llm_logs_performance ON public.llm_call_logs (latency_ms, created_at DESC) WHERE latency_ms IS NOT NULL;
CREATE INDEX idx_llm_logs_cost ON public.llm_call_logs (total_cost_credits, created_at DESC);

-- Create analytics views
CREATE VIEW public.llm_usage_analytics AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    provider_id,
    model,
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE error_occurred = false) as successful_calls,
    COUNT(*) FILTER (WHERE error_occurred = true) as failed_calls,
    SUM(input_tokens) as total_input_tokens,
    SUM(output_tokens) as total_output_tokens,
    SUM(total_cost_credits) as total_cost_credits,
    AVG(latency_ms) FILTER (WHERE latency_ms IS NOT NULL) as avg_latency_ms,
    MAX(latency_ms) as max_latency_ms,
    MIN(latency_ms) FILTER (WHERE latency_ms IS NOT NULL) as min_latency_ms
FROM public.llm_call_logs
GROUP BY DATE_TRUNC('day', created_at), provider_id, model
ORDER BY date DESC, provider_id, model;

COMMENT ON VIEW public.llm_usage_analytics IS 'Daily analytics of LLM usage by provider and model';

CREATE VIEW public.user_llm_usage AS
SELECT 
    user_id,
    DATE_TRUNC('month', created_at) as month,
    COUNT(*) as total_calls,
    SUM(total_cost_credits) as total_credits_used,
    SUM(input_tokens) as total_input_tokens,
    SUM(output_tokens) as total_output_tokens,
    AVG(latency_ms) FILTER (WHERE latency_ms IS NOT NULL) as avg_latency_ms
FROM public.llm_call_logs
WHERE error_occurred = false
GROUP BY user_id, DATE_TRUNC('month', created_at)
ORDER BY month DESC, total_credits_used DESC;

COMMENT ON VIEW public.user_llm_usage IS 'Monthly usage summary by user for billing and quotas';

CREATE VIEW public.provider_performance AS
SELECT 
    provider_id,
    model,
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE error_occurred = false) as successful_calls,
    ROUND(100.0 * COUNT(*) FILTER (WHERE error_occurred = false) / COUNT(*), 2) as success_rate_percent,
    AVG(latency_ms) FILTER (WHERE latency_ms IS NOT NULL) as avg_latency_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE latency_ms IS NOT NULL) as p95_latency_ms,
    COUNT(*) FILTER (WHERE error_type = 'rate_limit') as rate_limit_errors,
    COUNT(*) FILTER (WHERE error_type = 'quota_exceeded') as quota_errors
FROM public.llm_call_logs
WHERE created_at >= now() - interval '7 days'
GROUP BY provider_id, model
ORDER BY total_calls DESC;

COMMENT ON VIEW public.provider_performance IS 'Provider performance metrics over the last 7 days';

-- Function to log LLM calls
CREATE OR REPLACE FUNCTION public.log_llm_call(
    p_user_id UUID,
    p_document_id UUID,
    p_ai_request_id UUID,
    p_provider_id TEXT,
    p_provider_key_id UUID,
    p_model TEXT,
    p_input_text TEXT,
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
        document_id,
        ai_request_id,
        provider_id,
        provider_key_id,
        model,
        input_text,
        input_tokens,
        max_output_tokens,
        request_metadata
    ) VALUES (
        p_user_id,
        p_document_id,
        p_ai_request_id,
        p_provider_id,
        p_provider_key_id,
        p_model,
        p_input_text,
        p_input_tokens,
        p_max_output_tokens,
        p_request_metadata
    )
    RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$;

COMMENT ON FUNCTION public.log_llm_call IS 'Creates a new LLM call log entry and returns the log ID';

-- Function to update LLM call with response
CREATE OR REPLACE FUNCTION public.update_llm_call_response(
    p_log_id UUID,
    p_output_text TEXT,
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
        output_text = p_output_text,
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

COMMENT ON FUNCTION public.update_llm_call_response IS 'Updates LLM call log with response data and calculates latency';

-- Function to log LLM call errors
CREATE OR REPLACE FUNCTION public.log_llm_call_error(
    p_log_id UUID,
    p_error_type TEXT,
    p_error_message TEXT,
    p_error_details JSONB DEFAULT NULL,
    p_api_response_status INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.llm_call_logs
    SET 
        error_occurred = true,
        error_type = p_error_type,
        error_message = p_error_message,
        error_details = p_error_details,
        response_received_at = now(),
        latency_ms = EXTRACT(EPOCH FROM (now() - request_started_at)) * 1000,
        api_response_status = p_api_response_status
    WHERE id = p_log_id;
END;
$$;

COMMENT ON FUNCTION public.log_llm_call_error IS 'Logs error information for a failed LLM call';

-- RLS Policies
ALTER TABLE public.llm_call_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own logs
CREATE POLICY "Users can view their own LLM logs" ON public.llm_call_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Service role can manage all logs
CREATE POLICY "Service role can manage all LLM logs" ON public.llm_call_logs
    FOR ALL USING (auth.role() = 'service_role');

-- Analytics views are accessible to authenticated users (aggregated data)
CREATE POLICY "Authenticated users can view analytics" ON public.llm_call_logs
    FOR SELECT USING (auth.role() = 'authenticated');

-- Create materialized view for real-time dashboard (refresh periodically)
CREATE MATERIALIZED VIEW public.llm_realtime_stats AS
SELECT 
    COUNT(*) as total_calls_today,
    COUNT(*) FILTER (WHERE error_occurred = false) as successful_calls_today,
    COUNT(*) FILTER (WHERE error_occurred = true) as failed_calls_today,
    SUM(total_cost_credits) as total_credits_used_today,
    AVG(latency_ms) FILTER (WHERE latency_ms IS NOT NULL) as avg_latency_today_ms,
    COUNT(DISTINCT user_id) as active_users_today,
    COUNT(DISTINCT provider_id) as active_providers_today
FROM public.llm_call_logs
WHERE created_at >= CURRENT_DATE;

COMMENT ON MATERIALIZED VIEW public.llm_realtime_stats IS 'Real-time statistics for dashboard (refresh periodically)';

-- Create index on materialized view
CREATE UNIQUE INDEX idx_llm_realtime_stats_unique ON public.llm_realtime_stats ((1));

-- Function to refresh real-time stats
CREATE OR REPLACE FUNCTION public.refresh_llm_realtime_stats()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.llm_realtime_stats;
END;
$$;

COMMENT ON FUNCTION public.refresh_llm_realtime_stats IS 'Refreshes the real-time LLM statistics materialized view';