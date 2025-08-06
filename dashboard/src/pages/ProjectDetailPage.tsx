import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  getDocuments, 
  createDocument, 
  updateDocument, 
  deleteDocument, 
  getDocument
} from '../api';
import type { Document } from '../api';
import '../styles/ProjectDetailPage.css';

interface DocumentFormData {
  title: string;
  content: string;
  document_type: string;
  is_composite: boolean;
  components: Record<string, string>;
}

// Custom hook for document filtering
function useDocumentFilter(documents: Document[]) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [formatFilter, setFormatFilter] = useState('');

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      const matchesSearch = !searchTerm || 
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.content && doc.content.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesType = !typeFilter || doc.document_type === typeFilter;
      
      const matchesFormat = !formatFilter || 
        (formatFilter === 'composite' && doc.is_composite) ||
        (formatFilter === 'static' && !doc.is_composite);

      return matchesSearch && matchesType && matchesFormat;
    });
  }, [documents, searchTerm, typeFilter, formatFilter]);

  const availableTypes = useMemo(() => {
    return [...new Set(documents.map(doc => doc.document_type).filter(Boolean))];
  }, [documents]);

  const resetFilters = () => {
    setSearchTerm('');
    setTypeFilter('');
    setFormatFilter('');
  };

  return {
    searchTerm,
    setSearchTerm,
    typeFilter,
    setTypeFilter,
    formatFilter,
    setFormatFilter,
    filteredDocuments,
    availableTypes,
    resetFilters,
    hasActiveFilters: searchTerm || typeFilter || formatFilter
  };
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
  isSelected?: boolean;
  onClick?: (document: Document) => void;
  showPreview?: boolean;
  showActions?: boolean;
  onEdit?: (document: Document) => void;
  onDelete?: (documentId: string) => void;
  variant?: 'sidebar' | 'picker';
}

function DocumentListItem({ 
  document, 
  isSelected = false, 
  onClick, 
  showPreview = false,
  showActions = false,
  onEdit,
  onDelete,
  variant = 'sidebar'
}: DocumentListItemProps) {
  const handleClick = () => {
    if (onClick) {
      onClick(document);
    }
  };

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
        </span>
      </div>
      
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
  selectedDocumentId?: string;
  onDocumentClick?: (document: Document) => void;
  onDocumentEdit?: (document: Document) => void;
  onDocumentDelete?: (documentId: string) => void;
  variant?: 'sidebar' | 'picker';
  emptyMessage?: string;
}

function DocumentList({ 
  documents, 
  selectedDocumentId, 
  onDocumentClick, 
  onDocumentEdit, 
  onDocumentDelete,
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
          isSelected={selectedDocumentId === doc.id}
          onClick={onDocumentClick}
          onEdit={onDocumentEdit}
          onDelete={onDocumentDelete}
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
  const [formData, setFormData] = useState<DocumentFormData>({
    title: '',
    content: '',
    document_type: '',
    is_composite: false,
    components: {}
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
      setDocuments(docs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

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
      components: {}
    });
  };

  const startEdit = (doc: Document) => {
    setSelectedDocument(doc);
    setFormData({
      title: doc.title,
      content: doc.content || '',
      document_type: doc.document_type || '',
      is_composite: doc.is_composite,
      components: doc.components || {}
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
      setShowDocumentPicker(true);
    }
  };

  const cancelKeyInput = () => {
    setShowKeyInput(false);
    setKeyInputValue('');
  };

  const selectDocumentForComponent = (documentId: string) => {
    if (componentKeyToAdd) {
      setFormData({
        ...formData,
        components: { ...formData.components, [componentKeyToAdd]: documentId }
      });
    }
    setShowDocumentPicker(false);
    setComponentKeyToAdd(null);
  };

  const cancelDocumentSelection = () => {
    setShowDocumentPicker(false);
    setComponentKeyToAdd(null);
  };

  const removeComponent = (key: string) => {
    const newComponents = { ...formData.components };
    delete newComponents[key];
    setFormData({ ...formData, components: newComponents });
  };

  const handleSidebarDocumentClick = (document: Document) => {
    setSelectedDocument(document);
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
          selectedDocumentId={selectedDocument?.id}
          onDocumentClick={handleSidebarDocumentClick}
          onDocumentEdit={handleSidebarDocumentEdit}
          onDocumentDelete={handleDeleteDocument}
          variant="sidebar"
          emptyMessage={sidebarFilter.hasActiveFilters ? "No documents match your filters." : "No documents found. Create your first document!"}
        />
        
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
  isCreating,
  documents
}: DocumentFormProps) {
  
  const getDocumentTitle = (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    return doc ? doc.title : `Unknown Document (${docId.substring(0, 8)}...)`;
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
                    <small className="document-id">ID: {docId.substring(0, 8)}...</small>
                  </div>
                </div>
                <button 
                  className="btn btn--sm btn--danger"
                  onClick={() => removeComponent(key)}
                >
                  Remove
                </button>
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
      
      {resolvedContent && (
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