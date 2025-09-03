import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Document, AIProvider, Tag } from '../api';
import { getAIProviders, getUserCredits } from '../api';
import { useProjectActions } from '../App';
import { useProjectDetailState } from '../hooks/useProjectDetailState';
import { useDocumentOperations } from '../hooks/useDocumentOperations';
import { useDocumentFilter } from '../hooks/useDocumentFilter';
import { DocumentForm } from '../components/DocumentForm';
import { DocumentViewer } from '../components/DocumentViewer';
import { PromptDocumentViewer } from '../components/PromptDocumentViewer';
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
import { EventSelector } from '../components/EventSelector';
import { EventsWidget } from '../components/EventsWidget';
import { EventTimelineModal } from '../components/EventTimelineModal';
import { EventFilter } from '../components/EventFilter';
import { DocumentEvolution } from '../components/DocumentEvolution';
import { ProjectSettingsModal } from '../components/ProjectSettingsModal';
import '../styles/ProjectDetailPage.css';


export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [aiProviders, setAiProviders] = useState<AIProvider[]>([]);
  const [accessToken, setAccessToken] = useState<string>('');
  const [userCredits, setUserCredits] = useState<number>(0);
  const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
  
  // Get project actions context
  const { setProjectActions, setCurrentProject: setAppCurrentProject } = useProjectActions();
  
  // Use custom hooks for state management
  const state = useProjectDetailState();
  const operations = useDocumentOperations({
    projectId,
    documents: state.documents,
    setDocuments: state.setDocuments,
    presets: state.presets,
    setPresets: state.setPresets,
    setTags: state.setTags,
    setError: state.setError,
    setLoading: state.setLoading,
    setSelectedDocument: state.setSelectedDocument,
    setResolvedContent: state.setResolvedContent,
  });
  
  // Get events from state hook instead

  // Use document filter hook for sidebar
  const sidebarFilter = useDocumentFilter(state.documents, state.events);

  // Sidebar collapse states
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [rightSidebarMobileOpen, setRightSidebarMobileOpen] = useState(false);
  
  // Preset dropdown states
  const [openPresetDropdown, setOpenPresetDropdown] = useState<string | null>(null);
  
  // Project settings modal
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [currentProject, setCurrentProject] = useState<any>(null);

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
      state.setEvents(projectEvents);
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
    setFilteredTags(state.tags);
  }, [state.tags]);

  // Auto-resolve composite documents when selected
  useEffect(() => {
    if (state.selectedDocument && state.selectedDocument.is_composite && !state.resolvedContent) {
      operations.handleResolveDocument(state.selectedDocument);
    }
  }, [state.selectedDocument, state.resolvedContent, operations]);

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
      await operations.handleCreateDocument(state.formData);
      state.setIsCreating(false);
      state.resetForm();
    } catch {
      // Error handled in operations hook
    }
  };

  const handleUpdateDocument = async () => {
    if (!state.selectedDocument) return;
    
    try {
      await operations.handleUpdateDocument(state.selectedDocument.id, state.formData);
      state.setIsEditing(false);
    } catch {
      // Error handled in operations hook
    }
  };

  const handleCreateDerivative = (document: Document) => {
    state.setSourceDocument(document);
    state.openModal('showDerivativeModal');
  };

  const handleDerivativeCreation = async (derivativeType: string, title: string) => {
    if (!state.sourceDocument) return;
    
    try {
      await operations.handleCreateDerivative(derivativeType, title, state.sourceDocument);
      state.closeModal('showDerivativeModal');
      state.setSourceDocument(null);
    } catch {
      // Error handled in operations hook
    }
  };

  const handleCreatePreset = async (name: string, document: Document) => {
    try {
      await operations.handleCreatePreset(name, document);
      state.closeModal('showPresetPicker');
    } catch {
      // Error handled in operations hook
    }
  };

  // Component handlers
  const addComponent = () => {
    state.setKeyInputValue('');
    state.openModal('showKeyInput');
  };

  const confirmComponentKey = () => {
    if (state.keyInputValue.trim()) {
      state.setComponentKeyToAdd(state.keyInputValue.trim());
      state.closeModal('showKeyInput');
      state.openModal('showComponentTypeSelector');
    }
  };

  const selectComponentType = (type: 'document' | 'group') => {
    console.debug('ProjectDetailPage: selectComponentType called', {
      type,
      componentKeyToAdd: state.componentKeyToAdd,
      availableDocuments: state.documents.length
    });
    
    state.closeModal('showComponentTypeSelector');
    if (type === 'document') {
      console.debug('ProjectDetailPage: Opening document picker modal');
      state.openModal('showDocumentPicker');
    } else {
      console.debug('ProjectDetailPage: Opening group picker modal');
      state.openModal('showGroupPicker');
    }
  };

  const selectDocumentForComponent = (documentId: string) => {
    console.debug('ProjectDetailPage: selectDocumentForComponent called', {
      documentId,
      componentKeyToAdd: state.componentKeyToAdd,
      isCreating: state.isCreating,
      selectedDocument: state.selectedDocument ? { 
        id: state.selectedDocument.id, 
        title: state.selectedDocument.title,
        components: state.selectedDocument.components 
      } : null,
      formDataComponents: state.formData.components
    });
    
    if (state.componentKeyToAdd) {
      // Use formData.components for both creation and editing modes
      const currentComponents = state.isCreating ? state.formData.components : state.selectedDocument?.components || {};
      const updatedComponents = {
        ...currentComponents,
        [state.componentKeyToAdd]: documentId
      };
      console.debug('ProjectDetailPage: Updating components', {
        previousComponents: currentComponents,
        updatedComponents,
        componentKey: state.componentKeyToAdd
      });
      
      state.setFormData(prev => ({ ...prev, components: updatedComponents }));
      state.closeModal('showDocumentPicker');
      state.setComponentKeyToAdd(null);
      console.debug('ProjectDetailPage: Selection completed, modal closed');
    } else {
      console.debug('ProjectDetailPage: Selection failed - missing componentKeyToAdd', {
        hasComponentKey: !!state.componentKeyToAdd
      });
    }
  };

  const selectGroupForComponent = (groupId: string) => {
    console.debug('ProjectDetailPage: selectGroupForComponent called', {
      groupId,
      componentKeyToAdd: state.componentKeyToAdd,
      isCreating: state.isCreating
    });
    
    if (state.componentKeyToAdd) {
      // Use formData.components for both creation and editing modes
      const currentComponents = state.isCreating ? state.formData.components : state.selectedDocument?.components || {};
      const updatedComponents = {
        ...currentComponents,
        [state.componentKeyToAdd]: `group:${groupId}`
      };
      console.debug('ProjectDetailPage: Updating components with group', {
        previousComponents: currentComponents,
        updatedComponents,
        componentKey: state.componentKeyToAdd
      });
      
      state.setFormData(prev => ({ ...prev, components: updatedComponents }));
      state.closeModal('showGroupPicker');
      state.setComponentKeyToAdd(null);
      console.debug('ProjectDetailPage: Group selection completed, modal closed');
    } else {
      console.debug('ProjectDetailPage: Group selection failed - missing componentKeyToAdd');
    }
  };

  const openGroupSwitcher = (componentKey: string, groupId: string) => {
    state.setSwitcherComponentKey(componentKey);
    state.setSwitcherGroupId(groupId);
    state.openModal('showGroupSwitcher');
  };

  const switchGroupType = (componentKey: string, groupId: string, preferredType?: string) => {
    console.debug('ProjectDetailPage: switchGroupType called', {
      componentKey,
      groupId,
      preferredType,
      isCreating: state.isCreating
    });
    
    // Use formData.components for both creation and editing modes
    const currentComponents = state.isCreating ? state.formData.components : state.selectedDocument?.components || {};
    const updatedComponents = {
      ...currentComponents,
      [componentKey]: preferredType ? `group:${groupId}:${preferredType}` : `group:${groupId}`
    };
    console.debug('ProjectDetailPage: Switching group type', {
      previousComponents: currentComponents,
      updatedComponents
    });
    
    state.setFormData(prev => ({ ...prev, components: updatedComponents }));
    state.closeModal('showGroupSwitcher');
    state.setSwitcherComponentKey(null);
    state.setSwitcherGroupId(null);
    console.debug('ProjectDetailPage: Group type switch completed');
  };

  const openTagSelector = (documentId: string) => {
    state.setTagSelectorDocumentId(documentId);
    state.openModal('showTagSelector');
  };

  const closeTagSelector = () => {
    state.closeModal('showTagSelector');
    state.setTagSelectorDocumentId(null);
    operations.loadDocuments();
  };

  const openEventSelector = (document: Document) => {
    state.setEventSelectorDocument(document);
    state.openModal('showEventSelector');
  };

  const closeEventSelector = () => {
    state.closeModal('showEventSelector');
    state.setEventSelectorDocument(null);
    operations.loadDocuments();
  };

  const openDocumentEvolution = (document: Document) => {
    state.setEvolutionDocument(document);
    state.openModal('showDocumentEvolution');
  };

  const closeDocumentEvolution = () => {
    state.closeModal('showDocumentEvolution');
    state.setEvolutionDocument(null);
  };


  const removeComponent = (key: string) => {
    const newComponents = { ...state.formData.components };
    delete newComponents[key];
    state.setFormData({ ...state.formData, components: newComponents });
  };

  const handleSidebarDocumentClick = (document: Document) => {
    state.setSelectedDocument(document);
    state.setIsEditing(false);
    state.setResolvedContent(null);
    state.setSidebarOpen(false);
  };

  const handleSidebarDocumentEdit = (document: Document) => {
    state.startEdit(document);
    state.setSidebarOpen(false);
  };

  const handleDocumentRename = (document: Document) => {
    const newTitle = prompt('Enter new document title:', document.title);
    if (newTitle && newTitle.trim() && newTitle.trim() !== document.title) {
      const formData = {
        title: newTitle.trim(),
        content: document.content || '',
        document_type: document.document_type || '',
        is_composite: document.is_composite,
        is_prompt: document.is_prompt,
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
      onToggleSidebar: () => state.setSidebarOpen(!state.sidebarOpen),
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
  }, [setProjectActions, state.setSidebarOpen, rightSidebarCollapsed, rightSidebarMobileOpen]);

  if (state.loading) return <div className="loading">Loading documents...</div>;

  return (
    <div className="project-detail-page">
      
      {/* Mobile overlays */}
      {state.sidebarOpen && <div className="sidebar-overlay" onClick={() => state.setSidebarOpen(false)} />}
      {rightSidebarMobileOpen && <div className="sidebar-overlay" onClick={() => setRightSidebarMobileOpen(false)} />}
      
      {/* Left Sidebar - Documents Only */}
      <div className={`left-sidebar ${state.sidebarOpen ? 'left-sidebar--open' : ''} ${leftSidebarCollapsed ? 'left-sidebar--collapsed' : ''}`}>
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
              onClick={() => state.setSidebarOpen(false)}
            >
              ×
            </button>
          </div>
        </div>
        
        {/* Create Document Button */}
        <div className="left-sidebar__create-section">
          <button 
            className="btn btn--primary btn--full-width"
            onClick={() => {
              state.startCreate();
              state.setSidebarOpen(false);
              setRightSidebarMobileOpen(false);
            }}
            title="Create new document"
          >
            + Create Document
          </button>
        </div>
        
        {state.error && (
          <div className="error-message">
            {state.error}
            <button onClick={() => state.setError(null)}>×</button>
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
            events={state.events}
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
            selectedDocumentId={state.selectedDocument?.id}
            onDocumentClick={handleSidebarDocumentClick}
            onDocumentEdit={handleSidebarDocumentEdit}
            onDocumentRename={handleDocumentRename}
            onDocumentDelete={operations.handleDeleteDocument}
            onCreateDerivative={handleCreateDerivative}
            onManageTags={(document) => openTagSelector(document.id)}
            onManageEvents={openEventSelector}
            onDocumentEvolution={openDocumentEvolution}
            emptyMessage={sidebarFilter.hasActiveFilters ? "No documents match your filters." : "No documents found. Create your first document!"}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        <div className="main-content__body">
          <div className="main-content__inner">
            {(state.isCreating || state.isEditing) && (
              <DocumentForm
                formData={state.formData}
                setFormData={state.setFormData}
                onSave={state.isCreating ? handleCreateDocument : handleUpdateDocument}
                onCancel={state.cancelEdit}
                addComponent={addComponent}
                removeComponent={removeComponent}
                onOpenGroupSwitcher={openGroupSwitcher}
                isCreating={state.isCreating}
                documents={state.documents}
                aiProviders={aiProviders}
              />
            )}
            
            {!state.isCreating && !state.isEditing && state.selectedDocument && (
              state.selectedDocument.is_prompt ? (
                <PromptDocumentViewer
                  document={state.selectedDocument}
                  resolvedContent={state.resolvedContent}
                  onResolve={() => state.selectedDocument && operations.handleResolveDocument(state.selectedDocument)}
                  aiProviders={aiProviders}
                  accessToken={accessToken}
                  projectId={projectId!}
                  allDocuments={state.documents}
                  onCreateFromSelection={(selectedText, selectionInfo, title, documentType, groupId) => 
                    state.selectedDocument && operations.handleCreateFromSelection(state.selectedDocument, selectedText, selectionInfo, title, documentType, groupId)
                  }
                  onRefreshDocument={() => {
                    if (state.selectedDocument) {
                      operations.loadDocuments();
                      loadAiProviders(); // Refresh credits after AI request
                    }
                  }}
                />
              ) : (
                <DocumentViewer
                  document={state.selectedDocument}
                  allDocuments={state.documents}
                  resolvedContent={state.resolvedContent}
                  onResolve={() => state.selectedDocument && operations.handleResolveDocument(state.selectedDocument)}
                  onCreateFromSelection={(selectedText, selectionInfo, title, documentType, groupId) => 
                    state.selectedDocument && operations.handleCreateFromSelection(state.selectedDocument, selectedText, selectionInfo, title, documentType, groupId)
                  }
                  onDocumentSelect={(document) => {
                    state.setSelectedDocument(document);
                    state.setResolvedContent(null);
                  }}
                  onTagUpdate={async () => {
                    await operations.loadDocuments();
                    // Force re-render by getting fresh document data
                    if (state.selectedDocument) {
                      // Since loadDocuments updates state.documents, we need to wait for the next render cycle
                      setTimeout(() => {
                        const updatedDoc = state.documents.find(d => d.id === state.selectedDocument!.id);
                        if (updatedDoc) {
                          state.setSelectedDocument(updatedDoc);
                        }
                      }, 0);
                    }
                  }}
                  projectId={projectId || ''}
                  loadDocumentHistory={operations.loadDocumentHistory}
                  loadHistoryEntry={operations.loadHistoryEntry}
                  onRollback={operations.handleRollbackDocument}
                />
              )
            )}
            
            {!state.isCreating && !state.isEditing && !state.selectedDocument && (
              <div className="empty-state">
                <h3>Select a document to view or create a new one</h3>
                <button 
                  className="btn btn--primary"
                  onClick={() => state.setSidebarOpen(true)}
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
                availableTags={state.tags}
              />
            </div>
          )}
          
          {/* Tags Management Widget */}
          <div className="widget">
            <div className="widget__header">
              <h4>Project Tags ({state.tags.length})</h4>
              <button 
                className="btn btn--sm btn--secondary"
                onClick={() => state.openModal('showTagManager')}
              >
                Manage
              </button>
            </div>
            
            <div className="widget__content">
              {/* Tag Filter and Create Interface */}
              {projectId && (
                <ProjectTagsFilter
                  projectId={projectId}
                  tags={state.tags}
                  onTagCreated={() => {
                    operations.loadTags();
                  }}
                  onFilterChange={setFilteredTags}
                />
              )}
              
              {state.tags.length === 0 ? (
                <div className="empty-state">
                  <p>No tags created yet.</p>
                  <p>Use the button above to create your first tag.</p>
                </div>
              ) : (
                <div className="tags-grid tags-grid--compact">
                  {filteredTags.map(tag => {
                    const isInFilter = sidebarFilter.tagFilterConditions.some(condition => condition.tagId === tag.id);
                    return (
                      <button 
                        key={tag.id}
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
                  events={state.events}
                  onEventsChange={loadEvents}
                  onTimelineClick={() => state.openModal('showEventTimeline')}
                  externalTagFilters={sidebarFilter.tagFilterConditions}
                  onEventClick={(eventId) => {
                    // Apply event filter to document selection
                    sidebarFilter.setSelectedEventIds([eventId]);
                  }}
                  onDocumentView={(document) => {
                    state.closeAllModals(); // Close all modals first
                    state.setSelectedDocument(document);
                    state.setIsEditing(false);
                    state.setResolvedContent(null);
                  }}
                  onDocumentEdit={(document) => {
                    state.closeAllModals(); // Close all modals first
                    state.startEdit(document);
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
              <h4>📡 Presets ({state.presets.length})</h4>
              <div className="presets-widget__actions">
                <button 
                  className="btn btn--xs btn--secondary"
                  onClick={() => state.openModal('showPresetPicker')}
                >
                  ＋
                </button>
              </div>
            </div>
            
            <div className="presets-widget__content">
              {state.presets.length === 0 ? (
                <div className="empty-state empty-state--compact">
                  <p>No presets yet</p>
                  <p>Create presets to publish documents as external API endpoints.</p>
                </div>
              ) : (
                <div className="preset-cards">
                  {state.presets.map((preset) => (
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
                                      state.setEditingPreset(preset);
                                      state.openModal('showPresetDashboard');
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
                                      state.setEditingPreset(preset);
                                      state.openModal('showPresetEdit');
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
      {state.modals.showKeyInput && (
        <ComponentKeyInputModal
          value={state.keyInputValue}
          onChange={state.setKeyInputValue}
          onConfirm={confirmComponentKey}
          onCancel={() => state.closeModal('showKeyInput')}
        />
      )}
      
      {/* Document Picker Modal */}
      {state.modals.showDocumentPicker && (
        <DocumentPickerModal
          documents={state.isCreating ? state.documents : state.documents.filter(doc => doc.id !== state.selectedDocument?.id)}
          componentKey={state.componentKeyToAdd}
          onSelect={selectDocumentForComponent}
          onCancel={() => state.closeModal('showDocumentPicker')}
        />
      )}

      {/* Derivative Modal */}
      {state.modals.showDerivativeModal && (
        <DerivativeModal
          sourceDocument={state.sourceDocument}
          onConfirm={handleDerivativeCreation}
          onCancel={() => state.closeModal('showDerivativeModal')}
        />
      )}

      {/* Component Type Selector Modal */}
      {state.modals.showComponentTypeSelector && (
        <ComponentTypeSelectorModal
          componentKey={state.componentKeyToAdd}
          onSelect={selectComponentType}
          onCancel={() => state.closeModal('showComponentTypeSelector')}
        />
      )}

      {/* Group Picker Modal */}
      {state.modals.showGroupPicker && (
        <GroupPickerModal
          documents={state.documents}
          componentKey={state.componentKeyToAdd}
          onSelect={selectGroupForComponent}
          onCancel={() => state.closeModal('showGroupPicker')}
        />
      )}

      {/* Group Switcher Modal */}
      {state.modals.showGroupSwitcher && state.switcherGroupId && state.switcherComponentKey && projectId && (
        <GroupSwitcherModal
          projectId={projectId}
          groupId={state.switcherGroupId}
          componentKey={state.switcherComponentKey}
          currentReference={state.selectedDocument?.components?.[state.switcherComponentKey] || ''}
          onSwitch={switchGroupType}
          onCancel={() => state.closeModal('showGroupSwitcher')}
        />
      )}

      {/* Preset Picker Modal */}
      {state.modals.showPresetPicker && (
        <PresetPickerModal
          documents={state.documents}
          onSelect={handleCreatePreset}
          onCancel={() => state.closeModal('showPresetPicker')}
        />
      )}

      {/* Preset Edit Modal */}
      {state.modals.showPresetEdit && state.editingPreset && (
        <PresetEditModal
          preset={state.editingPreset}
          documents={state.documents}
          onSave={async (presetId, name, documentId) => {
            await operations.handleUpdatePreset(presetId, name, documentId);
            state.setEditingPreset(null);
            state.closeModal('showPresetEdit');
          }}
          onCancel={() => {
            state.setEditingPreset(null);
            state.closeModal('showPresetEdit');
          }}
        />
      )}

      {/* Preset Dashboard Modal */}
      {state.modals.showPresetDashboard && state.editingPreset && (
        <PresetDashboardModal
          preset={state.editingPreset}
          documents={state.documents}
          onSave={async (presetId, overrides) => {
            await operations.handleUpdatePresetOverrides(presetId, overrides);
            await operations.loadPresets(); // Reload presets to get full document data
            state.setEditingPreset(null);
            state.closeModal('showPresetDashboard');
          }}
          onCancel={() => {
            state.setEditingPreset(null);
            state.closeModal('showPresetDashboard');
          }}
        />
      )}

      {/* Tag Manager Modal */}
      {state.modals.showTagManager && projectId && (
        <TagManager
          projectId={projectId}
          onClose={() => {
            state.closeModal('showTagManager');
            operations.loadTags();
          }}
        />
      )}

      {/* Tag Selector Modal */}
      {state.modals.showTagSelector && state.tagSelectorDocumentId && projectId && (
        <TagSelector
          projectId={projectId}
          entityType="document"
          entityId={state.tagSelectorDocumentId}
          entityName={state.documents.find((d: any) => d.id === state.tagSelectorDocumentId)?.title || 'Document'}
          onClose={closeTagSelector}
          onUpdate={operations.loadDocuments}
        />
      )}

      {/* Event Selector Modal */}
      {state.modals.showEventSelector && state.eventSelectorDocument && projectId && (
        <EventSelector
          projectId={projectId}
          document={state.eventSelectorDocument}
          onClose={closeEventSelector}
          onUpdate={loadEvents}
        />
      )}

      {/* Event Timeline Modal */}
      {state.modals.showEventTimeline && projectId && (
        <EventTimelineModal
          projectId={projectId}
          onClose={() => state.closeModal('showEventTimeline')}
          onCloseAllModals={state.closeAllModals}
          onDocumentView={(document) => {
            state.closeAllModals(); // Close all modals first
            state.setSelectedDocument(document);
            state.setIsEditing(false);
            state.setResolvedContent(null);
          }}
          onDocumentEdit={(document) => {
            state.closeAllModals(); // Close all modals first
            state.startEdit(document);
          }}
          onDocumentDelete={(documentId) => {
            operations.handleDeleteDocument(documentId);
          }}
          onEventsChange={loadEvents}
        />
      )}

      {/* Document Evolution Modal */}
      {state.modals.showDocumentEvolution && state.evolutionDocument && projectId && (
        <div className="modal-overlay">
          <div className="modal-content modal-content--large">
            <div className="modal-header">
              <h3>Document Evolution - {state.evolutionDocument.title}</h3>
              <button className="modal-close" onClick={closeDocumentEvolution}>&times;</button>
            </div>
            <div className="modal-body">
              <DocumentEvolution
                projectId={projectId}
                document={state.evolutionDocument}
                onClose={closeDocumentEvolution}
                onShowDocument={(doc) => {
                  state.setSelectedDocument(doc);
                  state.setIsEditing(false);
                  state.setResolvedContent(null);
                }}
                onEditDocument={(doc) => {
                  state.startEdit(doc);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Project Settings Modal */}
      {showProjectSettings && currentProject && (
        <ProjectSettingsModal
          project={currentProject}
          onClose={() => setShowProjectSettings(false)}
          onProjectUpdate={loadProject}
        />
      )}
    </div>
  );
}







