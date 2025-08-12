import { Router } from 'express';
import { supabaseAdmin } from '../db/supabaseClient';
import { authenticateUser } from '../middleware/auth';
import { RequestWithUser } from '../index';

const router = Router();

// Get project members (with user details)
router.get('/:projectId/members', authenticateUser, async (req: RequestWithUser, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id;

    // Verify user has access to this project
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all project members
    const { data: members, error: membersError } = await supabaseAdmin
      .from('project_members')
      .select(`
        project_id,
        user_id,
        role
      `)
      .eq('project_id', projectId);

    if (membersError) throw membersError;

    // Get user details from auth.users for each member
    const membersWithDetails = await Promise.all(
      (members || []).map(async (member: any) => {
        try {
          const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(member.user_id);
          
          return {
            id: `${member.project_id}-${member.user_id}`, // Create composite ID
            project_id: member.project_id,
            user_id: member.user_id,
            role: member.role,
            created_at: new Date().toISOString(), // Fallback since we don't have created_at
            profiles: {
              id: member.user_id,
              email: user?.email || 'unknown@example.com',
              full_name: user?.user_metadata?.full_name || user?.email || 'Unknown User'
            }
          };
        } catch (err) {
          console.error(`Failed to get user details for ${member.user_id}:`, err);
          return {
            id: `${member.project_id}-${member.user_id}`, // Create composite ID
            project_id: member.project_id,
            user_id: member.user_id,
            role: member.role,
            created_at: new Date().toISOString(), // Fallback since we don't have created_at
            profiles: {
              id: member.user_id,
              email: 'unknown@example.com',
              full_name: 'Unknown User'
            }
          };
        }
      })
    );

    // Sort with owners first
    const sortedMembers = membersWithDetails.sort((a, b) => {
      if (a.role === 'owner' && b.role !== 'owner') return -1;
      if (b.role === 'owner' && a.role !== 'owner') return 1;
      // Since we don't have created_at, just maintain the order
      return 0;
    });

    res.json({ members: sortedMembers });
  } catch (error) {
    console.error('Error fetching project members:', error);
    res.status(500).json({ error: 'Failed to fetch project members' });
  }
});

// Remove project member (owners only)
router.delete('/:projectId/members/:userId', authenticateUser, async (req: RequestWithUser, res) => {
  try {
    const { projectId, userId: memberUserId } = req.params;
    const userId = req.user?.id;

    // Verify user is project owner
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership || membership.role !== 'owner') {
      return res.status(403).json({ error: 'Only project owners can remove members' });
    }

    // Get member to remove
    const { data: memberToRemove, error: memberError } = await supabaseAdmin
      .from('project_members')
      .select('user_id, role')
      .eq('user_id', memberUserId)
      .eq('project_id', projectId)
      .single();

    if (memberError || !memberToRemove) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Prevent removing owners
    if (memberToRemove.role === 'owner') {
      return res.status(400).json({ error: 'Cannot remove project owner' });
    }

    // Prevent self-removal
    if (memberToRemove.user_id === userId) {
      return res.status(400).json({ error: 'Cannot remove yourself' });
    }

    // Remove member
    const { error: removeError } = await supabaseAdmin
      .from('project_members')
      .delete()
      .eq('user_id', memberUserId)
      .eq('project_id', projectId);

    if (removeError) throw removeError;

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing project member:', error);
    res.status(500).json({ error: 'Failed to remove project member' });
  }
});

