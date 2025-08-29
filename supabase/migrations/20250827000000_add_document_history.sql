-- Document History and Undo/Rollback System
-- This migration adds comprehensive document versioning capabilities

-- Create enum for change types to track the nature of each edit
CREATE TYPE public.document_change_type AS ENUM (
  'create',
  'update_content', 
  'update_title',
  'update_type',
  'update_components',
  'move_group',
  'link_event',
  'unlink_event',
  'delete'
);

-- Document History Table
-- Stores complete snapshots of document state for rollback capability
CREATE TABLE public.document_history (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  project_id UUID NOT NULL,
  
  -- Complete document state snapshot
  title TEXT NOT NULL,
  content TEXT,
  document_type TEXT,
  group_id UUID,
  is_composite BOOLEAN NOT NULL DEFAULT FALSE,
  components JSONB,
  event_id UUID,
  
  -- Change tracking
  change_type public.document_change_type NOT NULL,
  change_description TEXT, -- Human-readable description of the change
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Reference to the document version this replaces (for rollback chains)
  previous_version_id UUID,
  
  CONSTRAINT fk_document FOREIGN KEY(document_id) REFERENCES public.documents(id) ON DELETE CASCADE,
  CONSTRAINT fk_project FOREIGN KEY(project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_previous_version FOREIGN KEY(previous_version_id) REFERENCES public.document_history(id) ON DELETE SET NULL,
  CONSTRAINT fk_group FOREIGN KEY(group_id) REFERENCES public.documents(id) ON DELETE SET NULL,
  CONSTRAINT fk_event FOREIGN KEY(event_id) REFERENCES public.events(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_document_history_document_id ON public.document_history(document_id);
CREATE INDEX idx_document_history_project_id ON public.document_history(project_id);
CREATE INDEX idx_document_history_created_at ON public.document_history(created_at DESC);
CREATE INDEX idx_document_history_user_id ON public.document_history(user_id);
CREATE INDEX idx_document_history_change_type ON public.document_history(change_type);

-- Add updated_at column to documents table for change tracking
ALTER TABLE public.documents 
ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on document changes
CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_updated_at();

-- Function to create history entry
CREATE OR REPLACE FUNCTION create_document_history_entry(
  p_document_id UUID,
  p_change_type public.document_change_type,
  p_change_description TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  doc_record RECORD;
  history_id UUID;
  current_user_id UUID;
BEGIN
  -- Use provided user_id or fallback to auth.uid()
  current_user_id := COALESCE(p_user_id, auth.uid());
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required for history entry';
  END IF;
  
  -- Get current document state
  SELECT * INTO doc_record 
  FROM public.documents 
  WHERE id = p_document_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found: %', p_document_id;
  END IF;
  
  -- Create history entry
  INSERT INTO public.document_history (
    document_id,
    project_id,
    title,
    content,
    document_type,
    group_id,
    is_composite,
    components,
    event_id,
    change_type,
    change_description,
    user_id
  ) VALUES (
    doc_record.id,
    doc_record.project_id,
    doc_record.title,
    doc_record.content,
    doc_record.document_type,
    doc_record.group_id,
    doc_record.is_composite,
    doc_record.components,
    doc_record.event_id,
    p_change_type,
    p_change_description,
    current_user_id
  ) RETURNING id INTO history_id;
  
  RETURN history_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to rollback document to a specific history version
CREATE OR REPLACE FUNCTION rollback_document_to_version(
  p_document_id UUID,
  p_history_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  history_record RECORD;
  current_user_id UUID;
BEGIN
  -- Use provided user_id or fallback to auth.uid()
  current_user_id := COALESCE(p_user_id, auth.uid());
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required for rollback';
  END IF;
  
  -- Get the history version to rollback to
  SELECT * INTO history_record 
  FROM public.document_history 
  WHERE id = p_history_id AND document_id = p_document_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'History version not found or does not belong to document';
  END IF;
  
  -- Create a history entry for the current state before rollback
  PERFORM create_document_history_entry(
    p_document_id,
    'update_content'::public.document_change_type,
    'Rollback to version from ' || history_record.created_at::TEXT,
    current_user_id
  );
  
  -- Update document with historical state
  UPDATE public.documents SET
    title = history_record.title,
    content = history_record.content,
    document_type = history_record.document_type,
    group_id = history_record.group_id,
    is_composite = history_record.is_composite,
    components = history_record.components,
    event_id = history_record.event_id,
    updated_at = NOW()
  WHERE id = p_document_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE public.document_history IS 'Complete version history for documents with rollback capabilities';
COMMENT ON COLUMN public.document_history.change_type IS 'Type of change that created this history entry';
COMMENT ON COLUMN public.document_history.change_description IS 'Human-readable description of what changed';
COMMENT ON COLUMN public.document_history.previous_version_id IS 'Links to the previous version for rollback chains';
COMMENT ON FUNCTION create_document_history_entry IS 'Creates a history snapshot of the current document state';
COMMENT ON FUNCTION rollback_document_to_version IS 'Rolls back a document to a specific historical version';