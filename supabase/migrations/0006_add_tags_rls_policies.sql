-- Add RLS policies for tags tables

-- Enable RLS on tags table
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- Tags policies
-- Users can view tags for projects they have access to
CREATE POLICY "Users can view tags for accessible projects" ON public.tags
    FOR SELECT
    USING (
        project_id IN (
            SELECT project_id 
            FROM public.project_members 
            WHERE user_id = auth.uid()
        )
    );

-- Users can create tags for projects they have editor or owner access to
CREATE POLICY "Users can create tags for editable projects" ON public.tags
    FOR INSERT
    WITH CHECK (
        project_id IN (
            SELECT project_id 
            FROM public.project_members 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'editor')
        )
    );

-- Users can update tags for projects they have editor or owner access to
CREATE POLICY "Users can update tags for editable projects" ON public.tags
    FOR UPDATE
    USING (
        project_id IN (
            SELECT project_id 
            FROM public.project_members 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'editor')
        )
    );

-- Users can delete tags for projects they have editor or owner access to
CREATE POLICY "Users can delete tags for editable projects" ON public.tags
    FOR DELETE
    USING (
        project_id IN (
            SELECT project_id 
            FROM public.project_members 
            WHERE user_id = auth.uid() 
            AND role IN ('owner', 'editor')
        )
    );

-- Enable RLS on document_tags table
ALTER TABLE public.document_tags ENABLE ROW LEVEL SECURITY;

-- Document tags policies
-- Users can view document-tag associations for documents they can access
CREATE POLICY "Users can view document tags for accessible documents" ON public.document_tags
    FOR SELECT
    USING (
        document_id IN (
            SELECT id 
            FROM public.documents 
            WHERE project_id IN (
                SELECT project_id 
                FROM public.project_members 
                WHERE user_id = auth.uid()
            )
        )
    );

-- Users can create document-tag associations for documents they can edit
CREATE POLICY "Users can create document tags for editable documents" ON public.document_tags
    FOR INSERT
    WITH CHECK (
        document_id IN (
            SELECT id 
            FROM public.documents 
            WHERE project_id IN (
                SELECT project_id 
                FROM public.project_members 
                WHERE user_id = auth.uid() 
                AND role IN ('owner', 'editor')
            )
        )
        AND tag_id IN (
            SELECT id 
            FROM public.tags 
            WHERE project_id IN (
                SELECT project_id 
                FROM public.project_members 
                WHERE user_id = auth.uid() 
                AND role IN ('owner', 'editor')
            )
        )
    );

-- Users can delete document-tag associations for documents they can edit
CREATE POLICY "Users can delete document tags for editable documents" ON public.document_tags
    FOR DELETE
    USING (
        document_id IN (
            SELECT id 
            FROM public.documents 
            WHERE project_id IN (
                SELECT project_id 
                FROM public.project_members 
                WHERE user_id = auth.uid() 
                AND role IN ('owner', 'editor')
            )
        )
    );

-- Enable RLS on event_tags table
ALTER TABLE public.event_tags ENABLE ROW LEVEL SECURITY;

-- Event tags policies (for when events are fully implemented)
-- Users can view event-tag associations for events they can access
CREATE POLICY "Users can view event tags for accessible events" ON public.event_tags
    FOR SELECT
    USING (
        event_id IN (
            SELECT id 
            FROM public.events 
            WHERE project_id IN (
                SELECT project_id 
                FROM public.project_members 
                WHERE user_id = auth.uid()
            )
        )
    );

-- Users can create event-tag associations for events they can edit
CREATE POLICY "Users can create event tags for editable events" ON public.event_tags
    FOR INSERT
    WITH CHECK (
        event_id IN (
            SELECT id 
            FROM public.events 
            WHERE project_id IN (
                SELECT project_id 
                FROM public.project_members 
                WHERE user_id = auth.uid() 
                AND role IN ('owner', 'editor')
            )
        )
        AND tag_id IN (
            SELECT id 
            FROM public.tags 
            WHERE project_id IN (
                SELECT project_id 
                FROM public.project_members 
                WHERE user_id = auth.uid() 
                AND role IN ('owner', 'editor')
            )
        )
    );

-- Users can delete event-tag associations for events they can edit
CREATE POLICY "Users can delete event tags for editable events" ON public.event_tags
    FOR DELETE
    USING (
        event_id IN (
            SELECT id 
            FROM public.events 
            WHERE project_id IN (
                SELECT project_id 
                FROM public.project_members 
                WHERE user_id = auth.uid() 
                AND role IN ('owner', 'editor')
            )
        )
    );