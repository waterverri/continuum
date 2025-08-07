import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  getDocuments, 
  createDocument, 
  updateDocument, 
  deleteDocument, 
  getDocument,
  getPresets,
  createPreset,
  deletePreset,
  getTags,
  getDocumentTags,
} from '../api';
import type { Document, Preset, Tag } from '../api';
import { GroupSwitcherModal } from '../components/GroupSwitcherModal';
import { TagManager } from '../components/TagManager';
import { TagSelector } from '../components/TagSelector';
import { TagFilter } from '../components/TagFilter';
import { useDocumentFilter } from '../hooks/useDocumentFilter';
import '../styles/ProjectDetailPage.css';

interface DocumentFormData {
  title: string;
  content: string;
  document_type: string;
  is_composite: boolean;
  components: Record<string, string>;
  group_id?: string;
}


// Document Search Input Component
interface DocumentSearchInputProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
}

function DocumentSearchInput({ searchTerm, onSearchChange, placeholder = 'Search documents...' }: DocumentSearchInputProps) {
  return (
    <div className="filter-group">
      <input
        type="text"
        className="filter-input"
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>
  );
}

// Document Type Filter Component
interface DocumentTypeFilterProps {
  typeFilter: string;
  onTypeChange: (value: string) => void;
  availableTypes: string[];
}

function DocumentTypeFilter({ typeFilter, onTypeChange, availableTypes }: DocumentTypeFilterProps) {
  return (
    <select 
      className="filter-select"
      value={typeFilter}
      onChange={(e) => onTypeChange(e.target.value)}
    >
      <option value="">All Types</option>
      {availableTypes.map(type => (
        <option key={type} value={type}>{type}</option>
      ))}
    </select>
  );
}

// Document Format Filter Component
interface DocumentFormatFilterProps {
  formatFilter: string;
  onFormatChange: (value: string) => void;
}

function DocumentFormatFilter({ formatFilter, onFormatChange }: DocumentFormatFilterProps) {
  return (
    <select 
      className="filter-select"
      value={formatFilter}
      onChange={(e) => onFormatChange(e.target.value)}
    >
      <option value="">All Formats</option>
      <option value="static">Static Documents</option>
      <option value="composite">Composite Documents</option>
    </select>
  );
}

// Combined Filters Component
interface DocumentFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  typeFilter: string;
  onTypeChange: (value: string) => void;
  formatFilter: string;
  onFormatChange: (value: string) => void;
  availableTypes: string[];
  searchPlaceholder?: string;
  showFilters?: boolean;
}

function DocumentFilters({ 
  searchTerm, 
  onSearchChange, 
  typeFilter, 
  onTypeChange, 
  formatFilter, 
  onFormatChange, 
  availableTypes,
  searchPlaceholder,
  showFilters = true
}: DocumentFiltersProps) {
  return (
    <div className="modal-filters">
      <DocumentSearchInput 
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        placeholder={searchPlaceholder}
      />
      
      {showFilters && (
        <div className="filter-row">
          <DocumentTypeFilter 
            typeFilter={typeFilter}
            onTypeChange={onTypeChange}
            availableTypes={availableTypes}
          />
          <DocumentFormatFilter 
            formatFilter={formatFilter}
            onFormatChange={onFormatChange}
          />
        </div>
      )}
    </div>
  );
}

// Document List Item Component
interface DocumentListItemProps {
  document: Document;
  allDocuments?: Document[];
  isSelected?: boolean;
  onClick?: (document: Document) => void;
  showPreview?: boolean;
  showActions?: boolean;
  onEdit?: (document: Document) => void;
  onDelete?: (documentId: string) => void;
  onCreateDerivative?: (document: Document) => void;
  onManageTags?: (document: Document) => void;
  variant?: 'sidebar' | 'picker';
}

