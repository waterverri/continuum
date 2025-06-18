import express from 'express';
import cors from 'cors';
import { expressjwt } from 'express-jwt';
import jwksRsa from 'jwks-rsa';

// Import routers
import projectsRouter from './routes/projects';

const app = express();
app.use(cors());
app.use(express.json());

// --- Authentication Middleware ---
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