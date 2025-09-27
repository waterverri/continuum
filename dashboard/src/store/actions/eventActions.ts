import type { Event, Document } from '../../api';
import type { GlobalState, GlobalStateActions } from '../types';

type SetFunction = (partial: GlobalState | Partial<GlobalState> | ((state: GlobalState) => GlobalState | Partial<GlobalState>)) => void;
type GetFunction = () => GlobalState & GlobalStateActions;

export function createEventActions(set: SetFunction, get: GetFunction) {
  return {
    // Basic CRUD operations
    setEvents: (events: Event[]) =>
      set((state: GlobalState) => ({
        events: { ...state.events, items: events },
      })),

    addEvent: (event: Event) =>
      set((state: GlobalState) => ({
        events: {
          ...state.events,
          items: [...state.events.items, event],
        },
      })),

    updateEvent: (id: string, updates: Partial<Event>) =>
      set((state: GlobalState) => ({
        events: {
          ...state.events,
          items: state.events.items.map((event: Event) =>
            event.id === id ? { ...event, ...updates } : event
          ),
        },
      })),

    removeEvent: (id: string) =>
      set((state: GlobalState) => ({
        events: {
          ...state.events,
          items: state.events.items.filter((event: Event) => event.id !== id),
        },
      })),

    setEventsLoading: (loading: boolean) =>
      set((state: GlobalState) => ({
        events: { ...state.events, loading },
      })),

    setEventsError: (error: string | null) =>
      set((state: GlobalState) => ({
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

      set((state: GlobalState) => ({
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
        console.log('🔄 Making API call to assign event to document...');

        // Import supabase client
        const { supabase } = await import('../../supabaseClient');

        // Get auth token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('No authentication session');
        }

        // Insert event-document relationship
        const { error } = await supabase
          .from('event_documents')
          .insert([{ event_id: eventId, document_id: documentId }]);

        if (error) {
          throw new Error(`Event to document assignment failed: ${error.message}`);
        }

        console.log('✅ Event assigned to document in database');
      } catch (error) {
        // Rollback on error
        set((state: GlobalState) => ({
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
      set((state: GlobalState) => ({
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
        // Import supabase client
        const { supabase } = await import('../../supabaseClient');

        // Get auth token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('No authentication session');
        }

        // Remove event-document relationship
        const { error } = await supabase
          .from('event_documents')
          .delete()
          .eq('event_id', eventId)
          .eq('document_id', documentId);

        if (error) {
          throw new Error(`Event removal failed: ${error.message}`);
        }
      } catch (error) {
        // Rollback on error
        set((state: GlobalState) => ({
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