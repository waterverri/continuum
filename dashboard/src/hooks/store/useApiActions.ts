import { useGlobalStore } from '../../store';

export function useApiActions() {
  const loadProjectData = useGlobalStore((state) => state.loadProjectData);
  const createDocument = useGlobalStore((state) => state.createDocumentApi);
  const updateDocument = useGlobalStore((state) => state.updateDocumentApi);
  const deleteDocument = useGlobalStore((state) => state.deleteDocumentApi);
  const createTag = useGlobalStore((state) => state.createTag);
  const createPreset = useGlobalStore((state) => state.createPreset);
  const updatePreset = useGlobalStore((state) => state.updatePresetApi);
  const deletePreset = useGlobalStore((state) => state.deletePresetApi);

  return { loadProjectData, createDocument, updateDocument, deleteDocument, createTag, createPreset, updatePreset, deletePreset };
}