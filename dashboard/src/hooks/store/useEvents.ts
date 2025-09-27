import { useGlobalStore } from '../../store';
import type { GlobalState, GlobalStateActions } from '../../store/types';

export function useEvents() {
  return useGlobalStore((state: GlobalState & GlobalStateActions) => state.events);
}

export function useEventList() {
  return useGlobalStore((state: GlobalState & GlobalStateActions) => state.events.items);
}

export function useEvent(eventId: string | null) {
  return useGlobalStore((state: GlobalState & GlobalStateActions) =>
    eventId ? state.events.items.find(event => event.id === eventId) : null
  );
}

export function useSelectedEvent() {
  const selectedEventId = useGlobalStore((state: GlobalState & GlobalStateActions) => state.selections.selectedEventId);
  return useGlobalStore((state: GlobalState & GlobalStateActions) =>
    selectedEventId ? state.events.items.find(event => event.id === selectedEventId) : null
  );
}

export function useEventActions() {
  const setEvents = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setEvents);
  const addEvent = useGlobalStore((state: GlobalState & GlobalStateActions) => state.addEvent);
  const updateEvent = useGlobalStore((state: GlobalState & GlobalStateActions) => state.updateEvent);
  const removeEvent = useGlobalStore((state: GlobalState & GlobalStateActions) => state.removeEvent);
  const setEventsLoading = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setEventsLoading);
  const setEventsError = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setEventsError);
  const assignEventToDocument = useGlobalStore((state: GlobalState & GlobalStateActions) => state.assignEventToDocument);
  const removeEventFromDocument = useGlobalStore((state: GlobalState & GlobalStateActions) => state.removeEventFromDocument);

  return {
    setEvents,
    addEvent,
    updateEvent,
    removeEvent,
    setEventsLoading,
    setEventsError,
    assignEventToDocument,
    removeEventFromDocument,
  };
}