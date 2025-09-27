import { useGlobalStore } from '../../store';
import type { GlobalState, GlobalStateActions } from '../../store/types';

export function useSelections() {
  return useGlobalStore((state: GlobalState & GlobalStateActions) => state.selections);
}

export function useSelectionActions() {
  const setSelectedDocument = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setSelectedDocument);
  const setSelectedEvent = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setSelectedEvent);
  const setSelectedPreset = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setSelectedPreset);

  return {
    setSelectedDocument,
    setSelectedEvent,
    setSelectedPreset,
  };
}