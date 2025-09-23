import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  TextNode,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_ENTER_COMMAND,
  COMMAND_PRIORITY_LOW,
} from 'lexical';
import type { Document } from '../api';
import { getAutocompleteMatches, generateComponentKey, type AutocompleteMatch } from '../utils/autocompleteLogic';

interface LexicalAutocompletePluginProps {
  documents: Document[];
  currentComponents: Record<string, string>;
  onComponentAdd: (key: string, documentId: string) => void;
  currentDocumentId?: string;
}

export function LexicalAutocompletePlugin({
  documents,
  currentComponents,
  onComponentAdd,
  currentDocumentId
}: LexicalAutocompletePluginProps) {
  const [editor] = useLexicalComposerContext();
  const [suggestions, setSuggestions] = useState<AutocompleteMatch[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [triggerWord, setTriggerWord] = useState('');
  void triggerWord; // Suppress unused variable warning
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const autocompleteRef = useRef<HTMLDivElement>(null);


  // Check if we're typing {{ and show autocomplete
  useEffect(() => {
    const unregister = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          if (isVisible) {
            setIsVisible(false);
            setSuggestions([]);
          }
          return;
        }

        const anchorNode = selection.anchor.getNode();
        if (!(anchorNode instanceof TextNode)) {
          return;
        }

        const text = anchorNode.getTextContent();
        const offset = selection.anchor.offset;

        // Find the last {{ before cursor
        const beforeCursor = text.substring(0, offset);
        const lastBraceIndex = beforeCursor.lastIndexOf('{{');

        if (lastBraceIndex === -1) {
          if (isVisible) {
            setIsVisible(false);
            setSuggestions([]);
          }
          return;
        }

        // Check if there's a closing }} between {{ and cursor
        const afterBraces = beforeCursor.substring(lastBraceIndex + 2);
        if (afterBraces.includes('}}')) {
          if (isVisible) {
            setIsVisible(false);
            setSuggestions([]);
          }
          return;
        }

        // Get the query after {{
        const query = afterBraces;

        if (query.length >= 0) {
          const matches = getAutocompleteMatches(query, documents, currentComponents, currentDocumentId);
          if (matches.length > 0) {
            setSuggestions(matches);
            setTriggerWord(query);
            setSelectedIndex(0);
            setIsVisible(true);

            // Calculate absolute position relative to viewport
            const calculatePosition = () => {
              const domSelection = window.getSelection();
              if (domSelection && domSelection.rangeCount > 0) {
                const range = domSelection.getRangeAt(0);
                const rect = range.getBoundingClientRect();

                // Position dropdown below the cursor
                const x = rect.left + window.scrollX;
                const y = rect.bottom + window.scrollY + 4; // 4px gap

                setPosition({ x, y });
              } else {
                // Fallback position
                setPosition({ x: 100, y: 100 });
              }
            };

            // Calculate position immediately
            calculatePosition();

            // Also recalculate on scroll/resize
            const handlePositionUpdate = () => {
              if (isVisible) calculatePosition();
            };

            window.addEventListener('scroll', handlePositionUpdate, true);
            window.addEventListener('resize', handlePositionUpdate);

            // Cleanup listeners when autocomplete closes
            const cleanup = () => {
              window.removeEventListener('scroll', handlePositionUpdate, true);
              window.removeEventListener('resize', handlePositionUpdate);
            };

            // Store cleanup function for later use
            (window as any)._lexicalAutocompleteCleanup = cleanup;
          } else {
            setIsVisible(false);
            setSuggestions([]);
          }
        }
      });
    });

    return unregister;
  }, [editor, isVisible, documents]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isVisible) return;


    const unregisterArrowDown = editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      () => {
        if (isVisible) {
          setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    const unregisterArrowUp = editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      () => {
        if (isVisible) {
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    const unregisterEnter = editor.registerCommand(
      KEY_ENTER_COMMAND,
      () => {
        if (isVisible && selectedIndex >= 0 && selectedIndex < suggestions.length) {
          insertSuggestion(suggestions[selectedIndex]);
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    const unregisterEscape = editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      () => {
        if (isVisible) {
          setIsVisible(false);
          setSuggestions([]);
          // Cleanup scroll listeners
          if ((window as any)._lexicalAutocompleteCleanup) {
            (window as any)._lexicalAutocompleteCleanup();
            (window as any)._lexicalAutocompleteCleanup = null;
          }
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    return () => {
      unregisterArrowDown();
      unregisterArrowUp();
      unregisterEnter();
      unregisterEscape();
    };
  }, [editor, isVisible, suggestions, selectedIndex]);

  const insertSuggestion = (suggestion: AutocompleteMatch) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
        return;
      }

      const anchorNode = selection.anchor.getNode();
      if (!(anchorNode instanceof TextNode)) {
        return;
      }

      const text = anchorNode.getTextContent();
      const offset = selection.anchor.offset;
      const beforeCursor = text.substring(0, offset);
      const lastBraceIndex = beforeCursor.lastIndexOf('{{');

      if (lastBraceIndex === -1) return;

      // Generate a unique key for this component
      const existingKeys = Object.keys(currentComponents);
      const componentKey = generateComponentKey(suggestion, existingKeys);

      // Replace the {{query with {{key}}
      const beforeBraces = text.substring(0, lastBraceIndex);
      const afterCursor = text.substring(offset);
      const newText = `${beforeBraces}{{${componentKey}}}${afterCursor}`;

      // Update the text node
      anchorNode.setTextContent(newText);

      // Position cursor after the insertion
      const newOffset = lastBraceIndex + `{{${componentKey}}}`.length;
      selection.anchor.offset = newOffset;
      selection.focus.offset = newOffset;

      // Add to components
      onComponentAdd(componentKey, suggestion.id);
    });

    setIsVisible(false);
    setSuggestions([]);

    // Cleanup scroll listeners
    if ((window as any)._lexicalAutocompleteCleanup) {
      (window as any)._lexicalAutocompleteCleanup();
      (window as any)._lexicalAutocompleteCleanup = null;
    }
  };

  if (!isVisible || suggestions.length === 0) {
    return null;
  }

  // Render dropdown in a portal at document root to avoid positioning issues
  return createPortal(
    <div
      ref={autocompleteRef}
      className="lexical-autocomplete-dropdown"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 10000
      }}
    >
      {suggestions.map((suggestion, index) => (
        <div
          key={`${suggestion.id}-${index}`}
          className={`autocomplete-item ${index === selectedIndex ? 'selected' : ''}`}
          onClick={() => insertSuggestion(suggestion)}
        >
          <div className="autocomplete-title">{suggestion.title}</div>
          <div className="autocomplete-meta">
            {suggestion.type === 'imported' ? '⭐ Imported' : 'Grouphead'}
            {suggestion.document_type && ` • ${suggestion.document_type}`}
          </div>
        </div>
      ))}
    </div>,
    document.body
  );
}