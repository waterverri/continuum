import express, { Response, NextFunction } from 'express';
import cors from 'cors';
import { expressjwt, Request as JWTRequest } from 'express-jwt';
import jwksRsa from 'jwks-rsa';

// Import routers
import projectsRouter from './routes/projects';

const app = express();
app.use(cors());
app.use(express.json());

// --- Authentication Middleware ---
// This uses the correct import and function call
const requireAuth = expressjwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co/auth/v1/jwks`,
  }),
  audience: 'authenticated',
  issuer: `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co/auth/v1`,
  algorithms: ['RS256'],
});


// --- API Routes ---
const apiRouter = express.Router();

// All routes under /api will require authentication.
// The requireAuth middleware automatically attaches the JWT payload to req.auth
apiRouter.use(requireAuth);

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