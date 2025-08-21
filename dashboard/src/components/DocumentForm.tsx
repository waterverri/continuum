import type { Document, AIProvider } from '../api';

interface DocumentFormData {
  title: string;
  content: string;
  document_type: string;
  is_composite: boolean;
  is_prompt: boolean;
  components: Record<string, string>;
  group_id?: string;
  ai_model?: string;
}

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
  aiProviders?: AIProvider[];
}

export function DocumentForm({ 
  formData, 
  setFormData, 
  onSave, 
  onCancel, 
  addComponent, 
  removeComponent,
  onOpenGroupSwitcher,
  isCreating,
  documents,
  // @ts-ignore: Keep aiProviders for interface compatibility
  aiProviders = []
}: DocumentFormProps) {
  
  const isPromptDocument = formData.is_prompt;
  // Note: Model selection is now handled dynamically in PromptDocumentViewer
  // DocumentForm only needs to set is_prompt flag
  
  const getDocumentTitle = (reference: string) => {
    if (reference.startsWith('group:')) {
      const parts = reference.split(':');
      const groupId = parts[1];
      const preferredType = parts[2] || null;
      
      const groupDocs = documents.filter(d => d.group_id === groupId);
      if (groupDocs.length > 0) {
        let representative: Document;
        if (preferredType) {
          representative = groupDocs.find(d => d.document_type === preferredType) || groupDocs[0];
        } else {
          representative = groupDocs.find(d => d.id === groupId) || groupDocs[0];
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
            placeholder="e.g., character bio, plot summary, world building"
          />
        </label>
      </div>
      
      <div className="form-group">
        <label className="form-checkbox">
          <input
            type="checkbox"
            checked={formData.is_prompt}
            onChange={(e) => setFormData({ 
              ...formData, 
              is_prompt: e.target.checked,
              ai_model: undefined // AI model selection is handled in PromptDocumentViewer
            })}
          />
          <span>AI Prompt Document (enables AI model selection and response functionality)</span>
        </label>
      </div>
      
      {isPromptDocument && (
        <div className="form-group">
          <div className="info-message">
            <small>Model selection will be available after creating the prompt document.</small>
          </div>
        </div>
      )}
      
      {!isPromptDocument && (
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
      )}
      
      {isPromptDocument && (
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
            <span>Composite Prompt (assembles prompt from other documents)</span>
          </label>
        </div>
      )}
      
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

export type { DocumentFormData, DocumentFormProps };