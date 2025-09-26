import { useGlobalStore } from '../../store';

export function usePresets() {
  return useGlobalStore((state) => state.presets);
}

export function usePresetList() {
  return useGlobalStore((state) => state.presets.items);
}

export function usePreset(presetId: string | null) {
  return useGlobalStore((state) =>
    presetId ? state.presets.items.find(preset => preset.id === presetId) : null
  );
}

export function useSelectedPreset() {
  const selectedPresetId = useGlobalStore((state) => state.selections.selectedPresetId);
  return useGlobalStore((state) =>
    selectedPresetId ? state.presets.items.find(preset => preset.id === selectedPresetId) : null
  );
}

export function usePresetActions() {
  return useGlobalStore((state) => ({
    setPresets: state.setPresets,
    addPreset: state.addPreset,
    updatePreset: state.updatePreset,
    removePreset: state.removePreset,
    setPresetsLoading: state.setPresetsLoading,
    setPresetsError: state.setPresetsError,
  }));
}