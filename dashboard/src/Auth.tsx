import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import { getProjects } from './api'
import './App.css';

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [projectsMessage, setProjectsMessage] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleGetProjects = async () => {
    setLoading(true)
    try {
      const data = await getProjects();
      setProjectsMessage(data.message);
    } catch (error) {
      setProjectsMessage((error as Error).message);
    }
    setLoading(false)
  };

  if (!session) {
    return <Auth />
  } else {
    return (
      <div className="container">
        <h1 className="header">Dashboard</h1>
        <p className="description">Welcome, {session.user.email}</p>
        <button onClick={() => supabase.auth.signOut()}>Sign Out</button>
        <hr />
        <button onClick={handleGetProjects} disabled={loading}>
          {loading ? 'Fetching...' : 'Fetch Protected Projects'}
        </button>
        {projectsMessage && <p>API Response: {projectsMessage}</p>}
      </div>
    )
  }
}

export default App