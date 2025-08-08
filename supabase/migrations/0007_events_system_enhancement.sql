-- Enhance events system with document relationships, hierarchies, and evolution support

-- Create event_documents junction table for many-to-many relationship
CREATE TABLE public.event_documents (
    event_id uuid NOT NULL,
    document_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    
    PRIMARY KEY (event_id, document_id),
    CONSTRAINT fk_event FOREIGN KEY(event_id) REFERENCES public.events(id) ON DELETE CASCADE,
    CONSTRAINT fk_document FOREIGN KEY(document_id) REFERENCES public.documents(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.event_documents IS 'Many-to-many relationship between events and documents';

-- Create event_hierarchy table for event parent-child relationships
CREATE TABLE public.event_hierarchy (
    parent_event_id uuid NOT NULL,
    child_event_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    
    PRIMARY KEY (parent_event_id, child_event_id),
    CONSTRAINT fk_parent_event FOREIGN KEY(parent_event_id) REFERENCES public.events(id) ON DELETE CASCADE,
    CONSTRAINT fk_child_event FOREIGN KEY(child_event_id) REFERENCES public.events(id) ON DELETE CASCADE,
    CONSTRAINT prevent_self_reference CHECK (parent_event_id != child_event_id)
);

COMMENT ON TABLE public.event_hierarchy IS 'Hierarchical relationships between events (parent-child)';

-- Add document evolution support to documents table
-- Add event_id to track which event a document version represents
ALTER TABLE public.documents 
ADD COLUMN event_id uuid,
ADD CONSTRAINT fk_event FOREIGN KEY(event_id) REFERENCES public.events(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.documents.event_id IS 'Event this document version represents (for document evolution)';

-- Add display_order to events for timeline ordering
ALTER TABLE public.events
ADD COLUMN display_order integer DEFAULT 0,
ADD COLUMN parent_event_id uuid,
ADD CONSTRAINT fk_parent_event FOREIGN KEY(parent_event_id) REFERENCES public.events(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.events.display_order IS 'Order for displaying events in timeline';
COMMENT ON COLUMN public.events.parent_event_id IS 'Parent event for hierarchical organization';

-- Create indexes for performance
CREATE INDEX idx_event_documents_event ON public.event_documents(event_id);
CREATE INDEX idx_event_documents_document ON public.event_documents(document_id);
CREATE INDEX idx_event_hierarchy_parent ON public.event_hierarchy(parent_event_id);
CREATE INDEX idx_event_hierarchy_child ON public.event_hierarchy(child_event_id);
CREATE INDEX idx_documents_event ON public.documents(event_id);
CREATE INDEX idx_events_parent ON public.events(parent_event_id);
CREATE INDEX idx_events_display_order ON public.events(project_id, display_order);

-- Function to prevent cyclic event hierarchies
CREATE OR REPLACE FUNCTION public.check_event_hierarchy_cycle()
RETURNS TRIGGER AS $$
DECLARE
    cycle_found boolean := false;
BEGIN
    -- Use a CTE to check for cycles
    WITH RECURSIVE event_path AS (
        -- Base case: start from the new parent
        SELECT NEW.parent_event_id as event_id, 1 as depth
        UNION ALL
        -- Recursive case: follow parent relationships
        SELECT e.parent_event_id, ep.depth + 1
        FROM public.events e
        JOIN event_path ep ON e.id = ep.event_id
        WHERE e.parent_event_id IS NOT NULL 
          AND ep.depth < 10 -- Prevent infinite recursion
    )
    SELECT EXISTS(
        SELECT 1 FROM event_path 
        WHERE event_id = NEW.child_event_id
    ) INTO cycle_found;
    
    IF cycle_found THEN
        RAISE EXCEPTION 'Cyclic event hierarchy detected. Event % cannot be a child of event % as it would create a cycle.', 
                       NEW.child_event_id, NEW.parent_event_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent cyclic hierarchies
CREATE TRIGGER prevent_event_hierarchy_cycles
    BEFORE INSERT OR UPDATE ON public.event_hierarchy
    FOR EACH ROW
    EXECUTE FUNCTION public.check_event_hierarchy_cycle();

-- Function to prevent direct parent_event_id cycles
CREATE OR REPLACE FUNCTION public.check_event_parent_cycle()
RETURNS TRIGGER AS $$
DECLARE
    cycle_found boolean := false;
BEGIN
    -- Check if setting this parent would create a cycle
    IF NEW.parent_event_id IS NOT NULL THEN
        WITH RECURSIVE event_path AS (
            -- Start from the new parent
            SELECT NEW.parent_event_id as event_id, 1 as depth
            UNION ALL
            -- Follow parent relationships
            SELECT e.parent_event_id, ep.depth + 1
            FROM public.events e
            JOIN event_path ep ON e.id = ep.event_id
            WHERE e.parent_event_id IS NOT NULL 
              AND ep.depth < 10
        )
        SELECT EXISTS(
            SELECT 1 FROM event_path 
            WHERE event_id = NEW.id
        ) INTO cycle_found;
        
        IF cycle_found THEN
            RAISE EXCEPTION 'Cyclic event hierarchy detected. Event % cannot have parent % as it would create a cycle.', 
                           NEW.id, NEW.parent_event_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent parent_event_id cycles
CREATE TRIGGER prevent_event_parent_cycles
    BEFORE INSERT OR UPDATE ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION public.check_event_parent_cycle();