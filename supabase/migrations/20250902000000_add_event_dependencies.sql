-- Add event dependencies system with natural language rules
-- Parents automatically span children (min start, max end)
-- Peer dependencies use natural language rules

-- Create event_dependencies table for peer-to-peer timing relationships
CREATE TABLE public.event_dependencies (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    dependent_event_id uuid NOT NULL,
    source_event_id uuid NOT NULL,
    dependency_rule text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    
    CONSTRAINT fk_dependent_event FOREIGN KEY(dependent_event_id) REFERENCES public.events(id) ON DELETE CASCADE,
    CONSTRAINT fk_source_event FOREIGN KEY(source_event_id) REFERENCES public.events(id) ON DELETE CASCADE,
    CONSTRAINT prevent_self_dependency CHECK (dependent_event_id != source_event_id)
);

COMMENT ON TABLE public.event_dependencies IS 'Peer-to-peer event timing dependencies using natural language rules';
COMMENT ON COLUMN public.event_dependencies.dependency_rule IS 'Natural language rule like "2 days after {source.end}" or "first Monday after {source.start}"';

-- Add indexes for performance
CREATE INDEX idx_event_dependencies_dependent ON public.event_dependencies(dependent_event_id);
CREATE INDEX idx_event_dependencies_source ON public.event_dependencies(source_event_id);

-- Function to calculate parent event dates from children
CREATE OR REPLACE FUNCTION public.calculate_parent_event_dates()
RETURNS TRIGGER AS $$
DECLARE
    parent_id uuid;
    min_start double precision;
    max_end double precision;
BEGIN
    -- Get the parent event ID (could be from OLD or NEW record)
    parent_id := COALESCE(NEW.parent_event_id, OLD.parent_event_id);
    
    -- Only proceed if there's a parent
    IF parent_id IS NOT NULL THEN
        -- Calculate min start and max end from all children
        SELECT 
            MIN(time_start),
            MAX(time_end)
        INTO min_start, max_end
        FROM public.events 
        WHERE parent_event_id = parent_id 
          AND time_start IS NOT NULL 
          AND time_end IS NOT NULL;
        
        -- Update parent with calculated dates
        IF min_start IS NOT NULL AND max_end IS NOT NULL THEN
            UPDATE public.events 
            SET 
                time_start = min_start,
                time_end = max_end
            WHERE id = parent_id;
        END IF;
    END IF;
    
    -- Handle the case where this event itself might have children
    -- (when updating an event that is a parent)
    IF (TG_OP = 'UPDATE' AND NEW.id IS NOT NULL) OR (TG_OP = 'INSERT' AND NEW.id IS NOT NULL) THEN
        -- Check if this event has children and recalculate if needed
        SELECT 
            MIN(time_start),
            MAX(time_end)
        INTO min_start, max_end
        FROM public.events 
        WHERE parent_event_id = COALESCE(NEW.id, OLD.id)
          AND time_start IS NOT NULL 
          AND time_end IS NOT NULL;
        
        IF min_start IS NOT NULL AND max_end IS NOT NULL THEN
            UPDATE public.events 
            SET 
                time_start = min_start,
                time_end = max_end
            WHERE id = COALESCE(NEW.id, OLD.id);
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update parent dates when children change
CREATE TRIGGER update_parent_dates_on_insert
    AFTER INSERT ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_parent_event_dates();

CREATE TRIGGER update_parent_dates_on_update
    AFTER UPDATE OF time_start, time_end, parent_event_id ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_parent_event_dates();

CREATE TRIGGER update_parent_dates_on_delete
    AFTER DELETE ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_parent_event_dates();

-- Function to prevent cyclic dependencies in event_dependencies table
CREATE OR REPLACE FUNCTION public.check_dependency_cycle()
RETURNS TRIGGER AS $$
DECLARE
    cycle_found boolean := false;
BEGIN
    -- Use a CTE to check for cycles in dependencies
    WITH RECURSIVE dependency_path AS (
        -- Base case: start from the new source
        SELECT NEW.source_event_id as event_id, 1 as depth
        UNION ALL
        -- Recursive case: follow dependency relationships
        SELECT ed.source_event_id, dp.depth + 1
        FROM public.event_dependencies ed
        JOIN dependency_path dp ON ed.dependent_event_id = dp.event_id
        WHERE dp.depth < 50 -- Prevent infinite recursion
    )
    SELECT EXISTS(
        SELECT 1 FROM dependency_path 
        WHERE event_id = NEW.dependent_event_id
    ) INTO cycle_found;
    
    IF cycle_found THEN
        RAISE EXCEPTION 'Cyclic event dependency detected. Event % cannot depend on event % as it would create a cycle.', 
                       NEW.dependent_event_id, NEW.source_event_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent cyclic dependencies
CREATE TRIGGER prevent_dependency_cycles
    BEFORE INSERT OR UPDATE ON public.event_dependencies
    FOR EACH ROW
    EXECUTE FUNCTION public.check_dependency_cycle();