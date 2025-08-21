-- Disable Google Vertex AI provider due to incompatible API structure
UPDATE public.ai_providers 
SET is_active = FALSE 
WHERE id = 'vertex';

-- Also remove any existing Vertex AI provider keys to prevent it from showing up
UPDATE public.ai_provider_keys 
SET is_active = FALSE 
WHERE provider_id = 'vertex';

-- Comment on why Vertex AI is disabled
COMMENT ON COLUMN public.ai_providers.is_active IS 'Provider activation status. Vertex AI disabled due to non-OpenAI-compatible API structure';