import { useRef } from 'react';
import Editor from '@monaco-editor/react';
import type { Document, Tag } from '../api';
import * as monaco from 'monaco-editor';

interface MonacoAutocompleteEditorProps {
  value: string;
  onChange: (value: string) => void;
  documents: Document[];
  currentComponents: Record<string, string>;
  onComponentAdd: (key: string, documentId: string) => void;
  placeholder?: string;
  className?: string;
  height?: string;
}

interface AutocompleteItem {
  id: string;
  title: string;
  alias?: string;
  group_id?: string;
  document_type?: string;
  tags?: Tag[];
  matchType: 'title' | 'alias' | 'tag';
  isInComponents?: boolean;
}

export function MonacoAutocompleteEditor({
  value,
  onChange,
  documents,
  currentComponents,
  onComponentAdd,
  placeholder = '',
  className = '',
  height = '75vh'
}: MonacoAutocompleteEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  // Generate component key based on title
  const generateComponentKey = (title: string): string => {
    let baseKey = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');

    if (!/^[a-z]/.test(baseKey)) {
      baseKey = 'doc_' + baseKey;
    }

    let key = baseKey;
    let counter = 1;
    while (Object.keys(currentComponents).includes(key)) {
      key = `${baseKey}_${counter}`;
      counter++;
    }

    return key;
  };

  // Generate group component value
  const generateGroupComponentValue = (item: AutocompleteItem): string => {
    if (item.group_id) {
      return `group:${item.group_id}:${item.id}`;
    } else {
      return `group:${item.id}:${item.id}`;
    }
  };

  // Search documents for autocomplete
  const searchDocuments = (query: string): AutocompleteItem[] => {
    if (query.length < 1) return [];

    const queryLower = query.toLowerCase();
    const results: AutocompleteItem[] = [];
    const componentValues = Object.values(currentComponents);

    documents.forEach(doc => {
      // Check if document is in components
      const isInComponents = componentValues.some(value => {
        if (value === doc.id) return true;
        if (value.startsWith('group:')) {
          const parts = value.split(':');
          if (parts.length >= 3 && parts[2] === doc.id) return true;
          if (parts.length >= 2 && doc.group_id === parts[1]) {
            return parts.length === 2 || parts[2] === doc.document_type;
          }
        }
        return false;
      });

      // Search by title
      if (doc.title.toLowerCase().includes(queryLower)) {
        results.push({
          id: doc.id,
          title: doc.title,
          alias: doc.alias,
          group_id: doc.group_id,
          document_type: doc.document_type,
          tags: doc.tags,
          matchType: 'title',
          isInComponents
        });
      }
      // Search by alias
      else if (doc.alias && doc.alias.toLowerCase().split(',').some(alias =>
        alias.trim().toLowerCase().includes(queryLower)
      )) {
        results.push({
          id: doc.id,
          title: doc.title,
          alias: doc.alias,
          group_id: doc.group_id,
          document_type: doc.document_type,
          tags: doc.tags,
          matchType: 'alias',
          isInComponents
        });
      }
      // Search by tag
      else if (doc.tags && doc.tags.some(tag =>
        tag.name.toLowerCase().includes(queryLower)
      )) {
        results.push({
          id: doc.id,
          title: doc.title,
          alias: doc.alias,
          group_id: doc.group_id,
          document_type: doc.document_type,
          tags: doc.tags,
          matchType: 'tag',
          isInComponents
        });
      }
    });

    // Sort results: components first, then by relevance
    return results.sort((a, b) => {
      if (a.isInComponents && !b.isInComponents) return -1;
      if (!a.isInComponents && b.isInComponents) return 1;

      const aExactTitle = a.title.toLowerCase() === queryLower;
      const bExactTitle = b.title.toLowerCase() === queryLower;
      if (aExactTitle && !bExactTitle) return -1;
      if (!aExactTitle && bExactTitle) return 1;

      return a.title.localeCompare(b.title);
    });
  };

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: typeof monaco) => {
    editorRef.current = editor;

    // Register completion provider for {{ pattern
    monacoInstance.languages.registerCompletionItemProvider('markdown', {
      triggerCharacters: ['{'],
      provideCompletionItems: (model, position) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        // Check if we're inside a {{ pattern
        const match = textUntilPosition.match(/\{\{([^}]*)$/);
        if (!match) {
          return { suggestions: [] };
        }

        const query = match[1];
        const searchResults = searchDocuments(query);

        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - query.length,
          endColumn: position.column,
        };

        const suggestions = searchResults.map((item, index) => {
          // Generate component key and add to components when selected
          let componentKey: string;
          let componentValue: string;

          if (item.isInComponents) {
            const existingKey = Object.keys(currentComponents).find(key => {
              const value = currentComponents[key];
              return value === item.id ||
                     value === `group:${item.group_id}:${item.id}` ||
                     (item.group_id && value.startsWith(`group:${item.group_id}`));
            });
            componentKey = existingKey || generateComponentKey(item.title);

            if (existingKey) {
              const existingValue = currentComponents[existingKey];
              const newValue = generateGroupComponentValue(item);
              if (existingValue !== newValue) {
                onComponentAdd(componentKey, newValue);
              }
            }
          } else {
            componentKey = generateComponentKey(item.title);
            componentValue = generateGroupComponentValue(item);
            onComponentAdd(componentKey, componentValue);
          }

          const label = item.title;
          const detail = item.matchType === 'alias' && item.alias ? `(${item.alias})` :
                        item.matchType === 'tag' ? 'via tag' :
                        item.document_type || '';

          const description = item.isInComponents ? 'Already used' : '';

          return {
            label,
            kind: monacoInstance.languages.CompletionItemKind.Reference,
            detail,
            documentation: description,
            insertText: `${componentKey}}}`,
            range,
            sortText: `${item.isInComponents ? '0' : '1'}_${index.toString().padStart(3, '0')}`
          };
        });

        return { suggestions };
      }
    });

    // Configure editor options
    editor.updateOptions({
      minimap: { enabled: false },
      lineNumbers: 'off',
      glyphMargin: false,
      folding: false,
      lineDecorationsWidth: 0,
      lineNumbersMinChars: 0,
      wordWrap: 'on',
      scrollBeyondLastLine: false,
      fontSize: 14,
      fontFamily: 'inherit',
      padding: { top: 12, bottom: 12 }
    });
  };

  return (
    <div className={`monaco-editor-container ${className}`}>
      <Editor
        height={height}
        defaultLanguage="markdown"
        value={value}
        onChange={(newValue) => onChange(newValue || '')}
        onMount={handleEditorDidMount}
        options={{
          placeholder,
          automaticLayout: true,
          wordWrap: 'on',
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          fontFamily: 'inherit',
          lineNumbers: 'off'
        }}
        theme="vs"
      />
    </div>
  );
}