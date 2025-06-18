import express from 'express';
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

const addUserToRequest = (req, res, next) => {
  if (req.auth && req.auth.sub) {
    req.user = { id: req.auth.sub };
  }
  next();
};

// --- API Routes ---
const apiRouter = express.Router();

// All routes under /api will require authentication
apiRouter.use(requireAuth, addUserToRequest);

// Mount the project-specific routes
apiRouter.use('/projects', projectsRouter);

// You can add more routers here in the future
// apiRouter.use('/documents', documentsRouter);


// Mount the main API router
app.use('/api', apiRouter);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});