import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

// Utility function to safely construct API URLs
const buildApiUrl = (path: string): string => {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  const cleanBase = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  const cleanPath = path.replace(/^\//, ''); // Remove leading slash
  return `${cleanBase}/${cleanPath}`;
};

interface InvitationData {
  id: string;
  project_id: string;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  projects: {
    id: string;
    name: string;
  };
}

export function InvitationPage() {
  const { invitationId } = useParams<{ invitationId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUser(user);
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error('Auth check failed:', err);
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    const loadInvitation = async () => {
      if (!invitationId) {
        setError('Invalid invitation link');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(buildApiUrl(`/api/public/invitations/${invitationId}`));
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Invitation not found or has been deactivated');
          } else if (response.status === 410) {
            throw new Error('This invitation has reached its maximum usage limit');
          } else {
            throw new Error('Failed to load invitation');
          }
        }

        const data = await response.json();
        setInvitation(data.invitation);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load invitation');
      } finally {
        setLoading(false);
      }
    };

    loadInvitation();
  }, [invitationId]);

  const handleAcceptInvitation = async () => {
    if (!invitation || !currentUser) return;

    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Authentication required. Please log in.');
        setLoading(false);
        return;
      }

      const response = await fetch(buildApiUrl(`/api/project-management/invitations/${invitation.id}/accept`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Invitation not found or has been deactivated');
        } else if (response.status === 409) {
          throw new Error('You are already a member of this project');
        } else if (response.status === 410) {
          throw new Error('This invitation has reached its maximum usage limit');
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to join project');
        }
      }

      const data = await response.json();
      setSuccess(true);
      
      // Redirect to project after a short delay
      setTimeout(() => {
        navigate(`/projects/${data.project_id}`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join project');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = () => {
    // Store the invitation URL to redirect back after login
    localStorage.setItem('returnUrl', window.location.pathname);
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="invitation-page">
        <div className="invitation-container">
          <div className="loading-spinner"></div>
          <p>Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="invitation-page">
        <div className="invitation-container error">
          <div className="error-icon">❌</div>
          <h2>Invitation Error</h2>
          <p>{error}</p>
          <button className="btn btn--secondary" onClick={() => navigate('/')}>
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="invitation-page">
        <div className="invitation-container success">
          <div className="success-icon">✅</div>
          <h2>Welcome to the Project!</h2>
          <p>You have successfully joined "{invitation?.projects.name}"</p>
          <p>Redirecting you to the project...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="invitation-page">
        <div className="invitation-container">
          <div className="invitation-icon">📨</div>
          <h2>Project Invitation</h2>
          {invitation && (
            <div className="project-info">
              <h3>{invitation.projects.name}</h3>
            </div>
          )}
          <p>You need to be signed in to accept this invitation.</p>
          <div className="invitation-actions">
            <button className="btn btn--primary" onClick={handleSignIn}>
              Sign In to Join
            </button>
            <button className="btn btn--secondary" onClick={() => navigate('/register')}>
              Create Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="invitation-page">
      <div className="invitation-container">
        <div className="invitation-icon">📨</div>
        <h2>Project Invitation</h2>
        {invitation && (
          <div className="project-info">
            <h3>{invitation.projects.name}</h3>
            <div className="invitation-details">
              <p>
                <strong>Invitation Usage:</strong> {invitation.used_count} / {invitation.max_uses}
              </p>
            </div>
          </div>
        )}
        <p>You've been invited to collaborate on this project.</p>
        <div className="invitation-actions">
          <button 
            className="btn btn--primary" 
            onClick={handleAcceptInvitation}
            disabled={loading}
          >
            {loading ? 'Joining...' : 'Accept Invitation'}
          </button>
          <button className="btn btn--secondary" onClick={() => navigate('/')}>
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}