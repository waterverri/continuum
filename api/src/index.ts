import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { expressjwt as jwt, GetVerificationKey } from 'express-jwt';
import jwksRsa from 'jwks-rsa';

// Import routers
import projectsRouter from './routes/projects';

const app = express();
app.use(cors());
app.use(express.json());

// --- Authentication Middleware ---
const requireAuth = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co/auth/v1/jwks`,
  }) as GetVerificationKey,
  audience: 'authenticated',
  issuer: `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co/auth/v1`,
  algorithms: ['RS256'],
});

// Define a custom interface to extend the Express Request object
interface AuthenticatedRequest extends Request {
    auth?: any; // or a more specific type from express-jwt if available
}

// Correctly typed middleware
const addUserToRequest = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.auth && req.auth.sub) {
    // This part is conceptually what happens, but `req.user` isn't a default property.
    // We handle the user via `req.auth.sub` from the JWT directly in endpoints.
  }
  next();
};

// --- API Routes ---
const apiRouter = express.Router();

// All routes under /api will require authentication
apiRouter.use(requireAuth, addUserToRequest);

// Mount the project-specific routes
apiRouter.use('/projects', projectsRouter);

// Mount the main API router
app.use('/api', apiRouter);

// This part is for local development; Google Cloud Functions Framework handles the server in production.
if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`API server listening on port ${port}`);
    });
}

// Export the Express app for the Google Cloud Functions Framework
export const continuumApi = app;