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
        console.log('🔮 Completion provider called at position:', position);

        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        console.log('📋 Provider text until position:', JSON.stringify(textUntilPosition));

        // Check if we're inside a {{ pattern
        const match = textUntilPosition.match(/\{\{([^}]*)$/);
        console.log('🎯 Provider pattern match:', match);

        if (!match) {
          console.log('🚫 Provider: No match, returning empty suggestions');
          return { suggestions: [] };
        }

        const query = match[1];
        console.log('🔎 Provider query:', JSON.stringify(query));
        const searchResults = searchDocuments(query);
        console.log('📊 Search results count:', searchResults.length);

        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - query.length,
          endColumn: position.column,
        };

        const suggestions = searchResults.map((item, index) => {
          // Generate component key (but don't add to components yet!)
          let componentKey: string;

          if (item.isInComponents) {
            const existingKey = Object.keys(currentComponents).find(key => {
              const value = currentComponents[key];
              return value === item.id ||
                     value === `group:${item.group_id}:${item.id}` ||
                     (item.group_id && value.startsWith(`group:${item.group_id}`));
            });
            componentKey = existingKey || generateComponentKey(item.title);
          } else {
            componentKey = generateComponentKey(item.title);
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
            sortText: `${item.isInComponents ? '0' : '1'}_${index.toString().padStart(3, '0')}`,
            // Add the item data so we can process it when selected
            command: {
              id: 'addComponent',
              title: 'Add Component',
              arguments: [item, componentKey]
            }
          };
        });

        return { suggestions };
      }
    });

    // Register command to handle component addition when item is selected
    monacoInstance.editor.registerCommand('addComponent', (_accessor, item: AutocompleteItem, componentKey: string) => {
      console.log('🎯 Component selected:', item.title, 'Key:', componentKey);

      // Now add to components when actually selected
      let componentValue: string;

      if (item.isInComponents) {
        const existingKey = Object.keys(currentComponents).find(key => {
          const value = currentComponents[key];
          return value === item.id ||
                 value === `group:${item.group_id}:${item.id}` ||
                 (item.group_id && value.startsWith(`group:${item.group_id}`));
        });

        if (existingKey) {
          const existingValue = currentComponents[existingKey];
          const newValue = generateGroupComponentValue(item);
          if (existingValue !== newValue) {
            onComponentAdd(componentKey, newValue);
          }
        }
      } else {
        componentValue = generateGroupComponentValue(item);
        onComponentAdd(componentKey, componentValue);
      }
    });

    // Add content change listener to trigger completion when typing inside {{
    editor.onDidChangeModelContent(() => {
      const position = editor.getPosition();
      console.log('🔄 Content changed, position:', position);
      if (!position) return;

      const model = editor.getModel();
      if (!model) return;

      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      console.log('📝 Text until position:', JSON.stringify(textUntilPosition));

      // Check if we're inside a {{ pattern
      const match = textUntilPosition.match(/\{\{([^}]*)$/);
      console.log('🔍 Pattern match:', match);

      if (match && match[1].length >= 1) {
        console.log('✅ Triggering autocomplete for query:', JSON.stringify(match[1]));
        // Manually trigger completion
        editor.trigger('autocomplete', 'editor.action.triggerSuggest', {});
      } else {
        console.log('❌ No match or query too short');
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
      padding: { top: 12, bottom: 12 },
      // Force autocomplete to always show dropdown, never auto-accept
      suggest: {
        showMethods: true,
        showFunctions: true,
        showConstructors: true,
        showFields: true,
        showVariables: true,
        showClasses: true,
        showStructs: true,
        showInterfaces: true,
        showModules: true,
        showProperties: true,
        showEvents: true,
        showOperators: true,
        showUnits: true,
        showValues: true,
        showConstants: true,
        showEnums: true,
        showEnumMembers: true,
        showKeywords: true,
        showWords: true,
        showColors: true,
        showFiles: true,
        showReferences: true,
        showFolders: true,
        showTypeParameters: true,
        showSnippets: true,
        showUsers: true,
        showIssues: true,
        insertMode: 'replace',
        filterGraceful: true,
        localityBonus: true,
        shareSuggestSelections: false,
        snippetsPreventQuickSuggestions: false,
        preview: false
      }
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