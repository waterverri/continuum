import { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import type { Document } from '../api';
import * as monaco from 'monaco-editor';
import { getAutocompleteMatches, generateComponentKey, type AutocompleteMatch } from '../utils/autocompleteLogic';

interface MonacoAutocompleteEditorProps {
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


export function MonacoAutocompleteEditor({
  initialValue,
  onContentChange,
  documents,
  currentComponents,
  onComponentAdd,
  placeholder = '',
  className = '',
  height = '75vh',
  currentDocumentId
}: MonacoAutocompleteEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const disposablesRef = useRef<monaco.IDisposable[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disposablesRef.current.forEach(disposable => disposable.dispose());
      disposablesRef.current = [];
    };
  }, []);



  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: typeof monaco) => {
    editorRef.current = editor;

    // Dispose any existing providers to prevent duplicates
    disposablesRef.current.forEach(disposable => disposable.dispose());
    disposablesRef.current = [];

    // Disable default autocomplete
    monacoInstance.languages.typescript.typescriptDefaults.setCompilerOptions({
      ...monacoInstance.languages.typescript.typescriptDefaults.getCompilerOptions(),
      allowNonTsExtensions: true
    });

    // Register completion provider for {{ pattern
    const completionProvider = monacoInstance.languages.registerCompletionItemProvider('markdown', {
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
        const searchResults = getAutocompleteMatches(query, documents, currentComponents, currentDocumentId);

        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - query.length,
          endColumn: position.column,
        };

        const suggestions = searchResults.map((item, index) => {
          // Generate component key
          const existingKeys = Object.keys(currentComponents);
          const componentKey = generateComponentKey(item, existingKeys);

          const label = item.title;
          const detail = item.type === 'imported' ? '⭐ Already imported' :
                        item.document_type ? `Grouphead • ${item.document_type}` : 'Grouphead';

          return {
            label,
            kind: monacoInstance.languages.CompletionItemKind.Reference,
            detail,
            documentation: item.alias ? `Alias: ${item.alias}` : '',
            insertText: componentKey,
            range,
            sortText: `${item.priority.toString().padStart(3, '0')}_${index.toString().padStart(3, '0')}`,
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
    disposablesRef.current.push(completionProvider);

    // Register command to handle component addition when item is selected
    monacoInstance.editor.registerCommand('addComponent', (_accessor, item: AutocompleteMatch, componentKey: string) => {
      // Add to components when actually selected
      onComponentAdd(componentKey, item.id);
    });

    // Add content change listener to trigger completion when typing inside {{
    editor.onDidChangeModelContent(() => {
      const position = editor.getPosition();
      if (!position) return;

      const model = editor.getModel();
      if (!model) return;

      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      // Check if we're inside a {{ pattern
      const match = textUntilPosition.match(/\{\{([^}]*)$/);

      if (match && match[1].length >= 1) {
        // Manually trigger completion
        editor.trigger('autocomplete', 'editor.action.triggerSuggest', {});
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
        defaultValue={initialValue}
        onChange={(newValue) => onContentChange(newValue || '')}
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