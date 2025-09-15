-- Remove the restrictive check_ai_prompt_fields constraint
-- This constraint was too restrictive and prevented chat documents from storing AI response metadata

ALTER TABLE public.documents 
DROP CONSTRAINT IF EXISTS check_ai_prompt_fields;

COMMENT ON TABLE public.documents IS 'Documents table with AI response tracking fields available for all document types';