import type { Tag } from '../../api';
import type { GlobalState, GlobalStateActions } from '../types';

type SetFunction = (partial: GlobalState | Partial<GlobalState> | ((state: GlobalState) => GlobalState | Partial<GlobalState>)) => void;
type GetFunction = () => GlobalState & GlobalStateActions;

export function createTagActions(set: SetFunction, get: GetFunction) {
  return {
    // Basic CRUD operations
    setTags: (tags: Tag[]) =>
      set((state: GlobalState) => ({
        tags: { ...state.tags, items: tags },
      })),

    addTag: (tag: Tag) =>
      set((state: GlobalState) => ({
        tags: {
          ...state.tags,
          items: [...state.tags.items, tag],
        },
      })),

    updateTag: (id: string, updates: Partial<Tag>) =>
      set((state: GlobalState) => ({
        tags: {
          ...state.tags,
          items: state.tags.items.map((tag: Tag) =>
            tag.id === id ? { ...tag, ...updates } : tag
          ),
        },
      })),

    removeTag: (id: string) =>
      set((state: GlobalState) => ({
        tags: {
          ...state.tags,
          items: state.tags.items.filter((tag: Tag) => tag.id !== id),
        },
      })),

    setTagsLoading: (loading: boolean) =>
      set((state: GlobalState) => ({
        tags: { ...state.tags, loading },
      })),

    setTagsError: (error: string | null) =>
      set((state: GlobalState) => ({
        tags: { ...state.tags, error },
      })),

    // Event tag assignment operations
    assignTagToEvent: async (eventId: string, tagId: string) => {
      const state = get();
      const event = state.events.items.find(e => e.id === eventId);
      const tag = state.tags.items.find(t => t.id === tagId);

      if (!event || !tag) return;

      // For events, we'll need to handle this through the backend
      // since the Event interface doesn't have a tags field yet
      // This is a placeholder for the API call

      try {
        console.log('🔄 Making API call to assign tag to event...');

        // Import supabase client
        const { supabase } = await import('../../supabaseClient');

        // Get auth token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('No authentication session');
        }

        // Insert tag-event relationship
        const { error } = await supabase
          .from('event_tags')
          .insert([{ event_id: eventId, tag_id: tagId }]);

        if (error) {
          throw new Error(`Tag to event assignment failed: ${error.message}`);
        }

        console.log('✅ Tag assigned to event in database');
      } catch (error) {
        throw error;
      }
    },

    removeTagFromEvent: async (eventId: string, tagId: string) => {
      const state = get();
      const event = state.events.items.find(e => e.id === eventId);

      if (!event) return;

      try {
        // Import supabase client
        const { supabase } = await import('../../supabaseClient');

        // Get auth token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('No authentication session');
        }

        // Remove tag-event relationship
        const { error } = await supabase
          .from('event_tags')
          .delete()
          .eq('event_id', eventId)
          .eq('tag_id', tagId);

        if (error) {
          throw new Error(`Tag removal from event failed: ${error.message}`);
        }
      } catch (error) {
        throw error;
      }
    },
  };
}