import type { Tag } from '../../api';
import type { GlobalState, GlobalStateActions } from '../types';

type SetFunction = (partial: any) => void;
type GetFunction = () => GlobalState & GlobalStateActions;

export function createTagActions(set: SetFunction, get: GetFunction) {
  return {
    // Basic CRUD operations
    setTags: (tags: Tag[]) =>
      set((state: any) => ({
        tags: { ...state.tags, items: tags },
      })),

    addTag: (tag: Tag) =>
      set((state: any) => ({
        tags: {
          ...state.tags,
          items: [...state.tags.items, tag],
        },
      })),

    updateTag: (id: string, updates: Partial<Tag>) =>
      set((state: any) => ({
        tags: {
          ...state.tags,
          items: state.tags.items.map((tag: Tag) =>
            tag.id === id ? { ...tag, ...updates } : tag
          ),
        },
      })),

    removeTag: (id: string) =>
      set((state: any) => ({
        tags: {
          ...state.tags,
          items: state.tags.items.filter((tag: Tag) => tag.id !== id),
        },
      })),

    setTagsLoading: (loading: boolean) =>
      set((state: any) => ({
        tags: { ...state.tags, loading },
      })),

    setTagsError: (error: string | null) =>
      set((state: any) => ({
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
        // TODO: Make API call to assign tag to event
        // This might require updating the Event interface to include tags
        console.log(`Assigning tag ${tagId} to event ${eventId}`);
      } catch (error) {
        throw error;
      }
    },

    removeTagFromEvent: async (eventId: string, tagId: string) => {
      const state = get();
      const event = state.events.items.find(e => e.id === eventId);

      if (!event) return;

      try {
        // TODO: Make API call to remove tag from event
        console.log(`Removing tag ${tagId} from event ${eventId}`);
      } catch (error) {
        throw error;
      }
    },
  };
}