import {
  DecoratorNode,
  type NodeKey,
  type DOMExportOutput,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useState, useCallback, createContext, useContext } from 'react';
import { marked } from 'marked';

// Context for passing document data to ComponentBlockNodes
interface ComponentDataContextType {
  documents: Document[];
  currentComponents: Record<string, string>;
  onComponentAdd?: (key: string, documentId: string) => void;
}

const ComponentDataContext = createContext<ComponentDataContextType | null>(null);

export const ComponentDataProvider = ComponentDataContext.Provider;

export const useComponentData = () => {
  const context = useContext(ComponentDataContext);
  return context || { documents: [], currentComponents: {}, onComponentAdd: undefined };
};

// Define proper types for document structure
interface Document {
  id: string;
  title: string;
  group_id?: string | null;
  document_type?: string;
  content?: string;
}

export type SerializedComponentBlockNode = {
  componentKey: string;
  resolvedContent: string;
  isExpanded: boolean;
  type: 'component-block';
  version: 1;
};

export class ComponentBlockNode extends DecoratorNode<JSX.Element> {
  __componentKey: string;
  __resolvedContent: string;
  __isExpanded: boolean;

  static getType(): string {
    return 'component-block';
  }

  static clone(node: ComponentBlockNode): ComponentBlockNode {
    return new ComponentBlockNode(
      node.__componentKey,
      node.__resolvedContent,
      node.__isExpanded,
      node.__key
    );
  }

  constructor(
    componentKey?: string,
    resolvedContent?: string,
    isExpanded?: boolean,
    key?: NodeKey
  ) {
    super(key);
    this.__componentKey = componentKey ?? '';
    this.__resolvedContent = resolvedContent ?? '';
    this.__isExpanded = isExpanded ?? false; // Default to collapsed

    console.log('🎨 ComponentBlockNode constructor called:', {
      componentKey,
      resolvedContent: resolvedContent?.substring(0, 50) + '...',
      isExpanded,
      key
    });
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div');
    div.className = 'lexical-component-block';
    return div;
  }

  updateDOM(): false {
    return false;
  }

  // CRITICAL: Export as {{key}} to preserve markdown format
  exportDOM(): DOMExportOutput {
    const element = document.createElement('span');
    element.textContent = `{{${this.__componentKey}}}`;
    return { element };
  }

  decorate(): JSX.Element {
    console.log('🖼️ ComponentBlockNode decorate called:', {
      componentKey: this.__componentKey,
      isExpanded: this.__isExpanded,
      hasContent: !!this.__resolvedContent
    });

    return (
      <ComponentBlockComponent
        node={this}
        componentKey={this.__componentKey}
        resolvedContent={this.__resolvedContent}
        isExpanded={this.__isExpanded}
      />
    );
  }

  static importJSON(serializedNode: SerializedComponentBlockNode): ComponentBlockNode {
    const { componentKey, resolvedContent, isExpanded } = serializedNode;
    return $createComponentBlockNode(componentKey, resolvedContent, isExpanded);
  }

  exportJSON(): SerializedComponentBlockNode {
    return {
      componentKey: this.__componentKey,
      resolvedContent: this.__resolvedContent,
      isExpanded: this.__isExpanded,
      type: 'component-block',
      version: 1,
    };
  }

  getComponentKey(): string {
    return this.__componentKey;
  }

  setExpanded(isExpanded: boolean): void {
    const writable = this.getWritable();
    writable.__isExpanded = isExpanded;
  }

  getExpanded(): boolean {
    return this.__isExpanded;
  }

  setComponentKey(componentKey: string): void {
    const writable = this.getWritable();
    writable.__componentKey = componentKey;
  }

  isInline(): false {
    return false;
  }
}

interface ComponentBlockComponentProps {
  node: ComponentBlockNode;
  componentKey: string;
  resolvedContent: string;
  isExpanded: boolean;
}


