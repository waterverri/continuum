-- Remove unnecessary AI response fields from documents table
-- These fields were incorrectly stored in documents - AI responses should be ephemeral
-- Keep only is_prompt (identifies prompt documents) and ai_model (target model)

ALTER TABLE public.documents 
DROP COLUMN IF EXISTS ai_response,
DROP COLUMN IF EXISTS ai_status,
DROP COLUMN IF EXISTS ai_tokens_used,
DROP COLUMN IF EXISTS ai_cost_credits,
DROP COLUMN IF EXISTS ai_submitted_at,
DROP COLUMN IF EXISTS ai_completed_at;