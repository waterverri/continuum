import { createClient } from '@supabase/supabase-js'

// It's crucial to use environment variables for these sensitive values
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be provided.');
}

// Service role client for server-side operations that bypass RLS
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Create a user-authenticated client that respects RLS policies
export const createUserSupabaseClient = (userToken: string) => {
  const client = createClient(supabaseUrl, supabaseAnonKey);
  // Set the user's JWT token for RLS-aware operations
  client.auth.setSession({
    access_token: userToken,
    refresh_token: '', // Not needed for server-side calls
  });
  return client;
};