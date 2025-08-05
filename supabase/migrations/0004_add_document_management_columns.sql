-- Add missing columns to documents table for document management functionality

-- Add title column (required for all documents)
ALTER TABLE public.documents 
ADD COLUMN title TEXT NOT NULL DEFAULT 'Untitled Document';

-- Add is_composite column to identify composite/blueprint documents
ALTER TABLE public.documents 
ADD COLUMN is_composite BOOLEAN NOT NULL DEFAULT FALSE;

-- Add components JSONB column to store component mappings for composite documents
ALTER TABLE public.documents 
ADD COLUMN components JSONB NULL;

-- Update table comment to reflect new functionality
COMMENT ON TABLE public.documents IS 'Stores discrete text units and composite blueprint documents. Supports static content and dynamic assembly via component references.';

-- Add column comments for clarity
COMMENT ON COLUMN public.documents.title IS 'Human-readable title for the document';
COMMENT ON COLUMN public.documents.is_composite IS 'True for blueprint documents that assemble content from other documents';
COMMENT ON COLUMN public.documents.components IS 'JSONB map of placeholder keys to document IDs for composite documents (e.g., {"chapter1": "uuid-..."})';

-- Add constraint to ensure components is only used with composite documents
ALTER TABLE public.documents 
ADD CONSTRAINT check_composite_components 
CHECK (
    (is_composite = FALSE AND components IS NULL) OR 
    (is_composite = TRUE)
);

-- Remove the default value now that the column has been added
ALTER TABLE public.documents 
ALTER COLUMN title DROP DEFAULT;