import { supabase } from './supabaseClient';

const API_URL = 'http://localhost:8080'; // Your local API endpoint, change for production

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