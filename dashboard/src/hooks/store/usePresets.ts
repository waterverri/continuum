import { useGlobalStore } from '../../store';
import type { GlobalState, GlobalStateActions } from '../../store/types';

export function usePresets() {
  return useGlobalStore((state: GlobalState & GlobalStateActions) => state.presets);
}

export function usePresetList() {
  return useGlobalStore((state: GlobalState & GlobalStateActions) => state.presets.items);
}

export function usePreset(presetId: string | null) {
  return useGlobalStore((state: GlobalState & GlobalStateActions) =>
    presetId ? state.presets.items.find(preset => preset.id === presetId) : null
  );
}

export function useSelectedPreset() {
  const selectedPresetId = useGlobalStore((state: GlobalState & GlobalStateActions) => state.selections.selectedPresetId);
  return useGlobalStore((state: GlobalState & GlobalStateActions) =>
    selectedPresetId ? state.presets.items.find(preset => preset.id === selectedPresetId) : null
  );
}

export function usePresetActions() {
  const setPresets = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setPresets);
  const addPreset = useGlobalStore((state: GlobalState & GlobalStateActions) => state.addPreset);
  const updatePreset = useGlobalStore((state: GlobalState & GlobalStateActions) => state.updatePreset);
  const removePreset = useGlobalStore((state: GlobalState & GlobalStateActions) => state.removePreset);
  const setPresetsLoading = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setPresetsLoading);
  const setPresetsError = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setPresetsError);

  return {
    setPresets,
    addPreset,
    updatePreset,
    removePreset,
    setPresetsLoading,
    setPresetsError,
  };
}