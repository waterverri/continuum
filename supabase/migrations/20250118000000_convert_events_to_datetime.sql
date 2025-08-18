-- Convert event time fields from integer to float for project-relative datetime format
-- This enables storing precise datetime values as days elapsed since the project's base date

-- Change time_start and time_end from bigint to double precision (float)
ALTER TABLE public.events 
ALTER COLUMN time_start TYPE double precision,
ALTER COLUMN time_end TYPE double precision;

-- Update column comments to reflect the new datetime format
COMMENT ON COLUMN public.events.time_start IS 'Start datetime as days elapsed since project base_date (project-relative format, supports fractional days for time precision)';
COMMENT ON COLUMN public.events.time_end IS 'End datetime as days elapsed since project base_date (project-relative format, supports fractional days for time precision)';