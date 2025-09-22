import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Detect if we're in local development
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Configure auth settings based on environment
const authConfig = {
  auth: {
    redirectTo: isLocalDev ? 'http://localhost:5173' : window.location.origin,
    // For local dev, we'll handle auth differently
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, authConfig)