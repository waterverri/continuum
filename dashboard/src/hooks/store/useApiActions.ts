import { useGlobalStore } from '../../store';
import type { GlobalState, GlobalStateActions } from '../../store/types';

export function useApiActions() {
  const loadProjectData = useGlobalStore((state: GlobalState & GlobalStateActions) => state.loadProjectData);
  const createDocument = useGlobalStore((state: GlobalState & GlobalStateActions) => state.createDocumentApi);
  const updateDocument = useGlobalStore((state: GlobalState & GlobalStateActions) => state.updateDocumentApi);
  const deleteDocument = useGlobalStore((state: GlobalState & GlobalStateActions) => state.deleteDocumentApi);
  const createTag = useGlobalStore((state: GlobalState & GlobalStateActions) => state.createTag);
  const createPreset = useGlobalStore((state: GlobalState & GlobalStateActions) => state.createPreset);
  const updatePreset = useGlobalStore((state: GlobalState & GlobalStateActions) => state.updatePresetApi);
  const deletePreset = useGlobalStore((state: GlobalState & GlobalStateActions) => state.deletePresetApi);

  return { loadProjectData, createDocument, updateDocument, deleteDocument, createTag, createPreset, updatePreset, deletePreset };
}