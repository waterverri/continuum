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

// Mount route handlers
apiRouter.use('/documents', documentRouter);
apiRouter.use('/presets', presetRouter);

app.use('/api', apiRouter);

// --- Public External API for LLM Systems ---
// Import document resolution service
import { resolveCompositeDocument } from './services/documentService';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// GET /preset/:projectId/:presetName - Public endpoint for external LLM systems
app.get('/preset/:projectId/:presetName', async (req: Request, res: Response) => {
  try {
    const { projectId, presetName } = req.params;
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase configuration missing for external API');
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

    // Resolve the document content (handling composite documents)
    let finalContent: string;
    if (document.is_composite) {
      // For composite documents, we need the service key for resolution
      const { content, error } = await resolveCompositeDocument(
        document,
        preset.project_id,
        supabaseServiceKey, // Using service key for server-side resolution
        new Set()
      );
      
      if (error) {
        console.error(`Error resolving composite document ${documentId}:`, error);
        return res.status(500).send('Error resolving document content');
      }
      
      finalContent = content;
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