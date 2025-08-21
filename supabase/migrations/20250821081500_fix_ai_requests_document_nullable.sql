-- Fix ai_requests table to allow null document_id for proxy requests

-- Remove the NOT NULL constraint from document_id column
ALTER TABLE public.ai_requests 
ALTER COLUMN document_id DROP NOT NULL;

-- Update the foreign key constraint to handle null values properly
ALTER TABLE public.ai_requests 
DROP CONSTRAINT IF EXISTS fk_document,
ADD CONSTRAINT fk_document 
    FOREIGN KEY (document_id) 
    REFERENCES public.documents(id) 
    ON DELETE CASCADE;

-- Update table comment to reflect that document_id can be null for proxy requests
COMMENT ON TABLE public.ai_requests IS 'Log of all AI requests for auditing and cost tracking. document_id can be null for standalone proxy requests.';

-- Add column comment for clarity
COMMENT ON COLUMN public.ai_requests.document_id IS 'Optional reference to document (null for proxy requests that are not tied to specific documents)';