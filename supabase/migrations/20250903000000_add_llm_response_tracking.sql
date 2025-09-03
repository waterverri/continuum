-- Add LLM response tracking to documents table for promptable documents
-- This allows saving and reusing the last AI response with full metadata

-- Add columns for LLM response tracking
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS last_ai_response TEXT NULL,
ADD COLUMN IF NOT EXISTS last_ai_provider_id TEXT NULL,
ADD COLUMN IF NOT EXISTS last_ai_model_id TEXT NULL,
ADD COLUMN IF NOT EXISTS last_ai_max_tokens INTEGER NULL,
ADD COLUMN IF NOT EXISTS last_ai_cost_estimate JSONB NULL,
ADD COLUMN IF NOT EXISTS last_ai_response_timestamp TIMESTAMPTZ NULL;

-- Add column comments
COMMENT ON COLUMN public.documents.last_ai_response IS 'Last AI-generated response content for prompt documents';
COMMENT ON COLUMN public.documents.last_ai_provider_id IS 'AI provider ID used for the last response';
COMMENT ON COLUMN public.documents.last_ai_model_id IS 'AI model ID used for the last response';
COMMENT ON COLUMN public.documents.last_ai_max_tokens IS 'Max tokens parameter used for the last response';
COMMENT ON COLUMN public.documents.last_ai_cost_estimate IS 'Cost estimation details for the last response';
COMMENT ON COLUMN public.documents.last_ai_response_timestamp IS 'Timestamp when the last AI response was generated';

-- Update constraint to include new AI response fields
DO $$ 
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_ai_prompt_fields'
    ) THEN
        ALTER TABLE public.documents DROP CONSTRAINT check_ai_prompt_fields;
    END IF;
    
    -- Add updated constraint
    ALTER TABLE public.documents 
    ADD CONSTRAINT check_ai_prompt_fields 
    CHECK (
        (is_prompt = FALSE AND 
         ai_model IS NULL AND 
         last_ai_response IS NULL AND
         last_ai_provider_id IS NULL AND
         last_ai_model_id IS NULL AND
         last_ai_max_tokens IS NULL AND
         last_ai_cost_estimate IS NULL AND
         last_ai_response_timestamp IS NULL
        ) OR
        (is_prompt = TRUE)
    );
END $$;