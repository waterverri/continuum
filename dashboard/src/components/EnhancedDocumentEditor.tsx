import { useState, useCallback, useRef } from 'react';
import { MonacoAutocompleteEditor } from './MonacoAutocompleteEditor';
import { ReactQuillEditor } from './ReactQuillEditor';
import type { Document } from '../api';
import { marked } from 'marked';
import TurndownService from 'turndown';

interface EnhancedDocumentEditorProps {
  initialValue: string;
  onContentChange: (value: string) => void;
  documents: Document[];
  currentComponents: Record<string, string>;
  onComponentAdd: (key: string, documentId: string) => void;
  placeholder?: string;
  className?: string;
  height?: string;
}

export function EnhancedDocumentEditor({
  initialValue,
  onContentChange,
  documents,
  currentComponents,
  onComponentAdd,
  placeholder,
  className,
  height = "75vh"
}: EnhancedDocumentEditorProps) {
  const [editorMode, setEditorMode] = useState<'markdown' | 'wysiwyg'>('markdown');
  const [markdownContent, setMarkdownContent] = useState(initialValue);
  const [htmlContent, setHtmlContent] = useState('');

  const turndownService = useRef(new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced'
  }));

  const convertMarkdownToHtml = useCallback(async (markdown: string) => {
    try {
      return await marked(markdown || '');
    } catch (error) {
      console.error('Error converting markdown to HTML:', error);
      return markdown;
    }
  }, []);

  const convertHtmlToMarkdown = useCallback((html: string) => {
    try {
      return turndownService.current.turndown(html);
    } catch (error) {
      console.error('Error converting HTML to markdown:', error);
      return html;
    }
  }, []);

  const handleModeChange = useCallback(async (mode: 'markdown' | 'wysiwyg') => {
    if (mode === editorMode) return;

    // Sync content when switching modes
    if (mode === 'wysiwyg') {
      // Converting from markdown to WYSIWYG
      const html = await convertMarkdownToHtml(markdownContent);
      setHtmlContent(html);
    } else {
      // Converting from WYSIWYG to markdown
      const markdown = convertHtmlToMarkdown(htmlContent);
      setMarkdownContent(markdown);
      onContentChange(markdown);
    }

    setEditorMode(mode);
  }, [editorMode, markdownContent, htmlContent, convertMarkdownToHtml, convertHtmlToMarkdown, onContentChange]);

  const handleMarkdownChange = useCallback((content: string) => {
    setMarkdownContent(content);
    onContentChange(content);
  }, [onContentChange]);

  const handleHtmlChange = useCallback((content: string) => {
    setHtmlContent(content);
    // Convert to markdown and update parent
    const markdown = convertHtmlToMarkdown(content);
    setMarkdownContent(markdown);
    onContentChange(markdown);
  }, [convertHtmlToMarkdown, onContentChange]);

  return (
    <div className="enhanced-document-editor">
      {/* Editor Mode Toggle */}
      <div className="editor-mode-toggle">
        <div className="toggle-buttons">
          <button
            type="button"
            className={`btn btn--sm ${editorMode === 'markdown' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => handleModeChange('markdown')}
          >
            📝 Markdown
          </button>
          <button
            type="button"
            className={`btn btn--sm ${editorMode === 'wysiwyg' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => handleModeChange('wysiwyg')}
          >
            📄 WYSIWYG
          </button>
        </div>
        <div className="mode-indicator">
          <small>
            {editorMode === 'markdown'
              ? 'Markdown mode with autocomplete'
              : 'WYSIWYG rich text editor'
            }
          </small>
        </div>
      </div>

      {/* Editor Content - Both editors mounted, show/hide based on mode */}
      <div className="editor-content">
        <div
          className={`editor-wrapper ${editorMode === 'markdown' ? 'editor-visible' : 'editor-hidden'}`}
        >
          <MonacoAutocompleteEditor
            initialValue={markdownContent}
            onContentChange={handleMarkdownChange}
            documents={documents}
            currentComponents={currentComponents}
            onComponentAdd={onComponentAdd}
            placeholder={
              Object.keys(currentComponents).length > 0
                ? "Enter your template with placeholders like {{key}}... Start typing {{abc to see autocomplete suggestions!"
                : "Enter your document content... Type {{abc to add component references with autocomplete!"
            }
            className={className}
            height={height}
          />
        </div>

        <div
          className={`editor-wrapper ${editorMode === 'wysiwyg' ? 'editor-visible' : 'editor-hidden'}`}
        >
          <ReactQuillEditor
            initialValue={htmlContent}
            onContentChange={handleHtmlChange}
            placeholder={placeholder || "Enter your content with rich text formatting..."}
            className={className}
            height={height}
          />
        </div>
      </div>
    </div>
  );
}

export type { EnhancedDocumentEditorProps };