-- Add AI configuration tracking to projects table
-- This will store the last used AI provider and model for the project
-- and serve as defaults when document-specific AI columns are empty

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS ai_config JSONB DEFAULT '{}';

-- Add comment for the new column
COMMENT ON COLUMN public.projects.ai_config IS 'JSONB object storing AI configuration for the project (provider_id, model_id, etc.)';

-- Create an index on the ai_config column for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_ai_config ON public.projects USING GIN (ai_config);

-- Example ai_config structure:
-- {
--   "provider_id": "openai",
--   "model_id": "gpt-4",
--   "last_updated": "2025-09-16T10:30:00Z",
--   "updated_by": "user_id_here"
-- }