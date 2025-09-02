-- Fix infinite recursion in parent event date calculation
-- The issue: Original function had logic to update the event itself, causing recursion
-- Solution: Remove the self-update logic, only update the parent

-- Replace the problematic function with a corrected version
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
    
    -- REMOVED: The problematic self-update logic that was causing infinite recursion
    -- The original function tried to update the event itself if it had children,
    -- but this caused recursion when the parent was updated
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;