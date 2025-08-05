import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  getDocuments, 
  createDocument, 
  updateDocument, 
  deleteDocument, 
  getDocument,
  Document 
} from '../api';

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
  const [formData, setFormData] = useState<DocumentFormData>({
    title: '',
    content: '',
    document_type: '',
    is_composite: false,
    components: {}
  });

  useEffect(() => {
    loadDocuments();
  }, [projectId]);

  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const loadDocuments = async () => {
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
  };

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
    const key = prompt('Enter placeholder key (without {{}}):');
    const docId = prompt('Enter document ID to reference:');
    if (key && docId) {
      setFormData({
        ...formData,
        components: { ...formData.components, [key]: docId }
      });
    }
  };

  const removeComponent = (key: string) => {
    const newComponents = { ...formData.components };
    delete newComponents[key];
    setFormData({ ...formData, components: newComponents });
  };

  if (loading) return <div>Loading documents...</div>;

  return (
    <div style={{ display: 'flex', height: '100vh', gap: '20px', padding: '20px' }}>
      {/* Sidebar - Document List */}
      <div style={{ width: '300px', borderRight: '1px solid #ccc', paddingRight: '20px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h2>Documents</h2>
          <button onClick={() => setIsCreating(true)}>Create New Document</button>
        </div>
        
        {error && (
          <div style={{ color: 'red', marginBottom: '10px' }}>
            {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}
        
        <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {documents.map(doc => (
            <div 
              key={doc.id} 
              style={{ 
                padding: '10px', 
                border: '1px solid #ddd', 
                marginBottom: '10px',
                cursor: 'pointer',
                backgroundColor: selectedDocument?.id === doc.id ? '#f0f0f0' : 'white'
              }}
              onClick={() => setSelectedDocument(doc)}
            >
              <h4>{doc.title}</h4>
              <small>
                {doc.is_composite ? '🔗 Composite' : '📄 Static'} • 
                {doc.document_type || 'No type'}
              </small>
              <div style={{ marginTop: '5px' }}>
                <button 
                  onClick={(e) => { e.stopPropagation(); startEdit(doc); }}
                  style={{ marginRight: '5px' }}
                >
                  Edit
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc.id); }}
                  style={{ color: 'red' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
        
        <div style={{ marginTop: '20px' }}>
          <Link to="/">← Back to All Projects</Link>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1 }}>
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
            availableDocuments={documents.filter(d => d.id !== selectedDocument?.id)}
            addComponent={addComponent}
            removeComponent={removeComponent}
            isCreating={isCreating}
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
          <div style={{ textAlign: 'center', marginTop: '50px' }}>
            <h3>Select a document to view or create a new one</h3>
          </div>
        )}
      </div>
    </div>
  );
}

// Document Form Component
interface DocumentFormProps {
  formData: DocumentFormData;
  setFormData: (data: DocumentFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  availableDocuments: Document[];
  addComponent: () => void;
  removeComponent: (key: string) => void;
  isCreating: boolean;
}

function DocumentForm({ 
  formData, 
  setFormData, 
  onSave, 
  onCancel, 
  availableDocuments, 
  addComponent, 
  removeComponent,
  isCreating 
}: DocumentFormProps) {
  return (
    <div>
      <h3>{isCreating ? 'Create New Document' : 'Edit Document'}</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <label>
          Title:
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            style={{ width: '100%', padding: '5px', marginTop: '5px' }}
          />
        </label>
      </div>
      
      <div style={{ marginBottom: '15px' }}>
        <label>
          Document Type:
          <input
            type="text"
            value={formData.document_type}
            onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
            placeholder="e.g., character, scene, location"
            style={{ width: '100%', padding: '5px', marginTop: '5px' }}
          />
        </label>
      </div>
      
      <div style={{ marginBottom: '15px' }}>
        <label>
          <input
            type="checkbox"
            checked={formData.is_composite}
            onChange={(e) => setFormData({ 
              ...formData, 
              is_composite: e.target.checked,
              components: e.target.checked ? formData.components : {}
            })}
          />
          Composite Document (assembles content from other documents)
        </label>
      </div>
      
      {formData.is_composite && (
        <div style={{ marginBottom: '15px', border: '1px solid #ddd', padding: '10px' }}>
          <h4>Components</h4>
          <p>Use placeholders like {`{{key}}`} in your content template below.</p>
          <button onClick={addComponent}>Add Component</button>
          <div style={{ marginTop: '10px' }}>
            {Object.entries(formData.components).map(([key, docId]) => (
              <div key={key} style={{ marginBottom: '5px', padding: '5px', backgroundColor: '#f9f9f9' }}>
                <span><strong>{`{{${key}}}`}</strong> → {docId}</span>
                <button 
                  onClick={() => removeComponent(key)}
                  style={{ marginLeft: '10px', color: 'red' }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div style={{ marginBottom: '15px' }}>
        <label>
          Content:
          <textarea
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            rows={formData.is_composite ? 10 : 15}
            style={{ width: '100%', padding: '5px', marginTop: '5px' }}
            placeholder={formData.is_composite ? 
              "Enter your template with placeholders like {{key}}..." : 
              "Enter your document content..."
            }
          />
        </label>
      </div>
      
      <div>
        <button onClick={onSave} style={{ marginRight: '10px' }}>
          {isCreating ? 'Create' : 'Save'}
        </button>
        <button onClick={onCancel}>Cancel</button>
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
    <div>
      <div style={{ marginBottom: '20px', borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>
        <h3>{document.title}</h3>
        <p>
          <strong>Type:</strong> {document.document_type || 'No type'} • 
          <strong>Format:</strong> {document.is_composite ? 'Composite Document' : 'Static Document'}
        </p>
        {document.is_composite && (
          <button onClick={onResolve} style={{ marginTop: '10px' }}>
            🔗 Resolve Template
          </button>
        )}
      </div>
      
      {document.is_composite && Object.keys(document.components || {}).length > 0 && (
        <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f9f9f9' }}>
          <h4>Components:</h4>
          {Object.entries(document.components || {}).map(([key, docId]) => (
            <div key={key}><strong>{`{{${key}}}`}</strong> → {docId}</div>
          ))}
        </div>
      )}
      
      <div style={{ marginBottom: '20px' }}>
        <h4>Raw Content:</h4>
        <div style={{ 
          border: '1px solid #ddd', 
          padding: '15px', 
          backgroundColor: '#fafafa',
          whiteSpace: 'pre-wrap',
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          {document.content || 'No content'}
        </div>
      </div>
      
      {resolvedContent && (
        <div>
          <h4>Resolved Content:</h4>
          <div style={{ 
            border: '1px solid #ddd', 
            padding: '15px', 
            backgroundColor: '#f0f8ff',
            whiteSpace: 'pre-wrap',
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            {resolvedContent}
          </div>
        </div>
      )}
    </div>
  );
}