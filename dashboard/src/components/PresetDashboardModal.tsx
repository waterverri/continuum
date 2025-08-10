import { useState, useEffect } from 'react';
import type { Preset, Document } from '../api';

interface ComponentOverride {
  componentKey: string;
  originalDocumentId: string;
  originalDocumentTitle: string;
  overrideDocumentId?: string;
  overrideDocumentTitle?: string;
}

interface PresetDashboardModalProps {
  preset: Preset;
  documents: Document[];
  onSave: (presetId: string, overrides: Record<string, string>) => Promise<void>;
  onCancel: () => void;
}

export function PresetDashboardModal({ preset, documents, onSave, onCancel }: PresetDashboardModalProps) {
  const [componentOverrides, setComponentOverrides] = useState<ComponentOverride[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());

  // Extract component references from the preset's base document
  useEffect(() => {
    if (!preset.document) return;

    const extractComponentReferences = (content: string, components: Record<string, string> = {}) => {
      const overrides: ComponentOverride[] = [];
      const existingOverrides = preset.rules.component_overrides || {};
      
      // Parse component references from content
      const componentRegex = /{{([^}]+)}}/g;
      const matches = content.matchAll(componentRegex);
      
      for (const match of matches) {
        const componentKey = match[1];
        if (!componentKey) continue;
        
        const referencedDocId = components[componentKey];
        
        if (referencedDocId) {
          const referencedDoc = documents.find(d => d.id === referencedDocId);
          const overrideDocId = existingOverrides[componentKey];
          const overrideDoc = overrideDocId ? documents.find(d => d.id === overrideDocId) : undefined;
          
          if (referencedDoc) {
            overrides.push({
              componentKey,
              originalDocumentId: referencedDocId,
              originalDocumentTitle: referencedDoc.title,
              overrideDocumentId: overrideDocId,
              overrideDocumentTitle: overrideDoc?.title
            });
          }
        }
      }
      
      return overrides;
    };

    if (preset.document?.is_composite && preset.document.components && preset.document.content) {
      const overrides = extractComponentReferences(
        preset.document.content,
        preset.document.components
      );
      setComponentOverrides(overrides);
    }
  }, [preset, documents]);

  const handleOverrideSelect = (componentKey: string, documentId: string) => {
    const selectedDoc = documents.find(d => d.id === documentId);
    
    setComponentOverrides(prev => prev.map(override =>
      override.componentKey === componentKey
        ? {
            ...override,
            overrideDocumentId: documentId,
            overrideDocumentTitle: selectedDoc?.title
          }
        : override
    ));
  };

  const handleClearOverride = (componentKey: string) => {
    setComponentOverrides(prev => prev.map(override =>
      override.componentKey === componentKey
        ? {
            ...override,
            overrideDocumentId: undefined,
            overrideDocumentTitle: undefined
          }
        : override
    ));
  };

  const toggleComponentExpansion = (componentKey: string) => {
    setExpandedComponents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(componentKey)) {
        newSet.delete(componentKey);
      } else {
        newSet.add(componentKey);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const overrides: Record<string, string> = {};
      componentOverrides.forEach(override => {
        if (override.overrideDocumentId) {
          overrides[override.componentKey] = override.overrideDocumentId;
        }
      });
      
      await onSave(preset.id, overrides);
    } catch (error) {
      console.error('Failed to save preset overrides:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges = componentOverrides.some(override => override.overrideDocumentId);
  const overrideCount = componentOverrides.filter(override => override.overrideDocumentId).length;
  const totalComponents = componentOverrides.length;

  const handleClearAllOverrides = () => {
    setComponentOverrides(prev => prev.map(override => ({
      ...override,
      overrideDocumentId: undefined,
      overrideDocumentTitle: undefined
    })));
  };

  const handleExpandAll = () => {
    setExpandedComponents(new Set(componentOverrides.map(o => o.componentKey)));
  };

  const handleCollapseAll = () => {
    setExpandedComponents(new Set());
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content preset-dashboard-modal">
        <div className="modal-header">
          <h3>📡 Preset Dashboard: {preset.name}</h3>
          <button className="modal-close" onClick={onCancel}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          <div className="preset-info">
            <h4>Base Document</h4>
            <div className="base-document-info">
              <span className="document-title">{preset.document?.title}</span>
              <span className="document-type">{preset.document?.document_type || 'Document'}</span>
            </div>
          </div>

          <div className="component-overrides">
            <div className="section-header">
              <h4>Component Overrides</h4>
              <div className="section-controls">
                {totalComponents > 0 && (
                  <>
                    <span className="override-stats">
                      {overrideCount} of {totalComponents} overridden
                    </span>
                    <button
                      className="btn btn--xs btn--ghost"
                      onClick={expandedComponents.size === totalComponents ? handleCollapseAll : handleExpandAll}
                    >
                      {expandedComponents.size === totalComponents ? 'Collapse All' : 'Expand All'}
                    </button>
                    {overrideCount > 0 && (
                      <button
                        className="btn btn--xs btn--secondary"
                        onClick={handleClearAllOverrides}
                      >
                        Clear All
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            <p className="section-help">
              Override document references without modifying the source document. 
              This allows you to create variations of your preset for different contexts.
            </p>

            {componentOverrides.length === 0 ? (
              <div className="no-components">
                <p>This preset's base document doesn't contain any component references.</p>
                <p>Only composite documents with <code>{'{{}}'}</code> placeholders can have overrides.</p>
              </div>
            ) : (
              <div className="components-list">
                {componentOverrides.map((override) => (
                  <div key={override.componentKey} className="component-override-card">
                    <div className="component-header">
                      <div className="component-info">
                        <span className="component-key">{override.componentKey}</span>
                        <button
                          className="expand-toggle"
                          onClick={() => toggleComponentExpansion(override.componentKey)}
                        >
                          {expandedComponents.has(override.componentKey) ? '▼' : '▶'}
                        </button>
                      </div>
                      <div className="component-status">
                        {override.overrideDocumentId ? (
                          <span className="status-overridden">Overridden</span>
                        ) : (
                          <span className="status-original">Original</span>
                        )}
                      </div>
                    </div>

                    {expandedComponents.has(override.componentKey) && (
                      <div className="component-details">
                        <div className="reference-section">
                          <h5>Original Reference</h5>
                          <div className="document-reference">
                            <span className="doc-title">{override.originalDocumentTitle}</span>
                          </div>
                        </div>

                        <div className="override-section">
                          <h5>Override With</h5>
                          <div className="override-selector">
                            <select
                              value={override.overrideDocumentId || ''}
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleOverrideSelect(override.componentKey, e.target.value);
                                } else {
                                  handleClearOverride(override.componentKey);
                                }
                              }}
                            >
                              <option value="">No override (use original)</option>
                              <optgroup label="Available Documents">
                                {documents
                                  .filter(doc => doc.id !== override.originalDocumentId)
                                  .sort((a, b) => a.title.localeCompare(b.title))
                                  .map(doc => (
                                    <option key={doc.id} value={doc.id}>
                                      📄 {doc.title} {doc.document_type && `(${doc.document_type})`}
                                      {doc.is_composite && ' [Composite]'}
                                    </option>
                                  ))}
                              </optgroup>
                            </select>
                            
                            {override.overrideDocumentId && (
                              <>
                                <button
                                  className="btn btn--xs btn--ghost"
                                  onClick={() => handleClearOverride(override.componentKey)}
                                  title="Clear override"
                                >
                                  Clear
                                </button>
                                <div className="override-preview">
                                  <span className="preview-label">Overriding with:</span>
                                  <span className="preview-document">
                                    📄 {override.overrideDocumentTitle}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button 
            className="btn btn--secondary" 
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button 
            className="btn btn--primary" 
            onClick={handleSave}
            disabled={isLoading || !hasChanges}
          >
            {isLoading ? 'Saving...' : 'Save Overrides'}
          </button>
        </div>
      </div>
    </div>
  );
}