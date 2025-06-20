-- Migration: 0004_fix_project_members_policy.sql
-- Description: Adds the missing INSERT policy for the project_members table.

-- This policy is crucial for the `assign_project_owner` trigger to succeed
-- when a new project is created.
-- It allows an insert into `project_members` as long as the user being added
-- is the same user who is performing the action.
CREATE POLICY "Allow users to be added to projects"
ON public.project_members
FOR INSERT
WITH CHECK (user_id = auth.uid());


-- While we are here, let's add other sensible policies for project_members.
-- A user should be able to see their own membership record.

CREATE POLICY "Allow users to see their own membership"
ON public.project_members
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Allow project owners to see all members"
ON public.project_members
FOR SELECT
USING (get_project_role(project_id, auth.uid()) = 'owner');

CREATE POLICY "Allow members to leave a project"
ON public.project_members
FOR DELETE
USING (get_project_role(project_id, auth.uid()) IN ('editor', 'viewer'));

CREATE POLICY "Allow owners to remove members"
ON public.project_members
FOR DELETE
USING (get_project_role(project_id, auth.uid()) = 'owner');