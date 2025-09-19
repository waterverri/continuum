-- Add alias field to documents table for autocomplete search functionality
ALTER TABLE public.documents
ADD COLUMN alias TEXT NULL;

COMMENT ON COLUMN public.documents.alias IS 'Comma-separated aliases for document autocomplete search (e.g., "char1,protagonist,john")';

-- Update document_history table to match
ALTER TABLE public.document_history
ADD COLUMN alias TEXT NULL;

COMMENT ON COLUMN public.document_history.alias IS 'Historical alias field for document versioning';

-- Add index for alias search performance
CREATE INDEX idx_documents_alias ON public.documents USING gin (to_tsvector('english', coalesce(alias, '')));

-- Function to update document history trigger to include alias
CREATE OR REPLACE FUNCTION create_document_history()
RETURNS TRIGGER AS $$
DECLARE
    change_type_val TEXT;
BEGIN
    -- Determine change type based on operation
    IF TG_OP = 'INSERT' THEN
        change_type_val := 'create';
    ELSIF TG_OP = 'UPDATE' THEN
        -- Determine specific type of update
        IF OLD.title != NEW.title THEN
            change_type_val := 'update_title';
        ELSIF OLD.content != NEW.content THEN
            change_type_val := 'update_content';
        ELSIF OLD.document_type != NEW.document_type THEN
            change_type_val := 'update_type';
        ELSIF OLD.components != NEW.components THEN
            change_type_val := 'update_components';
        ELSIF OLD.group_id != NEW.group_id THEN
            change_type_val := 'move_group';
        ELSIF OLD.event_id != NEW.event_id THEN
            IF NEW.event_id IS NULL THEN
                change_type_val := 'unlink_event';
            ELSE
                change_type_val := 'link_event';
            END IF;
        ELSIF OLD.alias != NEW.alias THEN
            change_type_val := 'update_alias';
        ELSE
            change_type_val := 'update_content'; -- Default fallback
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        change_type_val := 'delete';
    END IF;

    -- Insert history record
    INSERT INTO public.document_history (
        document_id,
        project_id,
        title,
        content,
        document_type,
        group_id,
        components,
        event_id,
        alias,
        change_type,
        user_id,
        created_at
    ) VALUES (
        COALESCE(NEW.id, OLD.id),
        COALESCE(NEW.project_id, OLD.project_id),
        COALESCE(NEW.title, OLD.title),
        COALESCE(NEW.content, OLD.content),
        COALESCE(NEW.document_type, OLD.document_type),
        COALESCE(NEW.group_id, OLD.group_id),
        COALESCE(NEW.components, OLD.components),
        COALESCE(NEW.event_id, OLD.event_id),
        COALESCE(NEW.alias, OLD.alias),
        change_type_val,
        auth.uid(),
        NOW()
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add update_alias to document_change_type enum
ALTER TYPE public.document_change_type ADD VALUE 'update_alias';