-- Migration: Deprecate is_composite and is_prompt boolean flags
-- This migration removes the artificial separation between document types
-- All documents are now unified with optional components for templating
-- All documents can use AI features without restrictions

-- Remove database constraints related to the flags
ALTER TABLE public.documents
DROP CONSTRAINT IF EXISTS check_ai_prompt_fields;

-- First, drop dependent view that references is_composite column
DROP VIEW IF EXISTS public.prompt_templates_with_documents;

-- Drop the is_composite column (templating is now determined by presence of components)
ALTER TABLE public.documents
DROP COLUMN IF EXISTS is_composite;

-- Drop the is_prompt column (all documents can now use AI features)
ALTER TABLE public.documents
DROP COLUMN IF EXISTS is_prompt;

-- Recreate the view without the deprecated is_composite column
CREATE OR REPLACE VIEW public.prompt_templates_with_documents AS
SELECT
    pp.*,
    d.title as document_title,
    d.content as document_content,
    d.document_type,
    d.created_at as document_created_at,
    p.name as project_name
FROM public.project_prompts pp
JOIN public.documents d ON pp.document_id = d.id
JOIN public.projects p ON pp.project_id = p.id;

COMMENT ON VIEW public.prompt_templates_with_documents IS
'Convenient view combining project_prompts registry with associated document details. Updated to use unified document model.';

-- Restore view permissions
GRANT SELECT ON public.prompt_templates_with_documents TO authenticated;

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