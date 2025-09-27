import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Document, AIProvider, Tag } from '../api';
import { getAIProviders, getUserCredits } from '../api';
import { useProjectActions } from '../App';
// Removed useProjectDetailState - migrated to Zustand
import { useDocumentOperations } from '../hooks/useDocumentOperations';
import { useDocumentFilter } from '../hooks/useDocumentFilter';
// New global state imports - MIGRATION TO ZUSTAND
import { useDocuments, useDocumentActions, useSelectedDocument } from '../hooks/store/useDocuments';
import { useTags, useTagActions } from '../hooks/store/useTags';
import { useEvents, useEventActions } from '../hooks/store/useEvents';
import { usePresets, usePresetActions } from '../hooks/store/usePresets';
import {
  useUI,
  useModals,
  useModalActions,
  useDocumentManagement,
  useForm,
  useFormActions,
  useSidebarActions,
  useEditingState
} from '../hooks/store/useUI';
import { useGlobalStore } from '../store';
import { DragDropProvider } from '../components/dnd/DragDropProvider';
import { RecycleBin } from '../components/dnd/RecycleBin';
import { DraggableItem } from '../components/dnd/DraggableItem';
import { EnhancedDocumentForm } from '../components/EnhancedDocumentForm';
import { DocumentViewer } from '../components/DocumentViewer';
import { DocumentGroupList } from '../components/DocumentGroupList';
import { ProjectTagsFilter } from '../components/ProjectTagsFilter';
import { DocumentFilters } from '../components/DocumentFilters';
import { DocumentPickerModal } from '../components/DocumentPickerModal';
import { ComponentKeyInputModal } from '../components/ComponentKeyInputModal';
import { DerivativeModal } from '../components/DerivativeModal';
import { ComponentTypeSelectorModal } from '../components/ComponentTypeSelectorModal';
import { GroupPickerModal } from '../components/GroupPickerModal';
import { PresetPickerModal } from '../components/PresetPickerModal';
import { PresetEditModal } from '../components/PresetEditModal';
import { PresetDashboardModal } from '../components/PresetDashboardModal';
import { GroupSwitcherModal } from '../components/GroupSwitcherModal';
import { TagManager } from '../components/TagManager';
import { TagSelector } from '../components/TagSelector';
import { TagFilterWidget } from '../components/TagFilterWidget';
import { EventAssignmentModal } from '../components/EventAssignmentModal';
import { EventsWidget } from '../components/EventsWidget';
import { EventTimelineModal } from '../components/EventTimelineModal';
import { EventFilter } from '../components/EventFilter';
import { DocumentEvolution } from '../components/DocumentEvolution';
import { ProjectSettingsModal } from '../components/ProjectSettingsModal';
import { DocumentGroupDeletionModal } from '../components/DocumentGroupDeletionModal';
import { BatchImportModal } from '../components/BatchImportModal';
import { ensureBidirectionalGroupAssignment } from '../utils/groupAssignment';
import '../styles/ProjectDetailPage.css';
import '../styles/components/drag-and-drop.css';


