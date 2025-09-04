-- Modify event dependencies to support separate start and end dependencies
-- Each event can have separate dependencies for start time and end time
-- Start and end can reference different source events

-- Drop existing constraints and triggers
DROP TRIGGER IF EXISTS prevent_dependency_cycles ON public.event_dependencies;
DROP FUNCTION IF EXISTS public.check_dependency_cycle();

-- Add new columns to support start/end separation
ALTER TABLE public.event_dependencies 
  ADD COLUMN dependency_type text NOT NULL DEFAULT 'start' CHECK (dependency_type IN ('start', 'end')),
  ADD COLUMN is_duration boolean NOT NULL DEFAULT false;

-- Update existing records to be 'start' type dependencies
UPDATE public.event_dependencies SET dependency_type = 'start';

-- Drop the unique constraint if it exists and create a new one
ALTER TABLE public.event_dependencies DROP CONSTRAINT IF EXISTS unique_dependency_per_event;
ALTER TABLE public.event_dependencies 
  ADD CONSTRAINT unique_dependency_per_event_type 
  UNIQUE (dependent_event_id, dependency_type);

-- Update comments
COMMENT ON TABLE public.event_dependencies IS 'Event timing dependencies with separate start and end dependencies';
COMMENT ON COLUMN public.event_dependencies.dependency_type IS 'Whether this dependency affects start or end time';
COMMENT ON COLUMN public.event_dependencies.is_duration IS 'True if this is a duration rule (e.g., "3 days duration") rather than a date rule';
COMMENT ON COLUMN public.event_dependencies.dependency_rule IS 'Natural language rule like "2 days after {source.end}" or "3 days duration"';

-- Updated cycle detection function that considers dependency types
CREATE OR REPLACE FUNCTION public.check_dependency_cycle()
RETURNS TRIGGER AS $$
DECLARE
    cycle_found boolean := false;
BEGIN
    -- Only check cycles for non-duration dependencies (duration deps don't create cycles)
    IF NEW.is_duration = false THEN
        -- Use a CTE to check for cycles in dependencies
        WITH RECURSIVE dependency_path AS (
            -- Base case: start from the new source
            SELECT NEW.source_event_id as event_id, 1 as depth
            UNION ALL
            -- Recursive case: follow dependency relationships (excluding duration deps)
            SELECT ed.source_event_id, dp.depth + 1
            FROM public.event_dependencies ed
            JOIN dependency_path dp ON ed.dependent_event_id = dp.event_id
            WHERE dp.depth < 50 -- Prevent infinite recursion
              AND ed.is_duration = false -- Don't follow duration dependencies
        )
        SELECT EXISTS(
            SELECT 1 FROM dependency_path 
            WHERE event_id = NEW.dependent_event_id
        ) INTO cycle_found;
        
        IF cycle_found THEN
            RAISE EXCEPTION 'Cyclic event dependency detected. Event % cannot depend on event % as it would create a cycle.', 
                           NEW.dependent_event_id, NEW.source_event_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create trigger for cycle prevention
CREATE TRIGGER prevent_dependency_cycles
    BEFORE INSERT OR UPDATE ON public.event_dependencies
    FOR EACH ROW
    EXECUTE FUNCTION public.check_dependency_cycle();

-- Update indexes for better performance with new columns
DROP INDEX IF EXISTS idx_event_dependencies_dependent;
DROP INDEX IF EXISTS idx_event_dependencies_source;

CREATE INDEX idx_event_dependencies_dependent_type ON public.event_dependencies(dependent_event_id, dependency_type);
CREATE INDEX idx_event_dependencies_source ON public.event_dependencies(source_event_id);
CREATE INDEX idx_event_dependencies_duration ON public.event_dependencies(is_duration);