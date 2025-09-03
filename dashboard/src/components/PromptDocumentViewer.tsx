import { useState, useEffect, useRef } from 'react';
import type { Document, AIProvider, ProviderModel, CostEstimate } from '../api';
import { estimateAICost, submitAIRequest, getUserCredits, getProviderModels, saveLLMResponse } from '../api';
import { ExtractTextModal } from './ExtractTextModal';

interface PromptDocumentViewerProps {
  document: Document;
  resolvedContent: string | null;
  onResolve: () => void;
  aiProviders: AIProvider[];
  accessToken: string;
  projectId: string;
  allDocuments?: Document[];
  onCreateFromSelection?: (selectedText: string, selectionInfo: { start: number; end: number }, title: string, documentType: string, groupId?: string) => void;
  onRefreshDocument: () => void;
}

export function PromptDocumentViewer({ 
  document, 
  resolvedContent, 
  onResolve, 
  aiProviders,
  accessToken,
  projectId,
  allDocuments = [],
  onCreateFromSelection,
  onRefreshDocument
}: PromptDocumentViewerProps) {
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [selectedModel, setSelectedModel] = useState(document.ai_model || '');
  const [availableModels, setAvailableModels] = useState<ProviderModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelSearchTerm, setModelSearchTerm] = useState('');
  const [maxTokens, setMaxTokens] = useState(4000);
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userCredits, setUserCredits] = useState(0);
  const [aiResponse, setAiResponse] = useState<string>('');
  const [aiStatus, setAiStatus] = useState<'idle' | 'pending' | 'processing' | 'completed' | 'failed'>('idle');
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const responseRef = useRef<HTMLTextAreaElement>(null);

  // const selectedProvider = aiProviders.find(p => p.id === selectedProviderId); // Not needed for dynamic models
  
  // Filter models based on search term
  const filteredModels = availableModels.filter(model =>
    model.name.toLowerCase().includes(modelSearchTerm.toLowerCase()) ||
    model.id.toLowerCase().includes(modelSearchTerm.toLowerCase()) ||
    (model.description && model.description.toLowerCase().includes(modelSearchTerm.toLowerCase()))
  );

  // Load initial data and restore last response if available
  useEffect(() => {
    loadUserCredits();
    
    // Load last response if available
    if (document.last_ai_response) {
      setAiResponse(document.last_ai_response);
      setAiStatus('completed');
      
      // Restore AI settings from last response
      if (document.last_ai_provider_id) {
        setSelectedProviderId(document.last_ai_provider_id);
      }
      if (document.last_ai_model_id) {
        setSelectedModel(document.last_ai_model_id);
      }
      if (document.last_ai_max_tokens) {
        setMaxTokens(document.last_ai_max_tokens);
      }
    } else {
      // Reset response when document changes and no saved response
      setAiResponse('');
      setAiStatus('idle');
    }
  }, [document.id, document.last_ai_response]);

  // Load models when provider changes
  useEffect(() => {
    if (selectedProviderId) {
      loadProviderModels(selectedProviderId);
    } else {
      setAvailableModels([]);
      setSelectedModel('');
    }
  }, [selectedProviderId]);

  const loadUserCredits = async () => {
    try {
      const credits = await getUserCredits(accessToken);
      setUserCredits(credits);
    } catch (error) {
      console.error('Failed to load user credits:', error);
    }
  };

  const loadProviderModels = async (providerId: string) => {
    setIsLoadingModels(true);
    try {
      const models = await getProviderModels(providerId, accessToken);
      setAvailableModels(models);
      // Clear selected model when provider changes
      setSelectedModel('');
      setModelSearchTerm('');
    } catch (error) {
      console.error('Failed to load provider models:', error);
      setAvailableModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleEstimateCost = async () => {
    if (!selectedModel || !selectedProviderId) return;
    
    // Warn if estimating cost for unresolved composite document
    if (document.is_composite && !resolvedContent) {
      const shouldContinue = window.confirm(
        'This composite document has unresolved placeholders. Cost estimation will be based on the raw template. ' +
        'Click "Resolve Components" first for accurate cost estimation. Continue anyway?'
      );
      if (!shouldContinue) return;
    }
    
    setIsEstimating(true);
    try {
      // Get resolved content for cost estimation
      const prompt = resolvedContent || document.content || '';
      const estimate = await estimateAICost(selectedProviderId, selectedModel, prompt, accessToken);
      setCostEstimate(estimate);
    } catch (error) {
      console.error('Error estimating cost:', error);
    } finally {
      setIsEstimating(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedModel || !selectedProviderId) return;
    
    // Check if we're submitting a composite document without resolved content
    if (document.is_composite && !resolvedContent) {
      const shouldContinue = window.confirm(
        'This is a composite document with unresolved placeholders. The AI will receive the raw template with {{placeholder}} text instead of resolved content. ' +
        'Click "Resolve Components" first for best results. Continue anyway?'
      );
      if (!shouldContinue) return;
    }
    
    setIsSubmitting(true);
    setAiStatus('processing');
    setAiResponse(''); // Clear previous response
    
    try {
      // Get resolved content for AI request
      const prompt = resolvedContent || document.content || '';
      const result = await submitAIRequest(selectedProviderId, selectedModel, prompt, { maxTokens }, accessToken);
      
      // Set response
      setAiResponse(result.response);
      setAiStatus('completed');
      
      // Save response to document for future reuse
      try {
        await saveLLMResponse(
          projectId,
          document.id,
          result.response,
          selectedProviderId,
          selectedModel,
          maxTokens,
          costEstimate || {
            inputTokens: result.inputTokens,
            estimatedMaxCost: result.costCredits,
            estimatedMaxTokens: result.outputTokens
          },
          accessToken
        );
        
        // Refresh document to get updated fields
        onRefreshDocument();
      } catch (saveError) {
        console.error('Failed to save LLM response:', saveError);
        // Don't fail the request if saving fails, just log it
      }
      
      // Refresh credits after a small delay to ensure backend processing is complete
      setTimeout(() => {
        loadUserCredits();
      }, 500);
    } catch (error) {
      console.error('Error submitting AI request:', error);
      setAiStatus('failed');
      setAiResponse('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExtractFromResponse = () => {
    const textarea = responseRef.current;
    if (!textarea || !aiResponse) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    if (start === end) {
      // No selection, select all
      setSelectedText(aiResponse);
      setSelectionRange({ start: 0, end: aiResponse.length });
    } else {
      // Use selected text
      const selectedText = aiResponse.substring(start, end);
      setSelectedText(selectedText);
      setSelectionRange({ start, end });
    }
    
    setShowExtractModal(true);
  };

  const contentToDisplay = resolvedContent || document.content || '';
  const hasResponse = aiResponse && aiResponse.trim();
  const canSubmit = selectedModel && selectedProviderId && contentToDisplay.trim() && 
                   (aiStatus !== 'pending' && aiStatus !== 'processing');

  return (
    <div className="document-viewer">
      <div className="document-viewer__header">
        <h3>{document.title}</h3>
        <div className="document-viewer__info">
          <span className="document-type">Type: {document.document_type}</span>
          <span className="credit-balance">
            Credits: {userCredits.toLocaleString()}
            <button 
              className="btn btn--link btn--xs" 
              onClick={loadUserCredits}
              style={{ marginLeft: '8px', fontSize: '0.8em' }}
            >
              🔄
            </button>
          </span>
        </div>
      </div>

      {/* Prompt Content Section */}
      <div className="document-section">
        <div className="document-section__header">
          <h4>Prompt Content</h4>
          {document.is_composite && (
            <button className="btn btn--secondary btn--sm" onClick={onResolve}>
              {resolvedContent ? 'Refresh' : 'Resolve'} Components
            </button>
          )}
        </div>
        <div className="document-content">
          <pre>{contentToDisplay}</pre>
        </div>
      </div>

      {/* AI Configuration Section */}
      <div className="document-section">
        <div className="document-section__header">
          <h4>AI Configuration</h4>
        </div>
        <div className="ai-config">
          <div className="form-group">
            <label className="form-label">
              AI Provider:
              <select
                className="form-input"
                value={selectedProviderId}
                onChange={(e) => setSelectedProviderId(e.target.value)}
              >
                <option value="">Select a provider...</option>
                {aiProviders.map(provider => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedProviderId && (
            <div className="form-group">
              <label className="form-label">
                Model:
                {isLoadingModels ? (
                  <div className="loading-indicator">Loading models...</div>
                ) : (
                  <>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Search models..."
                      value={modelSearchTerm}
                      onChange={(e) => setModelSearchTerm(e.target.value)}
                    />
                    <select
                      className="form-input"
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      size={Math.min(filteredModels.length + 1, 8)}
                    >
                      <option value="">Select a model...</option>
                      {filteredModels.map(model => (
                        <option key={model.id} value={model.id}>
                          {model.name} {model.description && `- ${model.description}`}
                        </option>
                      ))}
                    </select>
                    {filteredModels.length === 0 && modelSearchTerm && (
                      <small className="text-muted">No models found matching "{modelSearchTerm}"</small>
                    )}
                  </>
                )}
              </label>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              Max Tokens:
              <input
                type="number"
                className="form-input"
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                min={1}
                max={8000}
              />
            </label>
          </div>

          <div className="ai-actions">
            <button
              className="btn btn--secondary"
              onClick={handleEstimateCost}
              disabled={!selectedModel || !selectedProviderId || isEstimating}
            >
              {isEstimating ? 'Estimating...' : 'Estimate Cost'}
            </button>

            <button
              className="btn btn--primary"
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? 'Processing...' : 'Submit Request'}
            </button>
          </div>

          {costEstimate && (
            <div className="cost-estimate">
              <small>
                Estimated cost: {costEstimate.estimatedMaxCost.toLocaleString()} credits
                (Input: {costEstimate.inputTokens} tokens)
              </small>
            </div>
          )}
        </div>
      </div>

      {/* AI Response Section */}
      {(hasResponse || aiStatus === 'processing' || aiStatus === 'failed') && (
        <div className="document-section">
          <div className="document-section__header">
            <h4>AI Response</h4>
            <div className="document-section__actions">
              {aiStatus === 'processing' && <span className="status-indicator processing">Processing...</span>}
              {aiStatus === 'completed' && <span className="status-indicator completed">Completed</span>}
              {aiStatus === 'failed' && <span className="status-indicator failed">Failed</span>}
              {hasResponse && (
                <button 
                  className="btn btn--secondary btn--sm"
                  onClick={handleExtractFromResponse}
                >
                  Extract Text
                </button>
              )}
            </div>
          </div>
          
          {aiStatus === 'processing' && (
            <div className="loading-state">
              <p>Processing your request...</p>
            </div>
          )}
          
          {aiStatus === 'failed' && (
            <div className="error-state">
              <p>Request failed. Please try again.</p>
            </div>
          )}

          {hasResponse && (
            <>
              {/* Response metadata */}
              {document.last_ai_response && aiResponse === document.last_ai_response && (
                <div className="response-metadata">
                  <small style={{ color: '#666', fontSize: '0.85em' }}>
                    Saved response from {document.last_ai_provider_id}/{document.last_ai_model_id} • 
                    Max tokens: {document.last_ai_max_tokens} • 
                    Generated: {document.last_ai_response_timestamp ? 
                      new Date(document.last_ai_response_timestamp).toLocaleString() : 'Unknown'}
                  </small>
                </div>
              )}
              
              <div className="document-content">
                <textarea
                  ref={responseRef}
                  value={aiResponse}
                  readOnly
                  className="form-input"
                  rows={Math.max(10, aiResponse.split('\n').length + 2)}
                  style={{ resize: 'vertical', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Extract Modal */}
      {showExtractModal && selectedText && selectionRange && (
        <ExtractTextModal
          sourceDocument={document}
          selectedText={selectedText}
          allDocuments={allDocuments}
          onConfirm={(title: string, documentType: string, groupId?: string) => {
            onCreateFromSelection?.(selectedText, selectionRange, title, documentType, groupId);
            setShowExtractModal(false);
            setSelectedText('');
            setSelectionRange(null);
          }}
          onCancel={() => {
            setShowExtractModal(false);
            setSelectedText('');
            setSelectionRange(null);
          }}
        />
      )}
    </div>
  );
}