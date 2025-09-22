import { useState } from 'react';
import { MonacoAutocompleteEditor } from './MonacoAutocompleteEditor';
import { ReactQuillEditor } from './ReactQuillEditor';
import type { Document } from '../api';

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

  const handleModeChange = (mode: 'markdown' | 'wysiwyg') => {
    setEditorMode(mode);
  };

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

      {/* Editor Content */}
      <div className="editor-content">
        {editorMode === 'markdown' ? (
          <MonacoAutocompleteEditor
            initialValue={initialValue}
            onContentChange={onContentChange}
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
        ) : (
          <ReactQuillEditor
            initialValue={initialValue}
            onContentChange={onContentChange}
            placeholder={placeholder || "Enter your content with rich text formatting..."}
            className={className}
            height={height}
          />
        )}
      </div>
    </div>
  );
}

export type { EnhancedDocumentEditorProps };