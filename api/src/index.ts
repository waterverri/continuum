import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

// --- Custom Type for Express Request ---
// This extends the default Request type to include our custom properties.
export interface RequestWithUser extends Request {
  user?: any;
  token?: string; // Add the token property here
}

// --- Custom Authentication Middleware ---
export const validateSupabaseJwt = async (req: RequestWithUser, res: Response, next: NextFunction) => {
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


// Import the existing supabaseAdmin client
import { supabaseAdmin } from './db/supabaseClient';

// --- Public Invitation Lookup API ---
// IMPORTANT: This must come BEFORE the protected API router to avoid JWT middleware
// This endpoint needs to be public (no JWT required) so users can view invitations before authenticating
app.get('/api/public/invitations/:invitationId', async (req: Request, res: Response) => {
  const { invitationId } = req.params;
  console.log(`[INVITATION_LOOKUP] Starting lookup for invitation ID: ${invitationId}`);
  
  try {
    // Check environment configuration
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    console.log(`[INVITATION_LOOKUP] Environment check - SUPABASE_URL: ${supabaseUrl ? 'SET' : 'MISSING'}`);
    console.log(`[INVITATION_LOOKUP] Environment check - SUPABASE_SERVICE_KEY: ${supabaseServiceKey ? 'SET' : 'MISSING'}`);

    console.log(`[INVITATION_LOOKUP] Executing database query for invitation: ${invitationId}`);
    
    // Get invitation with project details
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from('project_invitations')
      .select(`
        id,
        project_id,
        max_uses,
        used_count,
        is_active,
        projects (
          id,
          name
        )
      `)
      .eq('id', invitationId)
      .eq('is_active', true)
      .single();

    console.log(`[INVITATION_LOOKUP] Database response - Error: ${invitationError ? JSON.stringify(invitationError) : 'NONE'}`);
    console.log(`[INVITATION_LOOKUP] Database response - Data: ${invitation ? 'FOUND' : 'NULL'}`);
    
    if (invitation) {
      console.log(`[INVITATION_LOOKUP] Invitation details - ID: ${invitation.id}, Project: ${invitation.project_id}, Active: ${invitation.is_active}, Uses: ${invitation.used_count}/${invitation.max_uses}`);
    }

    if (invitationError || !invitation) {
      console.log(`[INVITATION_LOOKUP] Returning 404 - Invitation not found or deactivated`);
      return res.status(404).json({ error: 'Invitation not found or has been deactivated' });
    }

    if (invitation.used_count >= invitation.max_uses) {
      console.log(`[INVITATION_LOOKUP] Returning 410 - Usage limit reached`);
      return res.status(410).json({ error: 'This invitation has reached its maximum usage limit' });
    }

    console.log(`[INVITATION_LOOKUP] Success - Returning invitation data`);
    res.json({ invitation });
  } catch (error) {
    console.error(`[INVITATION_LOOKUP] Unexpected error:`, error);
    res.status(500).json({ error: 'Failed to fetch invitation' });
  }
});

// --- API Routes ---
// This router is protected by JWT validation and ready for future platformized features.
const apiRouter = express.Router();
apiRouter.use(validateSupabaseJwt);

// Import route handlers
import documentRouter from './routes/documents';
import presetRouter from './routes/presets';
import tagRouter from './routes/tags';
import eventRouter from './routes/events';
import { projectManagementRouter } from './routes/projectManagement';

// Mount route handlers
apiRouter.use('/documents', documentRouter);
apiRouter.use('/presets', presetRouter);
apiRouter.use('/tags', tagRouter);
apiRouter.use('/events', eventRouter);
apiRouter.use('/project-management', projectManagementRouter);

app.use('/api', apiRouter);

// --- Public External API for LLM Systems ---
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { resolveDocumentWithOverrides } from './services/documentResolutionService';

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

    // Resolve the document content with preset overrides using centralized service
    let finalContent: string;
    if (document.is_composite) {
      const overrides = preset.rules.component_overrides || {};
      
      finalContent = await resolveDocumentWithOverrides(
        supabase,
        preset.project_id,
        document.content || '',
        document.components || {},
        overrides,
        document.id
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
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`API server listening on port ${port}`);
    });
}

export const continuumApi = app;