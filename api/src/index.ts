import * as functions from '@google-cloud/functions-framework';
import express from 'express';
import cors from 'cors';
import { supabase } from './db/supabaseClient';

const app = express();

// Middleware
app.use(cors()); // Basic CORS for now
app.use(express.json());

// A simple authentication middleware example
const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send('Unauthorized: No token provided');
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).send('Unauthorized: Invalid token');
    }
    // You can attach the user to the request object if you want
    // (req as any).user = user;
    next();
  } catch (error) {
    return res.status(500).send('Internal Server Error');
  }
};

// Public route
app.get('/', (req, res) => {
  res.send('Continuum API is running with Express!');
});

// --- API Routes ---

// Example of a protected route to get projects
// This is a starting point for your CRUD operations
app.get('/projects', requireAuth, async (req, res) => {
  // TODO: Fetch projects from the database for the authenticated user
  res.json({
    message: "This is a protected route. If you see this, you are authenticated!",
    // In a real implementation, you would return project data here.
  });
});


// Export the Express app as a Google Cloud Function
export const continuumApi = functions.http('continuumApi', app);