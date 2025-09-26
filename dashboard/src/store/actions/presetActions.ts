import type { Preset } from '../../api';
import type { GlobalState, GlobalStateActions } from '../types';

type SetFunction = (partial: any) => void;
type GetFunction = () => GlobalState & GlobalStateActions;

export function createPresetActions(set: SetFunction, _get: GetFunction) {
  return {
    // Basic CRUD operations
    setPresets: (presets: Preset[]) =>
      set((state: any) => ({
        presets: { ...state.presets, items: presets },
      })),

    addPreset: (preset: Preset) =>
      set((state: any) => ({
        presets: {
          ...state.presets,
          items: [...state.presets.items, preset],
        },
      })),

    updatePreset: (id: string, updates: Partial<Preset>) =>
      set((state: any) => ({
        presets: {
          ...state.presets,
          items: state.presets.items.map((preset: Preset) =>
            preset.id === id ? { ...preset, ...updates } : preset
          ),
        },
      })),

    removePreset: (id: string) =>
      set((state: any) => ({
        presets: {
          ...state.presets,
          items: state.presets.items.filter((preset: Preset) => preset.id !== id),
        },
      })),

    setPresetsLoading: (loading: boolean) =>
      set((state: any) => ({
        presets: { ...state.presets, loading },
      })),

    setPresetsError: (error: string | null) =>
      set((state: any) => ({
        presets: { ...state.presets, error },
      })),
  };
}