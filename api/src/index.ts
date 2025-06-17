import * as functions from '@google-cloud/functions-framework';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { supabase } from './db/supabaseClient';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// --- Authentication Middleware ---
const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).send('Unauthorized: No token provided');
    return;
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    res.status(401).send('Unauthorized: Invalid token');
    return;
  }

  // Add user to the request object for use in other routes
  (req as any).user = user;
  next();
};

// --- Authentication Routes ---

app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).send('Email and password are required.');
  }

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return res.status(400).json({ error: error.message });
  }
  return res.status(201).json(data);
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).send('Email and password are required.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return res.status(401).json({ error: error.message });
  }
  // The JWT is in data.session.access_token
  return res.status(200).json(data);
});

app.post('/login-with-google', async (req, res) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google'
    });

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    // Return the provider's sign-in URL to the frontend
    return res.status(200).json(data);
});


// --- Protected API Routes ---
app.get('/projects', requireAuth, async (req, res) => {
  const user = (req as any).user;
  res.json({
    message: `This is a protected route for user ${user.email}.`,
  });
});

// Public root route
app.get('/', (req, res) => {
  res.send('Continuum API is running with Express!');
});

// Export the Express app as a Google Cloud Function
export const continuumApi = functions.http('continuumApi', app);