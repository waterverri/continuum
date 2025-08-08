import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Document } from '../api';
import { useProjectActions } from '../App';
import { useProjectDetailState } from '../hooks/useProjectDetailState';
import { useDocumentOperations } from '../hooks/useDocumentOperations';
import { useDocumentFilter } from '../hooks/useDocumentFilter';
import { DocumentForm } from '../components/DocumentForm';
import { DocumentViewer } from '../components/DocumentViewer';
import { DocumentList } from '../components/DocumentList';
import { DocumentFilters } from '../components/DocumentFilters';
import { DocumentPickerModal } from '../components/DocumentPickerModal';
import { ComponentKeyInputModal } from '../components/ComponentKeyInputModal';
import { DerivativeModal } from '../components/DerivativeModal';
import { ComponentTypeSelectorModal } from '../components/ComponentTypeSelectorModal';
import { GroupPickerModal } from '../components/GroupPickerModal';
import { PresetPickerModal } from '../components/PresetPickerModal';
import { GroupSwitcherModal } from '../components/GroupSwitcherModal';
import { TagManager } from '../components/TagManager';
import { TagSelector } from '../components/TagSelector';
import { TagFilter } from '../components/TagFilter';
import { EventSelector } from '../components/EventSelector';
import { EventsWidget } from '../components/EventsWidget';
import { EventTimelineModal } from '../components/EventTimelineModal';
import { EventFilter } from '../components/EventFilter';
import { DocumentEvolution } from '../components/DocumentEvolution';
import '../styles/ProjectDetailPage.css';