function ComponentBlockComponent({
  node,
  componentKey,
  resolvedContent,
  isExpanded
}: ComponentBlockComponentProps) {
  const [editor] = useLexicalComposerContext();
  const [expanded, setExpanded] = useState(isExpanded);
  const [showDocumentPicker, setShowDocumentPicker] = useState(false);
  const [showKeyEditor, setShowKeyEditor] = useState(false);
  const [newKey, setNewKey] = useState(componentKey);
  const { documents, currentComponents, onComponentAdd } = useComponentData();

  console.log('🎭 ComponentBlockComponent rendered:', {
    componentKey,
    isExpanded,
    expanded,
    hasResolvedContent: !!resolvedContent
  });

  const handleToggleExpanded = useCallback(() => {
    const newState = !expanded;
    setExpanded(newState);

    editor.update(() => {
      const writableNode = node.getWritable();
      writableNode.__isExpanded = newState;
    });
  }, [editor, node, expanded]);

  // Data now comes from props passed from parent editor

  const getCurrentGroup = () => {
    const currentDocId = currentComponents[componentKey];
    if (!currentDocId) return 'new';
    const doc = documents.find(d => d.id === currentDocId);
    return doc ? doc.title : 'new';
  };

  const getGroupOptions = () => {
    const groups = Array.from(new Set(Object.values(currentComponents)))
      .map(groupId => documents.find(d => d.id === groupId))
      .filter(Boolean)
      .map(doc => ({ value: doc!.title, label: doc!.title }));

    groups.push({ value: 'new', label: '+ Add New Group' });
    return groups;
  };

  const getDocumentOptions = () => {
    const currentGroup = getCurrentGroup();
    if (currentGroup === 'new') return [{ value: 'new', label: 'Select group first' }];

    const currentGroupId = documents.find(d => d.title === currentGroup)?.id;
    const docsInGroup = Object.entries(currentComponents)
      .filter(([_, groupId]) => groupId === currentGroupId)
      .map(([key, _]) => ({ value: key, label: key }));

    return docsInGroup;
  };

  const handleGroupChange = (groupName: string) => {
    if (groupName === 'new') {
      // Show document picker to create new group mapping
      setShowDocumentPicker(true);
      return;
    }

    // Validate group exists
    const groupDoc = documents.find(d => d.title === groupName);
    if (!groupDoc) {
      alert(`Group "${groupName}" not found`);
      return;
    }

    if (onComponentAdd) {
      onComponentAdd(componentKey, groupDoc.id);
      console.log(`Component "${componentKey}" mapped to group "${groupName}"`);
    } else {
      console.warn('No onComponentAdd handler available');
    }
  };

  const handleDocumentSelect = (documentId: string) => {
    // Validate document exists
    const selectedDoc = documents.find(d => d.id === documentId);
    if (!selectedDoc) {
      alert('Selected document not found');
      setShowDocumentPicker(false);
      return;
    }

    if (onComponentAdd) {
      onComponentAdd(componentKey, documentId);
      console.log(`Component "${componentKey}" mapped to document "${selectedDoc.title}" (${documentId})`);
    } else {
      console.warn('No onComponentAdd handler available');
    }
    setShowDocumentPicker(false);
  };

  const handleKeyChange = () => {
    // Validate the new key
    if (!newKey || newKey.trim() === '') {
      alert('Component key cannot be empty');
      setNewKey(componentKey);
      setShowKeyEditor(false);
      return;
    }

    // Check for invalid characters
    const validKeyPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validKeyPattern.test(newKey.trim())) {
      alert('Component key can only contain letters, numbers, underscores, and dashes');
      setNewKey(componentKey);
      setShowKeyEditor(false);
      return;
    }

    const trimmedKey = newKey.trim();
    if (trimmedKey !== componentKey) {
      const currentDocId = currentComponents[componentKey];

      // Update the component key
      editor.update(() => {
        node.setComponentKey(trimmedKey);
      });

      // Update the mapping if we have a document
      if (currentDocId && onComponentAdd) {
        onComponentAdd(trimmedKey, currentDocId);
      }

      console.log(`Component key changed from "${componentKey}" to "${trimmedKey}"`);
    }
    setShowKeyEditor(false);
    setNewKey(trimmedKey);
  };

  const handleComponentChange = (newKey: string) => {

    if (newKey === componentKey) return; // No change

    // Update the component mapping to the new key
    if (onComponentAdd) {
      const currentDocId = currentComponents[componentKey];
      if (currentDocId) {
        // Map the new key to the same document
        onComponentAdd(newKey, currentDocId);

        // Update the node to use the new key
        editor.update(() => {
          node.setComponentKey(newKey);
        });
      }
    }
  };

  const getResolvedContent = () => {
    const currentDocId = currentComponents[componentKey];
    if (!currentDocId) return null;

    // Find the actual document and return its content
    const doc = documents.find(d => d.id === currentDocId);
    return doc?.content || null;
  };

  if (!expanded) {
    // Collapsed state - show {{key}} placeholder (clickable to expand)
    return (
      <span
        className="component-block-collapsed"
        onClick={handleToggleExpanded}
        style={{
          display: 'inline-block',
          backgroundColor: '#e3f2fd',
          border: '1px solid #2196f3',
          borderRadius: '4px',
          padding: '2px 6px',
          margin: '0 2px',
          fontSize: '0.9em',
          fontFamily: 'monospace',
          cursor: 'pointer',
          userSelect: 'none'
        }}
        title="Click to expand component"
      >
        {`{{${componentKey}}}`}
      </span>
    );
  }

  // Expanded state - show component content with simple header
  return (
    <div
      className="component-block-expanded"
      style={{
        border: '2px solid #2196f3',
        borderRadius: '6px',
        margin: '8px 0',
        backgroundColor: '#f8f9fa'
      }}
    >
      {/* Two-level Group/Document picker header */}
      <div
        style={{
          backgroundColor: '#2196f3',
          color: 'white',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.85em',
          fontWeight: '500'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Component:</span>

          {!showKeyEditor ? (
            <span
              onClick={() => setShowKeyEditor(true)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '0.85em',
                cursor: 'pointer',
                fontFamily: 'monospace'
              }}
              title="Click to edit component key"
            >
              {`{{${componentKey}}}`}
            </span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleKeyChange()}
                onBlur={handleKeyChange}
                style={{
                  background: 'rgba(255,255,255,0.9)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: 'black',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '0.85em',
                  minWidth: '80px'
                }}
                autoFocus
              />
              <button
                onClick={handleKeyChange}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '0.8em',
                  cursor: 'pointer'
                }}
              >
                ✓
              </button>
            </div>
          )}

          <span>→</span>

          {/* Group Picker */}
          <select
            value={getCurrentGroup()}
            onChange={(e) => handleGroupChange(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '0.85em',
              minWidth: '120px'
            }}
          >
            {getGroupOptions().map(group => (
              <option key={group.value} value={group.value} style={{ color: 'black' }}>
                {group.label}
              </option>
            ))}
          </select>

          <span>→</span>

          {/* Document Picker */}
          <select
            value={componentKey}
            onChange={(e) => handleComponentChange(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '0.85em',
              minWidth: '120px'
            }}
          >
            {getDocumentOptions().map(doc => (
              <option key={doc.value} value={doc.value} style={{ color: 'black' }}>
                {doc.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleToggleExpanded}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: 'white',
            padding: '2px 8px',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '0.8em'
          }}
          title="Collapse to placeholder"
        >
          Collapse
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          padding: '12px',
          backgroundColor: 'white',
          borderBottomLeftRadius: '4px',
          borderBottomRightRadius: '4px'
        }}
      >
        {getResolvedContent() ? (
          <div
            style={{
              fontFamily: 'inherit',
              lineHeight: '1.5',
              color: '#333'
            }}
            dangerouslySetInnerHTML={{
              __html: marked(getResolvedContent() || '') as string
            }}
          />
        ) : (
          <div style={{
            color: '#999',
            fontStyle: 'italic',
            padding: '20px',
            textAlign: 'center',
            backgroundColor: '#f8f9fa'
          }}>
            <div>🔍 Component content not resolved</div>
            <div style={{ fontSize: '0.85em', marginTop: '8px' }}>
              Key "{componentKey}" is not mapped to any document.<br/>
              Use the group and document selectors above to map it.
            </div>
          </div>
        )}
      </div>

      {/* Document Picker Modal */}
      {showDocumentPicker && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowDocumentPicker(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '20px',
              minWidth: '400px',
              maxHeight: '500px',
              overflow: 'auto',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Select Document for {`{{${componentKey}}}`}</h3>
            <div style={{ marginBottom: '16px' }}>
              <input
                type="text"
                placeholder="Search documents..."
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {documents.length === 0 ? (
                <p style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
                  No documents available
                </p>
              ) : (
                documents.map(doc => (
                  <div
                    key={doc.id}
                    onClick={() => handleDocumentSelect(doc.id)}
                    style={{
                      padding: '12px',
                      border: '1px solid #eee',
                      borderRadius: '4px',
                      marginBottom: '8px',
                      cursor: 'pointer',
                      backgroundColor: currentComponents[componentKey] === doc.id ? '#e3f2fd' : 'white',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (currentComponents[componentKey] !== doc.id) {
                        e.currentTarget.style.backgroundColor = '#f5f5f5';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (currentComponents[componentKey] !== doc.id) {
                        e.currentTarget.style.backgroundColor = 'white';
                      }
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{doc.title}</div>
                    {doc.document_type && (
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                        Type: {doc.document_type}
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      ID: {doc.id.substring(0, 8)}...
                    </div>
                  </div>
                ))
              )}
            </div>
            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button
                onClick={() => setShowDocumentPicker(false)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  backgroundColor: '#f5f5f5',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function $createComponentBlockNode(
  componentKey?: string,
  resolvedContent?: string,
  isExpanded?: boolean
): ComponentBlockNode {
  return new ComponentBlockNode(componentKey, resolvedContent, isExpanded);
}

export function $isComponentBlockNode(node: unknown): node is ComponentBlockNode {
  return node instanceof ComponentBlockNode;
}