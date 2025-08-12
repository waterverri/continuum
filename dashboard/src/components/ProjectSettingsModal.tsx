import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../supabaseClient';

interface Project {
  id: string;
  title: string;
  description: string;
  base_date?: string;
  created_at: string;
}

interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
  created_at: string;
  profiles: {
    id: string;
    email: string;
    full_name?: string;
  };
}

interface ProjectInvitation {
  id: string;
  project_id: string;
  created_by: string;
  max_uses: number;
  used_count: number;
  expires_at?: string;
  created_at: string;
  is_active: boolean;
}

interface ProjectSettingsModalProps {
  project: Project;
  onClose: () => void;
  onProjectUpdate: () => void;
}

export function ProjectSettingsModal({ project, onClose, onProjectUpdate }: ProjectSettingsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'members' | 'invitations'>('general');
  
  // General settings
  const [baseDate, setBaseDate] = useState(project.base_date ? new Date(project.base_date).toISOString().split('T')[0] : '');
  
  // Members
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [transferTarget, setTransferTarget] = useState<string>('');
  
  // Invitations
  const [invitations, setInvitations] = useState<ProjectInvitation[]>([]);
  const [newInvitationUses, setNewInvitationUses] = useState<number>(1);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string>('');

  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const getCurrentUser = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    } catch (err) {
      console.error('Failed to get current user:', err);
    }
  }, []);

  const loadMembers = useCallback(async () => {
    try {
      const token = await getAccessToken();
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/project-management/${project.id}/members`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load project members');
      }

      const data = await response.json();
      setMembers(data.members as ProjectMember[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project members');
    }
  }, [project.id]);

  const loadInvitations = useCallback(async () => {
    try {
      const token = await getAccessToken();
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/project-management/${project.id}/invitations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load invitations');
      }

      const data = await response.json();
      setInvitations(data.invitations as ProjectInvitation[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invitations');
    }
  }, [project.id]);

  useEffect(() => {
    getCurrentUser();
    loadMembers();
    loadInvitations();
  }, [getCurrentUser, loadMembers, loadInvitations]);

  const handleUpdateBaseDate = async () => {
    if (!baseDate) {
      setError('Please select a base date');
      return;
    }

    try {
      setLoading(true);
      const token = await getAccessToken();
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          base_date: baseDate
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update base date');
      }

      onProjectUpdate();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update base date');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (!confirm('Are you sure you want to remove this member from the project?')) {
      return;
    }

    try {
      setLoading(true);
      const token = await getAccessToken();
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/project-management/${project.id}/members/${memberUserId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to remove member');
      }

      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  const handleTransferOwnership = async () => {
    if (!transferTarget) {
      setError('Please select a member to transfer ownership to');
      return;
    }

    if (!confirm('Are you sure you want to transfer ownership of this project? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      const token = await getAccessToken();
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/project-management/${project.id}/transfer-ownership`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          newOwnerId: transferTarget
        })
      });

      if (!response.ok) {
        throw new Error('Failed to transfer ownership');
      }

      await loadMembers();
      setTransferTarget('');
      onProjectUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transfer ownership');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvitation = async () => {
    if (newInvitationUses < 1 || newInvitationUses > 100) {
      setError('Invitation uses must be between 1 and 100');
      return;
    }

    try {
      setLoading(true);
      const token = await getAccessToken();
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/project-management/${project.id}/invitations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          maxUses: newInvitationUses
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create invitation');
      }

      const data = await response.json();
      const inviteLink = `${window.location.origin}/invite/${data.invitation.id}`;
      setGeneratedInviteLink(inviteLink);
      
      await loadInvitations();
      setNewInvitationUses(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivateInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to deactivate this invitation?')) {
      return;
    }

    try {
      setLoading(true);
      const token = await getAccessToken();
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/project-management/${project.id}/invitations/${invitationId}/deactivate`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to deactivate invitation');
      }

      await loadInvitations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate invitation');
    } finally {
      setLoading(false);
    }
  };

  const copyInviteLink = async (invitationId: string) => {
    const inviteLink = `${window.location.origin}/invite/${invitationId}`;
    try {
      await navigator.clipboard.writeText(inviteLink);
      // You could add a toast notification here
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = inviteLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  const isOwner = members.find(m => m.user_id === currentUserId)?.role === 'owner';
  const collaboratorMembers = members.filter(m => m.role === 'editor');

  return createPortal(
    <div className="modal-overlay">
      <div className="project-settings-modal">
        <div className="modal-header">
          <h2>Project Settings</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError(null)}>&times;</button>
          </div>
        )}

        <div className="settings-tabs">
          <button 
            className={`tab ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button 
            className={`tab ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            Members ({members.length})
          </button>
          <button 
            className={`tab ${activeTab === 'invitations' ? 'active' : ''}`}
            onClick={() => setActiveTab('invitations')}
          >
            Invitations ({invitations.length})
          </button>
        </div>

        <div className="settings-content">
          {activeTab === 'general' && (
            <div className="settings-section">
              <h3>General Settings</h3>
              
              <div className="setting-item">
                <h4>Base Date for Timeline</h4>
                <p>Set the base date (T0) for your project timeline. All events will be relative to this date.</p>
                <div className="setting-controls">
                  <input
                    type="date"
                    value={baseDate}
                    onChange={(e) => setBaseDate(e.target.value)}
                    disabled={loading}
                  />
                  <button 
                    className="btn btn--primary"
                    onClick={handleUpdateBaseDate}
                    disabled={loading || !baseDate}
                  >
                    {loading ? 'Updating...' : 'Update Base Date'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <div className="settings-section">
              <h3>Project Members</h3>
              
              <div className="members-list">
                {members.map((member) => (
                  <div key={member.id} className="member-item">
                    <div className="member-info">
                      <div className="member-name">
                        {member.profiles.full_name || member.profiles.email}
                        {member.role === 'owner' && <span className="owner-badge">Owner</span>}
                      </div>
                      <div className="member-email">{member.profiles.email}</div>
                    </div>
                    <div className="member-actions">
                      {isOwner && member.role === 'editor' && (
                        <button
                          className="btn btn--danger btn--sm"
                          onClick={() => handleRemoveMember(member.user_id)}
                          disabled={loading}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {isOwner && collaboratorMembers.length > 0 && (
                <div className="setting-item">
                  <h4>Transfer Ownership</h4>
                  <p>Transfer ownership of this project to another member. This action cannot be undone.</p>
                  <div className="setting-controls">
                    <select 
                      value={transferTarget} 
                      onChange={(e) => setTransferTarget(e.target.value)}
                      disabled={loading}
                    >
                      <option value="">Select new owner...</option>
                      {collaboratorMembers.map((member) => (
                        <option key={member.id} value={member.user_id}>
                          {member.profiles.full_name || member.profiles.email}
                        </option>
                      ))}
                    </select>
                    <button 
                      className="btn btn--danger"
                      onClick={handleTransferOwnership}
                      disabled={loading || !transferTarget}
                    >
                      {loading ? 'Transferring...' : 'Transfer Ownership'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'invitations' && (
            <div className="settings-section">
              <h3>Project Invitations</h3>
              
              {isOwner && (
                <div className="setting-item">
                  <h4>Create New Invitation</h4>
                  <p>Generate an invitation link that can be used by registered users to join this project.</p>
                  <div className="setting-controls">
                    <div className="input-group">
                      <label>Maximum uses:</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={newInvitationUses}
                        onChange={(e) => setNewInvitationUses(parseInt(e.target.value) || 1)}
                        disabled={loading}
                      />
                    </div>
                    <button 
                      className="btn btn--primary"
                      onClick={handleCreateInvitation}
                      disabled={loading}
                    >
                      {loading ? 'Creating...' : 'Create Invitation'}
                    </button>
                  </div>
                  
                  {generatedInviteLink && (
                    <div className="generated-link">
                      <h4>Invitation Link Generated</h4>
                      <div className="link-display">
                        <input type="text" value={generatedInviteLink} readOnly />
                        <button 
                          className="btn btn--secondary"
                          onClick={() => copyInviteLink(generatedInviteLink.split('/').pop() || '')}
                        >
                          Copy
                        </button>
                      </div>
                      <p>Share this link with users you want to invite to the project.</p>
                    </div>
                  )}
                </div>
              )}

              <div className="invitations-list">
                <h4>Active Invitations</h4>
                {invitations.length === 0 ? (
                  <p>No active invitations.</p>
                ) : (
                  invitations.map((invitation) => (
                    <div key={invitation.id} className="invitation-item">
                      <div className="invitation-info">
                        <div className="invitation-stats">
                          Used: {invitation.used_count} / {invitation.max_uses}
                        </div>
                        <div className="invitation-date">
                          Created: {new Date(invitation.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="invitation-actions">
                        <button
                          className="btn btn--secondary btn--sm"
                          onClick={() => copyInviteLink(invitation.id)}
                        >
                          Copy Link
                        </button>
                        {isOwner && (
                          <button
                            className="btn btn--danger btn--sm"
                            onClick={() => handleDeactivateInvitation(invitation.id)}
                            disabled={loading}
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.getElementById('modal-portal')!
  );
}