function DocumentListItem({ 
  document, 
  allDocuments = [],
  isSelected = false, 
  onClick, 
  showPreview = false,
  showActions = false,
  onEdit,
  onDelete,
  onCreateDerivative,
  onManageTags,
  variant = 'sidebar'
}: DocumentListItemProps) {
  const handleClick = () => {
    if (onClick) {
      onClick(document);
    }
  };

  const getGroupInfo = () => {
    if (!document.group_id) return null;
    
    const groupMembers = allDocuments.filter(doc => doc.group_id === document.group_id);
    const memberCount = groupMembers.length;
    
    if (memberCount <= 1) return null;
    
    const groupTypes = [...new Set(groupMembers.map(doc => doc.document_type).filter(Boolean))];
    
    return {
      count: memberCount,
      types: groupTypes,
      groupId: document.group_id
    };
  };

  const groupInfo = getGroupInfo();

  const className = variant === 'sidebar' 
    ? `document-item ${isSelected ? 'document-item--selected' : ''}` 
    : 'document-picker-item';

  return (
    <div className={className} onClick={handleClick}>
      <div className={variant === 'sidebar' ? 'document-item__header' : 'document-picker-header'}>
        <h4>{document.title}</h4>
        <span className={variant === 'sidebar' ? 'document-item__meta' : 'document-picker-meta'}>
          {document.is_composite ? '🔗 Composite' : '📄 Static'}
          {document.document_type && ` • ${document.document_type}`}
          {groupInfo && (
            <span 
              className="group-indicator" 
              title={`Part of group with ${groupInfo.count} members: ${groupInfo.types.join(', ')}`}
            >
              {' • '}👥 Group ({groupInfo.count})
            </span>
          )}
        </span>
      </div>
      
      {/* Tags display */}
      {document.tags && document.tags.length > 0 && (
        <div className={variant === 'sidebar' ? 'document-item__tags' : 'document-picker-tags'}>
          {document.tags.slice(0, 3).map(tag => (
            <span 
              key={tag.id}
              className="tag-badge tag-badge--xs"
              style={{ backgroundColor: tag.color, color: 'white' }}
              title={tag.name}
            >
              {tag.name}
            </span>
          ))}
          {document.tags.length > 3 && (
            <span className="tag-badge tag-badge--xs tag-badge--more">
              +{document.tags.length - 3}
            </span>
          )}
        </div>
      )}
      
      {showPreview && document.content && (
        <div className="document-picker-preview">
          {document.content.substring(0, 150)}
          {document.content.length > 150 && '...'}
        </div>
      )}
      
      {variant === 'picker' && (
        <div className="document-picker-id">
          ID: {document.id.substring(0, 8)}...
        </div>
      )}
      
      {showActions && (
        <div className="document-item__actions">
          {onEdit && (
            <button 
              className="btn btn--sm"
              onClick={(e) => { 
                e.stopPropagation(); 
                onEdit(document); 
              }}
            >
              Edit
            </button>
          )}
          {onCreateDerivative && (
            <button 
              className="btn btn--sm btn--secondary"
              onClick={(e) => { 
                e.stopPropagation(); 
                onCreateDerivative(document); 
              }}
            >
              + Derivative
            </button>
          )}
          {onManageTags && (
            <button 
              className="btn btn--sm btn--secondary"
              onClick={(e) => { 
                e.stopPropagation(); 
                onManageTags(document); 
              }}
            >
              Tags
            </button>
          )}
          {onDelete && (
            <button 
              className="btn btn--sm btn--danger"
              onClick={(e) => { 
                e.stopPropagation(); 
                onDelete(document.id); 
              }}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Document List Component
interface DocumentListProps {
  documents: Document[];
  allDocuments?: Document[];
  selectedDocumentId?: string;
  onDocumentClick?: (document: Document) => void;
  onDocumentEdit?: (document: Document) => void;
  onDocumentDelete?: (documentId: string) => void;
  onCreateDerivative?: (document: Document) => void;
  onManageTags?: (document: Document) => void;
  variant?: 'sidebar' | 'picker';
  emptyMessage?: string;
}

function DocumentList({ 
  documents, 
  allDocuments,
  selectedDocumentId, 
  onDocumentClick, 
  onDocumentEdit, 
  onDocumentDelete,
  onCreateDerivative,
  onManageTags,
  variant = 'sidebar',
  emptyMessage = 'No documents found.'
}: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="empty-state">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={variant === 'sidebar' ? 'document-list' : 'document-picker-list'}>
      {documents.map(doc => (
        <DocumentListItem
          key={doc.id}
          document={doc}
          allDocuments={allDocuments || documents}
          isSelected={selectedDocumentId === doc.id}
          onClick={onDocumentClick}
          onEdit={onDocumentEdit}
          onDelete={onDocumentDelete}
          onCreateDerivative={onCreateDerivative}
          onManageTags={onManageTags}
          showPreview={variant === 'picker'}
          showActions={variant === 'sidebar'}
          variant={variant}
        />
      ))}
    </div>
  );
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [resolvedContent, setResolvedContent] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showDocumentPicker, setShowDocumentPicker] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [componentKeyToAdd, setComponentKeyToAdd] = useState<string | null>(null);
  const [keyInputValue, setKeyInputValue] = useState('');
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const [showDerivativeModal, setShowDerivativeModal] = useState(false);
  const [sourceDocument, setSourceDocument] = useState<Document | null>(null);
  const [showComponentTypeSelector, setShowComponentTypeSelector] = useState(false);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [showGroupSwitcher, setShowGroupSwitcher] = useState(false);
  const [switcherComponentKey, setSwitcherComponentKey] = useState<string | null>(null);
  const [switcherGroupId, setSwitcherGroupId] = useState<string | null>(null);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [tagSelectorDocumentId, setTagSelectorDocumentId] = useState<string | null>(null);
  const [formData, setFormData] = useState<DocumentFormData>({
    title: '',
    content: '',
    document_type: '',
    is_composite: false,
    components: {},
    group_id: undefined
  });
  
  // Use document filter hook for sidebar
  const sidebarFilter = useDocumentFilter(documents);

  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const loadDocuments = useCallback(async () => {
    if (!projectId) return;
    
    try {
      setLoading(true);
      const token = await getAccessToken();
      const docs = await getDocuments(projectId, token);
      
      // Load tags for each document
      const docsWithTags = await Promise.all(
        docs.map(async (doc) => {
          try {
            const docTags = await getDocumentTags(projectId, doc.id, token);
            return { ...doc, tags: docTags };
          } catch (err) {
            console.error(`Failed to load tags for document ${doc.id}:`, err);
            return { ...doc, tags: [] };
          }
        })
      );
      
      setDocuments(docsWithTags);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadPresets = useCallback(async () => {
    if (!projectId) return;
    
    try {
      const token = await getAccessToken();
      const presets = await getPresets(projectId, token);
      setPresets(presets);
    } catch (err) {
      console.error('Failed to load presets:', err);
    }
  }, [projectId]);

  const loadTags = useCallback(async () => {
    if (!projectId) return;
    
    try {
      const token = await getAccessToken();
      const projectTags = await getTags(projectId, token);
      setTags(projectTags);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  }, [projectId]);

  useEffect(() => {
    loadDocuments();
    loadPresets();
    loadTags();
  }, [loadDocuments, loadPresets, loadTags]);

  const handleCreateDocument = async () => {
    if (!projectId) return;
    
    try {
      const token = await getAccessToken();
      const newDoc = await createDocument(projectId, formData, token);
      setDocuments([newDoc, ...documents]);
      setIsCreating(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create document');
    }
  };

  const handleUpdateDocument = async () => {
    if (!projectId || !selectedDocument) return;
    
    try {
      const token = await getAccessToken();
      const updatedDoc = await updateDocument(projectId, selectedDocument.id, formData, token);
      setDocuments(documents.map(doc => doc.id === updatedDoc.id ? updatedDoc : doc));
      setSelectedDocument(updatedDoc);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update document');
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!projectId || !confirm('Are you sure you want to delete this document?')) return;
    
    try {
      const token = await getAccessToken();
      await deleteDocument(projectId, documentId, token);
      setDocuments(documents.filter(doc => doc.id !== documentId));
      if (selectedDocument?.id === documentId) {
        setSelectedDocument(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  const handleResolveDocument = async (doc: Document) => {
    if (!projectId || !doc.is_composite) return;
    
    try {
      const token = await getAccessToken();
      const resolvedDoc = await getDocument(projectId, doc.id, token, true);
      setResolvedContent(resolvedDoc.resolved_content || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve document');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      document_type: '',
      is_composite: false,
      components: {},
      group_id: undefined
    });
  };

  const handleCreatePreset = async (name: string, document: Document) => {
    if (!projectId) return;
    
    try {
      const token = await getAccessToken();
      const newPreset = await createPreset(projectId, name, document.id, token);
      setPresets([newPreset, ...presets]);
      setShowPresetPicker(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create preset');
    }
  };

  const handleDeletePreset = async (presetId: string) => {
    if (!confirm('Are you sure you want to delete this preset?')) return;
    
    try {
      const token = await getAccessToken();
      await deletePreset(presetId, token);
      setPresets(presets.filter(preset => preset.id !== presetId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete preset');
    }
  };

  const getPresetUrl = (presetName: string) => {
    return `${import.meta.env.VITE_API_URL}/preset/${projectId}/${presetName}`;
  };

  const handleCreateDerivative = (document: Document) => {
    setSourceDocument(document);
    setShowDerivativeModal(true);
  };

  const handleDerivativeCreation = async (derivativeType: string, title: string) => {
    if (!projectId || !sourceDocument) return;
    
    try {
      const token = await getAccessToken();
      
      // Create derivative document with same group_id as source
      const groupId = sourceDocument.group_id || sourceDocument.id; // Use source's group_id or create new group
      
      const derivativeDoc = await createDocument(projectId, {
        title,
        content: '', // Start with empty content
        document_type: derivativeType,
        is_composite: false,
        components: {},
        group_id: groupId
      }, token);

      // If source document doesn't have a group_id yet, update it to be part of the same group
      if (!sourceDocument.group_id) {
        await updateDocument(projectId, sourceDocument.id, {
          ...sourceDocument,
          group_id: groupId
        }, token);
        
        // Update local state
        setDocuments(documents.map(doc => 
          doc.id === sourceDocument.id 
            ? { ...doc, group_id: groupId }
            : doc
        ));
      }

      setDocuments([derivativeDoc, ...documents]);
      setShowDerivativeModal(false);
      setSourceDocument(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create derivative document');
    }
  };

  const startEdit = (doc: Document) => {
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
  };

  const addComponent = () => {
    setKeyInputValue('');
    setShowKeyInput(true);
  };

  const confirmComponentKey = () => {
    if (keyInputValue.trim()) {
      setComponentKeyToAdd(keyInputValue.trim());
      setShowKeyInput(false);
      setShowComponentTypeSelector(true);
    }
  };

  const selectComponentType = (type: 'document' | 'group') => {
    setShowComponentTypeSelector(false);
    if (type === 'document') {
      setShowDocumentPicker(true);
    } else {
      setShowGroupPicker(true);
    }
  };

  const cancelComponentTypeSelection = () => {
    setShowComponentTypeSelector(false);
    setComponentKeyToAdd(null);
  };

  const selectDocumentForComponent = (documentId: string) => {
    if (componentKeyToAdd && selectedDocument) {
      const updatedComponents = {
        ...selectedDocument.components,
        [componentKeyToAdd]: documentId
      };
      setFormData(prev => ({ ...prev, components: updatedComponents }));
      setShowDocumentPicker(false);
      setComponentKeyToAdd(null);
    }
  };

  const selectGroupForComponent = (groupId: string) => {
    if (componentKeyToAdd && selectedDocument) {
      const updatedComponents = {
        ...selectedDocument.components,
        [componentKeyToAdd]: `group:${groupId}`
      };
      setFormData(prev => ({ ...prev, components: updatedComponents }));
      setShowGroupPicker(false);
      setComponentKeyToAdd(null);
    }
  };

  const cancelDocumentSelection = () => {
    setShowDocumentPicker(false);
    setComponentKeyToAdd(null);
  };

  const cancelGroupSelection = () => {
    setShowGroupPicker(false);
    setComponentKeyToAdd(null);
  };

  const openGroupSwitcher = (componentKey: string, groupId: string) => {
    setSwitcherComponentKey(componentKey);
    setSwitcherGroupId(groupId);
    setShowGroupSwitcher(true);
  };

  const switchGroupType = (componentKey: string, groupId: string, preferredType?: string) => {
    const updatedComponents = {
      ...selectedDocument?.components,
      [componentKey]: preferredType ? `group:${groupId}:${preferredType}` : `group:${groupId}`
    };
    setFormData(prev => ({ ...prev, components: updatedComponents }));
    setShowGroupSwitcher(false);
    setSwitcherComponentKey(null);
    setSwitcherGroupId(null);
  };

  const cancelGroupSwitcher = () => {
    setShowGroupSwitcher(false);
    setSwitcherComponentKey(null);
    setSwitcherGroupId(null);
  };

  const cancelKeyInput = () => {
    setShowKeyInput(false);
    setKeyInputValue('');
  };

  const openTagSelector = (documentId: string) => {
    setTagSelectorDocumentId(documentId);
    setShowTagSelector(true);
  };

  const closeTagSelector = () => {
    setShowTagSelector(false);
    setTagSelectorDocumentId(null);
    // Reload documents to get updated tags
    loadDocuments();
  };


  const removeComponent = (key: string) => {
    const newComponents = { ...formData.components };
    delete newComponents[key];
    setFormData({ ...formData, components: newComponents });
  };

  const handleSidebarDocumentClick = (document: Document) => {
    setSelectedDocument(document);
    setIsEditing(false);
    setResolvedContent(null);
    setSidebarOpen(false);
  };

  const handleSidebarDocumentEdit = (document: Document) => {
    startEdit(document);
    setSidebarOpen(false);
  };

  if (loading) return <div className="loading">Loading documents...</div>;

  return (
    <div className="project-detail-page">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      
      {/* Sidebar - Document List */}
      <div className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__header">
          <h2>Documents</h2>
          <button 
            className="sidebar__close"
            onClick={() => setSidebarOpen(false)}
          >
            ×
          </button>
        </div>
        
        <div className="sidebar__actions">
          <button 
            className="btn btn--primary"
            onClick={() => {
              setIsCreating(true);
              setSidebarOpen(false);
            }}
          >
            Create New Document
          </button>
        </div>
        
        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}
        
        {/* Document Search and Filters */}
        <div className="sidebar__filters">
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
              compact={true}
            />
          )}
          
          {sidebarFilter.hasActiveFilters && (
            <button 
              className="btn btn--sm btn--secondary"
              onClick={sidebarFilter.resetFilters}
            >
              Clear Filters
            </button>
          )}
        </div>
        
        <DocumentList
          documents={sidebarFilter.filteredDocuments}
          allDocuments={documents}
          selectedDocumentId={selectedDocument?.id}
          onDocumentClick={handleSidebarDocumentClick}
          onDocumentEdit={handleSidebarDocumentEdit}
          onDocumentDelete={handleDeleteDocument}
          onCreateDerivative={handleCreateDerivative}
          onManageTags={(document) => openTagSelector(document.id)}
          variant="sidebar"
          emptyMessage={sidebarFilter.hasActiveFilters ? "No documents match your filters." : "No documents found. Create your first document!"}
        />
        
        {/* Tags Section */}
        <div className="sidebar__section">
          <div className="sidebar__section-header">
            <h3>Project Tags</h3>
            <button 
              className="btn btn--sm btn--secondary"
              onClick={() => setShowTagManager(true)}
            >
              Manage Tags
            </button>
          </div>
          
          {tags.length === 0 ? (
            <div className="empty-state">
              <p>No tags created yet.</p>
              <p>Create tags to organize your documents.</p>
            </div>
          ) : (
            <div className="tags-summary">
              <p>{tags.length} tag{tags.length !== 1 ? 's' : ''} available</p>
              <div className="tags-preview">
                {tags.slice(0, 3).map(tag => (
                  <span 
                    key={tag.id}
                    className="tag-badge tag-badge--sm"
                    style={{ backgroundColor: tag.color, color: 'white' }}
                  >
                    {tag.name}
                  </span>
                ))}
                {tags.length > 3 && <span className="tags-more">+{tags.length - 3} more</span>}
              </div>
            </div>
          )}
        </div>

        {/* Presets Section */}
        <div className="sidebar__section">
          <div className="sidebar__section-header">
            <h3>Published Presets</h3>
            <button 
              className="btn btn--sm btn--secondary"
              onClick={() => setShowPresetPicker(true)}
            >
              + Create Preset
            </button>
          </div>
          
          {presets.length === 0 ? (
            <div className="empty-state">
              <p>No presets created yet.</p>
              <p>Create a preset to publish a document as an external API endpoint.</p>
            </div>
          ) : (
            <div className="preset-list">
              {presets.map((preset) => (
                <div key={preset.id} className="preset-item">
                  <div className="preset-header">
                    <h4>{preset.name}</h4>
                    <button 
                      className="btn btn--sm btn--danger"
                      onClick={() => handleDeletePreset(preset.id)}
                    >
                      Delete
                    </button>
                  </div>
                  <div className="preset-meta">
                    Document: {preset.document?.title || 'Unknown'}
                  </div>
                  <div className="preset-url">
                    <small>API Endpoint:</small>
                    <code className="preset-url-text">{getPresetUrl(preset.name)}</code>
                    <button 
                      className="btn btn--xs"
                      onClick={() => navigator.clipboard.writeText(getPresetUrl(preset.name))}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="sidebar__footer">
          <Link to="/" className="back-link">← Back to All Projects</Link>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        <div className="main-content__header">
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(true)}
          >
            ☰ Documents
          </button>
        </div>
        <div className="main-content__body">
          {(isCreating || isEditing) && (
            <DocumentForm
              formData={formData}
              setFormData={setFormData}
              onSave={isCreating ? handleCreateDocument : handleUpdateDocument}
              onCancel={() => {
                setIsCreating(false);
                setIsEditing(false);
                resetForm();
              }}
              addComponent={addComponent}
              removeComponent={removeComponent}
              onOpenGroupSwitcher={openGroupSwitcher}
              isCreating={isCreating}
              documents={documents}
            />
          )}
          
          {!isCreating && !isEditing && selectedDocument && (
            <DocumentViewer
              document={selectedDocument}
              resolvedContent={resolvedContent}
              onResolve={() => handleResolveDocument(selectedDocument)}
            />
          )}
          
          {!isCreating && !isEditing && !selectedDocument && (
            <div className="empty-state">
              <h3>Select a document to view or create a new one</h3>
              <button 
                className="btn btn--primary"
                onClick={() => setSidebarOpen(true)}
              >
                Browse Documents
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Component Key Input Modal */}
      {showKeyInput && (
        <ComponentKeyInputModal
          value={keyInputValue}
          onChange={setKeyInputValue}
          onConfirm={confirmComponentKey}
          onCancel={cancelKeyInput}
        />
      )}
      
      {/* Document Picker Modal */}
      {showDocumentPicker && (
        <DocumentPickerModal
          documents={documents.filter(doc => doc.id !== selectedDocument?.id)}
          componentKey={componentKeyToAdd}
          onSelect={selectDocumentForComponent}
          onCancel={cancelDocumentSelection}
        />
      )}

      {/* Derivative Modal */}
      {showDerivativeModal && (
        <DerivativeModal
          sourceDocument={sourceDocument}
          onConfirm={handleDerivativeCreation}
          onCancel={() => {
            setShowDerivativeModal(false);
            setSourceDocument(null);
          }}
        />
      )}

      {/* Component Type Selector Modal */}
      {showComponentTypeSelector && (
        <ComponentTypeSelectorModal
          componentKey={componentKeyToAdd}
          onSelect={selectComponentType}
          onCancel={cancelComponentTypeSelection}
        />
      )}

      {/* Group Picker Modal */}
      {showGroupPicker && (
        <GroupPickerModal
          documents={documents}
          componentKey={componentKeyToAdd}
          onSelect={selectGroupForComponent}
          onCancel={cancelGroupSelection}
        />
      )}

      {/* Group Switcher Modal */}
      {showGroupSwitcher && switcherGroupId && switcherComponentKey && projectId && (
        <GroupSwitcherModal
          projectId={projectId}
          groupId={switcherGroupId}
          componentKey={switcherComponentKey}
          currentReference={selectedDocument?.components?.[switcherComponentKey] || ''}
          onSwitch={switchGroupType}
          onCancel={cancelGroupSwitcher}
        />
      )}

      {/* Preset Picker Modal */}
      {showPresetPicker && (
        <PresetPickerModal
          documents={documents}
          onSelect={handleCreatePreset}
          onCancel={() => setShowPresetPicker(false)}
        />
      )}

      {/* Tag Manager Modal */}
      {showTagManager && projectId && (
        <TagManager
          projectId={projectId}
          onClose={() => {
            setShowTagManager(false);
            loadTags(); // Reload tags after changes
          }}
        />
      )}

      {/* Tag Selector Modal */}
      {showTagSelector && tagSelectorDocumentId && projectId && (
        <TagSelector
          projectId={projectId}
          documentId={tagSelectorDocumentId}
          onClose={closeTagSelector}
        />
      )}
    </div>
  );
}

// Document Form Component
interface DocumentFormProps {
  formData: DocumentFormData;
  setFormData: (data: DocumentFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  addComponent: () => void;
  removeComponent: (key: string) => void;
  onOpenGroupSwitcher?: (componentKey: string, groupId: string) => void;
  isCreating: boolean;
  documents: Document[];
}

function DocumentForm({ 
  formData, 
  setFormData, 
  onSave, 
  onCancel, 
  addComponent, 
  removeComponent,
  onOpenGroupSwitcher,
  isCreating,
  documents
}: DocumentFormProps) {
  
  const getDocumentTitle = (reference: string) => {
    if (reference.startsWith('group:')) {
      const parts = reference.split(':');
      const groupId = parts[1];
      const preferredType = parts[2] || null;
      
      const groupDocs = documents.filter(d => d.group_id === groupId);
      if (groupDocs.length > 0) {
        let representative: Document;
        if (preferredType) {
          // Use specific preferred type if available
          representative = groupDocs.find(d => d.document_type === preferredType) || groupDocs[0];
        } else {
          // Use default representative document selection
          representative = groupDocs.find(d => !d.document_type || d.document_type === 'source' || d.document_type === 'original') || groupDocs[0];
        }
        
        const typeLabel = preferredType ? ` - ${preferredType}` : '';
        return `${representative.title} (Group${typeLabel} - ${groupDocs.length} docs)`;
      }
      return `Unknown Group (${groupId.substring(0, 8)}...)`;
    } else {
      const doc = documents.find(d => d.id === reference);
      return doc ? doc.title : `Unknown Document (${reference.substring(0, 8)}...)`;
    }
  };
  return (
    <div className="document-form">
      <h3 className="document-form__title">
        {isCreating ? 'Create New Document' : 'Edit Document'}
      </h3>
      
      <div className="form-group">
        <label className="form-label">
          Title:
          <input
            type="text"
            className="form-input"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
        </label>
      </div>
      
      <div className="form-group">
        <label className="form-label">
          Document Type:
          <input
            type="text"
            className="form-input"
            value={formData.document_type}
            onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
            placeholder="e.g., character, scene, location"
          />
        </label>
      </div>
      
      <div className="form-group">
        <label className="form-checkbox">
          <input
            type="checkbox"
            checked={formData.is_composite}
            onChange={(e) => setFormData({ 
              ...formData, 
              is_composite: e.target.checked,
              components: e.target.checked ? formData.components : {}
            })}
          />
          <span>Composite Document (assembles content from other documents)</span>
        </label>
      </div>
      
      {formData.is_composite && (
        <div className="components-section">
          <h4>Components</h4>
          <p className="components-description">
            Use placeholders like {`{{key}}`} in your content template below.
          </p>
          <button className="btn btn--secondary" onClick={addComponent}>
            Add Component
          </button>
          <div className="components-list">
            {Object.entries(formData.components).map(([key, docId]) => (
              <div key={key} className="component-item">
                <div className="component-mapping">
                  <div className="component-key">
                    <strong>{`{{${key}}}`}</strong>
                  </div>
                  <div className="component-arrow">→</div>
                  <div className="component-document">
                    <span className="document-title">{getDocumentTitle(docId)}</span>
                    <small className="document-id">
                      {docId.startsWith('group:') ? 
                        (() => {
                          const parts = docId.split(':');
                          const groupId = parts[1];
                          const preferredType = parts[2];
                          return `Group ID: ${groupId.substring(0, 8)}...${preferredType ? ` (${preferredType})` : ''}`;
                        })() 
                        : `ID: ${docId.substring(0, 8)}...`
                      }
                    </small>
                  </div>
                </div>
                <div className="component-actions">
                  {docId.startsWith('group:') && (
                    <button 
                      className="btn btn--sm btn--secondary"
                      onClick={() => {
                        const parts = docId.split(':');
                        const groupId = parts[1] || '';
                        onOpenGroupSwitcher?.(key, groupId);
                      }}
                      style={{ marginRight: '0.5rem' }}
                    >
                      Switch Type
                    </button>
                  )}
                  <button 
                    className="btn btn--sm btn--danger"
                    onClick={() => removeComponent(key)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="form-group">
        <label className="form-label">
          Content:
          <textarea
            className="form-textarea"
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            rows={formData.is_composite ? 10 : 15}
            placeholder={formData.is_composite ? 
              "Enter your template with placeholders like {{key}}..." : 
              "Enter your document content..."
            }
          />
        </label>
      </div>
      
      <div className="form-actions">
        <button className="btn btn--primary" onClick={onSave}>
          {isCreating ? 'Create' : 'Save'}
        </button>
        <button className="btn btn--secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// Document Viewer Component
interface DocumentViewerProps {
  document: Document;
  resolvedContent: string | null;
  onResolve: () => void;
}

function DocumentViewer({ document, resolvedContent, onResolve }: DocumentViewerProps) {
  return (
    <div className="document-viewer">
      <div className="document-viewer__header">
        <h3 className="document-viewer__title">{document.title}</h3>
        <p className="document-viewer__meta">
          <strong>Type:</strong> {document.document_type || 'No type'} • 
          <strong>Format:</strong> {document.is_composite ? 'Composite Document' : 'Static Document'}
        </p>
        {document.is_composite && (
          <button className="btn btn--primary" onClick={onResolve}>
            🔗 Resolve Template
          </button>
        )}
      </div>
      
      {document.is_composite && Object.keys(document.components || {}).length > 0 && (
        <div className="document-components">
          <h4>Components:</h4>
          <div className="components-list">
            {Object.entries(document.components || {}).map(([key, docId]) => (
              <div key={key} className="component-mapping">
                <strong>{`{{${key}}}`}</strong> → {docId}
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="content-section">
        <h4>Raw Content:</h4>
        <div className="content-display content-display--raw">
          {document.content || 'No content'}
        </div>
      </div>
      
      {document.is_composite && resolvedContent && (
        <div className="content-section">
          <h4>Resolved Content:</h4>
          <div className="content-display content-display--resolved">
            {resolvedContent}
          </div>
        </div>
      )}
    </div>
  );
}

// Document Picker Modal Component
interface DocumentPickerModalProps {
  documents: Document[];
  componentKey: string | null;
  onSelect: (documentId: string) => void;
  onCancel: () => void;
}

function DocumentPickerModal({ documents, componentKey, onSelect, onCancel }: DocumentPickerModalProps) {
  const documentFilter = useDocumentFilter(documents);

  const handleDocumentSelect = (document: Document) => {
    onSelect(document.id);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content document-picker-modal">
        <div className="modal-header">
          <h3>Select Document for {componentKey && `{{${componentKey}}}`}</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        
        <DocumentFilters
          searchTerm={documentFilter.searchTerm}
          onSearchChange={documentFilter.setSearchTerm}
          typeFilter={documentFilter.typeFilter}
          onTypeChange={documentFilter.setTypeFilter}
          formatFilter={documentFilter.formatFilter}
          onFormatChange={documentFilter.setFormatFilter}
          availableTypes={documentFilter.availableTypes}
          searchPlaceholder="Search by title or content..."
        />

        <div className="modal-body">
          <DocumentList
            documents={documentFilter.filteredDocuments}
            onDocumentClick={handleDocumentSelect}
            variant="picker"
            emptyMessage="No documents found matching your criteria."
          />
        </div>

        <div className="modal-footer">
          <button className="btn btn--secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Component Key Input Modal
interface ComponentKeyInputModalProps {
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function ComponentKeyInputModal({ value, onChange, onConfirm, onCancel }: ComponentKeyInputModalProps) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content component-key-modal">
        <div className="modal-header">
          <h3>Add Component</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="key-input-section">
            <label className="form-label">
              Placeholder Key (without {`{{}}`}):
              <input
                type="text"
                className="form-input"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="e.g., chapter1, character_intro, setting"
                autoFocus
              />
            </label>
            <p className="key-input-help">
              This key will be used as {value && `{{${value}}}`} in your template content.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn--secondary" onClick={onCancel}>
            Cancel
          </button>
          <button 
            className="btn btn--primary" 
            onClick={onConfirm}
            disabled={!value.trim()}
          >
            Next: Select Document
          </button>
        </div>
      </div>
    </div>
  );
}

// Derivative Document Modal Component
interface DerivativeModalProps {
  sourceDocument: Document | null;
  onConfirm: (derivativeType: string, title: string) => void;
  onCancel: () => void;
}

function DerivativeModal({ sourceDocument, onConfirm, onCancel }: DerivativeModalProps) {
  const [derivativeType, setDerivativeType] = useState('');
  const [title, setTitle] = useState('');

  const handleConfirm = () => {
    if (derivativeType.trim() && title.trim()) {
      onConfirm(derivativeType.trim(), title.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const generateSuggestedTitle = (type: string) => {
    if (!sourceDocument) return '';
    const baseTitle = sourceDocument.title;
    return type ? `${baseTitle} - ${type}` : baseTitle;
  };

  const handleTypeChange = (type: string) => {
    setDerivativeType(type);
    if (!title || title === generateSuggestedTitle(derivativeType)) {
      setTitle(generateSuggestedTitle(type));
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content derivative-modal">
        <div className="modal-header">
          <h3>Create Derivative Document</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        
        <div className="modal-body">
          {sourceDocument && (
            <div className="source-document-info">
              <p><strong>Source:</strong> {sourceDocument.title}</p>
              {sourceDocument.document_type && (
                <p><strong>Type:</strong> {sourceDocument.document_type}</p>
              )}
            </div>
          )}

          <div className="derivative-form">
            <label className="form-label">
              Document Type:
              <input
                type="text"
                className="form-input"
                value={derivativeType}
                onChange={(e) => handleTypeChange(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Enter any type (e.g., summary, analysis, notes, translation)"
                autoFocus
              />
            </label>

            <label className="form-label">
              Title:
              <input
                type="text"
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Enter derivative document title"
              />
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn--secondary" onClick={onCancel}>
            Cancel
          </button>
          <button 
            className="btn btn--primary" 
            onClick={handleConfirm}
            disabled={!derivativeType.trim() || !title.trim()}
          >
            Create Derivative
          </button>
        </div>
      </div>
    </div>
  );
}

// Preset Picker Modal Component
interface PresetPickerModalProps {
  documents: Document[];
  onSelect: (name: string, document: Document) => void;
  onCancel: () => void;
}

function PresetPickerModal({ documents, onSelect, onCancel }: PresetPickerModalProps) {
  const [presetName, setPresetName] = useState('');
  const [step, setStep] = useState<'name' | 'document'>('name');

  const handleNameConfirm = () => {
    if (presetName.trim()) {
      setStep('document');
    }
  };

  const handleDocumentSelect = (document: Document) => {
    onSelect(presetName, document);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && step === 'name') {
      handleNameConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (step === 'name') {
    return (
      <div className="modal-overlay">
        <div className="modal-content preset-name-modal">
          <div className="modal-header">
            <h3>Create Preset</h3>
            <button className="modal-close" onClick={onCancel}>×</button>
          </div>
          
          <div className="modal-body">
            <div className="preset-name-section">
              <label className="form-label">
                Preset Name (will be used in API endpoint):
                <input
                  type="text"
                  className="form-input"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="e.g., character-sheet, world-guide"
                  autoFocus
                />
              </label>
              <p className="preset-name-help">
                This will create the endpoint: <code>/preset/&#123;project-id&#125;/{presetName || '{name}'}</code>
              </p>
            </div>
          </div>

          <div className="modal-footer">
            <button className="btn btn--secondary" onClick={onCancel}>
              Cancel
            </button>
            <button 
              className="btn btn--primary" 
              onClick={handleNameConfirm}
              disabled={!presetName.trim()}
            >
              Next: Select Document
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content document-picker-modal">
        <div className="modal-header">
          <h3>Select Document for "{presetName}"</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="document-picker-list">
            {documents.map((document) => (
              <DocumentListItem
                key={document.id}
                document={document}
                onClick={handleDocumentSelect}
                showPreview={true}
                variant="picker"
              />
            ))}
            {documents.length === 0 && (
              <div className="empty-state">
                <p>No documents available.</p>
                <p>Create a document first before creating a preset.</p>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn--secondary" onClick={() => setStep('name')}>
            Back
          </button>
          <button className="btn btn--secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Component Type Selector Modal Component
interface ComponentTypeSelectorModalProps {
  componentKey: string | null;
  onSelect: (type: 'document' | 'group') => void;
  onCancel: () => void;
}

function ComponentTypeSelectorModal({ componentKey, onSelect, onCancel }: ComponentTypeSelectorModalProps) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content component-key-modal">
        <div className="modal-header">
          <h3>Select Component Type</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="key-input-section">
            <p>Choose how to populate the component key <strong>{componentKey}</strong>:</p>
            <div className="form-actions">
              <button 
                className="btn btn--primary"
                onClick={() => onSelect('document')}
                onKeyDown={handleKeyPress}
                autoFocus
              >
                Select Document
              </button>
              <button 
                className="btn btn--secondary"
                onClick={() => onSelect('group')}
                onKeyDown={handleKeyPress}
              >
                Select Group
              </button>
            </div>
            <p className="key-input-help">
              <strong>Document:</strong> Choose a specific document to populate this component.<br/>
              <strong>Group:</strong> Choose a document group - the system will use the preferred group member.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Group Picker Modal Component
interface GroupPickerModalProps {
  documents: Document[];
  componentKey: string | null;
  onSelect: (groupId: string) => void;
  onCancel: () => void;
}

function GroupPickerModal({ documents, componentKey, onSelect, onCancel }: GroupPickerModalProps) {
  const documentGroups = useMemo(() => {
    const groupMap = new Map<string, { 
      groupId: string; 
      documents: Document[]; 
      representativeDoc: Document 
    }>();

    documents.forEach(doc => {
      if (doc.group_id) {
        if (!groupMap.has(doc.group_id)) {
          groupMap.set(doc.group_id, {
            groupId: doc.group_id,
            documents: [],
            representativeDoc: doc
          });
        }
        groupMap.get(doc.group_id)!.documents.push(doc);
        
        // Update representative doc (prefer source documents or documents without document_type)
        const current = groupMap.get(doc.group_id)!.representativeDoc;
        if (!current.document_type || 
            (doc.document_type && (doc.document_type === 'source' || doc.document_type === 'original')) ||
            (!doc.document_type && current.document_type)) {
          groupMap.get(doc.group_id)!.representativeDoc = doc;
        }
      }
    });

    return Array.from(groupMap.values());
  }, [documents]);

  const handleGroupSelect = (groupId: string) => {
    onSelect(groupId);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content document-picker-modal">
        <div className="modal-header">
          <h3>Select Document Group for "{componentKey}"</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        
        <div className="modal-body">
          {documentGroups.length > 0 ? (
            <div className="document-picker-list">
              {documentGroups.map(group => (
                <div
                  key={group.groupId}
                  className="document-picker-item"
                  onClick={() => handleGroupSelect(group.groupId)}
                >
                  <div className="document-picker-header">
                    <h4>{group.representativeDoc.title}</h4>
                    <div className="document-picker-meta">
                      Group ({group.documents.length} documents)
                    </div>
                  </div>
                  <div className="document-picker-preview">
                    Types: {[...new Set(group.documents.map(d => d.document_type || 'untitled').filter(Boolean))].join(', ')}
                  </div>
                  <div className="document-picker-id">
                    Group ID: {group.groupId}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>No document groups found.</p>
              <p>Create derivative documents to form groups.</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn--secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}