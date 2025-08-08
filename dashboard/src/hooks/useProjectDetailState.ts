import { useState, useCallback } from 'react';
import type { Document, Preset, Tag, Event } from '../api';

interface DocumentFormData {
  title: string;
  content: string;
  document_type: string;
  is_composite: boolean;
  components: Record<string, string>;
  group_id?: string;
}

export function useProjectDetailState() {
  // Core data states
  const [documents, setDocuments] = useState<Document[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  
  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Document management states
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [resolvedContent, setResolvedContent] = useState<string | null>(null);
  
  // UI states
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Form states
  const [formData, setFormData] = useState<DocumentFormData>({
    title: '',
    content: '',
    document_type: '',
    is_composite: false,
    components: {},
    group_id: undefined
  });

  // Modal states
  const [modals, setModals] = useState({
    showDocumentPicker: false,
    showKeyInput: false,
    showPresetPicker: false,
    showDerivativeModal: false,
    showComponentTypeSelector: false,
    showGroupPicker: false,
    showGroupSwitcher: false,
    showTagManager: false,
    showTagSelector: false,
    showEventManager: false,
    showEventSelector: false,
    showEventTimeline: false,
    showDocumentEvolution: false,
  });

  // Modal-related states
  const [componentKeyToAdd, setComponentKeyToAdd] = useState<string | null>(null);
  const [keyInputValue, setKeyInputValue] = useState('');
  const [sourceDocument, setSourceDocument] = useState<Document | null>(null);
  const [switcherComponentKey, setSwitcherComponentKey] = useState<string | null>(null);
  const [switcherGroupId, setSwitcherGroupId] = useState<string | null>(null);
  const [tagSelectorDocumentId, setTagSelectorDocumentId] = useState<string | null>(null);
  const [eventSelectorDocument, setEventSelectorDocument] = useState<Document | null>(null);
  const [evolutionDocument, setEvolutionDocument] = useState<Document | null>(null);

  // Reset form function
  const resetForm = useCallback(() => {
    setFormData({
      title: '',
      content: '',
      document_type: '',
      is_composite: false,
      components: {},
      group_id: undefined
    });
  }, []);

  // Modal management functions
  const openModal = useCallback((modalName: keyof typeof modals) => {
    setModals(prev => ({ ...prev, [modalName]: true }));
  }, []);

  const closeModal = useCallback((modalName: keyof typeof modals) => {
    setModals(prev => ({ ...prev, [modalName]: false }));
  }, []);

  const closeAllModals = useCallback(() => {
    setModals({
      showDocumentPicker: false,
      showKeyInput: false,
      showPresetPicker: false,
      showDerivativeModal: false,
      showComponentTypeSelector: false,
      showGroupPicker: false,
      showGroupSwitcher: false,
      showTagManager: false,
      showTagSelector: false,
      showEventManager: false,
      showEventSelector: false,
      showEventTimeline: false,
      showDocumentEvolution: false,
    });
  }, []);

  // Document management functions
  const startEdit = useCallback((doc: Document) => {
    setSelectedDocument(doc);
    setFormData({
      title: doc.title,
      content: doc.content || '',
      document_type: doc.document_type || '',
      is_composite: doc.is_composite,
      components: doc.components || {},
      group_id: doc.group_id
    });
    setIsEditing(true);
    setResolvedContent(null);
  }, []);

  const startCreate = useCallback(() => {
    resetForm();
    setIsCreating(true);
    setSelectedDocument(null);
    setResolvedContent(null);
  }, [resetForm]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setIsCreating(false);
    resetForm();
    closeAllModals();
  }, [resetForm, closeAllModals]);

  return {
    // State
    documents,
    setDocuments,
    presets,
    setPresets,
    tags,
    setTags,
    events,
    setEvents,
    loading,
    setLoading,
    error,
    setError,
    selectedDocument,
    setSelectedDocument,
    isEditing,
    setIsEditing,
    isCreating,
    setIsCreating,
    resolvedContent,
    setResolvedContent,
    sidebarOpen,
    setSidebarOpen,
    formData,
    setFormData,
    
    // Modal states
    modals,
    componentKeyToAdd,
    setComponentKeyToAdd,
    keyInputValue,
    setKeyInputValue,
    sourceDocument,
    setSourceDocument,
    switcherComponentKey,
    setSwitcherComponentKey,
    switcherGroupId,
    setSwitcherGroupId,
    tagSelectorDocumentId,
    setTagSelectorDocumentId,
    eventSelectorDocument,
    setEventSelectorDocument,
    evolutionDocument,
    setEvolutionDocument,

    // Actions
    resetForm,
    openModal,
    closeModal,
    closeAllModals,
    startEdit,
    startCreate,
    cancelEdit,
  };
}

export type { DocumentFormData };