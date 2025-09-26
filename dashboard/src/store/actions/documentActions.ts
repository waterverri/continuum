import type { Document } from '../../api';
import type { GlobalState, GlobalStateActions } from '../types';
// import { addTagsToDocument } from '../../api';
import { supabase } from '../../supabaseClient';

type SetFunction = (partial: any) => void;
type GetFunction = () => GlobalState & GlobalStateActions;

export function createDocumentActions(set: SetFunction, get: GetFunction) {
  return {
    // Basic CRUD operations
    setDocuments: (documents: Document[]) =>
      set((state: any) => ({
        documents: { ...state.documents, items: documents },
      })),

    addDocument: (document: Document) =>
      set((state: any) => ({
        documents: {
          ...state.documents,
          items: [...state.documents.items, document],
        },
      })),

    updateDocument: (id: string, updates: Partial<Document>) =>
      set((state: any) => ({
        documents: {
          ...state.documents,
          items: state.documents.items.map((doc: Document) =>
            doc.id === id ? { ...doc, ...updates } : doc
          ),
        },
      })),

    removeDocument: (id: string) =>
      set((state: any) => ({
        documents: {
          ...state.documents,
          items: state.documents.items.filter((doc: Document) => doc.id !== id),
        },
      })),

    setDocumentsLoading: (loading: boolean) =>
      set((state: any) => ({
        documents: { ...state.documents, loading },
      })),

    setDocumentsError: (error: string | null) =>
      set((state: any) => ({
        documents: { ...state.documents, error },
      })),

    // Optimistic tag operations
    assignTagToDocument: async (documentId: string, tagId: string) => {
      const state = get();
      const document = state.documents.items.find(d => d.id === documentId);
      const tag = state.tags.items.find(t => t.id === tagId);

      if (!document || !tag) return;

      // Check if tag is already assigned
      const isAlreadyAssigned = document.tags?.some(t => t.id === tagId);
      if (isAlreadyAssigned) return;

      // Optimistic update
      const updatedTags = [...(document.tags || []), tag];
      set((state: any) => ({
        documents: {
          ...state.documents,
          items: state.documents.items.map((doc: Document) =>
            doc.id === documentId ? { ...doc, tags: updatedTags } : doc
          ),
        },
      }));

      try {
        // TODO: Make API call - need to check function signature
        // await addTagsToDocument(projectId, documentId, [tagId], token);
        console.log(`Assigning tag ${tagId} to document ${documentId}`);
      } catch (error) {
        // Rollback on error
        set((state: any) => ({
          documents: {
            ...state.documents,
            items: state.documents.items.map((doc: Document) =>
              doc.id === documentId ? { ...doc, tags: document.tags } : doc
            ),
          },
        }));
        throw error;
      }
    },

    removeTagFromDocument: async (documentId: string, tagId: string) => {
      const state = get();
      const document = state.documents.items.find(d => d.id === documentId);

      if (!document) return;

      const originalTags = document.tags || [];
      const updatedTags = originalTags.filter(t => t.id !== tagId);

      // Optimistic update
      set((state: any) => ({
        documents: {
          ...state.documents,
          items: state.documents.items.map((doc: Document) =>
            doc.id === documentId ? { ...doc, tags: updatedTags } : doc
          ),
        },
      }));

      try {
        // Make API call - remove tag via Supabase
        await supabase
          .from('document_tags')
          .delete()
          .eq('document_id', documentId)
          .eq('tag_id', tagId);
      } catch (error) {
        // Rollback on error
        set((state: any) => ({
          documents: {
            ...state.documents,
            items: state.documents.items.map((doc: Document) =>
              doc.id === documentId ? { ...doc, tags: originalTags } : doc
            ),
          },
        }));
        throw error;
      }
    },

    // Document grouping operations
    moveDocumentToGroup: async (sourceDocId: string, targetDocId: string) => {
      const state = get();
      const sourceDoc = state.documents.items.find(d => d.id === sourceDocId);
      const targetDoc = state.documents.items.find(d => d.id === targetDocId);

      if (!sourceDoc || !targetDoc) return;

      // Determine new group structure
      let newGroupId: string;
      let updatedDocuments = [...state.documents.items];

      if (!targetDoc.group_id) {
        // Target is standalone - make it group head
        newGroupId = targetDoc.id;
        // Update target to be group head
        updatedDocuments = updatedDocuments.map(doc =>
          doc.id === targetDoc.id ? { ...doc, group_id: targetDoc.id } : doc
        );
      } else {
        // Target is already in a group
        newGroupId = targetDoc.group_id;
      }

      // If source is group head, move all members
      let docsToMove = [sourceDoc];
      if (sourceDoc.group_id === sourceDoc.id) {
        docsToMove = state.documents.items.filter(d => d.group_id === sourceDoc.id);
      }

      // Optimistic update
      updatedDocuments = updatedDocuments.map(doc => {
        if (docsToMove.some(d => d.id === doc.id)) {
          return { ...doc, group_id: newGroupId };
        }
        return doc;
      });

      set((state: any) => ({
        documents: { ...state.documents, items: updatedDocuments },
      }));

      try {
        // TODO: Make API call to update group assignments
        // This would require a backend endpoint to handle group moves
        console.log('Group move operation completed optimistically');
      } catch (error) {
        // Rollback on error
        set((state: any) => ({
          documents: { ...state.documents, items: state.documents.items },
        }));
        throw error;
      }
    },

    // Document deletion
    deleteDocument: async (documentId: string) => {
      const state = get();
      const document = state.documents.items.find(d => d.id === documentId);

      if (!document) return;

      const originalDocuments = state.documents.items;

      // Optimistic update - remove document
      set((state: any) => ({
        documents: {
          ...state.documents,
          items: state.documents.items.filter((doc: Document) => doc.id !== documentId),
        },
        // Also clear selection if this document was selected
        selections: {
          ...state.selections,
          selectedDocumentId: state.selections.selectedDocumentId === documentId
            ? null
            : state.selections.selectedDocumentId,
        },
      }));

      try {
        // TODO: Make API call to delete document
        // This would require a backend endpoint or direct Supabase call
        console.log('Document deletion completed optimistically');
      } catch (error) {
        // Rollback on error
        set((state: any) => ({
          documents: { ...state.documents, items: originalDocuments },
        }));
        throw error;
      }
    },
  };
}