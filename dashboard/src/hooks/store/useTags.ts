import { useGlobalStore } from '../../store';

export function useTags() {
  return useGlobalStore((state) => state.tags);
}

export function useTagList() {
  return useGlobalStore((state) => state.tags.items);
}

export function useTag(tagId: string | null) {
  return useGlobalStore((state) =>
    tagId ? state.tags.items.find(tag => tag.id === tagId) : null
  );
}

export function useTagActions() {
  const setTags = useGlobalStore((state) => state.setTags);
  const addTag = useGlobalStore((state) => state.addTag);
  const updateTag = useGlobalStore((state) => state.updateTag);
  const removeTag = useGlobalStore((state) => state.removeTag);
  const setTagsLoading = useGlobalStore((state) => state.setTagsLoading);
  const setTagsError = useGlobalStore((state) => state.setTagsError);
  const assignTagToDocument = useGlobalStore((state) => state.assignTagToDocument);
  const removeTagFromDocument = useGlobalStore((state) => state.removeTagFromDocument);
  const assignTagToEvent = useGlobalStore((state) => state.assignTagToEvent);
  const removeTagFromEvent = useGlobalStore((state) => state.removeTagFromEvent);

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