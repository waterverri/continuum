-- Migration: 0002_implement_rls_policies.sql
-- Description: Enables Row Level Security and creates initial policies for projects and documents.

-- Step 1: Enable Row Level Security (RLS) on the tables
-- This locks down the tables and ensures no access is allowed until a policy grants it.
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_users ENABLE ROW LEVEL SECURITY;

-- As a best practice, also force RLS for table owners.
ALTER TABLE public.projects FORCE ROW LEVEL SECURITY;
ALTER TABLE public.documents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.project_users FORCE ROW LEVEL SECURITY;


-- Step 2: Create policies for the 'projects' table
-- These policies ensure that users can only interact with projects they own.

CREATE POLICY "Allow users to select their own projects"
ON public.projects
FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Allow users to insert their own projects"
ON public.projects
FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Allow users to update their own projects"
ON public.projects
FOR UPDATE
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Allow users to delete their own projects"
ON public.projects
FOR DELETE
USING (auth.uid() = owner_id);


-- Step 3: Create policies for the 'documents' table
-- These policies check for project ownership before allowing document operations.

CREATE POLICY "Allow users to select documents from their projects"
ON public.documents
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM projects
    WHERE projects.id = documents.project_id AND projects.owner_id = auth.uid()
  )
);

CREATE POLICY "Allow users to insert documents into their projects"
ON public.documents
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM projects
    WHERE projects.id = documents.project_id AND projects.owner_id = auth.uid()
  )
);

CREATE POLICY "Allow users to update documents in their projects"
ON public.documents
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM projects
    WHERE projects.id = documents.project_id AND projects.owner_id = auth.uid()
  )
);

CREATE POLICY "Allow users to delete documents from their projects"
ON public.documents
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM projects
    WHERE projects.id = documents.project_id AND projects.owner_id = auth.uid()
  )
);
