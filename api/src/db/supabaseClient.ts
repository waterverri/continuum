import { createClient } from '@supabase/supabase-js'

// It's crucial to use environment variables for these sensitive values
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

console.log('[SUPABASE_CLIENT] Initializing Supabase clients...');
console.log(`[SUPABASE_CLIENT] SUPABASE_URL: ${supabaseUrl ? 'SET' : 'MISSING'}`);
console.log(`[SUPABASE_CLIENT] SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'SET' : 'MISSING'}`);
console.log(`[SUPABASE_CLIENT] SUPABASE_SERVICE_KEY: ${supabaseServiceKey ? 'SET' : 'MISSING'}`);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[SUPABASE_CLIENT] CRITICAL: Required environment variables missing');
  throw new Error('Supabase URL and Anon Key must be provided.');
}

if (!supabaseServiceKey) {
  console.error('[SUPABASE_CLIENT] CRITICAL: SUPABASE_SERVICE_KEY is missing! Admin operations will fail.');
  throw new Error('SUPABASE_SERVICE_KEY environment variable is required for admin operations.');
}

// Service role client for server-side operations that bypass RLS
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
console.log('[SUPABASE_CLIENT] Regular supabase client created successfully');

// Admin client for server-side operations that bypass RLS with service key
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
console.log('[SUPABASE_CLIENT] Admin supabase client created successfully');

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