import type { ElementTransformer } from '@lexical/markdown';
import {
  $createComponentBlockNode,
  $isComponentBlockNode,
  ComponentBlockNode
} from './ComponentBlockNode';

export const COMPONENT_BLOCK_TRANSFORMER: ElementTransformer = {
  dependencies: [ComponentBlockNode],
  export: (node) => {
    if (!$isComponentBlockNode(node)) {
      return null;
    }
    // CRITICAL: Always export as {{key}} to preserve markdown format
    return `{{${node.getComponentKey()}}}`;
  },
  regExp: /^{{([^}]+)}}$/,
  replace: (parentNode, _children, match) => {
    const componentKey = match[1];
    // Create collapsed component block by default
    const componentNode = $createComponentBlockNode(componentKey, '', false);
    parentNode.replace(componentNode);
  },
  type: 'element',
};