-- Test script to validate the migration logic for is_prompt documents
-- This can be run to test the migration functions and logic

-- Test the template variable extraction function
SELECT extract_template_variables('Hello {{name}}, your {{item_type}} is ready. Cost: {{price}}');
-- Expected: {"name": {"type": "text", "description": "Template variable: name", "default": ""}, ...}

SELECT extract_template_variables('Simple text without variables');
-- Expected: {}

SELECT extract_template_variables('Mixed {{variable1}} text with some {{variable2}} placeholders');
-- Expected: Two variables extracted

-- Test migration query (dry run without INSERT)
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
    NOW() AS updated_at
FROM public.documents d
WHERE d.is_prompt = true
LIMIT 5;

-- Test the view that combines prompts with documents
SELECT * FROM public.prompt_templates_with_documents LIMIT 3;

-- Cleanup test function (remove after testing)
-- DROP FUNCTION IF EXISTS extract_template_variables(TEXT);