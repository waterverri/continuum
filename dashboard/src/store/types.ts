import type { Document, Preset, Tag, Event } from '../api';
import type { TagFilterCondition } from '../components/TagFilterWidget';

export interface DocumentFormData {
  title: string;
  alias: string;
  content: string;
  document_type: string;
  components: Record<string, string>;
  group_id?: string;
  ai_model?: string;
}

export interface ModalState {
  showDocumentPicker: boolean;
  showKeyInput: boolean;
  showPresetPicker: boolean;
  showPresetEdit: boolean;
  showPresetDashboard: boolean;
  showDerivativeModal: boolean;
  showComponentTypeSelector: boolean;
  showGroupPicker: boolean;
  showGroupAssignmentPicker: boolean;
  showGroupSwitcher: boolean;
  showTagManager: boolean;
  showTagSelector: boolean;
  showEventManager: boolean;
  showEventSelector: boolean;
  showEventTimeline: boolean;
  showDocumentEvolution: boolean;
  showDocumentDeletion: boolean;
  showAIChat: boolean;
  showTransform: boolean;
  showDocumentHistory: boolean;
}

export interface SelectionState {
  selectedDocumentId: string | null;
  selectedEventId: string | null;
  selectedPresetId: string | null;
}

export interface FilterState {
  searchTerm: string;
  typeFilter: string;
  formatFilter: string;
  selectedTagIds: string[];
  selectedEventIds: string[];
  eventVersionFilter: 'all' | 'base' | 'versions';
  tagFilterConditions: TagFilterCondition[];
}

export interface UIState {
  sidebarOpen: boolean;
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  modals: ModalState;
  isEditing: boolean;
  isCreating: boolean;
  resolvedContent: string | null;
  // Modal-related states
  componentKeyToAdd: string | null;
  keyInputValue: string;
  sourceDocument: Document | null;
  switcherComponentKey: string | null;
  switcherGroupId: string | null;
  tagSelectorDocumentId: string | null;
  eventSelectorDocument: Document | null;
  evolutionDocument: Document | null;
  editingPreset: Preset | null;
  documentToDelete: Document | null;
}

export interface DataState {
  documents: {
    items: Document[];
    loading: boolean;
    error: string | null;
  };
  presets: {
    items: Preset[];
    loading: boolean;
    error: string | null;
  };
  tags: {
    items: Tag[];
    loading: boolean;
    error: string | null;
  };
  events: {
    items: Event[];
    loading: boolean;
    error: string | null;
  };
}

export interface FormState {
  formData: DocumentFormData;
}

export interface DragState {
  isDragging: boolean;
  dragType: 'tag' | 'event' | 'document' | null;
  dragItem: any;
  dropTarget: any;
}

export interface GlobalState extends DataState {
  selections: SelectionState;
  filters: FilterState;
  ui: UIState;
  form: FormState;
  drag: DragState;
}

