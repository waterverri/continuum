import { useState, useEffect } from 'react';
import type { Preset, Document } from '../api';

interface ComponentOverride {
  componentKey: string;
  namespacedKey: string;  // docid.componentkey for namespacing
  sourceDocumentId: string;
  sourceDocumentTitle: string;
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

  // Extract component references recursively from all documents in the preset tree
  useEffect(() => {
    if (!preset.document) return;

    const extractComponentReferencesRecursively = (
      docId: string, 
      content: string, 
      components: Record<string, string> = {},
      visited: Set<string> = new Set(),
      parentPath: string[] = []
    ): ComponentOverride[] => {
      const overrides: ComponentOverride[] = [];
      const existingOverrides = preset.rules.component_overrides || {};
      
      // Prevent infinite recursion
      if (visited.has(docId)) return overrides;
      visited.add(docId);

      const currentDoc = documents.find(d => d.id === docId);
      if (!currentDoc) return overrides;
      
      // Parse component references from content
      const componentRegex = /{{([^}]+)}}/g;
      const matches = content.matchAll(componentRegex);
      
      for (const match of matches) {
        const componentKey = match[1];
        if (!componentKey) continue;
        
        let referencedDocId = components[componentKey];
        if (!referencedDocId) continue;
        
        let referencedDoc: typeof documents[0] | undefined;
        
        // Handle group references: group:groupId or group:groupId:preferredType
        if (referencedDocId.startsWith('group:')) {
          const groupParts = referencedDocId.split(':');
          const groupId = groupParts[1];
          const preferredType = groupParts[2] || null;
          
          // Find documents in the group
          let groupDocs = documents.filter(d => d.group_id === groupId);
          
          if (preferredType) {
            // Try to find document with preferred type first
            const preferredDoc = groupDocs.find(d => d.document_type === preferredType);
            if (preferredDoc) {
              referencedDoc = preferredDoc;
              referencedDocId = preferredDoc.id; // Update to actual document ID
            }
          }
          
          // If no preferred type or preferred type not found, use first document in group
          if (!referencedDoc && groupDocs.length > 0) {
            referencedDoc = groupDocs[0];
            referencedDocId = groupDocs[0].id; // Update to actual document ID
          }
        } else {
          // Direct document ID reference
          referencedDoc = documents.find(d => d.id === referencedDocId);
        }
        
        if (!referencedDoc) continue;

        // Create namespaced key for this component
        const namespacedKey = `${docId}.${componentKey}`;
        
        // Check for overrides using both global and namespaced keys
        const overrideDocId = existingOverrides[namespacedKey] || existingOverrides[componentKey];
        const overrideDoc = overrideDocId ? documents.find(d => d.id === overrideDocId) : undefined;
        
        overrides.push({
          componentKey,
          namespacedKey,
          sourceDocumentId: docId,
          sourceDocumentTitle: currentDoc.title,
          originalDocumentId: referencedDocId,
          originalDocumentTitle: referencedDoc.title,
          overrideDocumentId: overrideDocId,
          overrideDocumentTitle: overrideDoc?.title
        });

        // If the referenced document is composite, recursively extract its components
        if (referencedDoc.is_composite && referencedDoc.components) {
          const nestedOverrides = extractComponentReferencesRecursively(
            referencedDocId,
            referencedDoc.content || '',
            referencedDoc.components,
            new Set(visited), // Create new visited set to avoid cross-contamination
            [...parentPath, componentKey]
          );
          overrides.push(...nestedOverrides);
        }
      }
      
      return overrides;
    };

    // Start extraction from the base document
    if (preset.document.is_composite && preset.document.components) {
      const allOverrides = extractComponentReferencesRecursively(
        preset.document.id,
        preset.document.content || '',
        preset.document.components
      );
      setComponentOverrides(allOverrides);
    } else {
      setComponentOverrides([]);
    }
  }, [preset, documents]);

  const handleOverrideSelect = (namespacedKey: string, documentId: string) => {
    const selectedDoc = documents.find(d => d.id === documentId);
    
    setComponentOverrides(prev => prev.map(override =>
      override.namespacedKey === namespacedKey
        ? {
            ...override,
            overrideDocumentId: documentId,
            overrideDocumentTitle: selectedDoc?.title
          }
        : override
    ));
  };

  const handleClearOverride = (namespacedKey: string) => {
    setComponentOverrides(prev => prev.map(override =>
      override.namespacedKey === namespacedKey
        ? {
            ...override,
            overrideDocumentId: undefined,
            overrideDocumentTitle: undefined
          }
        : override
    ));
  };

  const toggleComponentExpansion = (namespacedKey: string) => {
    setExpandedComponents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(namespacedKey)) {
        newSet.delete(namespacedKey);
      } else {
        newSet.add(namespacedKey);
      }
      return newSet;
    });
  };

  const handleExpandAll = () => {
    setExpandedComponents(new Set(componentOverrides.map(o => o.namespacedKey)));
  };

  const handleCollapseAll = () => {
    setExpandedComponents(new Set());
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const overrides: Record<string, string> = {};
      componentOverrides.forEach(override => {
        if (override.overrideDocumentId) {
          // Use namespaced key for more precise override control
          overrides[override.namespacedKey] = override.overrideDocumentId;
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
                  <div key={override.namespacedKey} className="component-override-card">
                    <div className="component-header">
                      <div className="component-info">
                        <div className="component-key-info">
                          <span className="component-key">{override.componentKey}</span>
                          <span className="component-source">in {override.sourceDocumentTitle}</span>
                        </div>
                        <button
                          className="expand-toggle"
                          onClick={() => toggleComponentExpansion(override.namespacedKey)}
                        >
                          {expandedComponents.has(override.namespacedKey) ? '▼' : '▶'}
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

                    {expandedComponents.has(override.namespacedKey) && (
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
                                  handleOverrideSelect(override.namespacedKey, e.target.value);
                                } else {
                                  handleClearOverride(override.namespacedKey);
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
                                  onClick={() => handleClearOverride(override.namespacedKey)}
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