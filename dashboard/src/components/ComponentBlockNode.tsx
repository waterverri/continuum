import {
  DecoratorNode,
  type NodeKey,
  type DOMExportOutput,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useState, useCallback } from 'react';
import { marked } from 'marked';

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

  const handleToggleExpanded = useCallback(() => {
    const newState = !expanded;
    setExpanded(newState);

    editor.update(() => {
      const writableNode = node.getWritable();
      writableNode.__isExpanded = newState;
    });
  }, [editor, node, expanded]);

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
      {/* Simple header */}
      <div
        style={{
          backgroundColor: '#2196f3',
          color: 'white',
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.85em',
          fontWeight: '500'
        }}
      >
        <span>Component: {componentKey}</span>
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
        {resolvedContent ? (
          <div
            style={{
              fontFamily: 'inherit',
              lineHeight: '1.5',
              color: '#333'
            }}
            dangerouslySetInnerHTML={{
              __html: marked(resolvedContent) as string
            }}
          />
        ) : (
          <div style={{ color: '#999', fontStyle: 'italic' }}>
            No content resolved
          </div>
        )}
      </div>
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