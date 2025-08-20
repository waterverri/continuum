-- Fix the AI constraint to be less restrictive
-- Only require that non-prompt documents don't have ai_response or ai_status

-- Drop the existing constraint
ALTER TABLE public.documents 
DROP CONSTRAINT IF EXISTS check_ai_prompt_fields;

-- Add a more permissive constraint that only restricts ai_response and ai_status for non-prompt documents
ALTER TABLE public.documents 
ADD CONSTRAINT check_ai_prompt_fields 
CHECK (
    (is_prompt = FALSE AND ai_response IS NULL AND ai_status IS NULL) OR
    (is_prompt = TRUE)
);

COMMENT ON CONSTRAINT check_ai_prompt_fields ON public.documents IS 'Ensures AI response and status fields are only used with prompt documents';