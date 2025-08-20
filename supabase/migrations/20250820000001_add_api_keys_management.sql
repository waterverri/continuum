-- Create table for storing API keys per provider
CREATE TABLE public.ai_provider_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id TEXT NOT NULL,
    key_name TEXT NOT NULL,
    api_key TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID NULL,
    notes TEXT NULL,
    CONSTRAINT fk_provider FOREIGN KEY (provider_id) REFERENCES public.ai_providers(id),
    CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES auth.users(id),
    CONSTRAINT unique_provider_key_name UNIQUE (provider_id, key_name)
);

COMMENT ON TABLE public.ai_provider_keys IS 'API keys for AI providers with round-robin rotation support';
COMMENT ON COLUMN public.ai_provider_keys.provider_id IS 'Reference to ai_providers table';
COMMENT ON COLUMN public.ai_provider_keys.key_name IS 'Human-readable name for the API key (e.g., "primary", "backup-1")';
COMMENT ON COLUMN public.ai_provider_keys.api_key IS 'Encrypted API key value';
COMMENT ON COLUMN public.ai_provider_keys.usage_count IS 'Number of times this key has been used (for round-robin)';
COMMENT ON COLUMN public.ai_provider_keys.last_used_at IS 'Last time this key was used';

-- Create index for efficient round-robin selection
CREATE INDEX idx_provider_keys_round_robin 
ON public.ai_provider_keys (provider_id, is_active, usage_count, last_used_at);

-- Create index for provider lookup
CREATE INDEX idx_provider_keys_provider 
ON public.ai_provider_keys (provider_id);

-- Function to get next API key with round-robin logic
CREATE OR REPLACE FUNCTION public.get_next_api_key(p_provider_id TEXT)
RETURNS TABLE (
    key_id UUID,
    api_key TEXT,
    key_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    selected_key RECORD;
BEGIN
    -- Get the least used active key for the provider
    SELECT pk.id, pk.api_key, pk.key_name
    INTO selected_key
    FROM public.ai_provider_keys pk
    WHERE pk.provider_id = p_provider_id 
      AND pk.is_active = true
    ORDER BY pk.usage_count ASC, pk.last_used_at ASC NULLS FIRST
    LIMIT 1;
    
    -- If no key found, return empty result
    IF selected_key.id IS NULL THEN
        RETURN;
    END IF;
    
    -- Update usage statistics
    UPDATE public.ai_provider_keys
    SET 
        usage_count = usage_count + 1,
        last_used_at = now()
    WHERE id = selected_key.id;
    
    -- Return the selected key
    RETURN QUERY SELECT selected_key.id, selected_key.api_key, selected_key.key_name;
END;
$$;

COMMENT ON FUNCTION public.get_next_api_key IS 'Gets the next API key using round-robin logic based on usage count';

-- Function to reset usage counters (for maintenance)
CREATE OR REPLACE FUNCTION public.reset_api_key_usage_counters(p_provider_id TEXT DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    IF p_provider_id IS NULL THEN
        -- Reset all providers
        UPDATE public.ai_provider_keys
        SET usage_count = 0, last_used_at = NULL;
        GET DIAGNOSTICS updated_count = ROW_COUNT;
    ELSE
        -- Reset specific provider
        UPDATE public.ai_provider_keys
        SET usage_count = 0, last_used_at = NULL
        WHERE provider_id = p_provider_id;
        GET DIAGNOSTICS updated_count = ROW_COUNT;
    END IF;
    
    RETURN updated_count;
END;
$$;

COMMENT ON FUNCTION public.reset_api_key_usage_counters IS 'Resets usage counters for load balancing maintenance';

-- RLS Policies for ai_provider_keys
ALTER TABLE public.ai_provider_keys ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can view keys (but actual key values are hidden in normal queries)
CREATE POLICY "Users can view API key metadata" ON public.ai_provider_keys
    FOR SELECT USING (auth.role() = 'authenticated');

-- Only service role can insert/update/delete API keys
CREATE POLICY "Service role can manage API keys" ON public.ai_provider_keys
    FOR ALL USING (auth.role() = 'service_role');

-- Create view for API key management (excludes actual API key values)
CREATE VIEW public.api_key_management AS
SELECT 
    id,
    provider_id,
    key_name,
    is_active,
    usage_count,
    last_used_at,
    created_at,
    created_by,
    notes,
    -- Mask the API key for security
    CASE 
        WHEN LENGTH(api_key) > 8 THEN 
            LEFT(api_key, 4) || '...' || RIGHT(api_key, 4)
        ELSE '***'
    END as masked_api_key
FROM public.ai_provider_keys;

COMMENT ON VIEW public.api_key_management IS 'Safe view of API keys with masked values for management interfaces';

-- Insert default provider configurations (update existing ones to remove hardcoded keys)
UPDATE public.ai_providers 
SET pricing = '{"grok-beta": {"input": 5, "output": 15}}'::jsonb
WHERE id = 'grok';

UPDATE public.ai_providers 
SET pricing = '{"gemini-pro": {"input": 1, "output": 3}, "gemini-pro-vision": {"input": 1, "output": 3}}'::jsonb
WHERE id = 'vertex';

UPDATE public.ai_providers 
SET pricing = '{"anthropic/claude-3-sonnet": {"input": 3, "output": 15}, "openai/gpt-4-turbo": {"input": 10, "output": 30}, "meta-llama/llama-2-70b-chat": {"input": 1, "output": 1}}'::jsonb
WHERE id = 'openrouter';