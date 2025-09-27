import { useGlobalStore } from '../../store';
import type { GlobalState, GlobalStateActions } from '../../store/types';

export function useFilters() {
  return useGlobalStore((state: GlobalState & GlobalStateActions) => state.filters);
}

export function useFilterActions() {
  const setSearchTerm = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setSearchTerm);
  const setTypeFilter = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setTypeFilter);
  const setFormatFilter = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setFormatFilter);
  const setSelectedTagIds = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setSelectedTagIds);
  const setSelectedEventIds = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setSelectedEventIds);
  const setEventVersionFilter = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setEventVersionFilter);
  const setTagFilterConditions = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setTagFilterConditions);
  const resetFilters = useGlobalStore((state: GlobalState & GlobalStateActions) => state.resetFilters);

  return {
    setSearchTerm,
    setTypeFilter,
    setFormatFilter,
    setSelectedTagIds,
    setSelectedEventIds,
    setEventVersionFilter,
    setTagFilterConditions,
    resetFilters,
  };
}

export function useHasActiveFilters() {
  return useGlobalStore((state: GlobalState & GlobalStateActions) => {
    const { filters } = state;
    return !!(
      filters.searchTerm ||
      filters.typeFilter ||
      filters.formatFilter ||
      filters.selectedTagIds.length > 0 ||
      filters.selectedEventIds.length > 0 ||
      filters.eventVersionFilter !== 'all' ||
      filters.tagFilterConditions.length > 0
    );
  });
}