-- APPROVED CLEANUP: Remove document coupling from ai_requests table
-- Make AI requests truly generic for billing/auditing across all features

-- Remove the foreign key constraint to documents (this will be dropped automatically with the column)
ALTER TABLE public.ai_requests 
DROP CONSTRAINT IF EXISTS fk_document;

-- Remove the document_id column entirely - AI requests should be generic!
ALTER TABLE public.ai_requests 
DROP COLUMN IF EXISTS document_id;

-- Update table comment to reflect generic nature
COMMENT ON TABLE public.ai_requests IS 'Generic log of all AI requests for auditing and cost tracking - decoupled from any specific feature';