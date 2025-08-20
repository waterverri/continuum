import { useState, useEffect, useRef } from 'react';
import type { Document, AIProvider, CostEstimate, AIStatus } from '../api';
import { estimateAICost, submitAIRequest, getAIStatus, getUserCredits } from '../api';
import { ExtractTextModal } from './ExtractTextModal';

interface PromptDocumentViewerProps {
  document: Document;
  resolvedContent: string | null;
  onResolve: () => void;
  aiProviders: AIProvider[];
  accessToken: string;
  onCreateFromSelection?: (selectedText: string, selectionInfo: { start: number; end: number }, title: string, documentType: string) => void;
  onRefreshDocument: () => void;
}

export function PromptDocumentViewer({ 
  document, 
  resolvedContent, 
  onResolve, 
  aiProviders,
  accessToken,
  onCreateFromSelection,
  onRefreshDocument
}: PromptDocumentViewerProps) {
  const [selectedModel, setSelectedModel] = useState(document.ai_model || '');
  const [maxTokens, setMaxTokens] = useState(4000);
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userCredits, setUserCredits] = useState(0);
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const responseRef = useRef<HTMLDivElement>(null);

  const allModels = aiProviders.flatMap(provider => 
    provider.models.map(model => ({ providerId: provider.id, providerName: provider.name, model }))
  );

  const selectedProvider = aiProviders.find(p => p.models.includes(selectedModel));

  // Load initial data
  useEffect(() => {
    loadUserCredits();
    if (document.ai_status) {
      loadAIStatus();
    }
  }, [document.id]);

  // Set up polling for pending/processing requests
  useEffect(() => {
    if (aiStatus?.status === 'pending' || aiStatus?.status === 'processing') {
      const interval = setInterval(() => {
        loadAIStatus();
      }, 3000);
      setPollingInterval(interval);
      return () => clearInterval(interval);
    } else {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    }
  }, [aiStatus?.status]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, []);

  const loadUserCredits = async () => {
    try {
      const credits = await getUserCredits(accessToken);
      setUserCredits(credits);
    } catch (error) {
      console.error('Failed to load user credits:', error);
    }
  };

  const loadAIStatus = async () => {
    try {
      const status = await getAIStatus(document.id, accessToken);
      setAiStatus(status);
      
      // If completed or failed, refresh the document to get updated data
      if ((status.status === 'completed' || status.status === 'failed') && 
          (aiStatus?.status === 'pending' || aiStatus?.status === 'processing')) {
        onRefreshDocument();
      }
    } catch (error) {
      console.error('Failed to load AI status:', error);
    }
  };

  const handleEstimateCost = async () => {
    if (!selectedModel || !selectedProvider) return;

    setIsEstimating(true);
    try {
      const estimate = await estimateAICost(selectedProvider.id, selectedModel, document.id, accessToken);
      setCostEstimate(estimate);
    } catch (error) {
      console.error('Failed to estimate cost:', error);
      alert('Failed to estimate cost. Please try again.');
    } finally {
      setIsEstimating(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!selectedModel || !selectedProvider || !costEstimate) return;

    if (userCredits < costEstimate.estimatedMaxCost) {
      alert('Insufficient credits for this request. Please add more credits.');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitAIRequest(document.id, selectedProvider.id, selectedModel, maxTokens, accessToken);
      setAiStatus({ status: 'pending' });
      await loadUserCredits(); // Refresh credits after submission
    } catch (error) {
      console.error('Failed to submit AI request:', error);
      alert(`Failed to submit AI request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResponseTextSelection = () => {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        setSelectedText('');
        setSelectionRange(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const selectedText = selection.toString().trim();
      
      // Check if selection is within the response content
      const isInResponse = responseRef.current && range.commonAncestorContainer && 
          (responseRef.current.contains(range.commonAncestorContainer) || 
           responseRef.current === range.commonAncestorContainer);
      
      if (selectedText && isInResponse && document.ai_response) {
        const startIndex = document.ai_response.indexOf(selectedText);
        
        if (startIndex !== -1) {
          setSelectedText(selectedText);
          setSelectionRange({
            start: startIndex,
            end: startIndex + selectedText.length
          });
        }
      } else {
        setSelectedText('');
        setSelectionRange(null);
      }
    } catch (error) {
      console.error('Error handling text selection:', error);
    }
  };

  const handleExtractFromResponse = () => {
    if (!selectedText || !selectionRange) return;
    setShowExtractModal(true);
  };

  const contentToDisplay = resolvedContent || document.content || '';
  const hasResponse = document.ai_response && document.ai_response.trim();
  const canSubmit = selectedModel && selectedProvider && contentToDisplay.trim() && 
                   (!aiStatus || (aiStatus.status !== 'pending' && aiStatus.status !== 'processing'));

  return (
    <div className="document-viewer">
      <div className="document-viewer__header">
        <h3>{document.title}</h3>
        <div className="document-viewer__info">
          <span className="document-type">Type: {document.document_type}</span>
          <span className="credit-balance">Credits: {userCredits.toLocaleString()}</span>
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

      {/* AI Controls Section */}
      <div className="document-section">
        <h4>AI Configuration</h4>
        
        <div className="ai-controls">
          <div className="form-group">
            <label className="form-label">
              AI Model:
              <select
                className="form-input"
                value={selectedModel}
                onChange={(e) => {
                  setSelectedModel(e.target.value);
                  setCostEstimate(null); // Reset cost estimate when model changes
                }}
              >
                <option value="">Select an AI model...</option>
                {allModels.map(({ providerId, providerName, model }) => (
                  <option key={`${providerId}-${model}`} value={model}>
                    {providerName} - {model}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">
              Max Output Tokens:
              <input
                type="number"
                className="form-input"
                value={maxTokens}
                onChange={(e) => {
                  setMaxTokens(parseInt(e.target.value) || 4000);
                  setCostEstimate(null); // Reset cost estimate when tokens change
                }}
                min="100"
                max="32000"
              />
            </label>
          </div>

          <div className="ai-actions">
            <button
              className="btn btn--secondary"
              onClick={handleEstimateCost}
              disabled={!selectedModel || isEstimating}
            >
              {isEstimating ? 'Estimating...' : 'Estimate Cost'}
            </button>

            {costEstimate && (
              <div className="cost-estimate">
                <p>Input tokens: {costEstimate.inputTokens.toLocaleString()}</p>
                <p>Estimated cost: {costEstimate.estimatedMaxCost.toLocaleString()} credits</p>
                <p className="cost-estimate__dollars">
                  (${(costEstimate.estimatedMaxCost / 10000).toFixed(4)})
                </p>
              </div>
            )}

            <button
              className="btn btn--primary"
              onClick={handleSubmitRequest}
              disabled={!canSubmit || isSubmitting || !costEstimate}
            >
              {isSubmitting ? 'Submitting...' : 'Submit to AI'}
            </button>
          </div>
        </div>

        {/* AI Status */}
        {aiStatus && (
          <div className={`ai-status ai-status--${aiStatus.status}`}>
            <h5>AI Status: {aiStatus.status}</h5>
            {aiStatus.model && <p>Model: {aiStatus.model}</p>}
            {aiStatus.tokensUsed && <p>Tokens used: {aiStatus.tokensUsed.toLocaleString()}</p>}
            {aiStatus.costCredits && <p>Cost: {aiStatus.costCredits.toLocaleString()} credits</p>}
            {aiStatus.submittedAt && <p>Submitted: {new Date(aiStatus.submittedAt).toLocaleString()}</p>}
            {aiStatus.completedAt && <p>Completed: {new Date(aiStatus.completedAt).toLocaleString()}</p>}
          </div>
        )}
      </div>

      {/* AI Response Section */}
      {hasResponse && (
        <div className="document-section">
          <div className="document-section__header">
            <h4>AI Response</h4>
            {selectedText && (
              <button 
                className="btn btn--secondary btn--sm"
                onClick={handleExtractFromResponse}
              >
                Extract Selection
              </button>
            )}
          </div>
          <div 
            className="document-content ai-response"
            ref={responseRef}
            onMouseUp={handleResponseTextSelection}
          >
            <pre>{document.ai_response}</pre>
          </div>
        </div>
      )}

      {/* Extract Modal */}
      {showExtractModal && selectedText && selectionRange && (
        <ExtractTextModal
          sourceDocument={document}
          selectedText={selectedText}
          onConfirm={(title: string, documentType: string) => {
            onCreateFromSelection?.(selectedText, selectionRange, title, documentType);
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