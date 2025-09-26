import { useGlobalStore } from '../../store';

export function useEvents() {
  return useGlobalStore((state) => state.events);
}

export function useEventList() {
  return useGlobalStore((state) => state.events.items);
}

export function useEvent(eventId: string | null) {
  return useGlobalStore((state) =>
    eventId ? state.events.items.find(event => event.id === eventId) : null
  );
}

export function useSelectedEvent() {
  const selectedEventId = useGlobalStore((state) => state.selections.selectedEventId);
  return useGlobalStore((state) =>
    selectedEventId ? state.events.items.find(event => event.id === selectedEventId) : null
  );
}

export function useEventActions() {
  const setEvents = useGlobalStore((state) => state.setEvents);
  const addEvent = useGlobalStore((state) => state.addEvent);
  const updateEvent = useGlobalStore((state) => state.updateEvent);
  const removeEvent = useGlobalStore((state) => state.removeEvent);
  const setEventsLoading = useGlobalStore((state) => state.setEventsLoading);
  const setEventsError = useGlobalStore((state) => state.setEventsError);
  const assignEventToDocument = useGlobalStore((state) => state.assignEventToDocument);
  const removeEventFromDocument = useGlobalStore((state) => state.removeEventFromDocument);

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