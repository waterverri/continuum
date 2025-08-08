-- Enable RLS on events system tables
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_hierarchy ENABLE ROW LEVEL SECURITY;

-- RLS policies for events table
-- Users can only access events for projects they are members of
CREATE POLICY "Users can view events for their projects" ON public.events
    FOR SELECT USING (
        project_id IN (
            SELECT project_id FROM public.project_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert events for projects they have editor+ access to" ON public.events
    FOR INSERT WITH CHECK (
        project_id IN (
            SELECT project_id FROM public.project_members 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'editor')
        )
    );

CREATE POLICY "Users can update events for projects they have editor+ access to" ON public.events
    FOR UPDATE USING (
        project_id IN (
            SELECT project_id FROM public.project_members 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'editor')
        )
    );

CREATE POLICY "Users can delete events for projects they have editor+ access to" ON public.events
    FOR DELETE USING (
        project_id IN (
            SELECT project_id FROM public.project_members 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'editor')
        )
    );

-- RLS policies for event_documents table
-- Users can only access event-document associations for their projects
CREATE POLICY "Users can view event-document associations for their projects" ON public.event_documents
    FOR SELECT USING (
        event_id IN (
            SELECT id FROM public.events 
            WHERE project_id IN (
                SELECT project_id FROM public.project_members 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can create event-document associations for their projects" ON public.event_documents
    FOR INSERT WITH CHECK (
        event_id IN (
            SELECT id FROM public.events 
            WHERE project_id IN (
                SELECT project_id FROM public.project_members 
                WHERE user_id = auth.uid() 
                AND role IN ('owner', 'editor')
            )
        ) AND
        document_id IN (
            SELECT id FROM public.documents 
            WHERE project_id IN (
                SELECT project_id FROM public.project_members 
                WHERE user_id = auth.uid() 
                AND role IN ('owner', 'editor')
            )
        )
    );

CREATE POLICY "Users can delete event-document associations for their projects" ON public.event_documents
    FOR DELETE USING (
        event_id IN (
            SELECT id FROM public.events 
            WHERE project_id IN (
                SELECT project_id FROM public.project_members 
                WHERE user_id = auth.uid() 
                AND role IN ('owner', 'editor')
            )
        )
    );

-- RLS policies for event_hierarchy table
-- Users can only access event hierarchies for their projects
CREATE POLICY "Users can view event hierarchies for their projects" ON public.event_hierarchy
    FOR SELECT USING (
        parent_event_id IN (
            SELECT id FROM public.events 
            WHERE project_id IN (
                SELECT project_id FROM public.project_members 
                WHERE user_id = auth.uid()
            )
        ) OR
        child_event_id IN (
            SELECT id FROM public.events 
            WHERE project_id IN (
                SELECT project_id FROM public.project_members 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can create event hierarchies for their projects" ON public.event_hierarchy
    FOR INSERT WITH CHECK (
        parent_event_id IN (
            SELECT id FROM public.events 
            WHERE project_id IN (
                SELECT project_id FROM public.project_members 
                WHERE user_id = auth.uid() 
                AND role IN ('owner', 'editor')
            )
        ) AND
        child_event_id IN (
            SELECT id FROM public.events 
            WHERE project_id IN (
                SELECT project_id FROM public.project_members 
                WHERE user_id = auth.uid() 
                AND role IN ('owner', 'editor')
            )
        )
    );

CREATE POLICY "Users can delete event hierarchies for their projects" ON public.event_hierarchy
    FOR DELETE USING (
        parent_event_id IN (
            SELECT id FROM public.events 
            WHERE project_id IN (
                SELECT project_id FROM public.project_members 
                WHERE user_id = auth.uid() 
                AND role IN ('owner', 'editor')
            )
        )
    );