// Transfer ownership (owners only)
router.post('/:projectId/transfer-ownership', authenticateUser, async (req: RequestWithUser, res) => {
  try {
    const { projectId } = req.params;
    const { newOwnerId } = req.body;
    const userId = req.user?.id;

    if (!newOwnerId) {
      return res.status(400).json({ error: 'New owner ID is required' });
    }

    // Verify user is project owner
    const { data: currentOwnership, error: ownershipError } = await supabaseAdmin
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('role', 'owner')
      .single();

    if (ownershipError || !currentOwnership) {
      return res.status(403).json({ error: 'Only project owners can transfer ownership' });
    }

    // Verify new owner is a project member
    const { data: newOwnerMembership, error: newOwnerError } = await supabaseAdmin
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', newOwnerId)
      .single();

    if (newOwnerError || !newOwnerMembership) {
      return res.status(400).json({ error: 'New owner must be a project member' });
    }

    // Perform transfer in a transaction
    const { error: transferError } = await supabaseAdmin.rpc('transfer_project_ownership', {
      project_id: projectId,
      current_owner_id: userId,
      new_owner_id: newOwnerId
    });

    if (transferError) {
      // If RPC doesn't exist, do it manually
      // First, downgrade current owner
      await supabaseAdmin
        .from('project_members')
        .update({ role: 'collaborator' })
        .eq('project_id', projectId)
        .eq('user_id', userId);

      // Then, upgrade new owner
      await supabaseAdmin
        .from('project_members')
        .update({ role: 'owner' })
        .eq('project_id', projectId)
        .eq('user_id', newOwnerId);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error transferring ownership:', error);
    res.status(500).json({ error: 'Failed to transfer ownership' });
  }
});

// Get project invitations (owners only)
router.get('/:projectId/invitations', authenticateUser, async (req: RequestWithUser, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id;

    // Verify user is project owner
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership || membership.role !== 'owner') {
      return res.status(403).json({ error: 'Only project owners can view invitations' });
    }

    // Get active invitations
    const { data: invitations, error: invitationsError } = await supabaseAdmin
      .from('project_invitations')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (invitationsError) throw invitationsError;

    res.json({ invitations: invitations || [] });
  } catch (error) {
    console.error('Error fetching invitations:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// Create project invitation (owners only)
router.post('/:projectId/invitations', authenticateUser, async (req: RequestWithUser, res) => {
  try {
    const { projectId } = req.params;
    const { maxUses } = req.body;
    const userId = req.user?.id;

    if (!maxUses || maxUses < 1 || maxUses > 100) {
      return res.status(400).json({ error: 'Max uses must be between 1 and 100' });
    }

    // Verify user is project owner
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership || membership.role !== 'owner') {
      return res.status(403).json({ error: 'Only project owners can create invitations' });
    }

    // Create invitation
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from('project_invitations')
      .insert({
        project_id: projectId,
        created_by: userId,
        max_uses: maxUses,
        used_count: 0,
        is_active: true
      })
      .select()
      .single();

    if (invitationError) throw invitationError;

    res.json({ invitation });
  } catch (error) {
    console.error('Error creating invitation:', error);
    res.status(500).json({ error: 'Failed to create invitation' });
  }
});

// Deactivate invitation (owners only)
router.patch('/:projectId/invitations/:invitationId/deactivate', authenticateUser, async (req: RequestWithUser, res) => {
  try {
    const { projectId, invitationId } = req.params;
    const userId = req.user?.id;

    // Verify user is project owner
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (membershipError || !membership || membership.role !== 'owner') {
      return res.status(403).json({ error: 'Only project owners can deactivate invitations' });
    }

    // Deactivate invitation
    const { error: deactivateError } = await supabaseAdmin
      .from('project_invitations')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', invitationId)
      .eq('project_id', projectId);

    if (deactivateError) throw deactivateError;

    res.json({ success: true });
  } catch (error) {
    console.error('Error deactivating invitation:', error);
    res.status(500).json({ error: 'Failed to deactivate invitation' });
  }
});

// Accept invitation (authenticated endpoint)
router.post('/invitations/:invitationId/accept', authenticateUser, async (req: RequestWithUser, res) => {
  try {
    const { invitationId } = req.params;
    const userId = req.user?.id;

    // Get and validate invitation
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from('project_invitations')
      .select('id, project_id, max_uses, used_count, is_active')
      .eq('id', invitationId)
      .eq('is_active', true)
      .single();

    if (invitationError || !invitation) {
      return res.status(404).json({ error: 'Invitation not found or has been deactivated' });
    }

    if (invitation.used_count >= invitation.max_uses) {
      return res.status(410).json({ error: 'This invitation has reached its maximum usage limit' });
    }

    // Check if user is already a member
    const { data: existingMember, error: memberCheckError } = await supabaseAdmin
      .from('project_members')
      .select('user_id')
      .eq('project_id', invitation.project_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (memberCheckError) throw memberCheckError;

    if (existingMember) {
      return res.status(409).json({ error: 'You are already a member of this project' });
    }

    // Add user as project member
    const { error: memberError } = await supabaseAdmin
      .from('project_members')
      .insert({
        project_id: invitation.project_id,
        user_id: userId,
        role: 'collaborator'
      });

    if (memberError) throw memberError;

    // Increment invitation usage count
    const { error: updateError } = await supabaseAdmin
      .from('project_invitations')
      .update({
        used_count: invitation.used_count + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', invitation.id);

    if (updateError) throw updateError;

    res.json({ 
      success: true, 
      project_id: invitation.project_id,
      message: 'Successfully joined the project'
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

export { router as projectManagementRouter };