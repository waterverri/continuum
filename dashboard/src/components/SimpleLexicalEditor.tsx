import { useEffect, useState, useCallback } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import {
  TRANSFORMERS,
} from '@lexical/markdown';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $createLineBreakNode,
  LineBreakNode,
  FORMAT_TEXT_COMMAND,
} from 'lexical';
import { $createQuoteNode } from '@lexical/rich-text';
import { $createCodeNode } from '@lexical/code';
import { $createHeadingNode } from '@lexical/rich-text';
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list';

import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListItemNode, ListNode } from '@lexical/list';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table';
import { INSERT_TABLE_COMMAND } from '@lexical/table';

import type { Document } from '../api';
import { LexicalAutocompletePlugin } from './LexicalAutocompletePlugin';
import { HorizontalRuleNode, $createHorizontalRuleNode } from './HorizontalRuleNode';
import { ChecklistItemNode } from './ChecklistItemNode';
import { $createListItemNode } from '@lexical/list';
import { CUSTOM_TRANSFORMERS } from './LexicalCustomTransformers';

// Put custom transformers FIRST so they take priority
const ENHANCED_TRANSFORMERS = [...CUSTOM_TRANSFORMERS, ...TRANSFORMERS];

interface SimpleLexicalEditorProps {
  initialValue: string;
  onContentChange: (value: string) => void;
  documents: Document[];
  currentComponents: Record<string, string>;
  onComponentAdd: (key: string, documentId: string) => void;
  placeholder?: string;
  className?: string;
  height?: string;
  currentDocumentId?: string;
}

