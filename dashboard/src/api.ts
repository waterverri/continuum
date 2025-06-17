import { supabase } from './supabaseClient';

// Use the environment variable for the API URL, but fall back to localhost for development
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const getProjects = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error("User not logged in.");
  }

  const response = await fetch(`${API_URL}/projects`, {
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch projects');
  }

  return response.json();
};