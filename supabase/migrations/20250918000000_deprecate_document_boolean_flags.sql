-- Migration: Deprecate is_composite and is_prompt boolean flags
-- This migration removes the artificial separation between document types
-- All documents are now unified with optional components for templating
-- All documents can use AI features without restrictions

-- Remove database constraints related to the flags
ALTER TABLE public.documents
DROP CONSTRAINT IF EXISTS check_ai_prompt_fields;

-- Drop the is_composite column (templating is now determined by presence of components)
ALTER TABLE public.documents
DROP COLUMN IF EXISTS is_composite;

-- Drop the is_prompt column (all documents can now use AI features)
ALTER TABLE public.documents
DROP COLUMN IF EXISTS is_prompt;

-- Update any references in comments to reflect the new unified model
COMMENT ON COLUMN public.documents.components IS 'JSONB map of placeholder keys to document IDs for template documents (e.g., {"chapter1": "uuid-..."})';

-- Update document history table to match
ALTER TABLE public.document_history
DROP COLUMN IF EXISTS is_composite;

-- Note: We keep the components column and ai_* columns as they are still useful
-- Components enable templating for any document
-- AI columns enable AI features for any document

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully:';
    RAISE NOTICE '- Removed is_composite and is_prompt boolean flags';
    RAISE NOTICE '- Removed check_ai_prompt_fields constraint';
    RAISE NOTICE '- All documents now unified with optional templating and AI features';
    RAISE NOTICE '- Template documents determined by presence of components';
    RAISE NOTICE '- AI features available for all documents';
END $$;