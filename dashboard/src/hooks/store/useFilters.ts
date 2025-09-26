import { useGlobalStore } from '../../store';

export function useFilters() {
  return useGlobalStore((state) => state.filters);
}

export function useFilterActions() {
  const setSearchTerm = useGlobalStore((state) => state.setSearchTerm);
  const setTypeFilter = useGlobalStore((state) => state.setTypeFilter);
  const setFormatFilter = useGlobalStore((state) => state.setFormatFilter);
  const setSelectedTagIds = useGlobalStore((state) => state.setSelectedTagIds);
  const setSelectedEventIds = useGlobalStore((state) => state.setSelectedEventIds);
  const setEventVersionFilter = useGlobalStore((state) => state.setEventVersionFilter);
  const setTagFilterConditions = useGlobalStore((state) => state.setTagFilterConditions);
  const resetFilters = useGlobalStore((state) => state.resetFilters);

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
  return useGlobalStore((state) => {
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