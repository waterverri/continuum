import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js' // FIX: Added 'type' keyword
import { supabase } from './supabaseClient'
import Auth from './Auth'
import { getProjects } from './api'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [projectsMessage, setProjectsMessage] = useState<string>('')

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
    try {
      const data = await getProjects();
      setProjectsMessage(data.message);
    } catch (error) {
      setProjectsMessage((error as Error).message);
    }
  };

  if (!session) {
    return <Auth />
  } else {
    return (
      <div style={{maxWidth: '400px', margin: 'auto'}}>
        <h1>Continuum Dashboard</h1>
        <p>Welcome, {session.user.email}</p>
        <button onClick={() => supabase.auth.signOut()}>Sign Out</button>
        <hr />
        <button onClick={handleGetProjects}>Fetch Protected Projects</button>
        {projectsMessage && <p>API Response: {projectsMessage}</p>}
      </div>
    )
  }
}

export default App