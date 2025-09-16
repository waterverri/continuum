import { useState, useEffect, useMemo } from 'react';
import type { Document, AIProvider, ProviderModel } from '../api';
import { getProjectPrompts, submitAITransform, getProviderModels, createDocument, getProjectAIConfig } from '../api';
import { ensureBidirectionalGroupAssignment } from '../utils/groupAssignment';

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
  documents: Document[];
  onSuccess?: (newDocument: Document) => void;
}

export function TransformModal({
  isOpen,
  onClose,
  document,
  aiProviders,
  accessToken,
  projectId,
  documents,
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
  
  // Template search state
  const [templateSearch, setTemplateSearch] = useState('');
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  
  // New document form fields
  const [showNewDocForm, setShowNewDocForm] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocType, setNewDocType] = useState('');
  const [newDocGroupId, setNewDocGroupId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Group selection state
  const [groupSearch, setGroupSearch] = useState('');
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  
  // Available groups (group heads and non-group documents)
  const availableGroups = useMemo(() => {
    return documents.filter(doc => {
      // Show group head documents (documents that can be group heads)
      // These are documents without group_id or documents where group_id equals their own id
      return !doc.group_id || doc.group_id === doc.id;
    }).map(doc => {
      // Enhance with group information
      const groupDocuments = documents.filter(d => d.group_id === doc.id);
      const groupSize = groupDocuments.length;
      const isExistingGroup = groupSize > 0;
      
      return {
        ...doc,
        displayName: isExistingGroup 
          ? `${doc.title} (Group with ${groupSize} documents)`
          : doc.title,
        isGroup: isExistingGroup
      };
    });
  }, [documents]);

  // Load everything at once when modal opens
  useEffect(() => {
    if (isOpen) {
      initializeModalData();
    }
  }, [isOpen, projectId, document.id]);

  const initializeModalData = async () => {
    console.log('🔧 TransformModal: Initializing all data', {
      documentId: document.id,
      documentTitle: document.title,
      last_ai_provider_id: document.last_ai_provider_id,
      last_ai_model_id: document.last_ai_model_id
    });

    try {
      // Prepare all async operations
      const loadPromptsPromise = getProjectPrompts(projectId, accessToken);
      
      // Determine which provider/model to use
      let targetProvider = document.last_ai_provider_id;
      let targetModel = document.last_ai_model_id;
      
      // If document doesn't have AI config, try project config
      let projectConfigPromise: Promise<{ aiConfig: { provider_id: string; model_id: string; last_updated: string; updated_by: string } | null } | null> = Promise.resolve(null);
      if (!targetProvider || !targetModel) {
        projectConfigPromise = getProjectAIConfig(projectId, accessToken);
      }
      
      // Load project config if needed
      const [promptsResponse, projectConfigResponse] = await Promise.all([
        loadPromptsPromise,
        projectConfigPromise
      ]);
      
      // Use project config as fallback
      if (projectConfigResponse?.aiConfig) {
        targetProvider = targetProvider || projectConfigResponse.aiConfig.provider_id;
        targetModel = targetModel || projectConfigResponse.aiConfig.model_id;
      }
      
      console.log('🔧 Final AI config determined:', { targetProvider, targetModel });
      
      // Load models if we have a provider
      let modelsResponse: ProviderModel[] = [];
      if (targetProvider) {
        modelsResponse = await getProviderModels(targetProvider, accessToken);
        console.log('🔧 Models loaded:', modelsResponse.length);
      }
      
      // Find the model name
      let modelDisplayName = '';
      if (targetModel && modelsResponse.length > 0) {
        const modelObj = modelsResponse.find(m => m.id === targetModel);
        modelDisplayName = modelObj ? modelObj.name : targetModel;
        console.log('🔧 Model name resolved:', modelDisplayName);
      }
      
      // SET ALL STATE AT ONCE - NO MORE TIMING ISSUES!
      setPrompts(promptsResponse.prompts);
      setSelectedProvider(targetProvider || '');
      setSelectedModel(targetModel || '');
      setModelSearch(modelDisplayName);
      setAvailableModels(modelsResponse);
      
      console.log('🔧 All state set successfully!');
      
    } catch (error) {
      console.error('🔧 Failed to initialize modal data:', error);
      setError('Failed to load AI configuration');
    }
  };

  // Set default new document values when result is generated
  useEffect(() => {
    if (result && !newDocTitle) {
      setNewDocTitle(`${document.title} (Transformed)`);
      setNewDocType(document.document_type || 'document');
      
      // Default to current document's group, or the current document itself if it can be a group head
      let defaultGroupId = '';
      let defaultGroupName = '';
      
      if (document.group_id) {
        // Document is in a group, use that group
        defaultGroupId = document.group_id;
        const groupDoc = availableGroups.find(g => g.id === document.group_id);
        if (groupDoc) {
          defaultGroupName = groupDoc.displayName;
        }
      } else {
        // Document is not in a group, use the document itself as the group
        defaultGroupId = document.id;
        const docAsGroup = availableGroups.find(g => g.id === document.id);
        if (docAsGroup) {
          defaultGroupName = docAsGroup.displayName;
        }
      }
      
      setNewDocGroupId(defaultGroupId);
      setGroupSearch(defaultGroupName);
    }
  }, [result, document, availableGroups]);

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

  // Load models when user manually changes provider
  useEffect(() => {
    if (selectedProvider && availableModels.length === 0) {
      console.log('🔧 User changed provider, loading models for:', selectedProvider);
      loadModelsForProvider(selectedProvider);
    }
  }, [selectedProvider]);

  const loadModelsForProvider = async (providerId: string) => {
    try {
      const models = await getProviderModels(providerId, accessToken);
      setAvailableModels(models);
      // Clear model selection when provider changes
      setSelectedModel('');
      setModelSearch('');
    } catch (error) {
      console.error('Failed to load models for provider:', error);
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

  const filteredTemplates = prompts.filter(template =>
    template.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
    template.document_title.toLowerCase().includes(templateSearch.toLowerCase()) ||
    (template.description && template.description.toLowerCase().includes(templateSearch.toLowerCase()))
  );

  const handleTemplateSelect = (template: ProjectPrompt) => {
    setSelectedPromptId(template.id);
    setTemplateSearch(template.name);
    setShowTemplateDropdown(false);
  };

  const handleTemplateSearchChange = (value: string) => {
    setTemplateSearch(value);
    setShowTemplateDropdown(true);
    if (!value) {
      setSelectedPromptId('');
    } else {
      // If the search exactly matches a template name, auto-select it
      const exactMatch = prompts.find(p => p.name.toLowerCase() === value.toLowerCase());
      if (exactMatch) {
        setSelectedPromptId(exactMatch.id);
      }
    }
  };

  const clearTemplateSelection = () => {
    setSelectedPromptId('');
    setTemplateSearch('');
  };

  const filteredGroups = availableGroups.filter(group =>
    group.displayName.toLowerCase().includes(groupSearch.toLowerCase()) ||
    group.document_type?.toLowerCase().includes(groupSearch.toLowerCase())
  );

  const handleGroupSelect = (group: any) => {
    setNewDocGroupId(group.id);
    setGroupSearch(group.displayName);
    setShowGroupDropdown(false);
  };

  const handleGroupSearchChange = (value: string) => {
    setGroupSearch(value);
    setShowGroupDropdown(true);
    if (!value) {
      setNewDocGroupId('');
    }
  };

  const clearGroupSelection = () => {
    setNewDocGroupId('');
    setGroupSearch('');
  };

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
      // Create the new document
      const newDocument = await createDocument(projectId, {
        title: newDocTitle.trim(),
        document_type: newDocType || 'document',
        content: result,
        group_id: newDocGroupId || undefined,
        interaction_mode: 'document'
      }, accessToken);

      // If assigning to a group, ensure bidirectional group assignment
      if (newDocGroupId) {
        try {
          await ensureBidirectionalGroupAssignment(
            newDocGroupId,
            documents,
            projectId,
            accessToken
            // No state update callback needed here as parent will refresh
          );
        } catch (groupError) {
          console.error('🔧 Bidirectional group assignment failed in transform modal:', groupError);
          // Don't fail the whole operation, just log the error
        }
      }

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
            <div className="form-group">
              <label className="form-label">
                Template:
                <div className="searchable-select">
                  <input
                    type="text"
                    className="form-input"
                    value={templateSearch}
                    onChange={(e) => handleTemplateSearchChange(e.target.value)}
                    onFocus={() => setShowTemplateDropdown(true)}
                    onBlur={() => setTimeout(() => setShowTemplateDropdown(false), 200)}
                    placeholder={prompts.length === 0 ? "No templates available" : "Search templates or leave empty for no template..."}
                    disabled={prompts.length === 0}
                  />
                  {templateSearch && (
                    <button
                      type="button"
                      className="searchable-clear"
                      onClick={clearTemplateSelection}
                      title="Clear template selection"
                    >
                      ×
                    </button>
                  )}
                  {showTemplateDropdown && prompts.length > 0 && (
                    <div className="searchable-dropdown">
                      {filteredTemplates.length === 0 ? (
                        <div className="dropdown-item dropdown-item--no-results">
                          No templates match your search
                        </div>
                      ) : (
                        filteredTemplates.map(template => (
                          <div
                            key={template.id}
                            className="dropdown-item"
                            onClick={() => handleTemplateSelect(template)}
                          >
                            <div className="template-name">{template.name}</div>
                            <div className="template-source">📄 {template.document_title}</div>
                            {template.description && (
                              <div className="template-description">{template.description}</div>
                            )}
                            {Object.keys(template.variables || {}).length > 0 && (
                              <div className="template-vars">🔧 {Object.keys(template.variables).length} variables</div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </label>
            </div>
            
            {/* Show template details when one is selected */}
            {selectedPrompt && (
              <div className="template-details">
                <div className="template-meta">
                  <strong>{selectedPrompt.name}</strong>
                  <span className="template-date">
                    Created {new Date(selectedPrompt.created_at).toLocaleDateString()}
                  </span>
                </div>
                {selectedPrompt.description && (
                  <p className="template-description">{selectedPrompt.description}</p>
                )}
                <div className="template-info">
                  <span>📄 Source: {selectedPrompt.document_title}</span>
                  {Object.keys(selectedPrompt.variables || {}).length > 0 && (
                    <span>🔧 {Object.keys(selectedPrompt.variables).length} variables</span>
                  )}
                </div>
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
                    Group (Optional):
                    <div className="searchable-select">
                      <input
                        type="text"
                        className="form-input"
                        value={groupSearch}
                        onChange={(e) => handleGroupSearchChange(e.target.value)}
                        onFocus={() => setShowGroupDropdown(true)}
                        onBlur={() => setTimeout(() => setShowGroupDropdown(false), 200)}
                        placeholder={availableGroups.length === 0 ? "No groups available" : "Search groups or leave empty for no group..."}
                        disabled={availableGroups.length === 0}
                      />
                      {groupSearch && (
                        <button
                          type="button"
                          className="searchable-clear"
                          onClick={clearGroupSelection}
                          title="Clear group selection"
                        >
                          ×
                        </button>
                      )}
                      {showGroupDropdown && availableGroups.length > 0 && (
                        <div className="searchable-dropdown">
                          {filteredGroups.length === 0 ? (
                            <div className="dropdown-item dropdown-item--no-results">
                              No groups match your search
                            </div>
                          ) : (
                            filteredGroups.map(group => (
                              <div
                                key={group.id}
                                className="dropdown-item"
                                onClick={() => handleGroupSelect(group)}
                              >
                                <div className="group-name">{group.title}</div>
                                <div className="group-meta">
                                  {group.isGroup ? 
                                    `📁 Existing group with ${documents.filter(d => d.group_id === group.id).length} documents` :
                                    '📄 Can become group head'
                                  }
                                </div>
                                {group.document_type && (
                                  <div className="group-type">Type: {group.document_type}</div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
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