import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import type { Session } from '@supabase/supabase-js'; // Corrected type-only import
import { getProjects } from './api';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [projects, setProjects] = useState<any[]>([]); // State to hold projects
  const [error, setError] = useState<string | null>(null); // State for errors

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // useEffect to fetch projects when the session is available
  useEffect(() => {
    if (session) {
      handleGetProjects();
    }
  }, [session]);

  const handleGetProjects = async () => {
    if (!session) {
      alert('You must be logged in to get projects.');
      return;
    }
    try {
      setError(null); // Clear previous errors
      const data = await getProjects(session);
      setProjects(data);
    } catch (error) {
      console.error(error);
      setError('Failed to fetch projects. Check the console for details.');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setProjects([]); // Clear projects on sign out
    setError(null); // Clear errors
  }

  if (!session) {
    return <Auth />;
  } else {
    return (
      <div>
        <h2>Welcome to Continuum</h2>
        <p>Logged in as: {session.user.email}</p>
        <button onClick={handleSignOut}>Sign out</button>
        <hr />
        <h3>Your Projects</h3>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {projects.length > 0 ? (
          <ul>
            {projects.map((project) => (
              <li key={project.id}>{project.name} (ID: {project.id})</li>
            ))}
          </ul>
        ) : (
          <p>You don't have any projects yet.</p>
        )}
      </div>
    );
  }
}

export default App;