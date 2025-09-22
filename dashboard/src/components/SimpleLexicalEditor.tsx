import { useEffect, useState, useCallback } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { TRANSFORMERS } from '@lexical/markdown';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListItemNode, ListNode } from '@lexical/list';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { AutoLinkNode, LinkNode } from '@lexical/link';

import type { Document } from '../api';
import { LexicalAutocompletePlugin } from './LexicalAutocompletePlugin';

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
        $convertFromMarkdownString(initialValue, TRANSFORMERS);
      });
      setHasInitialized(true);
    }
  }, [editor, initialValue, hasInitialized]);

  // Export to markdown when explicitly requested
  const exportToMarkdown = useCallback(() => {
    editor.getEditorState().read(() => {
      const markdown = $convertToMarkdownString(TRANSFORMERS);
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
                  outline: 'none !important',
                  padding: '15px !important',
                  border: '1px solid #ccc !important',
                  borderRadius: '4px !important',
                  backgroundColor: '#fff !important',
                  color: '#000 !important',
                  opacity: '1 !important'
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
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
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