import { useState, useEffect } from 'react';
import type { Document, AIProvider } from '../api';
import { getProjectPrompts, submitAITransform, getProviderModels, createDocument, getProjectAIConfig } from '../api';

interface ProjectPrompt {
  id: string;
  name: string;
  description?: string;
  variables: Record<string, any>;
  document_title: string;
  document_content: string;
  created_at: string;
}

interface TransformModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document;
  aiProviders: AIProvider[];
  accessToken: string;
  projectId: string;
  onSuccess?: (newDocument: Document) => void;
}

export function TransformModal({
  isOpen,
  onClose,
  document,
  aiProviders,
  accessToken,
  projectId,
  onSuccess
}: TransformModalProps) {
  const [prompts, setPrompts] = useState<ProjectPrompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [modelSearch, setModelSearch] = useState('');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [instruction, setInstruction] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  
  // New document form fields
  const [showNewDocForm, setShowNewDocForm] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocType, setNewDocType] = useState('');
  const [newDocGroupId, setNewDocGroupId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load project prompts
  useEffect(() => {
    if (isOpen) {
      loadPrompts();
      loadProjectAIConfigIfNeeded();
    }
  }, [isOpen, projectId]);

  // Initialize AI config from document or project
  useEffect(() => {
    if (isOpen) {
      // Initialize from document AI columns if available
      if (document.last_ai_provider_id) {
        setSelectedProvider(document.last_ai_provider_id);
      }
      if (document.last_ai_model_id) {
        setSelectedModel(document.last_ai_model_id);
        setModelSearch(document.last_ai_model_id);
      }
    }
  }, [isOpen, document]);

  // Load models when provider changes
  useEffect(() => {
    if (selectedProvider) {
      loadProviderModels(selectedProvider);
    } else {
      setAvailableModels([]);
      setSelectedModel('');
      setModelSearch('');
    }
  }, [selectedProvider]);

  // Set default new document values when result is generated
  useEffect(() => {
    if (result && !newDocTitle) {
      setNewDocTitle(`${document.title} (Transformed)`);
      setNewDocType(document.document_type || 'document');
      setNewDocGroupId(document.group_id || '');
    }
  }, [result, document]);

  // Update variables when prompt changes
  useEffect(() => {
    const selectedPrompt = prompts.find(p => p.id === selectedPromptId);
    if (selectedPrompt) {
      const newVariables: Record<string, string> = {};
      Object.keys(selectedPrompt.variables || {}).forEach(key => {
        newVariables[key] = '';
      });
      setVariables(newVariables);
    }
  }, [selectedPromptId, prompts]);

  const loadPrompts = async () => {
    try {
      const response = await getProjectPrompts(projectId, accessToken);
      setPrompts(response.prompts);
    } catch (error) {
      console.error('Failed to load prompts:', error);
      setError('Failed to load prompt templates');
    }
  };

  const loadProjectAIConfigIfNeeded = async () => {
    // Only load project config if document doesn't have AI columns
    if (!document.last_ai_provider_id || !document.last_ai_model_id) {
      try {
        const { aiConfig } = await getProjectAIConfig(projectId, accessToken);
        if (aiConfig) {
          if (!document.last_ai_provider_id && aiConfig.provider_id) {
            setSelectedProvider(aiConfig.provider_id);
          }
          if (!document.last_ai_model_id && aiConfig.model_id) {
            setSelectedModel(aiConfig.model_id);
            setModelSearch(aiConfig.model_id);
          }
        }
      } catch (error) {
        console.error('Failed to load project AI config:', error);
        // Don't show error to user - this is optional functionality
      }
    }
  };

  const loadProviderModels = async (providerId: string) => {
    try {
      const models = await getProviderModels(providerId, accessToken);
      setAvailableModels(models);
      setSelectedModel('');
      setModelSearch('');
    } catch (error) {
      console.error('Failed to load models:', error);
      setAvailableModels([]);
    }
  };

  const handleModelSelect = (model: any) => {
    setSelectedModel(model.id);
    setModelSearch(model.name);
    setShowModelDropdown(false);
  };

  const handleModelSearchChange = (value: string) => {
    setModelSearch(value);
    setShowModelDropdown(true);
    if (!value) {
      setSelectedModel('');
    }
  };

  const filteredModels = availableModels.filter(model =>
    model.name.toLowerCase().includes(modelSearch.toLowerCase())
  );

  const handleTransform = async () => {
    if (!selectedProvider || !selectedModel) {
      setError('Please select a provider and model');
      return;
    }

    setIsLoading(true);
    setError('');
    setResult('');
    setShowNewDocForm(false);

    try {
      const response = await submitAITransform({
        documentId: document.id,
        promptTemplateId: selectedPromptId || undefined,
        variables,
        instruction,
        providerId: selectedProvider,
        model: selectedModel
      }, accessToken);

      setResult(response.response);
      setShowNewDocForm(true);
    } catch (error) {
      console.error('Transform error:', error);
      setError(error instanceof Error ? error.message : 'Transform failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAsNewDocument = async () => {
    if (!newDocTitle.trim() || !result) {
      setError('Please provide a title for the new document');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const newDocument = await createDocument(projectId, {
        title: newDocTitle.trim(),
        document_type: newDocType || 'document',
        content: result,
        group_id: newDocGroupId || undefined,
        interaction_mode: 'document'
      }, accessToken);

      if (onSuccess) {
        onSuccess(newDocument);
      }
      onClose();
    } catch (error) {
      console.error('Save document error:', error);
      setError(error instanceof Error ? error.message : 'Failed to save document');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedPrompt = prompts.find(p => p.id === selectedPromptId);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal modal--large">
        <div className="modal__header">
          <h2>⚡ Transform Document - {document.title}</h2>
          <button className="modal__close" onClick={onClose}>×</button>
        </div>

        <div className="modal__body">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Prompt Template Selection */}
          <div className="form-section">
            <h3>Select Prompt Template (Optional)</h3>
            <div className="template-option">
              <div 
                className={`prompt-card ${selectedPromptId === '' ? 'prompt-card--selected' : ''}`}
                onClick={() => setSelectedPromptId('')}
              >
                <div className="prompt-card__header">
                  <h4>No Template</h4>
                </div>
                <p className="prompt-card__description">Use only your custom instruction below</p>
              </div>
            </div>
            {prompts.length > 0 && (
              <div className="prompt-list">
                {prompts.map(prompt => (
                  <div 
                    key={prompt.id}
                    className={`prompt-card ${selectedPromptId === prompt.id ? 'prompt-card--selected' : ''}`}
                    onClick={() => setSelectedPromptId(prompt.id)}
                  >
                    <div className="prompt-card__header">
                      <h4>{prompt.name}</h4>
                      <span className="prompt-card__date">
                        {new Date(prompt.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {prompt.description && (
                      <p className="prompt-card__description">{prompt.description}</p>
                    )}
                    <div className="prompt-card__meta">
                      <span>📄 {prompt.document_title}</span>
                      {Object.keys(prompt.variables || {}).length > 0 && (
                        <span>🔧 {Object.keys(prompt.variables).length} variables</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Variables Input */}
          {selectedPrompt && Object.keys(selectedPrompt.variables || {}).length > 0 && (
            <div className="form-section">
              <h3>Template Variables</h3>
              <div className="variables-grid">
                {Object.entries(selectedPrompt.variables).map(([key, config]: [string, any]) => (
                  <div key={key} className="form-group">
                    <label className="form-label">
                      {key}:
                      {config.description && (
                        <span className="variable-description">{config.description}</span>
                      )}
                      <input
                        type="text"
                        className="form-input"
                        value={variables[key] || ''}
                        onChange={(e) => setVariables(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder={config.default || `Enter ${key}...`}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Document Content Preview */}
          <div className="form-section">
            <h3>Document Content</h3>
            <div className="document-preview">
              <div className="document-meta">
                <strong>{document.title}</strong> ({document.document_type || 'Document'})
              </div>
              <div className="document-content">
                {document.content ? (
                  <pre className="content-preview">{document.content.slice(0, 500)}{document.content.length > 500 ? '...' : ''}</pre>
                ) : (
                  <em>No content</em>
                )}
              </div>
            </div>
          </div>

          {/* Custom Instruction */}
          <div className="form-section">
            <h3>Custom Instruction</h3>
            <div className="form-group">
              <label className="form-label">
                What would you like to do with this document?
                <textarea
                  className="form-input"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="e.g., Rewrite this in first person from Alice's perspective, or Summarize the key points, or Translate to Spanish..."
                  rows={4}
                />
              </label>
            </div>
          </div>

          {/* AI Configuration */}
          <div className="form-section">
            <h3>AI Configuration</h3>
            <div className="ai-config">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    AI Provider:
                    <select
                      className="form-input"
                      value={selectedProvider}
                      onChange={(e) => setSelectedProvider(e.target.value)}
                    >
                      <option value="">Select provider...</option>
                      {aiProviders.map(provider => (
                        <option key={provider.id} value={provider.id}>
                          {provider.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Model:
                    <div className="searchable-select">
                      <input
                        type="text"
                        className="form-input"
                        value={modelSearch}
                        onChange={(e) => handleModelSearchChange(e.target.value)}
                        onFocus={() => setShowModelDropdown(true)}
                        onBlur={() => setTimeout(() => setShowModelDropdown(false), 200)}
                        placeholder={!selectedProvider ? "Select provider first..." : "Search models..."}
                        disabled={!selectedProvider}
                      />
                      {showModelDropdown && selectedProvider && filteredModels.length > 0 && (
                        <div className="searchable-dropdown">
                          {filteredModels.map(model => (
                            <div
                              key={model.id}
                              className="dropdown-item"
                              onClick={() => handleModelSelect(model)}
                            >
                              <div className="model-name">{model.name}</div>
                              {model.description && (
                                <div className="model-description">{model.description}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Transform Result */}
          {result && (
            <div className="form-section">
              <h3>Transform Result</h3>
              <div className="transform-result">
                <textarea
                  className="form-input"
                  value={result}
                  readOnly
                  rows={12}
                  style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}
                />
              </div>
            </div>
          )}

          {/* New Document Form */}
          {showNewDocForm && result && (
            <div className="form-section">
              <h3>Save as New Document</h3>
              <div className="new-document-form">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      Title:
                      <input
                        type="text"
                        className="form-input"
                        value={newDocTitle}
                        onChange={(e) => setNewDocTitle(e.target.value)}
                        placeholder="Enter document title..."
                      />
                    </label>
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      Type:
                      <input
                        type="text"
                        className="form-input"
                        value={newDocType}
                        onChange={(e) => setNewDocType(e.target.value)}
                        placeholder="document"
                      />
                    </label>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    Group ID (Optional):
                    <input
                      type="text"
                      className="form-input"
                      value={newDocGroupId}
                      onChange={(e) => setNewDocGroupId(e.target.value)}
                      placeholder="Leave empty for no group"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose}>
            Close
          </button>
          {!result && selectedProvider && selectedModel && (instruction.trim() || selectedPromptId) && (
            <button
              className="btn btn--ai"
              onClick={handleTransform}
              disabled={isLoading}
            >
              {isLoading ? 'Transforming...' : '⚡ Transform'}
            </button>
          )}
          {result && showNewDocForm && (
            <button
              className="btn btn--primary"
              onClick={handleSaveAsNewDocument}
              disabled={isSaving || !newDocTitle.trim()}
            >
              {isSaving ? 'Saving...' : '💾 Save as New Document'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}