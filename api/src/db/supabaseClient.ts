import { createClient } from '@supabase/supabase-js'

// It's crucial to use environment variables for these sensitive values
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be provided.');
}

// Service role client for server-side operations that bypass RLS
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for server-side operations that bypass RLS with service key
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

// Create a user-authenticated client that respects RLS policies
export const createUserSupabaseClient = (userToken: string) => {
  // For server-side RLS to work, we need to create a client that will 
  // pass the user's JWT token with each request so auth.uid() works
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    },
  });
  
  return client;
};