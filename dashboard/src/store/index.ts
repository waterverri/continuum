import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { GlobalState, GlobalStateActions, DocumentFormData, ModalState } from './types';
import { createDocumentActions } from './actions/documentActions';
import { createTagActions } from './actions/tagActions';
import { createEventActions } from './actions/eventActions';
import { createPresetActions } from './actions/presetActions';
import { createApiActions } from './actions/apiActions';

const initialModalState: ModalState = {
  showDocumentPicker: false,
  showKeyInput: false,
  showPresetPicker: false,
  showPresetEdit: false,
  showPresetDashboard: false,
  showDerivativeModal: false,
  showComponentTypeSelector: false,
  showGroupPicker: false,
  showGroupAssignmentPicker: false,
  showGroupSwitcher: false,
  showTagManager: false,
  showTagSelector: false,
  showEventManager: false,
  showEventSelector: false,
  showEventTimeline: false,
  showDocumentEvolution: false,
  showDocumentDeletion: false,
  showAIChat: false,
  showTransform: false,
  showDocumentHistory: false,
};

const initialFormData: DocumentFormData = {
  title: '',
  alias: '',
  content: '',
  document_type: '',
  components: {},
  group_id: undefined,
  ai_model: undefined
};

export const useGlobalStore = create<GlobalState & GlobalStateActions>()(
  subscribeWithSelector((set, get) => {
    // Create action functions with access to set and get
    const documentActions = createDocumentActions(set, get);
    const tagActions = createTagActions(set, get);
    const eventActions = createEventActions(set, get);
    const presetActions = createPresetActions(set, get);
    const apiActions = createApiActions(set, get);

    return {
      // Initial State
      documents: {
        items: [],
        loading: false,
        error: null,
      },
      presets: {
        items: [],
        loading: false,
        error: null,
      },
      tags: {
        items: [],
        loading: false,
        error: null,
      },
      events: {
        items: [],
        loading: false,
        error: null,
      },
      selections: {
        selectedDocumentId: null,
        selectedEventId: null,
        selectedPresetId: null,
      },
      filters: {
        searchTerm: '',
        typeFilter: '',
        formatFilter: '',
        selectedTagIds: [],
        selectedEventIds: [],
        eventVersionFilter: 'all' as const,
        tagFilterConditions: [],
      },
      ui: {
        sidebarOpen: false,
        leftSidebarOpen: true,
        rightSidebarOpen: true,
        modals: initialModalState,
        isEditing: false,
        isCreating: false,
        resolvedContent: null,
        componentKeyToAdd: null,
        keyInputValue: '',
        sourceDocument: null,
        switcherComponentKey: null,
        switcherGroupId: null,
        tagSelectorDocumentId: null,
        eventSelectorDocument: null,
        evolutionDocument: null,
        editingPreset: null,
        documentToDelete: null,
      },
      form: {
        formData: initialFormData,
      },
      drag: {
        isDragging: false,
        dragType: null,
        dragItem: null,
        dropTarget: null,
      },

      // Actions
      ...documentActions,
      ...tagActions,
      ...eventActions,
      ...presetActions,
      ...apiActions,

      // Selection actions
      setSelectedDocument: (documentId) =>
        set((state) => ({
          selections: { ...state.selections, selectedDocumentId: documentId },
        })),
      setSelectedEvent: (eventId) =>
        set((state) => ({
          selections: { ...state.selections, selectedEventId: eventId },
        })),
      setSelectedPreset: (presetId) =>
        set((state) => ({
          selections: { ...state.selections, selectedPresetId: presetId },
        })),

      // Filter actions
      setSearchTerm: (searchTerm) =>
        set((state) => ({
          filters: { ...state.filters, searchTerm },
        })),
      setTypeFilter: (typeFilter) =>
        set((state) => ({
          filters: { ...state.filters, typeFilter },
        })),
      setFormatFilter: (formatFilter) =>
        set((state) => ({
          filters: { ...state.filters, formatFilter },
        })),
      setSelectedTagIds: (selectedTagIds) =>
        set((state) => ({
          filters: { ...state.filters, selectedTagIds },
        })),
      setSelectedEventIds: (selectedEventIds) =>
        set((state) => ({
          filters: { ...state.filters, selectedEventIds },
        })),
      setEventVersionFilter: (eventVersionFilter) =>
        set((state) => ({
          filters: { ...state.filters, eventVersionFilter },
        })),
      setTagFilterConditions: (tagFilterConditions) =>
        set((state) => ({
          filters: { ...state.filters, tagFilterConditions },
        })),
      resetFilters: () =>
        set(() => ({
          filters: {
            searchTerm: '',
            typeFilter: '',
            formatFilter: '',
            selectedTagIds: [],
            selectedEventIds: [],
            eventVersionFilter: 'all' as const,
            tagFilterConditions: [],
          },
        })),

      // UI actions
      setSidebarOpen: (sidebarOpen) =>
        set((state) => ({
          ui: { ...state.ui, sidebarOpen },
        })),
      setLeftSidebarOpen: (leftSidebarOpen) =>
        set((state) => ({
          ui: { ...state.ui, leftSidebarOpen },
        })),
      setRightSidebarOpen: (rightSidebarOpen) =>
        set((state) => ({
          ui: { ...state.ui, rightSidebarOpen },
        })),
      setIsEditing: (isEditing) =>
        set((state) => ({
          ui: { ...state.ui, isEditing },
        })),
      setIsCreating: (isCreating) =>
        set((state) => ({
          ui: { ...state.ui, isCreating },
        })),
      setResolvedContent: (resolvedContent) =>
        set((state) => ({
          ui: { ...state.ui, resolvedContent },
        })),

      // Modal actions
      openModal: (modalName) =>
        set((state) => ({
          ui: {
            ...state.ui,
            modals: { ...state.ui.modals, [modalName]: true },
          },
        })),
      closeModal: (modalName) =>
        set((state) => ({
          ui: {
            ...state.ui,
            modals: { ...state.ui.modals, [modalName]: false },
          },
        })),
      closeAllModals: () =>
        set((state) => ({
          ui: { ...state.ui, modals: initialModalState },
        })),

      // Modal-related state actions
      setComponentKeyToAdd: (componentKeyToAdd) =>
        set((state) => ({
          ui: { ...state.ui, componentKeyToAdd },
        })),
      setKeyInputValue: (keyInputValue) =>
        set((state) => ({
          ui: { ...state.ui, keyInputValue },
        })),
      setSourceDocument: (sourceDocument) =>
        set((state) => ({
          ui: { ...state.ui, sourceDocument },
        })),
      setSwitcherComponentKey: (switcherComponentKey) =>
        set((state) => ({
          ui: { ...state.ui, switcherComponentKey },
        })),
      setSwitcherGroupId: (switcherGroupId) =>
        set((state) => ({
          ui: { ...state.ui, switcherGroupId },
        })),
      setTagSelectorDocumentId: (tagSelectorDocumentId) =>
        set((state) => ({
          ui: { ...state.ui, tagSelectorDocumentId },
        })),
      setEventSelectorDocument: (eventSelectorDocument) =>
        set((state) => ({
          ui: { ...state.ui, eventSelectorDocument },
        })),
      setEvolutionDocument: (evolutionDocument) =>
        set((state) => ({
          ui: { ...state.ui, evolutionDocument },
        })),
      setEditingPreset: (editingPreset) =>
        set((state) => ({
          ui: { ...state.ui, editingPreset },
        })),
      setDocumentToDelete: (documentToDelete) =>
        set((state) => ({
          ui: { ...state.ui, documentToDelete },
        })),

      // Form actions
      setFormData: (formData) =>
        set(() => ({
          form: { formData },
        })),
      updateFormData: (updates) =>
        set((state) => ({
          form: {
            formData: { ...state.form.formData, ...updates },
          },
        })),
      resetForm: () =>
        set(() => ({
          form: { formData: initialFormData },
        })),

      // Document management actions
      startEdit: (document) => {
        set((state) => ({
          selections: { ...state.selections, selectedDocumentId: document.id },
          form: {
            formData: {
              title: document.title,
              alias: document.alias || '',
              content: document.content || '',
              document_type: document.document_type || '',
              components: document.components || {},
              group_id: document.group_id,
              ai_model: document.ai_model,
            },
          },
          ui: {
            ...state.ui,
            isEditing: true,
            resolvedContent: null,
          },
        }));
      },
      startCreate: () => {
        set((state) => ({
          selections: { ...state.selections, selectedDocumentId: null },
          form: { formData: initialFormData },
          ui: {
            ...state.ui,
            isCreating: true,
            resolvedContent: null,
          },
        }));
      },
      cancelEdit: () => {
        set((state) => ({
          form: { formData: initialFormData },
          ui: {
            ...state.ui,
            isEditing: false,
            isCreating: false,
            modals: initialModalState,
          },
        }));
      },

      // Drag actions
      startDrag: (type, item) =>
        set(() => ({
          drag: {
            isDragging: true,
            dragType: type,
            dragItem: { type, item },
            dropTarget: null,
          },
        })),
      endDrag: () =>
        set(() => ({
          drag: {
            isDragging: false,
            dragType: null,
            dragItem: null,
            dropTarget: null,
          },
        })),
      setDropTarget: (dropTarget) =>
        set((state) => ({
          drag: { ...state.drag, dropTarget },
        })),
    };
  })
);