import * as functions from '@google-cloud/functions-framework';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { supabase } from './db/supabaseClient';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// A simple authentication middleware example
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).send('Unauthorized: No token provided');
    return; // Explicitly return to exit function
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      res.status(401).send('Unauthorized: Invalid token');
      return; // Explicitly return to exit function
    }
    
    // Attach user to request for use in subsequent handlers if needed
    // (req as any).user = user;
    
    next(); // Call next() on the success path
  } catch (error) {
    res.status(500).send('Internal Server Error');
    return; // Explicitly return to exit function
  }
};

// Public route
app.get('/', (req, res) => {
  res.send('Continuum API is running with Express!');
});

// --- API Routes ---

// Protected route to get projects
app.get('/projects', requireAuth, async (req, res) => {
  // At this point, the user is authenticated.
  res.json({
    message: "This is a protected route. If you see this, you are authenticated!",
  });
});

// Export the Express app as a Google Cloud Function
export const continuumApi = functions.http('continuumApi', app);