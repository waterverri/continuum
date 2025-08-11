import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

// --- Custom Type for Express Request ---
// This extends the default Request type to include our custom properties.
export interface RequestWithUser extends Request {
  user?: any;
  token?: string; // Add the token property here
}

// --- Custom Authentication Middleware ---
const validateSupabaseJwt = async (req: RequestWithUser, res: Response, next: NextFunction) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase URL or Anon Key is not configured on the server.');
      return res.status(500).json({ error: 'Authentication service is not configured.' });
    }
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing or invalid Authorization header. A Bearer token is required.' });
    }

    const jwt = authHeader.split(' ')[1];

    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'apikey': supabaseAnonKey,
      },
    });

    const userData = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ message: userData.msg || 'Invalid or expired token.', detail: userData });
    }
    
    // Attach both the user data AND the original token to the request
    req.user = userData;
    req.token = jwt;
    next();

  } catch (error) {
    console.error('Error in authentication middleware:', error);
    return res.status(500).json({ message: 'Internal Server Error during authentication.' });
  }
};


// --- App Setup ---
const app = express();
app.use(cors());
app.use(express.json());


// --- API Routes ---
// This router is protected by JWT validation and ready for future platformized features.
const apiRouter = express.Router();
apiRouter.use(validateSupabaseJwt);

// Import route handlers
import documentRouter from './routes/documents';
import presetRouter from './routes/presets';
import tagRouter from './routes/tags';
import eventRouter from './routes/events';

// Mount route handlers
apiRouter.use('/documents', documentRouter);
apiRouter.use('/presets', presetRouter);
apiRouter.use('/tags', tagRouter);
apiRouter.use('/events', eventRouter);

app.use('/api', apiRouter);

// --- Public External API for LLM Systems ---
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// GET /preset/:projectId/:presetName - Public endpoint for external LLM systems
app.get('/preset/:projectId/:presetName', async (req: Request, res: Response) => {
  try {
    const { projectId, presetName } = req.params;
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase configuration missing for external API. Please configure SUPABASE_SERVICE_KEY in environment variables.');
      return res.status(500).send('Service configuration error');
    }

    // Use service key for server-side access (bypasses RLS)
    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceKey);

    // Find the preset by name within the specified project
    const { data: preset, error: presetError } = await supabase
      .from('presets')
      .select('id, name, rules, project_id')
      .eq('name', presetName)
      .eq('project_id', projectId)
      .single();

    if (presetError || !preset) {
      return res.status(404).send('Preset not found');
    }

    const documentId = preset.rules?.document_id;
    if (!documentId) {
      return res.status(400).send('Preset has no associated document');
    }

    // Fetch the document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('project_id', preset.project_id)
      .single();

    if (docError || !document) {
      return res.status(404).send('Document not found');
    }

    // Resolve the document content with preset overrides
    let finalContent: string;
    if (document.is_composite) {
      // Recursive function to resolve composite documents with overrides
      const resolveWithOverrides = async (
        docContent: string, 
        docComponents: Record<string, string> = {},
        overrides: Record<string, string> = {},
        visited: Set<string> = new Set()
      ): Promise<string> => {
        let resolvedContent = docContent;
        
        // Find all component references in the content
        const componentRegex = /{{([^}]+)}}/g;
        const matches = [...docContent.matchAll(componentRegex)];
        
        for (const match of matches) {
          const componentKey = match[1];
          if (!componentKey) continue;
          
          // Check if this component has an override
          let targetDocId = overrides[componentKey] || docComponents[componentKey];
          
          if (!targetDocId) continue;
          
          // Prevent infinite recursion
          if (visited.has(targetDocId)) {
            console.warn(`Circular reference detected for document ${targetDocId}`);
            continue;
          }
          
          // Get the component document
          const { data: componentDoc, error: componentError } = await supabase
            .from('documents')
            .select('id, content, is_composite, components')
            .eq('id', targetDocId)
            .eq('project_id', preset.project_id)
            .single();
            
          if (componentError || !componentDoc) {
            console.warn(`Component document ${targetDocId} not found`);
            continue;
          }
          
          let componentContent = componentDoc.content || '';
          
          // If the component is also composite, recursively resolve it
          if (componentDoc.is_composite && componentDoc.components) {
            const newVisited = new Set(visited);
            newVisited.add(targetDocId);
            componentContent = await resolveWithOverrides(
              componentContent,
              componentDoc.components,
              overrides, // Pass through the same overrides for nested resolution
              newVisited
            );
          }
          
          // Replace the component reference with the resolved content
          resolvedContent = resolvedContent.replace(match[0], componentContent);
        }
        
        return resolvedContent;
      };

      // Apply overrides and resolve the document
      const overrides = preset.rules.component_overrides || {};
      
      finalContent = await resolveWithOverrides(
        document.content || '',
        document.components || {},
        overrides
      );
    } else {
      finalContent = document.content || '';
    }

    // Return as plain text
    res.set('Content-Type', 'text/plain');
    res.send(finalContent);
  } catch (error) {
    console.error('Error in GET /preset/:presetName:', error);
    res.status(500).send('Internal server error');
  }
});


// --- Local Development Server ---
if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`API server listening on port ${port}`);
    });
}

export const continuumApi = app;