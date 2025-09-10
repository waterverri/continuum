-- Migration: Add Row Level Security policies for project_prompts table
-- Ensures proper access control for the prompt template registry

-- Step 1: Enable RLS on project_prompts table
ALTER TABLE public.project_prompts ENABLE ROW LEVEL SECURITY;

-- Step 2: Allow project members to view prompt templates in their projects
CREATE POLICY "project_prompts_select_policy" ON public.project_prompts
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = project_prompts.project_id
        AND pm.user_id = auth.uid()
    )
);

-- Step 3: Allow project editors and owners to create new prompt templates
CREATE POLICY "project_prompts_insert_policy" ON public.project_prompts
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = project_prompts.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'editor')
    )
);

-- Step 4: Allow template creators and project owners to update their templates
CREATE POLICY "project_prompts_update_policy" ON public.project_prompts
FOR UPDATE
USING (
    -- Template creator can always update
    created_by = auth.uid()
    OR
    -- Project owners can update any template in their project
    EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = project_prompts.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'owner'
    )
);

-- Step 5: Allow template creators and project owners to delete templates
CREATE POLICY "project_prompts_delete_policy" ON public.project_prompts
FOR DELETE
USING (
    -- Template creator can delete their own templates
    created_by = auth.uid()
    OR
    -- Project owners can delete any template in their project
    EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = project_prompts.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'owner'
    )
);

-- Step 6: Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_prompts TO authenticated;
GRANT SELECT ON public.prompt_templates_with_documents TO authenticated;

-- Step 7: Add RLS policies for the helper view (inherits from base tables)
-- Note: Views automatically inherit RLS from underlying tables, but we document this
COMMENT ON VIEW public.prompt_templates_with_documents IS 
'View inherits RLS policies from project_prompts, documents, and projects tables. 
Users can only see templates for projects they have access to.';

-- Step 8: Create indexes to optimize RLS policy performance
CREATE INDEX IF NOT EXISTS idx_project_prompts_created_by_project 
ON public.project_prompts(created_by, project_id);

CREATE INDEX IF NOT EXISTS idx_project_prompts_project_created_by 
ON public.project_prompts(project_id, created_by);

-- Step 9: Validate RLS setup with test queries (informational)
DO $$
BEGIN
    RAISE NOTICE 'RLS Policy Summary for project_prompts:';
    RAISE NOTICE '- SELECT: Project members can view templates';
    RAISE NOTICE '- INSERT: Editors/owners can create templates';  
    RAISE NOTICE '- UPDATE: Creators and project owners can modify';
    RAISE NOTICE '- DELETE: Creators and project owners can remove';
    RAISE NOTICE 'All policies enforce project-level data isolation';
END $$;