// Simple markdown conversion that only happens on initialization and manual export
function SimpleMarkdownPlugin({
  initialValue,
  onContentChange
}: {
  initialValue: string;
  onContentChange: (value: string) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const [hasInitialized, setHasInitialized] = useState(false);

  // Initialize content from markdown once
  useEffect(() => {
    if (initialValue && !hasInitialized) {
      editor.update(() => {
        try {
          // Convert markdown to Lexical nodes
          $convertFromMarkdownString(initialValue, ENHANCED_TRANSFORMERS);
        } catch (error) {
          console.error('❌ Error converting markdown:', error);
        }
      });
      setHasInitialized(true);
    }
  }, [editor, initialValue, hasInitialized]);

  // Export to markdown when explicitly requested
  const exportToMarkdown = useCallback(() => {
    editor.getEditorState().read(() => {
      const markdown = $convertToMarkdownString(ENHANCED_TRANSFORMERS);
      onContentChange(markdown);
    });
  }, [editor, onContentChange]);

  // Export on blur to save changes without constant updates
  useEffect(() => {
    const unregister = editor.registerRootListener((rootElement) => {
      if (rootElement) {
        const handleBlur = () => {
          exportToMarkdown();
        };
        rootElement.addEventListener('blur', handleBlur);
        return () => {
          rootElement.removeEventListener('blur', handleBlur);
        };
      }
    });

    return unregister;
  }, [editor, exportToMarkdown]);

  // Export on content changes (like checkbox toggles) to keep markdown in sync
  useEffect(() => {
    const unregister = editor.registerUpdateListener(() => {
      // Use setTimeout to ensure the update is fully committed
      setTimeout(() => {
        exportToMarkdown();
      }, 0);
    });

    return unregister;
  }, [editor, exportToMarkdown]);

  return null;
}

// Comprehensive Toolbar component
function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();

  const formatBold = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
  };

  const formatItalic = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
  };

  const formatUnderline = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
  };

  const formatStrikethrough = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough');
  };

  const formatCode = () => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code');
  };

  const insertHeading = (level: number) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const headingNode = $createHeadingNode(`h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6');
        selection.insertNodes([headingNode]);
      }
    });
  };

  const insertOrderedList = () => {
    editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
  };

  const insertUnorderedList = () => {
    editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
  };

  const insertCheckList = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const checkListItem = $createListItemNode(true); // true for checked
        selection.insertNodes([checkListItem]);
      }
    });
  };

  const insertQuote = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        // Create quote block
        const paragraph = selection.anchor.getNode();
        if (paragraph) {
          paragraph.replace($createQuoteNode());
        }
      }
    });
  };

  const insertCodeBlock = () => {
    editor.update(() => {
      const codeNode = $createCodeNode();
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertNodes([codeNode]);
      }
    });
  };

  const insertLineBreak = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const lineBreakNode = $createLineBreakNode();
        selection.insertNodes([lineBreakNode]);
      }
    });
  };

  const insertTable = () => {
    editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: '3', rows: '3' });
  };

  const insertHorizontalRule = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const hrNode = $createHorizontalRuleNode();
        selection.insertNodes([hrNode]);
      }
    });
  };

  const clearFormatting = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const nodes = selection.getNodes();
        nodes.forEach(node => {
          if ($isTextNode(node)) {
            node.setFormat(0);
          }
        });
      }
    });
  };

  return (
    <div className="lexical-toolbar">
      {/* Text Formatting */}
      <div className="toolbar-group">
        <button type="button" className="toolbar-button" onClick={formatBold} title="Bold">
          <strong>B</strong>
        </button>
        <button type="button" className="toolbar-button" onClick={formatItalic} title="Italic">
          <em>I</em>
        </button>
        <button type="button" className="toolbar-button" onClick={formatUnderline} title="Underline">
          <u>U</u>
        </button>
        <button type="button" className="toolbar-button" onClick={formatStrikethrough} title="Strikethrough">
          <s>S</s>
        </button>
        <button type="button" className="toolbar-button" onClick={formatCode} title="Inline Code">
          <code>&lt;/&gt;</code>
        </button>
        <button type="button" className="toolbar-button" onClick={clearFormatting} title="Clear Formatting">
          <span>⌫</span>
        </button>
      </div>

      <div className="toolbar-separator"></div>

      {/* Headings */}
      <div className="toolbar-group">
        <select
          className="toolbar-select"
          onChange={(e) => {
            const value = e.target.value;
            if (value === 'h1') insertHeading(1);
            else if (value === 'h2') insertHeading(2);
            else if (value === 'h3') insertHeading(3);
            else if (value === 'h4') insertHeading(4);
            else if (value === 'h5') insertHeading(5);
            e.target.value = '';
          }}
          title="Heading Level"
        >
          <option value="">Heading</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
          <option value="h5">Heading 5</option>
        </select>
      </div>

      <div className="toolbar-separator"></div>

      {/* Lists */}
      <div className="toolbar-group">
        <button type="button" className="toolbar-button" onClick={insertUnorderedList} title="Bullet List">
          <span>• ≡</span>
        </button>
        <button type="button" className="toolbar-button" onClick={insertOrderedList} title="Numbered List">
          <span>1. ≡</span>
        </button>
        <button type="button" className="toolbar-button" onClick={insertCheckList} title="Checklist">
          <span>☑ ≡</span>
        </button>
      </div>

      <div className="toolbar-separator"></div>

      {/* Blocks */}
      <div className="toolbar-group">
        <button type="button" className="toolbar-button" onClick={insertQuote} title="Quote Block">
          <span>❝</span>
        </button>
        <button type="button" className="toolbar-button" onClick={insertCodeBlock} title="Code Block">
          <span>{ }</span>
        </button>
        <button type="button" className="toolbar-button" onClick={insertLineBreak} title="Line Break">
          <span>↵</span>
        </button>
        <button type="button" className="toolbar-button" onClick={insertTable} title="Insert Table">
          <span>⊞</span>
        </button>
        <button type="button" className="toolbar-button" onClick={insertHorizontalRule} title="Horizontal Rule">
          <span>―</span>
        </button>
      </div>
    </div>
  );
}

const theme = {
  ltr: 'ltr',
  rtl: 'rtl',
  placeholder: 'lexical-placeholder',
  paragraph: 'lexical-paragraph',
  quote: 'lexical-quote',
  heading: {
    h1: 'lexical-heading-h1',
    h2: 'lexical-heading-h2',
    h3: 'lexical-heading-h3',
    h4: 'lexical-heading-h4',
    h5: 'lexical-heading-h5',
  },
  list: {
    nested: {
      listitem: 'lexical-nested-listitem',
    },
    ol: 'lexical-list-ol',
    ul: 'lexical-list-ul',
    listitem: 'lexical-list-listitem',
  },
  image: 'lexical-image',
  link: 'lexical-link',
  table: 'lexical-table',
  tableCell: 'lexical-tableCell',
  tableCellHeader: 'lexical-tableCellHeader',
  tableRow: 'lexical-tableRow',
  hr: 'lexical-hr',
  text: {
    bold: 'lexical-text-bold',
    italic: 'lexical-text-italic',
    overflowed: 'lexical-text-overflowed',
    hashtag: 'lexical-text-hashtag',
    underline: 'lexical-text-underline',
    strikethrough: 'lexical-text-strikethrough',
    underlineStrikethrough: 'lexical-text-underlineStrikethrough',
    code: 'lexical-text-code',
  },
  code: 'lexical-code',
  codeHighlight: {
    atrule: 'lexical-token-attr',
    attr: 'lexical-token-attr',
    boolean: 'lexical-token-property',
    builtin: 'lexical-token-selector',
    cdata: 'lexical-token-comment',
    char: 'lexical-token-selector',
    class: 'lexical-token-function',
    'class-name': 'lexical-token-function',
    comment: 'lexical-token-comment',
    constant: 'lexical-token-property',
    deleted: 'lexical-token-property',
    doctype: 'lexical-token-comment',
    entity: 'lexical-token-operator',
    function: 'lexical-token-function',
    important: 'lexical-token-variable',
    inserted: 'lexical-token-selector',
    keyword: 'lexical-token-attr',
    namespace: 'lexical-token-variable',
    number: 'lexical-token-property',
    operator: 'lexical-token-operator',
    prolog: 'lexical-token-comment',
    property: 'lexical-token-property',
    punctuation: 'lexical-token-punctuation',
    regex: 'lexical-token-variable',
    selector: 'lexical-token-selector',
    string: 'lexical-token-selector',
    symbol: 'lexical-token-property',
    tag: 'lexical-token-property',
    url: 'lexical-token-operator',
    variable: 'lexical-token-variable',
  },
};

function onError(error: Error) {
  console.error('Lexical Editor Error:', error);
}

export function SimpleLexicalEditor({
  initialValue,
  onContentChange,
  documents,
  currentComponents,
  onComponentAdd,
  placeholder = "Enter your document content...",
  className = "",
  height = "400px",
  currentDocumentId
}: SimpleLexicalEditorProps) {
  const initialConfig = {
    namespace: 'DocumentEditor',
    theme,
    onError,
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      QuoteNode,
      CodeNode,
      CodeHighlightNode,
      AutoLinkNode,
      LinkNode,
      TableNode,
      TableCellNode,
      TableRowNode,
      HorizontalRuleNode,
      ChecklistItemNode,
      LineBreakNode,
    ],
  };

  return (
    <div className={`lexical-editor ${className}`} style={{ height }}>
      <LexicalComposer initialConfig={initialConfig}>
        <ToolbarPlugin />
        <div className="lexical-inner">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="lexical-content-editable"
                data-lexical-wysiwyg="true"
                style={{
                  minHeight: height,
                  maxHeight: '75vh',
                  overflowY: 'auto',
                  outline: 'none',
                  padding: '15px',
                  border: '1px solid #cccccc',
                  borderRadius: '4px',
                  backgroundColor: '#ffffff',
                  background: '#ffffff',
                  color: '#000000',
                  opacity: 1,
                  visibility: 'visible',
                  display: 'block',
                  position: 'relative',
                  zIndex: 1
                }}
              />
            }
            placeholder={
              <div className="lexical-placeholder">
                {placeholder}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <AutoFocusPlugin />
          <LinkPlugin />
          <ListPlugin />
          <CheckListPlugin />
          <TablePlugin />
          <MarkdownShortcutPlugin transformers={ENHANCED_TRANSFORMERS} />
          <SimpleMarkdownPlugin
            initialValue={initialValue}
            onContentChange={onContentChange}
          />
          <LexicalAutocompletePlugin
            documents={documents}
            currentComponents={currentComponents}
            onComponentAdd={onComponentAdd}
            currentDocumentId={currentDocumentId}
          />
        </div>
      </LexicalComposer>
    </div>
  );
}