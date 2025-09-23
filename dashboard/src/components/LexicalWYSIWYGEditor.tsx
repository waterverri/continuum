import { useEffect, useState } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { TRANSFORMERS, $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { CUSTOM_TRANSFORMERS } from './LexicalCustomTransformers';
import { HorizontalRuleNode } from './HorizontalRuleNode';
import { ChecklistItemNode } from './ChecklistItemNode';
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListItemNode, ListNode } from '@lexical/list';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { AutoLinkNode, LinkNode } from '@lexical/link';

import type { Document } from '../api';
import { LexicalAutocompletePlugin } from './LexicalAutocompletePlugin';
import { ComponentBlockNode } from './ComponentBlockNode';
import { COMPONENT_BLOCK_TRANSFORMER } from './ComponentBlockTransformer';

// Put custom transformers FIRST so they take priority (matching SimpleLexicalEditor)
// Add component transformer LAST to avoid conflicts
const ENHANCED_TRANSFORMERS = [...CUSTOM_TRANSFORMERS, ...TRANSFORMERS, COMPONENT_BLOCK_TRANSFORMER];

interface LexicalWYSIWYGEditorProps {
  initialValue: string;
  onContentChange: (value: string) => void;
  documents: Document[];
  currentComponents: Record<string, string>;
  onComponentAdd: (key: string, documentId: string) => void;
  placeholder?: string;
  className?: string;
  height?: string;
}


// Plugin to handle markdown conversion
function MarkdownPlugin({
  initialValue,
  onContentChange
}: {
  initialValue: string;
  onContentChange: (value: string) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (initialValue && !isInitialized) {
      editor.update(() => {
        $convertFromMarkdownString(initialValue, ENHANCED_TRANSFORMERS);
      });
      setIsInitialized(true);
    }
  }, [editor, initialValue, isInitialized]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    return editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
      // Only convert to markdown if there are actual content changes (not just cursor moves)
      if (dirtyElements.size > 0 || dirtyLeaves.size > 0) {
        // Debounce the conversion to avoid performance issues
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          editorState.read(() => {
            const markdown = $convertToMarkdownString(ENHANCED_TRANSFORMERS);
            onContentChange(markdown);
          });
        }, 300);
      }
    });
  }, [editor, onContentChange]);

  return null;
}

// Toolbar component
function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();

  const formatBold = () => {
    editor.dispatchCommand('FORMAT_TEXT_COMMAND' as any, 'bold');
  };

  const formatItalic = () => {
    editor.dispatchCommand('FORMAT_TEXT_COMMAND' as any, 'italic');
  };

  const formatUnderline = () => {
    editor.dispatchCommand('FORMAT_TEXT_COMMAND' as any, 'underline');
  };

  return (
    <div className="lexical-toolbar">
      <button
        type="button"
        className="toolbar-button"
        onClick={formatBold}
        title="Bold"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        className="toolbar-button"
        onClick={formatItalic}
        title="Italic"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        className="toolbar-button"
        onClick={formatUnderline}
        title="Underline"
      >
        <u>U</u>
      </button>
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

export function LexicalWYSIWYGEditor({
  initialValue,
  onContentChange,
  documents,
  currentComponents,
  onComponentAdd,
  placeholder = "Enter your document content...",
  className = "",
  height = "400px"
}: LexicalWYSIWYGEditorProps) {
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
      ComponentBlockNode,
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
                style={{
                  minHeight: height,
                  outline: 'none',
                  padding: '15px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
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
          <TablePlugin />
          <CheckListPlugin />
          <MarkdownShortcutPlugin transformers={ENHANCED_TRANSFORMERS} />
          <MarkdownPlugin
            initialValue={initialValue}
            onContentChange={onContentChange}
          />
          <LexicalAutocompletePlugin
            documents={documents}
            currentComponents={currentComponents}
            onComponentAdd={onComponentAdd}
          />
        </div>
      </LexicalComposer>
    </div>
  );
}