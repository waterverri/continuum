-- Row Level Security policies for document history system

-- Enable RLS on document_history table
ALTER TABLE public.document_history ENABLE ROW LEVEL SECURITY;

-- Users can view document history for projects they are members of
CREATE POLICY "Users can view document history for their projects"
  ON public.document_history FOR SELECT
  USING (
    project_id IN (
      SELECT project_id 
      FROM public.project_members 
      WHERE user_id = auth.uid()
    )
  );

-- Users can create history entries for projects where they are editors or owners
-- (This policy is mainly for the create_document_history_entry function)
CREATE POLICY "Users can create history entries for editable projects"
  ON public.document_history FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id 
      FROM public.project_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'editor')
    )
  );

-- Only owners can delete history entries (for maintenance purposes)
CREATE POLICY "Only owners can delete history entries"
  ON public.document_history FOR DELETE
  USING (
    project_id IN (
      SELECT project_id 
      FROM public.project_members 
      WHERE user_id = auth.uid() 
      AND role = 'owner'
    )
  );

-- Grant execute permissions on history functions to authenticated users
GRANT EXECUTE ON FUNCTION create_document_history_entry TO authenticated;
GRANT EXECUTE ON FUNCTION rollback_document_to_version TO authenticated;

-- Grant usage on the new enum type
GRANT USAGE ON TYPE public.document_change_type TO authenticated;