export type GlobalStateActions = {
  // Data actions
  setDocuments: (documents: Document[]) => void;
  addDocument: (document: Document) => void;
  updateDocument: (id: string, updates: Partial<Document>) => void;
  removeDocument: (id: string) => void;
  setDocumentsLoading: (loading: boolean) => void;
  setDocumentsError: (error: string | null) => void;

  setPresets: (presets: Preset[]) => void;
  addPreset: (preset: Preset) => void;
  updatePreset: (id: string, updates: Partial<Preset>) => void;
  removePreset: (id: string) => void;
  setPresetsLoading: (loading: boolean) => void;
  setPresetsError: (error: string | null) => void;

  setTags: (tags: Tag[]) => void;
  addTag: (tag: Tag) => void;
  updateTag: (id: string, updates: Partial<Tag>) => void;
  removeTag: (id: string) => void;
  setTagsLoading: (loading: boolean) => void;
  setTagsError: (error: string | null) => void;

  setEvents: (events: Event[]) => void;
  addEvent: (event: Event) => void;
  updateEvent: (id: string, updates: Partial<Event>) => void;
  removeEvent: (id: string) => void;
  setEventsLoading: (loading: boolean) => void;
  setEventsError: (error: string | null) => void;

  // Selection actions
  setSelectedDocument: (documentId: string | null) => void;
  setSelectedEvent: (eventId: string | null) => void;
  setSelectedPreset: (presetId: string | null) => void;

  // Filter actions
  setSearchTerm: (searchTerm: string) => void;
  setTypeFilter: (typeFilter: string) => void;
  setFormatFilter: (formatFilter: string) => void;
  setSelectedTagIds: (tagIds: string[]) => void;
  setSelectedEventIds: (eventIds: string[]) => void;
  setEventVersionFilter: (filter: 'all' | 'base' | 'versions') => void;
  setTagFilterConditions: (conditions: TagFilterCondition[]) => void;
  resetFilters: () => void;

  // UI actions
  setSidebarOpen: (open: boolean) => void;
  setLeftSidebarOpen: (open: boolean) => void;
  setRightSidebarOpen: (open: boolean) => void;
  setIsEditing: (editing: boolean) => void;
  setIsCreating: (creating: boolean) => void;
  setResolvedContent: (content: string | null) => void;

  // Modal actions
  openModal: (modalName: keyof ModalState) => void;
  closeModal: (modalName: keyof ModalState) => void;
  closeAllModals: () => void;

  // Modal-related state actions
  setComponentKeyToAdd: (key: string | null) => void;
  setKeyInputValue: (value: string) => void;
  setSourceDocument: (document: Document | null) => void;
  setSwitcherComponentKey: (key: string | null) => void;
  setSwitcherGroupId: (groupId: string | null) => void;
  setTagSelectorDocumentId: (documentId: string | null) => void;
  setEventSelectorDocument: (document: Document | null) => void;
  setEvolutionDocument: (document: Document | null) => void;
  setEditingPreset: (preset: Preset | null) => void;
  setDocumentToDelete: (document: Document | null) => void;

  // Form actions
  setFormData: (formData: DocumentFormData) => void;
  updateFormData: (updates: Partial<DocumentFormData>) => void;
  resetForm: () => void;

  // Document management actions
  startEdit: (document: Document) => void;
  startCreate: () => void;
  cancelEdit: () => void;

  // Drag actions
  startDrag: (type: 'tag' | 'event' | 'document', item: any) => void;
  endDrag: () => void;
  setDropTarget: (target: any) => void;

  // Optimistic update actions
  assignTagToDocument: (documentId: string, tagId: string) => Promise<void>;
  removeTagFromDocument: (documentId: string, tagId: string) => Promise<void>;
  assignTagToEvent: (eventId: string, tagId: string) => Promise<void>;
  removeTagFromEvent: (eventId: string, tagId: string) => Promise<void>;
  assignEventToDocument: (documentId: string, eventId: string) => Promise<void>;
  removeEventFromDocument: (documentId: string, eventId: string) => Promise<void>;
  moveDocumentToGroup: (sourceDocId: string, targetDocId: string) => Promise<void>;
  deleteDocument: (documentId: string) => Promise<void>;

  // API actions
  loadProjectData: (projectId: string) => Promise<void>;
  createDocumentApi: (projectId: string, formData: DocumentFormData) => Promise<Document | undefined>;
  updateDocumentApi: (projectId: string, documentId: string, formData: DocumentFormData) => Promise<Document | undefined>;
  createTag: (projectId: string, tagData: { name: string; color: string }) => Promise<Tag | undefined>;
  createPreset: (projectId: string, presetData: { name: string; document_id: string; component_overrides?: Record<string, string> }) => Promise<Preset | undefined>;
  updatePresetApi: (projectId: string, presetId: string, presetData: Partial<Preset>) => Promise<Preset | undefined>;
  deletePresetApi: (projectId: string, presetId: string) => Promise<void>;
  deleteDocumentApi: (projectId: string, documentId: string) => Promise<void>;
};