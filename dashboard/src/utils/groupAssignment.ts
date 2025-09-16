import type { Document } from '../api';
import { updateDocument } from '../api';

/**
 * Ensures that when document A is assigned to document B's group,
 * document B becomes the group head (group_id = B.id) if it isn't already.
 * 
 * @param targetGroupId The ID of the document that should be the group head
 * @param documents Array of all documents to find the target document
 * @param projectId Project ID for API calls
 * @param accessToken Access token for API calls
 * @param updateDocumentsState Optional callback to update local document state
 */
export async function ensureBidirectionalGroupAssignment(
  targetGroupId: string | undefined,
  documents: Document[],
  projectId: string,
  accessToken: string,
  updateDocumentsState?: (updatedDocument: Document) => void
): Promise<void> {
  if (!targetGroupId) {
    console.log('🔧 No target group ID provided, skipping group head update');
    return;
  }

  const targetGroupDoc = documents.find(doc => doc.id === targetGroupId);
  
  console.log('🔧 Bidirectional group assignment:', {
    targetGroupId,
    targetDoc: targetGroupDoc ? {
      id: targetGroupDoc.id,
      title: targetGroupDoc.title,
      currentGroupId: targetGroupDoc.group_id
    } : 'NOT FOUND',
    needsUpdate: targetGroupDoc && (!targetGroupDoc.group_id || targetGroupDoc.group_id !== targetGroupDoc.id)
  });

  if (!targetGroupDoc) {
    console.error('🔧 Target group document not found:', targetGroupId);
    return;
  }

  // Check if the target document needs to become a group head
  if (!targetGroupDoc.group_id || targetGroupDoc.group_id !== targetGroupDoc.id) {
    try {
      console.log('🔧 Making API call to set document as group head:', targetGroupDoc.id);
      
      const updatedTargetDoc = await updateDocument(projectId, targetGroupDoc.id, {
        group_id: targetGroupDoc.id,
      }, accessToken);
      
      console.log('🔧 Successfully made document a group head:', {
        id: updatedTargetDoc.id,
        title: updatedTargetDoc.title,
        group_id: updatedTargetDoc.group_id
      });

      // Update local state if callback provided
      if (updateDocumentsState) {
        updateDocumentsState(updatedTargetDoc);
      }

    } catch (error) {
      console.error('🔧 Failed to make document a group head:', error);
      throw error; // Re-throw to let caller handle the error
    }
  } else {
    console.log('🔧 Target document is already a group head, no update needed');
  }
}