-- Migration: Convert existing is_prompt=true documents to new architecture
-- This migrates existing prompt documents to the new project_prompts registry system

-- Step 1: Create a function to detect template variables in prompt content
CREATE OR REPLACE FUNCTION extract_template_variables(content TEXT)
RETURNS jsonb AS $$
DECLARE
    variables jsonb := '{}';
    matches text[];
    var_name text;
BEGIN
    -- Extract variables in {{variable_name}} format
    SELECT array_agg(DISTINCT substring(match FROM '\{\{([^}]+)\}\}'))
    INTO matches
    FROM regexp_split_to_table(content, '') AS t(char)
    CROSS JOIN LATERAL regexp_matches(content, '\{\{([^}]+)\}\}', 'g') AS m(match);
    
    -- Convert array to JSON object with default values
    IF matches IS NOT NULL THEN
        FOR i IN 1..array_length(matches, 1) LOOP
            var_name := trim(matches[i]);
            IF var_name IS NOT NULL AND var_name != '' THEN
                variables := jsonb_set(
                    variables, 
                    ARRAY[var_name], 
                    jsonb_build_object(
                        'type', 'text',
                        'description', 'Template variable: ' || var_name,
                        'default', ''
                    )
                );
            END IF;
        END LOOP;
    END IF;
    
    RETURN variables;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Migrate existing is_prompt=true documents to project_prompts registry
-- This preserves all existing prompt documents as templates
INSERT INTO public.project_prompts (
    project_id,
    document_id, 
    name,
    description,
    variables,
    created_at,
    updated_at,
    created_by
)
SELECT 
    d.project_id,
    d.id,
    COALESCE(d.title, 'Untitled Prompt') AS name,
    CASE 
        WHEN d.document_type IS NOT NULL AND d.document_type != '' 
        THEN 'Migrated from ' || d.document_type || ' prompt document'
        ELSE 'Migrated prompt document template'
    END AS description,
    extract_template_variables(COALESCE(d.content, '')) AS variables,
    d.created_at,
    NOW() AS updated_at,
    -- Use the project owner as the creator (since we don't track document creators)
    (
        SELECT pm.user_id 
        FROM project_members pm 
        WHERE pm.project_id = d.project_id 
        AND pm.role = 'owner' 
        LIMIT 1
    ) AS created_by
FROM public.documents d
WHERE d.is_prompt = true
-- Only migrate if not already in registry (handle re-run safety)
AND NOT EXISTS (
    SELECT 1 FROM public.project_prompts pp 
    WHERE pp.document_id = d.id
);

-- Step 3: Update interaction_mode for existing prompt documents
-- These remain as 'document' mode but are now also registered as templates
UPDATE public.documents 
SET interaction_mode = 'document'
WHERE is_prompt = true 
AND interaction_mode = 'document'; -- Only update if still default

-- Step 4: Add comments explaining the migration strategy
COMMENT ON FUNCTION extract_template_variables(TEXT) IS 
'Utility function to detect {{variable}} patterns in prompt content and convert to JSONB schema';

-- Step 5: Create a view for easy template management queries
CREATE OR REPLACE VIEW public.prompt_templates_with_documents AS
SELECT 
    pp.*,
    d.title as document_title,
    d.content as document_content,
    d.document_type,
    d.is_composite,
    d.created_at as document_created_at,
    p.name as project_name
FROM public.project_prompts pp
JOIN public.documents d ON pp.document_id = d.id
JOIN public.projects p ON pp.project_id = p.id;

COMMENT ON VIEW public.prompt_templates_with_documents IS 
'Convenient view combining project_prompts registry with associated document details';

-- Step 6: Log migration results for verification
DO $$
DECLARE
    prompt_doc_count integer;
    migrated_count integer;
BEGIN
    -- Count existing prompt documents
    SELECT COUNT(*) INTO prompt_doc_count
    FROM public.documents 
    WHERE is_prompt = true;
    
    -- Count migrated templates
    SELECT COUNT(*) INTO migrated_count
    FROM public.project_prompts;
    
    RAISE NOTICE 'Migration Summary:';
    RAISE NOTICE '- Found % documents with is_prompt=true', prompt_doc_count;
    RAISE NOTICE '- Created % entries in project_prompts registry', migrated_count;
    RAISE NOTICE '- Migration completed successfully';
    
    -- Validate no orphaned prompt documents
    IF EXISTS (
        SELECT 1 FROM public.documents d 
        WHERE d.is_prompt = true 
        AND NOT EXISTS (
            SELECT 1 FROM public.project_prompts pp 
            WHERE pp.document_id = d.id
        )
    ) THEN
        RAISE WARNING 'Some prompt documents were not migrated to registry - manual review required';
    END IF;
END $$;