-- Improve tags schema for better flexibility and many-to-many relationships

-- First, drop the existing tags table since it has design limitations
DROP TABLE IF EXISTS public.tags CASCADE;

-- Create a new tags table for project-scoped tag definitions
CREATE TABLE public.tags (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#6366f1', -- Default color for UI
    created_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT fk_project FOREIGN KEY(project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
    CONSTRAINT unique_tag_per_project UNIQUE(project_id, name)
);

COMMENT ON TABLE public.tags IS 'Project-scoped tag definitions with names and colors';
COMMENT ON COLUMN public.tags.name IS 'Tag name, unique within each project';
COMMENT ON COLUMN public.tags.color IS 'Hex color code for UI display';

-- Create document_tags junction table for many-to-many relationship
CREATE TABLE public.document_tags (
    document_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    
    PRIMARY KEY (document_id, tag_id),
    CONSTRAINT fk_document FOREIGN KEY(document_id) REFERENCES public.documents(id) ON DELETE CASCADE,
    CONSTRAINT fk_tag FOREIGN KEY(tag_id) REFERENCES public.tags(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.document_tags IS 'Many-to-many relationship between documents and tags';

-- Create event_tags junction table for when events are implemented
CREATE TABLE public.event_tags (
    event_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    
    PRIMARY KEY (event_id, tag_id),
    CONSTRAINT fk_event FOREIGN KEY(event_id) REFERENCES public.events(id) ON DELETE CASCADE,
    CONSTRAINT fk_tag FOREIGN KEY(tag_id) REFERENCES public.tags(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.event_tags IS 'Many-to-many relationship between events and tags';

-- Create indexes for performance
CREATE INDEX idx_tags_project_id ON public.tags(project_id);
CREATE INDEX idx_tags_name ON public.tags(project_id, name);
CREATE INDEX idx_document_tags_document ON public.document_tags(document_id);
CREATE INDEX idx_document_tags_tag ON public.document_tags(tag_id);
CREATE INDEX idx_event_tags_event ON public.event_tags(event_id);
CREATE INDEX idx_event_tags_tag ON public.event_tags(tag_id);