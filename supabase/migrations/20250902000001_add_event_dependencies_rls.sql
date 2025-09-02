-- Add RLS policies for event_dependencies table

-- Enable RLS on event_dependencies table
ALTER TABLE public.event_dependencies ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view event dependencies for events in projects they are members of
CREATE POLICY "Users can view event dependencies in their projects" 
ON public.event_dependencies FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.events e
    JOIN public.project_members pm ON e.project_id = pm.project_id
    WHERE e.id = event_dependencies.dependent_event_id 
      AND pm.user_id = auth.uid()
  )
);

-- Policy: Users can create event dependencies for events in projects they are members of (editor+ role)
CREATE POLICY "Users can create event dependencies in their projects"
ON public.event_dependencies FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.events e
    JOIN public.project_members pm ON e.project_id = pm.project_id
    WHERE e.id = event_dependencies.dependent_event_id 
      AND pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'editor')
  )
  AND
  EXISTS (
    SELECT 1 
    FROM public.events e
    JOIN public.project_members pm ON e.project_id = pm.project_id  
    WHERE e.id = event_dependencies.source_event_id
      AND pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'editor')
  )
);

-- Policy: Users can update event dependencies for events in projects they are members of (editor+ role)
CREATE POLICY "Users can update event dependencies in their projects"
ON public.event_dependencies FOR UPDATE
USING (
  EXISTS (
    SELECT 1 
    FROM public.events e
    JOIN public.project_members pm ON e.project_id = pm.project_id
    WHERE e.id = event_dependencies.dependent_event_id 
      AND pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'editor')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.events e
    JOIN public.project_members pm ON e.project_id = pm.project_id
    WHERE e.id = event_dependencies.dependent_event_id 
      AND pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'editor')
  )
);

-- Policy: Users can delete event dependencies for events in projects they are members of (editor+ role)
CREATE POLICY "Users can delete event dependencies in their projects"
ON public.event_dependencies FOR DELETE
USING (
  EXISTS (
    SELECT 1 
    FROM public.events e
    JOIN public.project_members pm ON e.project_id = pm.project_id
    WHERE e.id = event_dependencies.dependent_event_id 
      AND pm.user_id = auth.uid()
      AND pm.role IN ('owner', 'editor')
  )
);