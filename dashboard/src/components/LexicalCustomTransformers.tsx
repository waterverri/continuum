import {
  $createTableNode,
  $createTableRowNode,
  $createTableCellNode,
  TableNode,
  TableRowNode,
  TableCellNode,
} from '@lexical/table';
import { $createCodeNode, CodeNode } from '@lexical/code';
import { $createParagraphNode, $createTextNode } from 'lexical';
import type { LexicalNode, ElementNode } from 'lexical';
import { $createLinkNode, LinkNode } from '@lexical/link';
import type { ElementTransformer, TextMatchTransformer, MultilineElementTransformer, Transformer } from '@lexical/markdown';
import { HorizontalRuleNode, $createHorizontalRuleNode } from './HorizontalRuleNode';
import { ChecklistItemNode, $createChecklistItemNode } from './ChecklistItemNode';


// Horizontal rule transformer
export const HORIZONTAL_RULE_TRANSFORMER: ElementTransformer = {
  dependencies: [HorizontalRuleNode],
  export: (node) => {
    if (node.getType() === 'horizontalrule') {
      return '\n---\n';
    }
    return null;
  },
  regExp: /^-{3,}$/,
  replace: (parentNode) => {
    const hrNode = $createHorizontalRuleNode();
    parentNode.replace(hrNode);
  },
  type: 'element',
};

// Checklist transformer that creates interactive checklist items
export const CHECKLIST_TRANSFORMER: ElementTransformer = {
  dependencies: [ChecklistItemNode],
  export: (node) => {
    if (node.getType() === 'checklist-item') {
      const checklistNode = node as ChecklistItemNode;
      const isChecked = checklistNode.getChecked();
      const text = checklistNode.getText();
      const result = `- [${isChecked ? 'x' : ' '}] ${text}`;
      return result;
    }
    return null;
  },
  regExp: /^- \[([ x])\] (.+)$/,
  replace: (parentNode, _children, match) => {
    const isChecked = match[1] === 'x';
    const text = match[2];

    // Create interactive checklist item
    const checklistNode = $createChecklistItemNode(isChecked, text);
    parentNode.replace(checklistNode);
  },
  type: 'element',
};

// Enhanced code block transformer for multiline
export const CODE_BLOCK_TRANSFORMER: ElementTransformer = {
  dependencies: [CodeNode],
  export: (node) => {
    if (node.getType() === 'code') {
      const codeNode = node as CodeNode;
      const language = codeNode.getLanguage() || '';
      const code = codeNode.getTextContent();
      return `\`\`\`${language}\n${code}\n\`\`\``;
    }
    return null;
  },
  regExp: /^```([a-z]*)\s*$/,
  replace: (parentNode, _children, match) => {
    // This should handle the opening ``` line, content will be added separately
    const language = match[1] || '';
    const codeNode = $createCodeNode(language);
    parentNode.replace(codeNode);
  },
  type: 'element',
};

// Image transformer (basic implementation)
export const IMAGE_TRANSFORMER: ElementTransformer = {
  dependencies: [],
  export: () => null,
  regExp: /^!\[([^\]]*)\]\(([^)]+)\)$/,
  replace: (parentNode, _children, match) => {
    const altText = match[1];
    const src = match[2];

    // Create a simple image element
    const paragraph = $createParagraphNode();
    paragraph.append($createTextNode(`[Image: ${altText || 'Image'} - ${src}]`));
    parentNode.replace(paragraph);
  },
  type: 'element',
};

// Proper multiline table transformer copying the built-in code block pattern
export const TABLE_TRANSFORMER: MultilineElementTransformer = {
  dependencies: [TableNode, TableRowNode, TableCellNode],
  export: (node: LexicalNode) => {
    if (node.getType() === 'table') {
      const tableNode = node as TableNode;
      const rows = tableNode.getChildren() as TableRowNode[];

      let markdown = '';
      rows.forEach((row, rowIndex) => {
        const cells = row.getChildren() as TableCellNode[];
        const cellTexts = cells.map(cell => cell.getTextContent().trim());
        markdown += '| ' + cellTexts.join(' | ') + ' |\n';

        // Add separator after first row (header)
        if (rowIndex === 0) {
          markdown += '| ' + cellTexts.map(() => '---').join(' | ') + ' |\n';
        }
      });

      return markdown;
    }
    return null;
  },
  regExpStart: /^\|.*\|$/,
  regExpEnd: {
    optional: true,
    regExp: /^(?!\s*\|)/
  },
  replace: (rootNode: ElementNode, _children: unknown, startMatch: string[], _endMatch: string[] | null, linesInBetween: string[] | null) => {
    // Collect all table lines
    const allLines = [startMatch[0]];
    if (linesInBetween) {
      allLines.push(...linesInBetween);
    }

    // Filter out separator lines
    const tableLines = allLines
      .filter((line: string) => line && line.trim() && !line.includes('---'))
      .map((line: string) => line.trim());

    if (tableLines.length === 0) return false;

    // Create the complete table
    const tableNode = $createTableNode();

    tableLines.forEach((line: string, rowIndex: number) => {
      const cells = line.slice(1, -1).split('|').map((cell: string) => cell.trim());
      const rowNode = $createTableRowNode();

      cells.forEach((cellText: string) => {
        // First row is header
        const cellNode = $createTableCellNode(rowIndex === 0 ? 1 : 0);
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode(cellText));
        cellNode.append(paragraph);
        rowNode.append(cellNode);
      });

      tableNode.append(rowNode);
    });

    rootNode.append(tableNode);
    return true;
  },
  type: 'multiline-element' as const,
};

// Link transformer for [text](url) syntax
export const LINK_TRANSFORMER: TextMatchTransformer = {
  dependencies: [LinkNode],
  export: () => null,
  importRegExp: /\[([^\]]+)\]\(([^)]+)\)/g,
  regExp: /\[([^\]]+)\]\(([^)]+)\)/,
  replace: (textNode, match) => {
    const linkText = match[1];
    const url = match[2];

    const linkNode = $createLinkNode(url);
    linkNode.append($createTextNode(linkText));
    textNode.replace(linkNode);
  },
  trigger: ')',
  type: 'text-match',
};

// Export all custom transformers
export const CUSTOM_TRANSFORMERS: Transformer[] = [
  HORIZONTAL_RULE_TRANSFORMER,
  CHECKLIST_TRANSFORMER,
  CODE_BLOCK_TRANSFORMER,
  IMAGE_TRANSFORMER,
  LINK_TRANSFORMER,
  TABLE_TRANSFORMER, // New multiline table transformer
];