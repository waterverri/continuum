-- Remove unnecessary constraint that's blocking document creation
-- The constraint was overly restrictive and serves no actual business purpose

ALTER TABLE public.documents 
DROP CONSTRAINT IF EXISTS check_ai_prompt_fields;