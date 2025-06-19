import express from 'express';
import cors from 'cors';
import { expressjwt } from 'express-jwt';
import jwksRsa from 'jwks-rsa';

// Import routers
import projectsRouter from './routes/projects';

// --- Helper function to parse the Project ID from the URL ---
function getSupabaseProjectId(url: string): string | null {
  try {
    const urlObject = new URL(url);
    const hostnameParts = urlObject.hostname.split('.');
    if (hostnameParts.length >= 3) {
      return hostnameParts[0];
    }
    return null;
  } catch (error) {
    console.error('Invalid Supabase URL:', error);
    return null;
  }
}

// --- App Setup ---
const app = express();
app.use(cors());
app.use(express.json());

// --- Auth Middleware Setup ---
const supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl) {
  throw new Error('SUPABASE_URL environment variable is not set.');
}

const supabaseProjectId = getSupabaseProjectId(supabaseUrl);
if (!supabaseProjectId) {
  throw new Error('Could not parse Project ID from SUPABASE_URL.');
}

const requireAuth = expressjwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${supabaseProjectId}.supabase.co/auth/v1/jwks`,
    jwksRequestHeaders: {
      apikey: process.env.SUPABASE_ANON_KEY, // Or your actual anon key
    },
  }),
  audience: 'authenticated',
  issuer: `https://${supabaseProjectId}.supabase.co/auth/v1`,
  algorithms: ['RS256'],
});

console.log("jwksUri",`https://${supabaseProjectId}.supabase.co/auth/v1/jwks`);
console.log("issuer",`https://${supabaseProjectId}.supabase.co/auth/v1`)

// --- API Routes ---
const apiRouter = express.Router();
apiRouter.use(requireAuth);
apiRouter.use('/projects', projectsRouter);
app.use('/api', apiRouter);

// For local development
if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`API server listening on port ${port}`);
    });
}

export const continuumApi = app;