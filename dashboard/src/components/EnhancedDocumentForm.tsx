import { useState } from 'react';
import type { Document, AIProvider } from '../api';
import { MonacoAutocompleteEditor } from './MonacoAutocompleteEditor';
import { LexicalWYSIWYGEditor } from './LexicalWYSIWYGEditor';

interface DocumentFormData {
  title: string;
  alias: string;
  content: string;
  document_type: string;
  components: Record<string, string>;
  group_id?: string;
  ai_model?: string;
}

interface EnhancedDocumentFormProps {
  formData: DocumentFormData;
  setFormData: (data: DocumentFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  addComponent: () => void;
  removeComponent: (key: string) => void;
  onOpenGroupSwitcher?: (componentKey: string, groupId: string) => void;
  onOpenGroupPicker?: () => void;
  isCreating: boolean;
  documents: Document[];
  aiProviders?: AIProvider[];
  currentDocumentId?: string;
}

export function EnhancedDocumentForm({
  formData,
  setFormData,
  onSave,
  onCancel,
  addComponent,
  removeComponent,
  onOpenGroupSwitcher,
  onOpenGroupPicker,
  isCreating,
  documents,
  aiProviders,
  currentDocumentId
}: EnhancedDocumentFormProps) {
  // Suppress unused variable warning for interface compatibility
  void aiProviders;
  const [isWYSIWYG, setIsWYSIWYG] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleAutocompleteComponentAdd = (key: string, documentId: string) => {
    const updatedComponents = { ...formData.components, [key]: documentId };
    setFormData({ ...formData, components: updatedComponents });
  };

  const getDocumentTitle = (reference: string) => {
    if (reference.startsWith('group:')) {
      const parts = reference.split(':');
      const groupId = parts[1];
      const preferredSpecifier = parts[2] || null;

      const groupDocs = documents.filter(d => d.group_id === groupId);
      if (groupDocs.length > 0) {
        let representative: Document;
        let specifierLabel = '';

        if (preferredSpecifier) {
          const specificDoc = groupDocs.find(d => d.id === preferredSpecifier);
          if (specificDoc) {
            representative = specificDoc;
            specifierLabel = ` - ${specificDoc.title}`;
          } else {
            representative = groupDocs.find(d => d.document_type === preferredSpecifier) || groupDocs[0];
            specifierLabel = ` - ${preferredSpecifier}`;
          }
        } else {
          representative = groupDocs.find(d => d.id === groupId) || groupDocs[0];
        }

        return `${representative.title} (Group${specifierLabel} - ${groupDocs.length} docs)`;
      }
      return `Unknown Group (${groupId.substring(0, 8)}...)`;
    } else {
      const doc = documents.find(d => d.id === reference);
      return doc ? doc.title : `Unknown Document (${reference.substring(0, 8)}...)`;
    }
  };

  const editorHeight = isFullscreen ? '80vh' : '400px';

  return (
    <div className={`document-form ${isFullscreen ? 'document-form--fullscreen' : ''}`}>
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
          Alias (for autocomplete):
          <input
            type="text"
            className="form-input"
            value={formData.alias}
            onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
            placeholder="e.g., char1,protagonist,john (comma-separated)"
          />
        </label>
        <small className="form-help">
          Add comma-separated aliases to make this document easier to find in autocomplete
        </small>
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
        <label className="form-label">
          Document Group:
        </label>
        <div className="group-assignment">
          <div className="current-group">
            {formData.group_id ?
              (() => {
                const groupDoc = documents.find(d => d.id === formData.group_id);
                const groupDocuments = documents.filter(d => d.group_id === formData.group_id);
                return groupDoc ?
                  `${groupDoc.title} (Group with ${groupDocuments.length} documents)` :
                  `Group ID: ${formData.group_id.substring(0, 8)}...`;
              })() :
              'No Group (Standalone Document)'
            }
          </div>
          <div className="group-assignment-actions">
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => onOpenGroupPicker?.()}
            >
              {formData.group_id ? 'Change Group' : 'Assign to Group'}
            </button>
            {formData.group_id && (
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setFormData({ ...formData, group_id: undefined })}
              >
                Remove from Group
              </button>
            )}
          </div>
        </div>
        <small className="form-help">
          Assign this document to an existing group or create a new group by selecting a group head document with filtering capabilities.
        </small>
      </div>

      <div className="form-group">
        <div className="editor-controls">
          <label className="form-label">Content:</label>
          <div className="editor-mode-controls">
            <button
              type="button"
              className={`btn btn--sm ${!isWYSIWYG ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setIsWYSIWYG(false)}
            >
              Markdown
            </button>
            <button
              type="button"
              className={`btn btn--sm ${isWYSIWYG ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setIsWYSIWYG(true)}
            >
              WYSIWYG
            </button>
            <button
              type="button"
              className="btn btn--sm btn--secondary"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title="Toggle Fullscreen"
            >
              {isFullscreen ? '⤓' : '⤢'}
            </button>
          </div>
        </div>

        {isWYSIWYG ? (
          <LexicalWYSIWYGEditor
            initialValue={formData.content}
            onContentChange={(value) => setFormData({ ...formData, content: value })}
            documents={documents}
            currentComponents={formData.components}
            onComponentAdd={handleAutocompleteComponentAdd}
            placeholder={Object.keys(formData.components).length > 0 ?
              "Enter your template with placeholders like {{key}}... Start typing {{abc to see autocomplete suggestions!" :
              "Enter your document content... Type {{abc to add component references with autocomplete!"
            }
            className="form-textarea"
            height={editorHeight}
          />
        ) : (
          <MonacoAutocompleteEditor
            initialValue={formData.content}
            onContentChange={(value) => setFormData({ ...formData, content: value })}
            documents={documents}
            currentComponents={formData.components}
            onComponentAdd={handleAutocompleteComponentAdd}
            placeholder={Object.keys(formData.components).length > 0 ?
              "Enter your template with placeholders like {{key}}... Start typing {{abc to see autocomplete suggestions!" :
              "Enter your document content... Type {{abc to add component references with autocomplete!"
            }
            className="form-textarea"
            height={editorHeight}
            currentDocumentId={currentDocumentId}
          />
        )}

        <small className="form-help">
          Tip: Type <code>{`{{`}</code> followed by a few characters to see autocomplete suggestions for documents, tags, or aliases.
          {Object.keys(formData.components).length === 0 && (
            <> You can also <button type="button" className="btn btn--link" onClick={addComponent}>manually add components</button>.</>
          )}
        </small>
      </div>

      {Object.keys(formData.components).length > 0 && (
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

export type { DocumentFormData, EnhancedDocumentFormProps };