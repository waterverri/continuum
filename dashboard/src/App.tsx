import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import ProjectNavigationPage from './pages/ProjectNavigationPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import type { Session } from '@supabase/supabase-js';
import './App.css'; 

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="app-container">
      <AppHeader session={session} />
      <main>
        <Routes>
          <Route 
            path="/" 
            element={!session ? <Auth /> : <ProjectNavigationPage />} 
          />
          <Route 
            path="/projects/:projectId" 
            element={!session ? <Navigate to="/" /> : <ProjectDetailPage />} 
          />
        </Routes>
      </main>
    </div>
  );
}

const AppHeader = ({ session }: { session: Session | null }) => {
  if (!session) return null;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  }

  return (
    <header className="app-header">
      <span>Logged in as: {session.user.email}</span>
      <button onClick={handleSignOut}>Sign out</button>
    </header>
  );
};

export default App;