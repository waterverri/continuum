import type { Event, Document } from '../../api';
import type { GlobalState, GlobalStateActions } from '../types';

type SetFunction = (partial: any) => void;
type GetFunction = () => GlobalState & GlobalStateActions;

export function createEventActions(set: SetFunction, get: GetFunction) {
  return {
    // Basic CRUD operations
    setEvents: (events: Event[]) =>
      set((state: any) => ({
        events: { ...state.events, items: events },
      })),

    addEvent: (event: Event) =>
      set((state: any) => ({
        events: {
          ...state.events,
          items: [...state.events.items, event],
        },
      })),

    updateEvent: (id: string, updates: Partial<Event>) =>
      set((state: any) => ({
        events: {
          ...state.events,
          items: state.events.items.map((event: Event) =>
            event.id === id ? { ...event, ...updates } : event
          ),
        },
      })),

    removeEvent: (id: string) =>
      set((state: any) => ({
        events: {
          ...state.events,
          items: state.events.items.filter((event: Event) => event.id !== id),
        },
      })),

    setEventsLoading: (loading: boolean) =>
      set((state: any) => ({
        events: { ...state.events, loading },
      })),

    setEventsError: (error: string | null) =>
      set((state: any) => ({
        events: { ...state.events, error },
      })),

    // Event-Document assignment operations
    assignEventToDocument: async (documentId: string, eventId: string) => {
      const state = get();
      const document = state.documents.items.find(d => d.id === documentId);
      const event = state.events.items.find(e => e.id === eventId);

      if (!document || !event) return;

      // Check if event is already assigned
      const isAlreadyAssigned = document.event_documents?.some(ed => ed.event_id === eventId);
      if (isAlreadyAssigned) return;

      // Optimistic update - add event-document relationship
      const newEventDocument = {
        event_id: eventId,
        document_id: documentId,
        created_at: new Date().toISOString(),
      };

      set((state: any) => ({
        documents: {
          ...state.documents,
          items: state.documents.items.map((doc: Document) =>
            doc.id === documentId
              ? {
                  ...doc,
                  event_documents: [...(doc.event_documents || []), newEventDocument],
                }
              : doc
          ),
        },
      }));

      try {
        // TODO: Make API call to create event-document relationship
        console.log(`Assigning event ${eventId} to document ${documentId}`);
      } catch (error) {
        // Rollback on error
        set((state: any) => ({
          documents: {
            ...state.documents,
            items: state.documents.items.map((doc: Document) =>
              doc.id === documentId
                ? { ...doc, event_documents: document.event_documents }
                : doc
            ),
          },
        }));
        throw error;
      }
    },

    removeEventFromDocument: async (documentId: string, eventId: string) => {
      const state = get();
      const document = state.documents.items.find(d => d.id === documentId);

      if (!document) return;

      const originalEventDocuments = document.event_documents || [];
      const updatedEventDocuments = originalEventDocuments.filter(ed => ed.event_id !== eventId);

      // Optimistic update
      set((state: any) => ({
        documents: {
          ...state.documents,
          items: state.documents.items.map((doc: Document) =>
            doc.id === documentId
              ? { ...doc, event_documents: updatedEventDocuments }
              : doc
          ),
        },
      }));

      try {
        // TODO: Make API call to remove event-document relationship
        console.log(`Removing event ${eventId} from document ${documentId}`);
      } catch (error) {
        // Rollback on error
        set((state: any) => ({
          documents: {
            ...state.documents,
            items: state.documents.items.map((doc: Document) =>
              doc.id === documentId
                ? { ...doc, event_documents: originalEventDocuments }
                : doc
            ),
          },
        }));
        throw error;
      }
    },
  };
}