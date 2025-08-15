import { useState } from 'react';
import { supabase } from './supabaseClient';
import './styles/Auth.css';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showLoginForm, setShowLoginForm] = useState(false);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      alert(error.message);
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
     if (error) {
      alert(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="auth-hero__content">
          <div className="auth-brand">
            <h1 className="auth-brand__title">
              📖 Continuum
            </h1>
            <p className="auth-brand__tagline">
              Story Context Management Platform
            </p>
          </div>
          
          <div className="auth-description">
            <h2>Organize Your Creative Universe</h2>
            <p className="auth-description__text">
              Continuum helps writers, game masters, and storytellers manage complex story universes 
              with interconnected documents, dynamic context generation, and collaborative tools.
            </p>
            
            <div className="auth-features">
              <div className="auth-feature">
                <span className="auth-feature__icon">🔗</span>
                <span className="auth-feature__text">Link documents and build context dynamically</span>
              </div>
              <div className="auth-feature">
                <span className="auth-feature__icon">📋</span>
                <span className="auth-feature__text">Generate presets for different story contexts</span>
              </div>
              <div className="auth-feature">
                <span className="auth-feature__icon">🏷️</span>
                <span className="auth-feature__text">Tag and organize with powerful filtering</span>
              </div>
              <div className="auth-feature">
                <span className="auth-feature__icon">📅</span>
                <span className="auth-feature__text">Timeline management for events and story arcs</span>
              </div>
            </div>
          </div>

          <div className="auth-actions">
            {!showLoginForm ? (
              <button 
                className="btn btn--primary btn--large"
                onClick={() => setShowLoginForm(true)}
              >
                Access Your Account
              </button>
            ) : (
              <div className="auth-form-container">
                <div className="auth-form">
                  <h3>Sign In to Continuum</h3>
                  
                  <button 
                    onClick={handleGoogleLogin} 
                    className="btn btn--google btn--large"
                    disabled={loading}
                  >
                    <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </button>

                  <div className="auth-divider">
                    <span>or</span>
                  </div>

                  <form className="auth-email-form" onSubmit={handleLogin}>
                    <div className="form-group">
                      <label htmlFor="email">Email Address</label>
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="password">Password</label>
                      <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Your password"
                        required
                      />
                    </div>

                    <button type="submit" className="btn btn--primary btn--large" disabled={loading}>
                      {loading ? 'Signing In...' : 'Sign In'}
                    </button>
                  </form>

                  <button 
                    className="btn btn--ghost btn--sm auth-back-btn"
                    onClick={() => setShowLoginForm(false)}
                  >
                    ← Back to Overview
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="auth-footer">
          <p className="auth-footer__text">
            A professional story development platform for writers and creators.
          </p>
          <div className="auth-footer__links">
            <span>© 2025 Continuum Platform</span>
          </div>
        </div>
      </div>
    </div>
  );
}