import {
  DecoratorNode,
  type NodeKey,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useState } from 'react';

export type SerializedChecklistItemNode = {
  checked: boolean;
  text: string;
  type: 'checklist-item';
  version: 1;
};

export class ChecklistItemNode extends DecoratorNode<JSX.Element> {
  __checked: boolean;
  __text: string;

  static getType(): string {
    return 'checklist-item';
  }

  static clone(node: ChecklistItemNode): ChecklistItemNode {
    return new ChecklistItemNode(node.__checked, node.__text, node.__key);
  }

  constructor(checked?: boolean, text?: string, key?: NodeKey) {
    super(key);
    this.__checked = checked ?? false;
    this.__text = text ?? '';
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div');
    div.className = 'lexical-checklist-item';
    return div;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): JSX.Element {
    return (
      <ChecklistItemComponent
        node={this}
        checked={this.__checked}
        text={this.__text}
      />
    );
  }

  static importJSON(serializedNode: SerializedChecklistItemNode): ChecklistItemNode {
    const { checked, text } = serializedNode;
    return $createChecklistItemNode(checked, text);
  }

  exportJSON(): SerializedChecklistItemNode {
    return {
      checked: this.__checked,
      text: this.__text,
      type: 'checklist-item',
      version: 1,
    };
  }

  setChecked(checked: boolean): void {
    const writable = this.getWritable();
    writable.__checked = checked;
  }

  getChecked(): boolean {
    return this.__checked;
  }

  setText(text: string): void {
    const writable = this.getWritable();
    writable.__text = text;
  }

  getText(): string {
    return this.__text;
  }

  toggleChecked(): void {
    this.setChecked(!this.__checked);
  }

  isInline(): false {
    return false;
  }
}

function ChecklistItemComponent({
  node,
  checked,
  text
}: {
  node: ChecklistItemNode;
  checked: boolean;
  text: string;
}) {
  const [editor] = useLexicalComposerContext();
  const [isChecked, setIsChecked] = useState(checked);
  const [textValue, setTextValue] = useState(text);

  const handleToggle = () => {
    const newState = !isChecked;
    setIsChecked(newState);

    // Update the node state in the editor
    editor.update(() => {
      const writableNode = node.getWritable();
      writableNode.__checked = newState;
    });
  };

  const handleTextChange = (newText: string) => {
    setTextValue(newText);
    editor.update(() => {
      const writableNode = node.getWritable();
      writableNode.__text = newText;
    });
  };

  return (
    <div className="checklist-item-wrapper" style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '8px',
      margin: '4px 0',
      width: '100%'
    }}>
      <input
        type="checkbox"
        checked={isChecked}
        onChange={handleToggle}
        className="checklist-checkbox"
        style={{
          cursor: 'pointer',
          marginTop: '2px',
          width: '16px',
          height: '16px',
          flexShrink: 0
        }}
      />
      <input
        type="text"
        value={textValue}
        onChange={(e) => handleTextChange(e.target.value)}
        className="checklist-text-input"
        style={{
          flex: 1,
          lineHeight: '1.6',
          fontSize: '14px',
          border: 'none',
          background: 'transparent',
          outline: 'none',
          fontFamily: 'inherit'
        }}
      />
    </div>
  );
}

export function $createChecklistItemNode(checked?: boolean, text?: string): ChecklistItemNode {
  return new ChecklistItemNode(checked, text);
}

export function $isChecklistItemNode(node: unknown): node is ChecklistItemNode {
  return node instanceof ChecklistItemNode;
}