export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [aiProviders, setAiProviders] = useState<AIProvider[]>([]);
  const [accessToken, setAccessToken] = useState<string>('');
  const [userCredits, setUserCredits] = useState<number>(0);
  const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
  
  // Get project actions context
  const { setProjectActions, setCurrentProject: setAppCurrentProject } = useProjectActions();
  
  // Zustand state hooks - replacing old useState system
  const documents = useDocuments();
  const documentActions = useDocumentActions();
  const tags = useTags();
  const tagActions = useTagActions();
  const events = useEvents();
  const eventActions = useEventActions();
  const presets = usePresets();
  const presetActions = usePresetActions();
  const ui = useUI();
  const modals = useModals();
  const modalActions = useModalActions();
  const documentManagement = useDocumentManagement();
  const editingState = useEditingState();
  const formData = useForm();
  const formActions = useFormActions();
  const sidebarActions = useSidebarActions();
  const selectedDocument = useSelectedDocument();

  // UI action methods we need directly from store
  // const setError = useGlobalStore(...); // Error handling TBD - unused for now
  const setSelectedDocumentAction = useGlobalStore(state => state.setSelectedDocument);
  const setResolvedContent = useGlobalStore(state => state.setResolvedContent);
  const setDocumentToDelete = useGlobalStore(state => state.setDocumentToDelete);
  const setIsEditing = useGlobalStore(state => state.setIsEditing);
  const setIsCreating = useGlobalStore(state => state.setIsCreating);
  const setSourceDocument = useGlobalStore(state => state.setSourceDocument);
  const setKeyInputValue = useGlobalStore(state => state.setKeyInputValue);
  const setComponentKeyToAdd = useGlobalStore(state => state.setComponentKeyToAdd);
  const setSwitcherComponentKey = useGlobalStore(state => state.setSwitcherComponentKey);
  const setSwitcherGroupId = useGlobalStore(state => state.setSwitcherGroupId);
  const setTagSelectorDocumentId = useGlobalStore(state => state.setTagSelectorDocumentId);
  const setEventSelectorDocument = useGlobalStore(state => state.setEventSelectorDocument);
  const setEvolutionDocument = useGlobalStore(state => state.setEvolutionDocument);
  const setEditingPreset = useGlobalStore(state => state.setEditingPreset);
  const startEdit = useGlobalStore(state => state.startEdit);
  const startCreate = useGlobalStore(state => state.startCreate);
  const resetForm = useGlobalStore(state => state.resetForm);

  const operations = useDocumentOperations({
    projectId,
    documents: documents.items,
    setDocuments: documentActions.setDocuments,
    presets: presets.items,
    setPresets: presetActions.setPresets,
    setTags: tagActions.setTags,
    setError: () => {}, // Will use proper error handling
    setLoading: documentActions.setDocumentsLoading,
    setSelectedDocument: () => {}, // Will use proper hook
    setResolvedContent: () => {}, // Will use proper hook
    setDocumentToDelete: () => {}, // Will use proper hook
    openModal: modalActions.openModal,
  });
  
  // Events now come from Zustand

  // Use document filter hook for sidebar
  const sidebarFilter = useDocumentFilter(documents.items, events.items);

  // Sidebar collapse states
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [rightSidebarMobileOpen, setRightSidebarMobileOpen] = useState(false);
  
  // Preset dropdown states
  const [openPresetDropdown, setOpenPresetDropdown] = useState<string | null>(null);
  
  // Project settings modal
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [currentProject, setCurrentProject] = useState<any>(null);

  // Batch import modal
  const [showBatchImport, setShowBatchImport] = useState(false);

  // Load project data
  const loadProject = async () => {
    if (!projectId) return;
    
    try {
      const { getProject } = await import('../accessors/projectAccessor');
      const project = await getProject(projectId);
      console.log('ProjectDetailPage: Loaded project:', project);
      setCurrentProject(project);
      // Update the app context with the current project
      if (project?.id && project?.name) {
        console.log('ProjectDetailPage: Setting app current project:', { id: project.id, title: project.name });
        setAppCurrentProject({ id: project.id, title: project.name });
      } else {
        console.log('ProjectDetailPage: Project missing id or name:', project);
      }
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  };

  // Load events
  const loadEvents = async () => {
    if (!projectId) return;
    
    try {
      const { supabase } = await import('../supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const { getEvents } = await import('../api');
      const { events: projectEvents } = await getEvents(projectId, session.access_token, true);
      eventActions.setEvents(projectEvents);
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  };

  // Load initial data
  useEffect(() => {
    operations.loadDocuments();
    operations.loadPresets();
    operations.loadTags();
    loadEvents();
    loadProject();
    loadAiProviders();
  }, [projectId]);

  // Initialize filtered tags when tags change
  useEffect(() => {
    setFilteredTags(tags.items);
  }, [tags.items]);

  // Auto-resolve template documents when selected
  useEffect(() => {
    if (selectedDocument &&
        selectedDocument.components &&
        Object.keys(selectedDocument.components).length > 0 &&
        !ui.resolvedContent) {
      operations.handleResolveDocument(selectedDocument);
    }
  }, [selectedDocument, ui.resolvedContent, operations]);

  const loadAiProviders = async () => {
    try {
      const token = await operations.getAccessToken();
      setAccessToken(token);
      const [providers, credits] = await Promise.all([
        getAIProviders(token),
        getUserCredits(token)
      ]);
      setAiProviders(providers);
      setUserCredits(credits);
    } catch (error) {
      console.error('Failed to load AI providers and credits:', error);
    }
  };

  // Close preset dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openPresetDropdown && !(event.target as Element).closest('.preset-card__menu-container')) {
        setOpenPresetDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openPresetDropdown]);

  // Clean up project context on unmount
  useEffect(() => {
    return () => {
      setAppCurrentProject(null);
    };
  }, []);

  const getPresetUrl = (presetName: string) => {
    return `${import.meta.env.VITE_API_URL}/preset/${projectId}/${presetName}`;
  };

  const downloadPresetPdf = async (preset: any) => {
    try {
      const { supabase } = await import('../supabaseClient');
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        console.error('No authentication token available');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api/presets/${projectId}/${preset.id}/pdf`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('PDF download failed:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          errorText
        });
        throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
      }

      // Create a blob from the response
      const blob = await response.blob();
      
      // Create a temporary link and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${preset.name}.pdf`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      // You might want to show a user-friendly error message here
    }
  };

  // Component-specific handlers
  const handleCreateDocument = async () => {
    try {
      await operations.handleCreateDocument(formData);
      setIsCreating(false);
      resetForm();
    } catch {
      // Error handled in operations hook
    }
  };

  const handleUpdateDocument = async () => {
    if (!selectedDocument) return;

    try {
      await operations.handleUpdateDocument(selectedDocument.id, formData);
      setIsEditing(false);
    } catch {
      // Error handled in operations hook
    }
  };

  const handleCreateDerivative = (document: Document) => {
    setSourceDocument(document);
    modalActions.openModal('showDerivativeModal');
  };

  const handleDerivativeCreation = async (derivativeType: string, title: string) => {
    if (!ui.sourceDocument) return;

    try {
      await operations.handleCreateDerivative(derivativeType, title, ui.sourceDocument);
      modalActions.closeModal('showDerivativeModal');
      setSourceDocument(null);
    } catch {
      // Error handled in operations hook
    }
  };

  const handleCreatePreset = async (name: string, document: Document) => {
    try {
      await operations.handleCreatePreset(name, document);
      modalActions.closeModal('showPresetPicker');
    } catch {
      // Error handled in operations hook
    }
  };

  const handleBatchImportSuccess = () => {
    setShowBatchImport(false);
    // Reload all data
    operations.loadDocuments();
    operations.loadTags();
    loadEvents();
    // Show success notification if you have a notification system
  };

  // Component handlers
  const addComponent = () => {
    setKeyInputValue('');
    modalActions.openModal('showKeyInput');
  };

  const confirmComponentKey = () => {
    if (ui.keyInputValue.trim()) {
      setComponentKeyToAdd(ui.keyInputValue.trim());
      modalActions.closeModal('showKeyInput');
      modalActions.openModal('showComponentTypeSelector');
    }
  };

  const selectComponentType = (type: 'document' | 'group') => {
    console.debug('ProjectDetailPage: selectComponentType called', {
      type,
      componentKeyToAdd: ui.componentKeyToAdd,
      availableDocuments: documents.items.length
    });

    modalActions.closeModal('showComponentTypeSelector');
    if (type === 'document') {
      console.debug('ProjectDetailPage: Opening document picker modal');
      modalActions.openModal('showDocumentPicker');
    } else {
      console.debug('ProjectDetailPage: Opening group picker modal');
      modalActions.openModal('showGroupPicker');
    }
  };

  const selectDocumentForComponent = (documentId: string) => {
    console.debug('ProjectDetailPage: selectDocumentForComponent called', {
      documentId,
      componentKeyToAdd: ui.componentKeyToAdd,
      isCreating: editingState.isCreating,
      selectedDocument: selectedDocument ? {
        id: selectedDocument.id,
        title: selectedDocument.title,
        components: selectedDocument.components
      } : null,
      formDataComponents: formData.components
    });

    if (ui.componentKeyToAdd) {
      // Use formData.components for both creation and editing modes
      const currentComponents = editingState.isCreating ? formData.components : selectedDocument?.components || {};
      const updatedComponents = {
        ...currentComponents,
        [ui.componentKeyToAdd]: documentId
      };
      console.debug('ProjectDetailPage: Updating components', {
        previousComponents: currentComponents,
        updatedComponents,
        componentKey: ui.componentKeyToAdd
      });

      formActions.updateFormData({ components: updatedComponents });
      modalActions.closeModal('showDocumentPicker');
      setComponentKeyToAdd(null);
      console.debug('ProjectDetailPage: Selection completed, modal closed');
    } else {
      console.debug('ProjectDetailPage: Selection failed - missing componentKeyToAdd', {
        hasComponentKey: !!ui.componentKeyToAdd
      });
    }
  };

  const selectGroupForComponent = (groupId: string) => {
    console.debug('ProjectDetailPage: selectGroupForComponent called', {
      groupId,
      componentKeyToAdd: ui.componentKeyToAdd,
      isCreating: editingState.isCreating
    });

    if (ui.componentKeyToAdd) {
      // Use formData.components for both creation and editing modes
      const currentComponents = editingState.isCreating ? formData.components : selectedDocument?.components || {};
      const updatedComponents = {
        ...currentComponents,
        [ui.componentKeyToAdd]: `group:${groupId}`
      };
      console.debug('ProjectDetailPage: Updating components with group', {
        previousComponents: currentComponents,
        updatedComponents,
        componentKey: ui.componentKeyToAdd
      });

      formActions.updateFormData({ components: updatedComponents });
      modalActions.closeModal('showGroupPicker');
      setComponentKeyToAdd(null);
      console.debug('ProjectDetailPage: Group selection completed, modal closed');
    } else {
      console.debug('ProjectDetailPage: Group selection failed - missing componentKeyToAdd');
    }
  };

  const openGroupSwitcher = (componentKey: string, groupId: string) => {
    setSwitcherComponentKey(componentKey);
    setSwitcherGroupId(groupId);
    modalActions.openModal('showGroupSwitcher');
  };

  const openGroupAssignmentPicker = () => {
    modalActions.openModal('showGroupAssignmentPicker');
  };

  const handleGroupAssignment = async (groupId: string) => {
    console.debug('ProjectDetailPage: handleGroupAssignment called', {
      groupId,
      isCreating: editingState.isCreating
    });

    // Update form data with new group assignment
    formActions.updateFormData({ group_id: groupId });

    // If we're editing (not creating), ensure bidirectional group assignment
    if (!editingState.isCreating && groupId && accessToken && projectId) {
      try {
        await ensureBidirectionalGroupAssignment(
          groupId,
          documents.items,
          projectId,
          accessToken,
          // Update local state when document is updated
          (updatedDoc) => {
            documentActions.setDocuments(documents.items.map(doc =>
              doc.id === updatedDoc.id ? updatedDoc : doc
            ));
          }
        );
      } catch (error) {
        console.error('🔧 Bidirectional group assignment failed:', error);
        // Don't block the UI, just log the error
      }
    }

    modalActions.closeModal('showGroupAssignmentPicker');
    console.debug('ProjectDetailPage: Group assignment completed');
  };

  const switchGroupType = (componentKey: string, groupId: string, preferredType?: string) => {
    console.debug('ProjectDetailPage: switchGroupType called', {
      componentKey,
      groupId,
      preferredType,
      isCreating: editingState.isCreating
    });

    // Use formData.components for both creation and editing modes
    const currentComponents = editingState.isCreating ? formData.components : selectedDocument?.components || {};
    const updatedComponents = {
      ...currentComponents,
      [componentKey]: preferredType ? `group:${groupId}:${preferredType}` : `group:${groupId}`
    };
    console.debug('ProjectDetailPage: Switching group type', {
      previousComponents: currentComponents,
      updatedComponents
    });

    formActions.updateFormData({ components: updatedComponents });
    modalActions.closeModal('showGroupSwitcher');
    setSwitcherComponentKey(null);
    setSwitcherGroupId(null);
    console.debug('ProjectDetailPage: Group type switch completed');
  };

  const openTagSelector = (documentId: string) => {
    setTagSelectorDocumentId(documentId);
    modalActions.openModal('showTagSelector');
  };

  const closeTagSelector = () => {
    modalActions.closeModal('showTagSelector');
    setTagSelectorDocumentId(null);
    operations.loadDocuments();
  };

  const openEventSelector = (document: Document) => {
    setEventSelectorDocument(document);
    modalActions.openModal('showEventSelector');
  };

  const closeEventSelector = () => {
    modalActions.closeModal('showEventSelector');
    setEventSelectorDocument(null);
    operations.loadDocuments();
  };

  const handleCreateEvent = async (document: Document) => {
    const eventName = prompt('Enter event name:', `${document.title} Event`);
    if (eventName && eventName.trim()) {
      try {
        // Create event via API
        const { supabase } = await import('../supabaseClient');
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        if (!token) throw new Error('No authentication token');

        const { createEvent, addTagsToEvent } = await import('../api');
        const newEvent = await createEvent(projectId!, {
          name: eventName.trim(),
          description: `Auto-created for document: ${document.title}`
        }, token);

        // Copy document tags to the new event
        if (document.tags && document.tags.length > 0) {
          try {
            const tagIds = document.tags.map(tag => tag.id);
            await addTagsToEvent(projectId!, newEvent.id, tagIds, token);
          } catch (tagError) {
            console.warn('Failed to copy tags to event:', tagError);
            // Don't fail the entire operation if tagging fails
          }
        }

        // Assign document to the new event
        const formData = {
          title: document.title,
          alias: document.alias || '',
          content: document.content || '',
          document_type: document.document_type || '',
          components: document.components || {},
          group_id: document.group_id,
          ai_model: document.ai_model,
          event_id: newEvent.id
        };
        
        await operations.handleUpdateDocument(document.id, formData);
        await loadEvents(); // Refresh events list
      } catch (error) {
        console.error('Failed to create event:', error);
        // TODO: Implement error handling
      }
    }
  };

  const openDocumentEvolution = (document: Document) => {
    setEvolutionDocument(document);
    modalActions.openModal('showDocumentEvolution');
  };

  const closeDocumentEvolution = () => {
    modalActions.closeModal('showDocumentEvolution');
    setEvolutionDocument(null);
  };


  const removeComponent = (key: string) => {
    const newComponents = { ...formData.components };
    delete newComponents[key];
    formActions.updateFormData({ components: newComponents });
  };

  const handleSidebarDocumentClick = (document: Document) => {
    setSelectedDocumentAction(document.id);
    setIsEditing(false);
    setResolvedContent(null);
    sidebarActions.setSidebarOpen(false);
  };

  const handleDocumentRename = (document: Document) => {
    const newTitle = prompt('Enter new document title:', document.title);
    if (newTitle && newTitle.trim() && newTitle.trim() !== document.title) {
      const formData = {
        title: newTitle.trim(),
        alias: document.alias || '',
        content: document.content || '',
        document_type: document.document_type || '',
        components: document.components || {},
        group_id: document.group_id,
        ai_model: document.ai_model
      };
      operations.handleUpdateDocument(document.id, formData);
    }
  };

  // Provide action handlers to the app header through context
  useEffect(() => {
    setProjectActions({
      onToggleSidebar: () => sidebarActions.setSidebarOpen(!ui.sidebarOpen),
      onToggleRightSidebar: () => {
        // On mobile, toggle mobile open state; on desktop, toggle collapse
        if (window.innerWidth <= 768) {
          setRightSidebarMobileOpen(!rightSidebarMobileOpen);
        } else {
          setRightSidebarCollapsed(!rightSidebarCollapsed);
        }
      }
    });
    
    // Cleanup when component unmounts
    return () => {
      setProjectActions({});
    };
  }, [setProjectActions, sidebarActions.setSidebarOpen, ui.sidebarOpen, rightSidebarCollapsed, rightSidebarMobileOpen]);

  if (documents.loading) return <div className="loading">Loading documents...</div>;

  return (
    <DragDropProvider>
      <div className="project-detail-page">

        {/* Mobile overlays */}
        {ui.sidebarOpen && <div className="sidebar-overlay" onClick={() => sidebarActions.setSidebarOpen(false)} />}
        {rightSidebarMobileOpen && <div className="sidebar-overlay" onClick={() => setRightSidebarMobileOpen(false)} />}
      
      {/* Left Sidebar - Documents Only */}
      <div className={`left-sidebar ${ui.sidebarOpen ? 'left-sidebar--open' : ''} ${leftSidebarCollapsed ? 'left-sidebar--collapsed' : ''}`}>
        <div className="left-sidebar__header">
          <div className="left-sidebar__header-content">
            <h2>Documents</h2>
            <div className="credits-display">
              <span className="credits-display__label">Credits:</span>
              <span className="credits-display__amount">{userCredits.toLocaleString()}</span>
            </div>
          </div>
          <div className="left-sidebar__header-actions">
            <button 
              className="left-sidebar__collapse-toggle"
              onClick={() => setLeftSidebarCollapsed(!leftSidebarCollapsed)}
              title={leftSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {leftSidebarCollapsed ? '▶' : '◀'}
            </button>
            <button 
              className="left-sidebar__close"
              onClick={() => sidebarActions.setSidebarOpen(false)}
            >
              ×
            </button>
          </div>
        </div>
        
        {/* Create Document Section */}
        <div className="left-sidebar__create-section">
          <button
            className="btn btn--primary btn--full-width"
            onClick={() => {
              startCreate();
              sidebarActions.setSidebarOpen(false);
              setRightSidebarMobileOpen(false);
            }}
            title="Create new document"
          >
            + Create Document
          </button>
          <button
            className="btn btn--secondary btn--full-width"
            onClick={() => {
              setShowBatchImport(true);
              sidebarActions.setSidebarOpen(false);
              setRightSidebarMobileOpen(false);
            }}
            title="Batch import documents from ZIP file"
            style={{ marginTop: '0.5rem' }}
          >
            📦 Batch Import
          </button>
        </div>
        
        {documents.error && (
          <div className="error-message">
            {documents.error}
            <button onClick={() => {/* TODO: Implement error clearing */}}>×</button>
          </div>
        )}
        
        {/* Document Filters */}
        <div className="left-sidebar__filters">
          <DocumentFilters
            searchTerm={sidebarFilter.searchTerm}
            onSearchChange={sidebarFilter.setSearchTerm}
            typeFilter={sidebarFilter.typeFilter}
            onTypeChange={sidebarFilter.setTypeFilter}
            formatFilter={sidebarFilter.formatFilter}
            onFormatChange={sidebarFilter.setFormatFilter}
            availableTypes={sidebarFilter.availableTypes}
            searchPlaceholder="Search documents..."
          />
          
          
          <EventFilter
            events={events.items}
            selectedEventIds={sidebarFilter.selectedEventIds}
            onEventSelectionChange={sidebarFilter.setSelectedEventIds}
            eventVersionFilter={sidebarFilter.eventVersionFilter}
            onVersionFilterChange={sidebarFilter.setEventVersionFilter}
          />
          
          {sidebarFilter.hasActiveFilters && (
            <button 
              className="btn btn--sm btn--secondary"
              onClick={sidebarFilter.resetFilters}
            >
              Clear Filters
            </button>
          )}
        </div>
        
        {/* Documents List - Takes Remaining Space */}
        <div className="left-sidebar__documents">
          <DocumentGroupList
            documents={sidebarFilter.filteredDocuments}
            selectedDocumentId={selectedDocument?.id}
            onDocumentClick={handleSidebarDocumentClick}
            onDocumentRename={handleDocumentRename}
            onDocumentDelete={operations.handleDeleteDocument}
            onCreateDerivative={handleCreateDerivative}
            onManageTags={(document) => openTagSelector(document.id)}
            onManageEvents={openEventSelector}
            onCreateEvent={handleCreateEvent}
            onDocumentEvolution={openDocumentEvolution}
            emptyMessage={sidebarFilter.hasActiveFilters ? "No documents match your filters." : "No documents found. Create your first document!"}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        <div className="main-content__body">
          <div className="main-content__inner">
            {(editingState.isCreating || editingState.isEditing) && (
              <EnhancedDocumentForm
                formData={formData}
                setFormData={formActions.setFormData}
                onSave={editingState.isCreating ? handleCreateDocument : handleUpdateDocument}
                onCancel={documentManagement.cancelEdit}
                addComponent={addComponent}
                removeComponent={removeComponent}
                onOpenGroupSwitcher={openGroupSwitcher}
                onOpenGroupPicker={openGroupAssignmentPicker}
                isCreating={editingState.isCreating}
                documents={documents.items}
                aiProviders={aiProviders}
                currentDocumentId={selectedDocument?.id}
              />
            )}
            
            {!editingState.isCreating && !editingState.isEditing && selectedDocument && (
              <DocumentViewer
                document={selectedDocument}
                allDocuments={documents.items}
                resolvedContent={ui.resolvedContent}
                onResolve={() => selectedDocument && operations.handleResolveDocument(selectedDocument)}
                onCreateFromSelection={(selectedText, selectionInfo, title, documentType, groupId) =>
                  selectedDocument && operations.handleCreateFromSelection(selectedDocument, selectedText, selectionInfo, title, documentType, groupId)
                }
                onDocumentSelect={(document) => {
                  setSelectedDocumentAction(document.id);
                  setResolvedContent(null);
                }}
                onDocumentUpdate={operations.loadDocuments}
                onEditDocument={(document) => {
                  modalActions.closeAllModals();
                  startEdit(document);
                }}
                onTagUpdate={async () => {
                  await operations.loadDocuments();
                  // Force re-render by getting fresh document data
                  if (selectedDocument) {
                    // Since loadDocuments updates documents.items, we need to wait for the next render cycle
                    setTimeout(() => {
                      const updatedDoc = documents.items.find(d => d.id === selectedDocument!.id);
                      if (updatedDoc) {
                        setSelectedDocumentAction(updatedDoc.id);
                      }
                    }, 0);
                  }
                }}
                projectId={projectId || ''}
                loadDocumentHistory={operations.loadDocumentHistory}
                loadHistoryEntry={operations.loadHistoryEntry}
                onRollback={operations.handleRollbackDocument}
                aiProviders={aiProviders}
                accessToken={accessToken}
              />
            )}
            
            {!editingState.isCreating && !editingState.isEditing && !selectedDocument && (
              <div className="empty-state">
                <h3>Select a document to view or create a new one</h3>
                <button
                  className="btn btn--primary"
                  onClick={() => sidebarActions.setSidebarOpen(true)}
                >
                  Browse Documents
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Right Sidebar - Widgets */}
      <div className={`right-sidebar ${rightSidebarCollapsed ? 'right-sidebar--collapsed' : ''} ${rightSidebarMobileOpen ? 'right-sidebar--mobile-open' : ''}`}>
        <div className="right-sidebar__header">
          <h3>Widgets</h3>
          <div className="right-sidebar__header-actions">
            <button 
              className="btn btn--xs btn--secondary"
              onClick={() => setShowProjectSettings(true)}
              title="Project Settings"
            >
              ⚙️
            </button>
            <button 
              className="right-sidebar__collapse-toggle"
              onClick={() => setRightSidebarCollapsed(!rightSidebarCollapsed)}
              title={rightSidebarCollapsed ? 'Expand widgets' : 'Collapse widgets'}
            >
              {rightSidebarCollapsed ? '◀' : '▶'}
            </button>
            <button 
              className="right-sidebar__close"
              onClick={() => setRightSidebarMobileOpen(false)}
            >
              ×
            </button>
          </div>
        </div>
        
        <div className="right-sidebar__content">
          {/* Tag Filter Widget */}
          {projectId && (
            <div className="widget">
              <TagFilterWidget
                projectId={projectId}
                selectedConditions={sidebarFilter.tagFilterConditions}
                onConditionsChange={sidebarFilter.setTagFilterConditions}
                availableTags={tags.items}
              />
            </div>
          )}
          
          {/* Tags Management Widget */}
          <div className="widget">
            <div className="widget__header">
              <h4>Project Tags ({tags.items.length})</h4>
              <button 
                className="btn btn--sm btn--secondary"
                onClick={() => modalActions.openModal('showTagManager')}
              >
                Manage
              </button>
            </div>
            
            <div className="widget__content">
              {/* Tag Filter and Create Interface */}
              {projectId && (
                <ProjectTagsFilter
                  projectId={projectId}
                  tags={tags.items}
                  onTagCreated={() => {
                    operations.loadTags();
                  }}
                  onFilterChange={setFilteredTags}
                />
              )}
              
              {tags.items.length === 0 ? (
                <div className="empty-state">
                  <p>No tags created yet.</p>
                  <p>Use the button above to create your first tag.</p>
                </div>
              ) : (
                <div className="tags-grid tags-grid--compact">
                  {filteredTags.map(tag => {
                    const isInFilter = sidebarFilter.tagFilterConditions.some(condition => condition.tagId === tag.id);
                    return (
                      <DraggableItem
                        key={tag.id}
                        id={`filter-tag-${tag.id}`}
                        type="tag"
                        item={tag}
                      >
                        <button
                          className={`tag-badge tag-badge--compact tag-badge--clickable ${isInFilter ? 'tag-badge--filtered' : ''}`}
                          style={{ backgroundColor: tag.color, color: 'white' }}
                          onClick={() => {
                            if (isInFilter) {
                              // Remove from filter
                              const newConditions = sidebarFilter.tagFilterConditions.filter(c => c.tagId !== tag.id);
                              sidebarFilter.setTagFilterConditions(newConditions);
                            } else {
                              // Add to filter
                              const newCondition = { tagId: tag.id, mode: 'exist_all' as const };
                              sidebarFilter.setTagFilterConditions([...sidebarFilter.tagFilterConditions, newCondition]);
                            }
                          }}
                          title={isInFilter ? 'Click to remove from filter' : 'Click to add to filter'}
                        >
                          {tag.name}
                          {isInFilter && <span className="tag-badge__indicator"> ✓</span>}
                        </button>
                      </DraggableItem>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          
          {/* Events Widget */}
          <div className="widget">
            <div className="widget__content">
              {projectId && (
                <EventsWidget
                  projectId={projectId}
                  events={events.items}
                  onEventsChange={loadEvents}
                  onTimelineClick={() => modalActions.openModal('showEventTimeline')}
                  externalTagFilters={sidebarFilter.tagFilterConditions}
                  onEventClick={(eventId) => {
                    // Apply event filter to document selection
                    sidebarFilter.setSelectedEventIds([eventId]);
                  }}
                  onDocumentView={(document) => {
                    modalActions.closeAllModals(); // Close all modals first
                    setSelectedDocumentAction(document.id);
                    setIsEditing(false);
                    setResolvedContent(null);
                  }}
                  onDocumentEdit={(document) => {
                    modalActions.closeAllModals(); // Close all modals first
                    startEdit(document);
                  }}
                  onDocumentDelete={(documentId) => {
                    operations.handleDeleteDocument(documentId);
                  }}
                />
              )}
            </div>
          </div>
          
          {/* Presets Widget */}
          <div className="presets-widget">
            <div className="presets-widget__header">
              <h4>📡 Presets ({presets.items.length})</h4>
              <div className="presets-widget__actions">
                <button 
                  className="btn btn--xs btn--secondary"
                  onClick={() => modalActions.openModal('showPresetPicker')}
                >
                  ＋
                </button>
              </div>
            </div>
            
            <div className="presets-widget__content">
              {presets.items.length === 0 ? (
                <div className="empty-state empty-state--compact">
                  <p>No presets yet</p>
                  <p>Create presets to publish documents as external API endpoints.</p>
                </div>
              ) : (
                <div className="preset-cards">
                  {presets.items.map((preset) => (
                    <div key={preset.id} className="preset-card">
                      <div className="preset-card__main">
                        <div className="preset-card__header">
                            <h5 className="preset-card__name">{preset.name}</h5>
                            <div className="preset-card__menu-container">
                              <button 
                                className="preset-card__menu-toggle"
                                onClick={() => setOpenPresetDropdown(openPresetDropdown === preset.id ? null : preset.id)}
                                title="More actions"
                              >
                                ⋯
                              </button>
                              {openPresetDropdown === preset.id && (
                                <div className="preset-card__dropdown">
                                  <button 
                                    className="preset-card__dropdown-item"
                                    onClick={() => {
                                      setEditingPreset(preset);
                                      modalActions.openModal('showPresetDashboard');
                                      setOpenPresetDropdown(null);
                                    }}
                                  >
                                    🎛️ Manage Overrides
                                  </button>
                                  <button 
                                    className="preset-card__dropdown-item"
                                    onClick={() => {
                                      navigator.clipboard.writeText(getPresetUrl(preset.name));
                                      setOpenPresetDropdown(null);
                                    }}
                                  >
                                    📋 Copy API URL
                                  </button>
                                  <button
                                    className="preset-card__dropdown-item"
                                    onClick={() => {
                                      downloadPresetPdf(preset);
                                      setOpenPresetDropdown(null);
                                    }}
                                  >
                                    📄 Download PDF
                                  </button>
                                  <button
                                    className="preset-card__dropdown-item"
                                    onClick={() => {
                                      setEditingPreset(preset);
                                      modalActions.openModal('showPresetEdit');
                                      setOpenPresetDropdown(null);
                                    }}
                                  >
                                    ✎ Edit Preset
                                  </button>
                                  <button
                                    className="preset-card__dropdown-item preset-card__dropdown-item--danger"
                                    onClick={() => {
                                      operations.handleDeletePreset(preset.id);
                                      setOpenPresetDropdown(null);
                                    }}
                                  >
                                    ✕ Delete Preset
                                  </button>
                                </div>
                              )}
                            </div>
                        </div>
                        
                        <div className="preset-card__meta">
                          <span className="preset-card__document">
                            📄 {preset.document?.title || 'Unknown Document'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Component Key Input Modal */}
      {modals.showKeyInput && (
        <ComponentKeyInputModal
          value={ui.keyInputValue}
          onChange={setKeyInputValue}
          onConfirm={confirmComponentKey}
          onCancel={() => modalActions.closeModal('showKeyInput')}
        />
      )}
      
      {/* Document Picker Modal */}
      {modals.showDocumentPicker && (
        <DocumentPickerModal
          documents={editingState.isCreating ? documents.items : documents.items.filter(doc => doc.id !== selectedDocument?.id)}
          componentKey={ui.componentKeyToAdd}
          onSelect={selectDocumentForComponent}
          onCancel={() => modalActions.closeModal('showDocumentPicker')}
        />
      )}

      {/* Derivative Modal */}
      {modals.showDerivativeModal && (
        <DerivativeModal
          sourceDocument={ui.sourceDocument}
          onConfirm={handleDerivativeCreation}
          onCancel={() => modalActions.closeModal('showDerivativeModal')}
        />
      )}

      {/* Component Type Selector Modal */}
      {modals.showComponentTypeSelector && (
        <ComponentTypeSelectorModal
          componentKey={ui.componentKeyToAdd}
          onSelect={selectComponentType}
          onCancel={() => modalActions.closeModal('showComponentTypeSelector')}
        />
      )}

      {/* Group Picker Modal */}
      {modals.showGroupPicker && (
        <GroupPickerModal
          documents={documents.items}
          componentKey={ui.componentKeyToAdd}
          onSelect={selectGroupForComponent}
          onCancel={() => modalActions.closeModal('showGroupPicker')}
        />
      )}

      {/* Group Assignment Picker Modal */}
      {modals.showGroupAssignmentPicker && (
        <GroupPickerModal
          documents={documents.items}
          mode="group-assignment"
          onSelect={handleGroupAssignment}
          onCancel={() => modalActions.closeModal('showGroupAssignmentPicker')}
        />
      )}

      {/* Group Switcher Modal */}
      {modals.showGroupSwitcher && ui.switcherGroupId && ui.switcherComponentKey && projectId && (
        <GroupSwitcherModal
          projectId={projectId}
          groupId={ui.switcherGroupId}
          componentKey={ui.switcherComponentKey}
          currentReference={selectedDocument?.components?.[ui.switcherComponentKey] || ''}
          onSwitch={switchGroupType}
          onCancel={() => modalActions.closeModal('showGroupSwitcher')}
        />
      )}

      {/* Preset Picker Modal */}
      {modals.showPresetPicker && (
        <PresetPickerModal
          documents={documents.items}
          onSelect={handleCreatePreset}
          onCancel={() => modalActions.closeModal('showPresetPicker')}
        />
      )}

      {/* Preset Edit Modal */}
      {modals.showPresetEdit && ui.editingPreset && (
        <PresetEditModal
          preset={ui.editingPreset}
          documents={documents.items}
          onSave={async (presetId, name, documentId) => {
            await operations.handleUpdatePreset(presetId, name, documentId);
            setEditingPreset(null);
            modalActions.closeModal('showPresetEdit');
          }}
          onCancel={() => {
            setEditingPreset(null);
            modalActions.closeModal('showPresetEdit');
          }}
        />
      )}

      {/* Preset Dashboard Modal */}
      {modals.showPresetDashboard && ui.editingPreset && (
        <PresetDashboardModal
          preset={ui.editingPreset}
          documents={documents.items}
          onSave={async (presetId, overrides) => {
            await operations.handleUpdatePresetOverrides(presetId, overrides);
            await operations.loadPresets(); // Reload presets to get full document data
            setEditingPreset(null);
            modalActions.closeModal('showPresetDashboard');
          }}
          onCancel={() => {
            setEditingPreset(null);
            modalActions.closeModal('showPresetDashboard');
          }}
        />
      )}

      {/* Tag Manager Modal */}
      {modals.showTagManager && projectId && (
        <TagManager
          projectId={projectId}
          onClose={() => {
            modalActions.closeModal('showTagManager');
            operations.loadTags();
          }}
        />
      )}

      {/* Tag Selector Modal */}
      {modals.showTagSelector && ui.tagSelectorDocumentId && projectId && (
        <TagSelector
          projectId={projectId}
          entityType="document"
          entityId={ui.tagSelectorDocumentId}
          entityName={documents.items.find((d: any) => d.id === ui.tagSelectorDocumentId)?.title || 'Document'}
          onClose={closeTagSelector}
          onUpdate={operations.loadDocuments}
        />
      )}

      {/* Event Assignment Modal */}
      {modals.showEventSelector && ui.eventSelectorDocument && projectId && (
        <EventAssignmentModal
          projectId={projectId}
          document={ui.eventSelectorDocument}
          onClose={closeEventSelector}
          onUpdate={() => {
            operations.loadDocuments();
            loadEvents();
          }}
        />
      )}

      {/* Event Timeline Modal */}
      {modals.showEventTimeline && projectId && (
        <EventTimelineModal
          projectId={projectId}
          onClose={() => modalActions.closeModal('showEventTimeline')}
          onCloseAllModals={modalActions.closeAllModals}
          onDocumentView={(document) => {
            modalActions.closeAllModals(); // Close all modals first
            setSelectedDocumentAction(document.id);
            setIsEditing(false);
            setResolvedContent(null);
          }}
          onDocumentEdit={(document) => {
            modalActions.closeAllModals(); // Close all modals first
            startEdit(document);
          }}
          onDocumentDelete={(documentId) => {
            operations.handleDeleteDocument(documentId);
          }}
          onEventsChange={loadEvents}
        />
      )}

      {/* Document Evolution Modal */}
      {modals.showDocumentEvolution && ui.evolutionDocument && projectId && (
        <div className="modal-overlay">
          <div className="modal-content modal-content--large">
            <div className="modal-header">
              <h3>Document Evolution - {ui.evolutionDocument.title}</h3>
              <button className="modal-close" onClick={closeDocumentEvolution}>&times;</button>
            </div>
            <div className="modal-body">
              <DocumentEvolution
                projectId={projectId}
                document={ui.evolutionDocument}
                onClose={closeDocumentEvolution}
                onShowDocument={(doc) => {
                  setSelectedDocumentAction(doc.id);
                  setIsEditing(false);
                  setResolvedContent(null);
                }}
                onEditDocument={(doc) => {
                  startEdit(doc);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Document Group Deletion Modal */}
      {modals.showDocumentDeletion && ui.documentToDelete && (
        <DocumentGroupDeletionModal
          isOpen={modals.showDocumentDeletion}
          document={ui.documentToDelete}
          groupDocuments={documents.items.filter(doc => doc.group_id === ui.documentToDelete?.group_id)}
          onClose={() => {
            modalActions.closeModal('showDocumentDeletion');
            setDocumentToDelete(null);
          }}
          onDeleteDocument={operations.handleConfirmDeleteDocument}
        />
      )}

      {/* Project Settings Modal */}
      {showProjectSettings && currentProject && (
        <ProjectSettingsModal
          project={currentProject}
          onClose={() => setShowProjectSettings(false)}
          onProjectUpdate={loadProject}
        />
      )}

      {/* Batch Import Modal */}
      {showBatchImport && projectId && (
        <BatchImportModal
          projectId={projectId}
          onSuccess={handleBatchImportSuccess}
          onCancel={() => setShowBatchImport(false)}
        />
      )}
        {/* Drag and Drop Recycle Bin */}
        <RecycleBin />
      </div>
    </DragDropProvider>
  );
}







