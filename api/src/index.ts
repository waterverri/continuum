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

// Example for a future route:
// import presetRouter from './routes/presets';
// apiRouter.use('/presets', presetRouter);

app.use('/api', apiRouter);


// --- Local Development Server ---
if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`API server listening on port ${port}`);
    });
}

export const continuumApi = app;