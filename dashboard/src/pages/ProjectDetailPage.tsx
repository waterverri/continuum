import { useState, useEffect, useCallback } from 'react';
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
        
        <div className="document-list">
          {documents.map(doc => (
            <div 
              key={doc.id} 
              className={`document-item ${selectedDocument?.id === doc.id ? 'document-item--selected' : ''}`}
              onClick={() => {
                setSelectedDocument(doc);
                setSidebarOpen(false);
              }}
            >
              <div className="document-item__header">
                <h4>{doc.title}</h4>
                <small className="document-item__meta">
                  {doc.is_composite ? '🔗 Composite' : '📄 Static'} • 
                  {doc.document_type || 'No type'}
                </small>
              </div>
              <div className="document-item__actions">
                <button 
                  className="btn btn--sm"
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    startEdit(doc); 
                    setSidebarOpen(false);
                  }}
                >
                  Edit
                </button>
                <button 
                  className="btn btn--sm btn--danger"
                  onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc.id); }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
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
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [formatFilter, setFormatFilter] = useState('');

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = !searchTerm || 
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.content && doc.content.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = !typeFilter || doc.document_type === typeFilter;
    
    const matchesFormat = !formatFilter || 
      (formatFilter === 'composite' && doc.is_composite) ||
      (formatFilter === 'static' && !doc.is_composite);

    return matchesSearch && matchesType && matchesFormat;
  });

  const documentTypes = [...new Set(documents.map(doc => doc.document_type).filter(Boolean))];

  return (
    <div className="modal-overlay">
      <div className="modal-content document-picker-modal">
        <div className="modal-header">
          <h3>Select Document for {componentKey && `{{${componentKey}}}`}</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        
        <div className="modal-filters">
          <div className="filter-group">
            <input
              type="text"
              className="filter-input"
              placeholder="Search by title or content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="filter-row">
            <select 
              className="filter-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All Types</option>
              {documentTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            
            <select 
              className="filter-select"
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value)}
            >
              <option value="">All Formats</option>
              <option value="static">Static Documents</option>
              <option value="composite">Composite Documents</option>
            </select>
          </div>
        </div>

        <div className="modal-body">
          <div className="document-picker-list">
            {filteredDocuments.length === 0 ? (
              <div className="empty-state">
                <p>No documents found matching your criteria.</p>
              </div>
            ) : (
              filteredDocuments.map(doc => (
                <div 
                  key={doc.id}
                  className="document-picker-item"
                  onClick={() => onSelect(doc.id)}
                >
                  <div className="document-picker-header">
                    <h4>{doc.title}</h4>
                    <span className="document-picker-meta">
                      {doc.is_composite ? '🔗 Composite' : '📄 Static'}
                      {doc.document_type && ` • ${doc.document_type}`}
                    </span>
                  </div>
                  {doc.content && (
                    <div className="document-picker-preview">
                      {doc.content.substring(0, 150)}
                      {doc.content.length > 150 && '...'}
                    </div>
                  )}
                  <div className="document-picker-id">
                    ID: {doc.id.substring(0, 8)}...
                  </div>
                </div>
              ))
            )}
          </div>
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