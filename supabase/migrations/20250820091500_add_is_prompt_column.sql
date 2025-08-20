-- Add is_prompt boolean column to documents table
-- This migration adds the missing is_prompt column that enables AI functionality

ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS is_prompt BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.documents.is_prompt IS 'System flag indicating this is a prompt document with AI functionality';

-- Add constraint to ensure AI columns are only used with prompt documents
ALTER TABLE public.documents 
ADD CONSTRAINT IF NOT EXISTS check_ai_prompt_fields 
CHECK (
    (is_prompt = FALSE AND ai_model IS NULL AND ai_response IS NULL) OR
    (is_prompt = TRUE)
);