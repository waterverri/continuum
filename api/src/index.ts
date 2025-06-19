import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

// Import routers
import projectsRouter from './routes/projects';

// --- Custom Type for Express Request ---
// This extends the default Request type to include our custom 'user' property.
interface RequestWithUser extends Request {
  user?: any;
}

// --- Custom Authentication Middleware ---
// This middleware replaces the express-jwt and jwks-rsa setup.
const validateSupabaseJwt = async (req: RequestWithUser, res: Response, next: NextFunction) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY; // Using the 'anon' key which acts as the public key for this call.

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase URL or Anon Key is not configured on the server.');
      return res.status(500).json({ error: 'Authentication service is not configured.' });
    }

    // 1. Check for the Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing or invalid Authorization header. A Bearer token is required.' });
    }

    const jwt = authHeader.split(' ')[1]; // Extract the token from "Bearer <token>"

    // 2. Make a request to the Supabase user endpoint to validate the token
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'apikey': supabaseAnonKey,
      },
    });

    const userData = await response.json();

    // 3. Check the response from Supabase
    if (!response.ok) {
      // If Supabase returns an error, the token is invalid or expired.
      // Forward the status and message for better client-side error handling.
      return res.status(response.status).json({ message: userData.msg || 'Invalid or expired token.', detail: userData });
    }

    // 4. If the token is valid, attach the user data to the request object and proceed
    req.user = userData;
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
// All routes under /api will be protected by our custom JWT validation middleware.
const apiRouter = express.Router();
apiRouter.use(validateSupabaseJwt); // Apply the auth middleware here
apiRouter.use('/projects', projectsRouter); // Register the projects router

// Mount the protected API router
app.use('/api', apiRouter);


// --- Local Development Server ---
// This block will only run when not in a production environment (like Google Cloud Run)
if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`API server listening on port ${port}`);
    });
}

// Export the app for the Functions Framework
export const continuumApi = app;