import { useGlobalStore } from '../../store';
import type { GlobalState, GlobalStateActions } from '../../store/types';

export function useTags() {
  return useGlobalStore((state: GlobalState & GlobalStateActions) => state.tags);
}

export function useTagList() {
  return useGlobalStore((state: GlobalState & GlobalStateActions) => state.tags.items);
}

export function useTag(tagId: string | null) {
  return useGlobalStore((state: GlobalState & GlobalStateActions) =>
    tagId ? state.tags.items.find(tag => tag.id === tagId) : null
  );
}

export function useTagActions() {
  const setTags = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setTags);
  const addTag = useGlobalStore((state: GlobalState & GlobalStateActions) => state.addTag);
  const updateTag = useGlobalStore((state: GlobalState & GlobalStateActions) => state.updateTag);
  const removeTag = useGlobalStore((state: GlobalState & GlobalStateActions) => state.removeTag);
  const setTagsLoading = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setTagsLoading);
  const setTagsError = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setTagsError);
  const assignTagToDocument = useGlobalStore((state: GlobalState & GlobalStateActions) => state.assignTagToDocument);
  const removeTagFromDocument = useGlobalStore((state: GlobalState & GlobalStateActions) => state.removeTagFromDocument);
  const assignTagToEvent = useGlobalStore((state: GlobalState & GlobalStateActions) => state.assignTagToEvent);
  const removeTagFromEvent = useGlobalStore((state: GlobalState & GlobalStateActions) => state.removeTagFromEvent);

  return {
    setTags,
    addTag,
    updateTag,
    removeTag,
    setTagsLoading,
    setTagsError,
    assignTagToDocument,
    removeTagFromDocument,
    assignTagToEvent,
    removeTagFromEvent,
  };
}