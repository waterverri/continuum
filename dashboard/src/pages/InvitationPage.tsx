import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

interface InvitationData {
  id: string;
  project_id: string;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  projects: {
    id: string;
    title: string;
    description: string;
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
        const { data, error } = await supabase
          .from('project_invitations')
          .select(`
            *,
            projects (
              id,
              title,
              description
            )
          `)
          .eq('id', invitationId)
          .eq('is_active', true)
          .single();

        if (error) throw error;

        if (!data) {
          setError('Invitation not found or has been deactivated');
          setLoading(false);
          return;
        }

        if (data.used_count >= data.max_uses) {
          setError('This invitation has reached its maximum usage limit');
          setLoading(false);
          return;
        }

        setInvitation(data);
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

      // Check if user is already a member
      const { data: existingMember, error: memberCheckError } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', invitation.project_id)
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (memberCheckError) throw memberCheckError;

      if (existingMember) {
        setError('You are already a member of this project');
        setLoading(false);
        return;
      }

      // Add user as project member
      const { error: memberError } = await supabase
        .from('project_members')
        .insert({
          project_id: invitation.project_id,
          user_id: currentUser.id,
          role: 'collaborator'
        });

      if (memberError) throw memberError;

      // Increment invitation usage count
      const { error: updateError } = await supabase
        .from('project_invitations')
        .update({
          used_count: invitation.used_count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', invitation.id);

      if (updateError) throw updateError;

      setSuccess(true);
      
      // Redirect to project after a short delay
      setTimeout(() => {
        navigate(`/projects/${invitation.project_id}`);
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
          <p>You have successfully joined "{invitation?.projects.title}"</p>
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
              <h3>{invitation.projects.title}</h3>
              <p>{invitation.projects.description}</p>
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
            <h3>{invitation.projects.title}</h3>
            <p>{invitation.projects.description}</p>
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