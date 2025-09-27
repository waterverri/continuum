import type { Document } from '../../api';
import type { GlobalState, GlobalStateActions } from '../types';
// import { addTagsToDocument } from '../../api';
import { supabase } from '../../supabaseClient';

type SetFunction = (partial: GlobalState | Partial<GlobalState> | ((state: GlobalState) => GlobalState | Partial<GlobalState>)) => void;
type GetFunction = () => GlobalState & GlobalStateActions;

export function createDocumentActions(set: SetFunction, get: GetFunction) {
  return {
    // Basic CRUD operations
    setDocuments: (documents: Document[]) =>
      set((state: GlobalState) => ({
        documents: { ...state.documents, items: documents },
      })),

    addDocument: (document: Document) =>
      set((state: GlobalState) => ({
        documents: {
          ...state.documents,
          items: [...state.documents.items, document],
        },
      })),

    updateDocument: (id: string, updates: Partial<Document>) =>
      set((state: GlobalState) => ({
        documents: {
          ...state.documents,
          items: state.documents.items.map((doc: Document) =>
            doc.id === id ? { ...doc, ...updates } : doc
          ),
        },
      })),

    removeDocument: (id: string) =>
      set((state: GlobalState) => ({
        documents: {
          ...state.documents,
          items: state.documents.items.filter((doc: Document) => doc.id !== id),
        },
      })),

    setDocumentsLoading: (loading: boolean) =>
      set((state: GlobalState) => ({
        documents: { ...state.documents, loading },
      })),

    setDocumentsError: (error: string | null) =>
      set((state: GlobalState) => ({
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
      set((state: GlobalState) => ({
        documents: {
          ...state.documents,
          items: state.documents.items.map((doc: Document) =>
            doc.id === documentId ? { ...doc, tags: updatedTags } : doc
          ),
        },
      }));

      try {

        // Get auth token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('No authentication session');
        }

        // Insert tag-document relationship
        const { error } = await supabase
          .from('document_tags')
          .insert([{ document_id: documentId, tag_id: tagId }]);

        if (error) {
          throw new Error(`Tag assignment failed: ${error.message}`);
        }

      } catch (error) {
        // Rollback on error
        set((state: GlobalState) => ({
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
      set((state: GlobalState) => ({
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
        set((state: GlobalState) => ({
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

      set((state: GlobalState) => ({
        documents: { ...state.documents, items: updatedDocuments },
      }));

      try {
        // Get auth token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('No authentication session');
        }

        // Update group_id for all documents that need to be moved
        const docIdsToUpdate = docsToMove.map(d => d.id);
        const { error } = await supabase
          .from('documents')
          .update({ group_id: newGroupId })
          .in('id', docIdsToUpdate);

        if (error) {
          throw new Error(`Group assignment failed: ${error.message}`);
        }
      } catch (error) {
        // Rollback on error
        set((state: GlobalState) => ({
          documents: { ...state.documents, items: state.documents.items },
        }));
        throw error;
      }
    },

    // Document deletion
    deleteDocument: async (documentId: string) => {
      try {
        // Get auth token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('No authentication session');
        }

        // Delete from Supabase
        const { error } = await supabase
          .from('documents')
          .delete()
          .eq('id', documentId);

        if (error) {
          throw new Error(`Database deletion failed: ${error.message}`);
        }

        // Update Zustand store
        set((state: GlobalState) => ({
          documents: {
            ...state.documents,
            items: state.documents.items.filter((doc: Document) => doc.id !== documentId),
          },
          selections: {
            ...state.selections,
            selectedDocumentId: state.selections.selectedDocumentId === documentId
              ? null
              : state.selections.selectedDocumentId,
          },
        }));

        // UI now uses Zustand store, so no refresh needed
      } catch (error) {
        throw error;
      }
    },
  };
}