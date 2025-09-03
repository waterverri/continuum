import { EventDetailsModal } from './EventDetailsModal';
import { EventCreateModal } from './EventCreateModal';
import { BaseDateModal } from './BaseDateModal';
import type { Event, Document, EventDocument } from '../api';
import type { EventFormData, CreateEventPosition } from '../types/timeline';

export interface TimelineModalsProps {
  // Event Details Modal
  showEventDetails: boolean;
  selectedEvent: Event | null;
  editingEvent: Event | null;
  eventDocuments: (EventDocument & {documents: Document})[];
  
  // Event Create Modal
  isCreatingEvent: boolean;
  createEventPosition: CreateEventPosition;
  
  // Base Date Modal
  showBaseDateModal: boolean;
  baseDate: Date;
  
  // Form data
  formData: EventFormData;
  events: Event[];
  loading: boolean;
  
  // Utility functions
  formatDateDisplay: (timeValue?: number) => string;
  timeToDate: (timeValue: number) => Date;
  
  // Event handlers
  onEventDetailsClose: () => void;
  onStartEditEvent: (event: Event) => void;
  onFormDataChange: (data: EventFormData | ((prev: EventFormData) => EventFormData)) => void;
  onSaveEditEvent: (eventId: string, formData: EventFormData) => Promise<void>;
  onCancelEditEvent: () => void;
  
  onCreateEventSubmit: (formData: EventFormData) => Promise<void>;
  onCancelCreateEvent: () => void;
  
  onBaseDateModalClose: () => void;
  onBaseDateChange: (date: Date) => void;
  onBaseDateSave: (date: Date) => Promise<void>;
  
  // Document handlers (optional)
  onDocumentView?: (document: Document) => void;
  onDocumentEdit?: (document: Document) => void;
  onDocumentDelete?: (documentId: string) => void;
  onCloseAllModals?: () => void;
}

export function TimelineModals({
  // Event Details Modal
  showEventDetails,
  selectedEvent,
  editingEvent,
  eventDocuments,
  
  // Event Create Modal
  isCreatingEvent,
  createEventPosition,
  
  // Base Date Modal
  showBaseDateModal,
  baseDate,
  
  // Form data
  formData,
  events,
  loading,
  
  // Utility functions
  formatDateDisplay,
  timeToDate,
  
  // Event handlers
  onEventDetailsClose,
  onStartEditEvent,
  onFormDataChange,
  onSaveEditEvent,
  onCancelEditEvent,
  
  onCreateEventSubmit,
  onCancelCreateEvent,
  
  onBaseDateModalClose,
  onBaseDateChange,
  onBaseDateSave,
  
  // Document handlers
  onDocumentView,
  onDocumentEdit,
  onDocumentDelete,
  onCloseAllModals
}: TimelineModalsProps) {
  
  return (
    <>
      {/* Event Details Modal */}
      <EventDetailsModal
        isOpen={showEventDetails}
        selectedEvent={selectedEvent}
        editingEvent={editingEvent}
        eventDocuments={eventDocuments}
        formData={formData}
        events={events}
        loading={loading}
        formatDateDisplay={formatDateDisplay}
        onClose={onEventDetailsClose}
        onStartEdit={onStartEditEvent}
        onFormDataChange={onFormDataChange}
        onSaveEdit={onSaveEditEvent}
        onCancelEdit={onCancelEditEvent}
        onDocumentView={onDocumentView}
        onDocumentEdit={onDocumentEdit}
        onDocumentDelete={onDocumentDelete}
        onCloseAllModals={onCloseAllModals}
      />

      {/* Create Event Modal */}
      <EventCreateModal
        isOpen={isCreatingEvent}
        events={events}
        formData={formData}
        createEventPosition={createEventPosition}
        loading={loading}
        formatDateDisplay={formatDateDisplay}
        onFormDataChange={onFormDataChange}
        onSubmit={onCreateEventSubmit}
        onCancel={onCancelCreateEvent}
      />
      
      {/* Base Date Modal */}
      <BaseDateModal
        isOpen={showBaseDateModal}
        baseDate={baseDate}
        onBaseDateChange={onBaseDateChange}
        onSave={onBaseDateSave}
        onClose={onBaseDateModalClose}
        timeToDate={timeToDate}
      />
    </>
  );
}