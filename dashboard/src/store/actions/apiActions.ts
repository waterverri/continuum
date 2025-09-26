import type { Document, Preset, Tag } from '../../api';
import type { GlobalState, GlobalStateActions, DocumentFormData } from '../types';
import {
  getDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  getPresets,
  createPreset,
  updatePreset,
  getTags,
  getDocumentTags,
} from '../../api';
import { supabase } from '../../supabaseClient';

type SetFunction = (partial: any) => void;
type GetFunction = () => GlobalState & GlobalStateActions;

export function createApiActions(set: SetFunction, get: GetFunction) {
  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  return {
    // Load all data for a project
    loadProjectData: async (projectId: string) => {
      if (!projectId) return;

      try {
        set(() => ({
          documents: { items: [], loading: true, error: null },
          presets: { items: [], loading: true, error: null },
          tags: { items: [], loading: true, error: null },
          events: { items: [], loading: true, error: null },
        }));

        const token = await getAccessToken();

        // Load documents with tags and event associations
        const docs = await getDocuments(projectId, token);
        const docsWithTagsAndEvents = await Promise.all(
          docs.map(async (doc) => {
            try {
              const [docTags, eventAssociations] = await Promise.all([
                getDocumentTags(projectId, doc.id, token),
                // Load event associations via Supabase
                (async () => {
                  const { data: eventDocs } = await supabase
                    .from('event_documents')
                    .select('event_id, document_id, created_at')
                    .eq('document_id', doc.id);
                  return eventDocs || [];
                })()
              ]);

              return { ...doc, tags: docTags, event_documents: eventAssociations };
            } catch (err) {
              console.error(`Failed to load data for document ${doc.id}:`, err);
              return { ...doc, tags: [], event_documents: [] };
            }
          })
        );

        // Load other data in parallel
        const [projectPresets, projectTags] = await Promise.all([
          getPresets(projectId, token),
          getTags(projectId, token),
        ]);

        // Load events from Supabase
        const { data: events } = await supabase
          .from('events')
          .select('*')
          .eq('project_id', projectId)
          .order('display_order');

        set(() => ({
          documents: {
            items: docsWithTagsAndEvents,
            loading: false,
            error: null,
          },
          presets: {
            items: projectPresets,
            loading: false,
            error: null,
          },
          tags: {
            items: projectTags,
            loading: false,
            error: null,
          },
          events: {
            items: events || [],
            loading: false,
            error: null,
          },
        }));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load project data';
        set((state: any) => ({
          documents: { ...state.documents, loading: false, error: errorMessage },
          presets: { ...state.presets, loading: false, error: errorMessage },
          tags: { ...state.tags, loading: false, error: errorMessage },
          events: { ...state.events, loading: false, error: errorMessage },
        }));
      }
    },

    // Document operations
    createDocumentApi: async (projectId: string, formData: DocumentFormData) => {
      if (!projectId) return;

      try {
        const token = await getAccessToken();
        const newDoc = await createDocument(projectId, formData, token);

        // Optimistic update
        set((state: any) => ({
          documents: {
            ...state.documents,
            items: [newDoc, ...state.documents.items],
          },
        }));

        return newDoc;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create document';
        set((state: any) => ({
          documents: { ...state.documents, error: errorMessage },
        }));
        throw err;
      }
    },

    updateDocumentApi: async (projectId: string, documentId: string, formData: DocumentFormData) => {
      if (!projectId) return;

      // const state = get();
      // const originalDoc = state.documents.items.find(doc => doc.id === documentId);

      try {
        const token = await getAccessToken();
        const updatedDoc = await updateDocument(projectId, documentId, formData, token);

        // Optimistic update
        set((state: any) => ({
          documents: {
            ...state.documents,
            items: state.documents.items.map((doc: Document) =>
              doc.id === documentId ? { ...doc, ...updatedDoc } : doc
            ),
          },
        }));

        return updatedDoc;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update document';
        set((state: any) => ({
          documents: { ...state.documents, error: errorMessage },
        }));
        throw err;
      }
    },

    deleteDocumentApi: async (projectId: string, documentId: string) => {
      if (!projectId) return;

      const state = get();
      const originalDocuments = state.documents.items;

      // Optimistic update
      set((state: any) => ({
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

      try {
        const token = await getAccessToken();
        await deleteDocument(projectId, documentId, token);
      } catch (err) {
        // Rollback on error
        set((state: any) => ({
          documents: { ...state.documents, items: originalDocuments },
        }));

        const errorMessage = err instanceof Error ? err.message : 'Failed to delete document';
        set((state: any) => ({
          documents: { ...state.documents, error: errorMessage },
        }));
        throw err;
      }
    },

    // Tag operations
    createTag: async (projectId: string, tagData: { name: string; color: string }) => {
      if (!projectId) return;

      try {
        // const token = await getAccessToken();
        // TODO: Implement createTag API call
        const newTag: Tag = {
          id: `temp-${Date.now()}`,
          project_id: projectId,
          name: tagData.name,
          color: tagData.color,
          created_at: new Date().toISOString(),
        };

        // Optimistic update
        set((state: any) => ({
          tags: {
            ...state.tags,
            items: [...state.tags.items, newTag],
          },
        }));

        return newTag;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create tag';
        set((state: any) => ({
          tags: { ...state.tags, error: errorMessage },
        }));
        throw err;
      }
    },

    // Preset operations
    createPreset: async (projectId: string, presetData: { name: string; document_id: string; component_overrides?: Record<string, string> }) => {
      if (!projectId) return;

      try {
        const token = await getAccessToken();
        const newPreset = await createPreset(projectId, presetData.name, presetData.document_id, token);

        // Optimistic update
        set((state: any) => ({
          presets: {
            ...state.presets,
            items: [...state.presets.items, newPreset],
          },
        }));

        return newPreset;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create preset';
        set((state: any) => ({
          presets: { ...state.presets, error: errorMessage },
        }));
        throw err;
      }
    },

    updatePresetApi: async (projectId: string, presetId: string, _presetData: Partial<Preset>) => {
      if (!projectId) return;

      try {
        const token = await getAccessToken();
        // TODO: Fix API signature - might need different parameters
        const updatedPreset = await updatePreset(projectId, presetId, token);

        // Optimistic update
        set((state: any) => ({
          presets: {
            ...state.presets,
            items: state.presets.items.map((preset: Preset) =>
              preset.id === presetId ? { ...preset, ...updatedPreset } : preset
            ),
          },
        }));

        return updatedPreset;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update preset';
        set((state: any) => ({
          presets: { ...state.presets, error: errorMessage },
        }));
        throw err;
      }
    },

    deletePresetApi: async (projectId: string, presetId: string) => {
      if (!projectId) return;

      const state = get();
      const originalPresets = state.presets.items;

      // Optimistic update
      set((state: any) => ({
        presets: {
          ...state.presets,
          items: state.presets.items.filter((preset: Preset) => preset.id !== presetId),
        },
      }));

      try {
        // const token = await getAccessToken();
        // TODO: Implement deletePreset API call
        console.log(`Deleting preset ${presetId} from project ${projectId}`);
      } catch (err) {
        // Rollback on error
        set((state: any) => ({
          presets: { ...state.presets, items: originalPresets },
        }));

        const errorMessage = err instanceof Error ? err.message : 'Failed to delete preset';
        set((state: any) => ({
          presets: { ...state.presets, error: errorMessage },
        }));
        throw err;
      }
    },
  };
}