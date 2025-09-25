import type { TextMatchTransformer } from '@lexical/markdown';
import {
  $createComponentBlockNode,
  $isComponentBlockNode,
  ComponentBlockNode
} from './ComponentBlockNode';

console.log('📦 ComponentBlockTransformer module loaded!');

export const COMPONENT_BLOCK_TRANSFORMER: TextMatchTransformer = {
  dependencies: [ComponentBlockNode],
  export: (node) => {
    console.log('🔄 ComponentBlockTransformer EXPORT called:', {
      nodeType: node.getType(),
      isComponentBlock: $isComponentBlockNode(node),
      node
    });

    if (!$isComponentBlockNode(node)) {
      console.log('❌ Not a component block node, returning null');
      return null;
    }

    const result = `{{${node.getComponentKey()}}}`;
    console.log('✅ Exporting component block:', result);
    return result;
  },
  importRegExp: /{{([^}]+)}}/g,
  regExp: /{{([^}]+)}}/,
  replace: (textNode, match) => {
    console.log('🎯 ComponentBlockTransformer REPLACE called:', {
      match: match[0],
      componentKey: match[1],
      fullMatch: match,
      matchLength: match.length,
      matchContents: JSON.stringify(match),
      textNode: textNode.getType()
    });

    // Extract component key using substring - much simpler!
    const componentKey = match[0].substring(2, match[0].length - 2); // Remove {{ and }}

    if (!componentKey) {
      console.error('❌ ComponentBlockTransformer: componentKey is empty');
      return;
    }

    console.log('✅ Extracted componentKey:', componentKey);

    // TODO: Get real resolved content from document system
    // For now, create node with component key - content resolution will be handled in the component
    const componentNode = $createComponentBlockNode(componentKey, `Content for ${componentKey}`, false);

    console.log('🏗️ Created ComponentBlockNode:', {
      componentKey,
      nodeType: componentNode.getType()
    });

    textNode.replace(componentNode);
    console.log('✅ Replaced text node with ComponentBlockNode');
  },
  trigger: '}',
  type: 'text-match',
};