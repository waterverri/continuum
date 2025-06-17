import { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      alert(error.message); // FIX: Changed from error.error_description
    }
    // The onAuthStateChange listener in App.tsx will handle the redirect
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    });
     if (error) {
      alert(error.message); // FIX: Changed from error.error_description
    }
  };

  return (
    <div style={{maxWidth: '400px', margin: 'auto'}}>
      <h1>Continuum</h1>
      <p>Sign in via magic link or social provider</p>
      <form onSubmit={handleLogin}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email"
          />
           <label htmlFor="password">Password</label>
           <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
          />
        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
       <button onClick={handleGoogleLogin} disabled={loading}>
        Login with Google
      </button>
    </div>
  );
}