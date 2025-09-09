import { useState, useEffect } from 'react';
import type { Document, AIProvider } from '../api';
import { getProjectPrompts, submitAITransform, getProviderModels } from '../api';

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
  onSuccess?: (result: string) => void;
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
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  // Load project prompts
  useEffect(() => {
    if (isOpen) {
      loadPrompts();
    }
  }, [isOpen, projectId]);

  // Load models when provider changes
  useEffect(() => {
    if (selectedProvider) {
      loadProviderModels(selectedProvider);
    } else {
      setAvailableModels([]);
      setSelectedModel('');
    }
  }, [selectedProvider]);

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

  const loadProviderModels = async (providerId: string) => {
    try {
      const models = await getProviderModels(providerId, accessToken);
      setAvailableModels(models);
      setSelectedModel('');
    } catch (error) {
      console.error('Failed to load models:', error);
      setAvailableModels([]);
    }
  };

  const handleTransform = async () => {
    if (!selectedPromptId || !selectedProvider || !selectedModel) {
      setError('Please select a prompt template, provider, and model');
      return;
    }

    setIsLoading(true);
    setError('');
    setResult('');

    try {
      const response = await submitAITransform({
        documentId: document.id,
        promptTemplateId: selectedPromptId,
        variables,
        providerId: selectedProvider,
        model: selectedModel
      }, accessToken);

      setResult(response.response);
      if (onSuccess) {
        onSuccess(response.response);
      }
    } catch (error) {
      console.error('Transform error:', error);
      setError(error instanceof Error ? error.message : 'Transform failed');
    } finally {
      setIsLoading(false);
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
            <h3>Select Prompt Template</h3>
            {prompts.length === 0 ? (
              <p className="no-prompts">
                No prompt templates available. Create prompt templates by registering existing documents.
              </p>
            ) : (
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

          {/* AI Configuration */}
          {selectedPromptId && (
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
                      <select
                        className="form-input"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        disabled={!selectedProvider}
                      >
                        <option value="">Select model...</option>
                        {availableModels.map(model => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

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
        </div>

        <div className="modal__footer">
          <button className="btn btn--secondary" onClick={onClose}>
            Close
          </button>
          {selectedPromptId && selectedProvider && selectedModel && (
            <button
              className="btn btn--ai"
              onClick={handleTransform}
              disabled={isLoading}
            >
              {isLoading ? 'Transforming...' : '⚡ Transform'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}