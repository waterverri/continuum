-- Migration: 20250118000001_add_profiles_presets_rls.sql
-- Description: Enables Row Level Security and creates policies for profiles and presets tables.

-- Step 1: Enable Row Level Security (RLS) on profiles and presets tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presets ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners as best practice
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.presets FORCE ROW LEVEL SECURITY;

-- Step 2: Create policies for the 'profiles' table
-- Users can only access and modify their own profile

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Note: Profile creation is handled by the handle_new_user trigger
-- so we don't need an INSERT policy for regular users

-- Step 3: Create policies for the 'presets' table
-- Presets follow project-based access control

CREATE POLICY "Allow users to select presets from their projects"
ON public.presets
FOR SELECT
USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "Allow members to insert presets into their projects"
ON public.presets
FOR INSERT
WITH CHECK (is_project_member(project_id, auth.uid()));

CREATE POLICY "Allow editors and owners to update presets in their projects"
ON public.presets
FOR UPDATE
USING (get_project_role(project_id, auth.uid()) IN ('owner', 'editor'));

CREATE POLICY "Allow owners to delete presets from their projects"
ON public.presets
FOR DELETE
USING (get_project_role(project_id, auth.uid()) = 'owner');