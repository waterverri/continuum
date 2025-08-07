import { useState, useEffect, createContext, useContext } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import ProjectNavigationPage from './pages/ProjectNavigationPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import type { Session } from '@supabase/supabase-js';
import './App.css';

// Context for project page actions
const ProjectActionsContext = createContext<{
  setProjectActions: (actions: { 
    onCreateDocument?: () => void; 
    onToggleSidebar?: () => void;
    onToggleRightSidebar?: () => void;
  }) => void;
  projectActions: { 
    onCreateDocument?: () => void; 
    onToggleSidebar?: () => void;
    onToggleRightSidebar?: () => void;
  };
}>({ 
  setProjectActions: () => {}, 
  projectActions: {} 
});

export const useProjectActions = () => useContext(ProjectActionsContext); 

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectActions, setProjectActions] = useState<{
    onCreateDocument?: () => void;
    onToggleSidebar?: () => void;
    onToggleRightSidebar?: () => void;
  }>({});

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
    <ProjectActionsContext.Provider value={{ setProjectActions, projectActions }}>
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
    </ProjectActionsContext.Provider>
  );
}

const AppHeader = ({ session }: { session: Session | null }) => {
  const location = useLocation();
  const { projectActions } = useProjectActions();
  const { onCreateDocument, onToggleSidebar, onToggleRightSidebar } = projectActions;
  
  if (!session) return null;
  
  const isProjectDetailPage = location.pathname.startsWith('/projects/');

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  }

  return (
    <header className="app-header">
      <div className="app-header__left">
        {isProjectDetailPage && (
          <>
            <button 
              className="app-header__sidebar-toggle"
              onClick={onToggleSidebar}
              title="Toggle sidebar"
            >
              ☰
            </button>
            <Link to="/" className="app-header__back-link">
              ← Back to All Projects
            </Link>
          </>
        )}
      </div>
      
      <div className="app-header__center">
        <span>Continuum</span>
      </div>
      
      <div className="app-header__right">
        {isProjectDetailPage && (
          <>
            <button 
              className="app-header__sidebar-toggle"
              onClick={onToggleRightSidebar}
              title="Toggle widgets sidebar"
            >
              ⚙️
            </button>
            <button 
              className="btn btn--primary"
              onClick={onCreateDocument}
            >
              + Create Document
            </button>
          </>
        )}
        <span>Logged in as: {session.user.email}</span>
        <button onClick={handleSignOut}>Sign out</button>
      </div>
    </header>
  );
};

export default App;