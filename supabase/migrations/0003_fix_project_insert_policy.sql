-- Migration: 0003_fix_project_insert_policy.sql
-- Description: Alters the RLS policy for inserting new projects to fix a permissions issue.

-- Step 1: Drop the old, incorrect policy.
-- The previous policy used `auth.role() = 'authenticated'`, which was failing.
DROP POLICY "Allow any authenticated user to create a project" ON public.projects;

-- Step 2: Create the new, corrected policy.
-- This version uses `auth.uid() IS NOT NULL`, which is a more robust check
-- to ensure a user is logged in before allowing them to create a project.
CREATE POLICY "Allow any authenticated user to create a project"
ON public.projects
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);