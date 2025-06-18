-- Migration: 0002_implement_rls_policies.sql
-- Description: Enables Row Level Security and creates initial policies for projects and documents.

-- Step 1: Enable Row Level Security (RLS) on the tables
-- This locks down the tables and ensures no access is allowed until a policy grants it.
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY; -- CORRECTED

-- As a best practice, also force RLS for table owners.
ALTER TABLE public.projects FORCE ROW LEVEL SECURITY;
ALTER TABLE public.documents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.project_members FORCE ROW LEVEL SECURITY; -- CORRECTED


-- Step 2: Create policies for the 'projects' table
-- Note: The logic for project ownership is in the 'assign_project_owner' function
-- which correctly uses 'project_members'. These policies below rely on a new 'owner_id'
-- column that we should add to the projects table for direct ownership checks.
-- For now, let's assume a user in project_members with the 'owner' role is the owner.

-- Let's create a helper function to check project membership and roles.
CREATE OR REPLACE FUNCTION is_project_member(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_id = p_project_id AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_project_role(p_project_id UUID, p_user_id UUID)
RETURNS public.project_role AS $$
DECLARE
  v_role public.project_role;
BEGIN
  SELECT role INTO v_role
  FROM public.project_members
  WHERE project_id = p_project_id AND user_id = p_user_id;
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- POLICIES FOR 'projects' TABLE

CREATE POLICY "Allow users to select projects they are a member of"
ON public.projects
FOR SELECT
USING (is_project_member(id, auth.uid()));

CREATE POLICY "Allow project owners to update their projects"
ON public.projects
FOR UPDATE
USING (get_project_role(id, auth.uid()) = 'owner')
WITH CHECK (get_project_role(id, auth.uid()) = 'owner');

CREATE POLICY "Allow project owners to delete their projects"
ON public.projects
FOR DELETE
USING (get_project_role(id, auth.uid()) = 'owner');

-- Note: Inserting a project is handled by the `assign_project_owner` trigger,
-- so any authenticated user can insert, and they will become the owner.
CREATE POLICY "Allow any authenticated user to create a project"
ON public.projects
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');


-- POLICIES FOR 'documents' TABLE

CREATE POLICY "Allow users to select documents from their projects"
ON public.documents
FOR SELECT
USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Allow members to insert documents into their projects"
ON public.documents
FOR INSERT
WITH CHECK (is_project_member(project_id, auth.uid()));

CREATE POLICY "Allow editors and owners to update documents in their projects"
ON public.documents
FOR UPDATE
USING (get_project_role(project_id, auth.uid()) IN ('owner', 'editor'));

CREATE POLICY "Allow owners to delete documents from their projects"
ON public.documents
FOR DELETE
USING (get_project_role(project_id, auth.uid()) = 'owner');