export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  
  // Get project actions context
  const { setProjectActions } = useProjectActions();
  
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
  }, []);

  const getPresetUrl = (presetName: string) => {
    return `${import.meta.env.VITE_API_URL}/preset/${projectId}/${presetName}`;
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
    state.closeModal('showComponentTypeSelector');
    if (type === 'document') {
      state.openModal('showDocumentPicker');
    } else {
      state.openModal('showGroupPicker');
    }
  };

  const selectDocumentForComponent = (documentId: string) => {
    if (state.componentKeyToAdd && state.selectedDocument) {
      const updatedComponents = {
        ...state.selectedDocument.components,
        [state.componentKeyToAdd]: documentId
      };
      state.setFormData(prev => ({ ...prev, components: updatedComponents }));
      state.closeModal('showDocumentPicker');
      state.setComponentKeyToAdd(null);
    }
  };

  const selectGroupForComponent = (groupId: string) => {
    if (state.componentKeyToAdd && state.selectedDocument) {
      const updatedComponents = {
        ...state.selectedDocument.components,
        [state.componentKeyToAdd]: `group:${groupId}`
      };
      state.setFormData(prev => ({ ...prev, components: updatedComponents }));
      state.closeModal('showGroupPicker');
      state.setComponentKeyToAdd(null);
    }
  };

  const openGroupSwitcher = (componentKey: string, groupId: string) => {
    state.setSwitcherComponentKey(componentKey);
    state.setSwitcherGroupId(groupId);
    state.openModal('showGroupSwitcher');
  };

  const switchGroupType = (componentKey: string, groupId: string, preferredType?: string) => {
    const updatedComponents = {
      ...state.selectedDocument?.components,
      [componentKey]: preferredType ? `group:${groupId}:${preferredType}` : `group:${groupId}`
    };
    state.setFormData(prev => ({ ...prev, components: updatedComponents }));
    state.closeModal('showGroupSwitcher');
    state.setSwitcherComponentKey(null);
    state.setSwitcherGroupId(null);
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

  // Provide action handlers to the app header through context
  useEffect(() => {
    setProjectActions({
      onCreateDocument: () => {
        state.startCreate();
        state.setSidebarOpen(false);
        setRightSidebarMobileOpen(false);
      },
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
  }, [setProjectActions, state.startCreate, state.setSidebarOpen, rightSidebarCollapsed, rightSidebarMobileOpen]);

  if (state.loading) return <div className="loading">Loading documents...</div>;

  return (
    <div className="project-detail-page">
      
      {/* Mobile overlays */}
      {state.sidebarOpen && <div className="sidebar-overlay" onClick={() => state.setSidebarOpen(false)} />}
      {rightSidebarMobileOpen && <div className="sidebar-overlay" onClick={() => setRightSidebarMobileOpen(false)} />}
      
      {/* Left Sidebar - Documents Only */}
      <div className={`left-sidebar ${state.sidebarOpen ? 'left-sidebar--open' : ''} ${leftSidebarCollapsed ? 'left-sidebar--collapsed' : ''}`}>
        <div className="left-sidebar__header">
          <h2>Documents</h2>
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
          
          {projectId && (
            <TagFilter 
              projectId={projectId}
              selectedTagIds={sidebarFilter.selectedTagIds}
              onTagSelectionChange={sidebarFilter.setSelectedTagIds}
            />
          )}
          
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
          <DocumentList
            documents={sidebarFilter.filteredDocuments}
            allDocuments={state.documents}
            selectedDocumentId={state.selectedDocument?.id}
            onDocumentClick={handleSidebarDocumentClick}
            onDocumentEdit={handleSidebarDocumentEdit}
            onDocumentDelete={operations.handleDeleteDocument}
            onCreateDerivative={handleCreateDerivative}
            onManageTags={(document) => openTagSelector(document.id)}
            onManageEvents={openEventSelector}
            onDocumentEvolution={openDocumentEvolution}
            variant="sidebar"
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
              />
            )}
            
            {!state.isCreating && !state.isEditing && state.selectedDocument && (
              <DocumentViewer
                document={state.selectedDocument}
                resolvedContent={state.resolvedContent}
                onResolve={() => state.selectedDocument && operations.handleResolveDocument(state.selectedDocument)}
              />
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
          {/* Tags Widget */}
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
              {state.tags.length === 0 ? (
                <div className="empty-state">
                  <p>No tags created yet.</p>
                  <p>Create tags to organize your documents.</p>
                </div>
              ) : (
                <div className="tags-grid">
                  {state.tags.map(tag => (
                    <span 
                      key={tag.id}
                      className="tag-badge"
                      style={{ backgroundColor: tag.color, color: 'white' }}
                    >
                      {tag.name}
                    </span>
                  ))}
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
                />
              )}
            </div>
          </div>
          
          {/* Presets Widget */}
          <div className="widget">
            <div className="widget__header">
              <h4>Published Presets ({state.presets.length})</h4>
              <button 
                className="btn btn--sm btn--secondary"
                onClick={() => state.openModal('showPresetPicker')}
              >
                + Create
              </button>
            </div>
            
            <div className="widget__content">
              {state.presets.length === 0 ? (
                <div className="empty-state">
                  <p>No presets created yet.</p>
                  <p>Create a preset to publish a document as an external API endpoint.</p>
                </div>
              ) : (
                <div className="presets-list">
                  {state.presets.map((preset) => (
                    <div key={preset.id} className="preset-card">
                      <div className="preset-card__header">
                        <h5>{preset.name}</h5>
                        <button 
                          className="btn btn--xs btn--danger"
                          onClick={() => operations.handleDeletePreset(preset.id)}
                        >
                          ×
                        </button>
                      </div>
                      <div className="preset-card__meta">
                        {preset.document?.title || 'Unknown'}
                      </div>
                      <div className="preset-card__actions">
                        <button 
                          className="btn btn--xs"
                          onClick={() => navigator.clipboard.writeText(getPresetUrl(preset.name))}
                        >
                          Copy URL
                        </button>
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
          documents={state.documents.filter(doc => doc.id !== state.selectedDocument?.id)}
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
          documentId={state.tagSelectorDocumentId}
          onClose={closeTagSelector}
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
    </div>
  );
}







