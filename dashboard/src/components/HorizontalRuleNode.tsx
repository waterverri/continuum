import {
  DecoratorNode,
  type NodeKey,
} from 'lexical';

export type SerializedHorizontalRuleNode = {
  type: 'horizontalrule';
  version: 1;
};

export class HorizontalRuleNode extends DecoratorNode<JSX.Element> {
  static getType(): string {
    return 'horizontalrule';
  }

  static clone(node: HorizontalRuleNode): HorizontalRuleNode {
    return new HorizontalRuleNode(node.__key);
  }

  constructor(key?: NodeKey) {
    super(key);
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div');
    div.className = 'lexical-hr-container';
    return div;
  }

  updateDOM(): false {
    return false;
  }

  static importJSON(): HorizontalRuleNode {
    return $createHorizontalRuleNode();
  }

  exportJSON(): SerializedHorizontalRuleNode {
    return {
      type: 'horizontalrule',
      version: 1,
    };
  }

  decorate(): JSX.Element {
    return <hr className="lexical-hr" />;
  }

  isInline(): false {
    return false;
  }
}

export function $createHorizontalRuleNode(): HorizontalRuleNode {
  return new HorizontalRuleNode();
}

export function $isHorizontalRuleNode(node: unknown): node is HorizontalRuleNode {
  return node instanceof HorizontalRuleNode;
}