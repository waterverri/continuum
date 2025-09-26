import { useGlobalStore } from '../../store';

export function useSelections() {
  return useGlobalStore((state) => state.selections);
}

export function useSelectionActions() {
  return useGlobalStore((state) => ({
    setSelectedDocument: state.setSelectedDocument,
    setSelectedEvent: state.setSelectedEvent,
    setSelectedPreset: state.setSelectedPreset,
  }));
}