-- Migration: Add interaction_mode enum and project_prompts table
-- This prepares the foundation for the new AI chat architecture

-- Step 1: Create interaction_mode enum type
CREATE TYPE public.interaction_mode AS ENUM ('document', 'chat', 'canvas');

COMMENT ON TYPE public.interaction_mode IS 'Defines how users interact with a document: standard document editing, AI chat interface, or visual canvas';

-- Step 2: Add interaction_mode column to documents table  
ALTER TABLE public.documents 
ADD COLUMN interaction_mode public.interaction_mode NOT NULL DEFAULT 'document';

COMMENT ON COLUMN public.documents.interaction_mode IS 'Determines the UI mode and behavior for this document';

-- Step 3: Create project_prompts table for template registry
CREATE TABLE public.project_prompts (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL,
    document_id uuid NOT NULL,
    name varchar(100) NOT NULL,
    description text,
    variables jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NOT NULL,
    
    CONSTRAINT fk_project_prompts_project 
        FOREIGN KEY(project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_project_prompts_document 
        FOREIGN KEY(document_id) REFERENCES public.documents(id) ON DELETE CASCADE,
    CONSTRAINT fk_project_prompts_creator 
        FOREIGN KEY(created_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add indexes for performance
CREATE INDEX idx_project_prompts_project_id ON public.project_prompts(project_id);
CREATE INDEX idx_project_prompts_document_id ON public.project_prompts(document_id);
CREATE INDEX idx_project_prompts_created_by ON public.project_prompts(created_by);

-- Add unique constraint on project + name to prevent duplicates
CREATE UNIQUE INDEX idx_project_prompts_unique_name ON public.project_prompts(project_id, name);

COMMENT ON TABLE public.project_prompts IS 'Registry of reusable AI prompt templates within each project';
COMMENT ON COLUMN public.project_prompts.name IS 'User-friendly name for the prompt template';
COMMENT ON COLUMN public.project_prompts.variables IS 'JSON object defining template variables and their types/defaults';
COMMENT ON COLUMN public.project_prompts.document_id IS 'References the document that serves as the template';

-- Step 4: Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 5: Trigger for updated_at on project_prompts
CREATE TRIGGER update_project_prompts_updated_at 
    BEFORE UPDATE ON public.project_prompts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Step 6: Prepare for eventual migration of existing is_prompt documents
-- (This will be done in a separate migration to allow for testing)