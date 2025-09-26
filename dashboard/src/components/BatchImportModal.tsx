import { useState } from 'react';

interface ValidationError {
  type: 'validation' | 'file_missing' | 'constraint' | 'database';
  row?: number;
  filename?: string;
  field?: string;
  message: string;
  group_name?: string;
}

interface BatchImportResult {
  success: boolean;
  errors?: ValidationError[];
  warnings?: string[];
  created?: {
    documents: number;
    groups: number;
    tags: number;
    events: number;
  };
}

interface BatchImportModalProps {
  projectId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function BatchImportModal({ projectId, onSuccess, onCancel }: BatchImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<BatchImportResult | null>(null);
  const [importResult, setImportResult] = useState<BatchImportResult | null>(null);
  const [currentStep, setCurrentStep] = useState<'select' | 'validate' | 'confirm' | 'result'>('select');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.name.toLowerCase().endsWith('.zip')) {
      setSelectedFile(file);
      setValidationResult(null);
      setImportResult(null);
      setCurrentStep('select');
    } else {
      alert('Please select a ZIP file');
    }
  };

  const handleValidate = async () => {
    if (!selectedFile) return;

    setIsValidating(true);
    const formData = new FormData();
    formData.append('zipFile', selectedFile);

    try {
      const { supabase } = await import('../supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authentication token found');
      }
      const token = session.access_token;

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/batch-import/${projectId}/validate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setValidationResult(result);
      setCurrentStep('validate');
    } catch (error) {
      console.error('Validation failed:', error);
      setValidationResult({
        success: false,
        errors: [{
          type: 'validation',
          message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      });
      setCurrentStep('validate');
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('zipFile', selectedFile);

    try {
      const { supabase } = await import('../supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authentication token found');
      }
      const token = session.access_token;

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/batch-import/${projectId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setImportResult(result);
      setCurrentStep('result');

      if (result.success) {
        // Auto-close after success
        setTimeout(() => {
          onSuccess();
        }, 3000);
      }
    } catch (error) {
      console.error('Import failed:', error);
      setImportResult({
        success: false,
        errors: [{
          type: 'database',
          message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      });
      setCurrentStep('result');
    } finally {
      setIsUploading(false);
    }
  };

  const renderErrors = (errors: ValidationError[] | undefined) => {
    if (!errors || errors.length === 0) return null;

    return (
      <div className="batch-import-errors">
        <h4>Errors:</h4>
        {errors.map((error, index) => (
          <div key={index} className="error-item">
            <div className="error-header">
              <span className="error-type">{error.type}</span>
              {error.row && <span className="error-row">Row {error.row}</span>}
              {error.filename && <span className="error-filename">{error.filename}</span>}
            </div>
            <div className="error-message">{error.message}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderWarnings = (warnings: string[] | undefined) => {
    if (!warnings || warnings.length === 0) return null;

    return (
      <div className="batch-import-warnings">
        <h4>Warnings:</h4>
        {warnings.map((warning, index) => (
          <div key={index} className="warning-item">{warning}</div>
        ))}
      </div>
    );
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content batch-import-modal">
        <div className="modal-header">
          <h3>Batch Import Documents</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>

        <div className="modal-body">
          {currentStep === 'select' && (
            <div className="step-select">
              <div className="batch-import-instructions">
                <h4>Instructions:</h4>
                <ol>
                  <li>Create a ZIP file containing your markdown (.md) files</li>
                  <li>Include a <code>manifest.csv</code> file with the following columns:
                    <ul>
                      <li><strong>filename</strong> - Name of the .md file (required)</li>
                      <li><strong>title</strong> - Document title (required)</li>
                      <li><strong>alias</strong> - Comma-separated aliases for autocomplete (optional)</li>
                      <li><strong>group_name</strong> - Group to assign document (optional)</li>
                      <li><strong>tags</strong> - Comma-separated tags (optional)</li>
                      <li><strong>document_type</strong> - Document type (optional)</li>
                      <li><strong>group_head</strong> - "true" if this should be the group head (optional)</li>
                      <li><strong>event_name</strong> - Event to link to (optional)</li>
                    </ul>
                  </li>
                  <li>Upload the ZIP file and validate before importing</li>
                </ol>
              </div>

              <div className="file-upload-section">
                <label className="file-upload-label">
                  <input
                    type="file"
                    accept=".zip"
                    onChange={handleFileSelect}
                    className="file-upload-input"
                  />
                  {selectedFile ? (
                    <div className="file-selected">
                      <span className="file-icon">📁</span>
                      <span className="file-name">{selectedFile.name}</span>
                      <span className="file-size">({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </div>
                  ) : (
                    <div className="file-placeholder">
                      <span className="upload-icon">⬆️</span>
                      <span>Choose ZIP file or drag and drop</span>
                    </div>
                  )}
                </label>
              </div>
            </div>
          )}

          {currentStep === 'validate' && validationResult && (
            <div className="step-validate">
              <h4>Validation Results</h4>

              {validationResult.success ? (
                <div className="validation-success">
                  <div className="success-message">✅ Validation passed! Ready to import.</div>
                  {renderWarnings(validationResult.warnings)}
                </div>
              ) : (
                <div className="validation-failed">
                  <div className="error-message">❌ Validation failed. Please fix the errors below:</div>
                  {renderErrors(validationResult.errors)}
                  {renderWarnings(validationResult.warnings)}
                </div>
              )}
            </div>
          )}

          {currentStep === 'result' && importResult && (
            <div className="step-result">
              <h4>Import Results</h4>

              {importResult.success ? (
                <div className="import-success">
                  <div className="success-message">✅ Import completed successfully!</div>
                  {importResult.created && (
                    <div className="import-stats">
                      <h5>Created:</h5>
                      <ul>
                        <li>{importResult.created.documents} documents</li>
                        <li>{importResult.created.groups} groups</li>
                        <li>{importResult.created.tags} tags</li>
                        <li>{importResult.created.events} events</li>
                      </ul>
                    </div>
                  )}
                  {renderWarnings(importResult.warnings)}
                  <div className="auto-close-notice">
                    This dialog will close automatically in 3 seconds...
                  </div>
                </div>
              ) : (
                <div className="import-failed">
                  <div className="error-message">❌ Import failed:</div>
                  {renderErrors(importResult.errors)}
                  {renderWarnings(importResult.warnings)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          {currentStep === 'select' && (
            <>
              <button
                className="btn btn--secondary"
                onClick={onCancel}
              >
                Cancel
              </button>
              <button
                className="btn btn--primary"
                onClick={handleValidate}
                disabled={!selectedFile || isValidating}
              >
                {isValidating ? 'Validating...' : 'Validate'}
              </button>
            </>
          )}

          {currentStep === 'validate' && validationResult && (
            <>
              <button
                className="btn btn--secondary"
                onClick={() => setCurrentStep('select')}
              >
                Back
              </button>
              {validationResult.success ? (
                <button
                  className="btn btn--primary"
                  onClick={handleImport}
                  disabled={isUploading}
                >
                  {isUploading ? 'Importing...' : 'Import'}
                </button>
              ) : (
                <button
                  className="btn btn--secondary"
                  onClick={() => setCurrentStep('select')}
                >
                  Fix Errors
                </button>
              )}
            </>
          )}

          {currentStep === 'result' && (
            <button
              className="btn btn--primary"
              onClick={onSuccess}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}