import { useState, useRef, useCallback, useEffect } from 'react';
import type { Document } from '../api';
import { useAutocomplete, type AutocompleteItem } from '../components/AutocompleteDropdown';

interface HandlebarMatch {
  start: number;
  end: number;
  query: string;
  key?: string; // For completed handlebars like {{somekey}}
  isComplete: boolean;
}

interface UseHandlebarAutocompleteProps {
  documents: Document[];
  currentComponents: Record<string, string>;
  onComponentAdd: (key: string, documentId: string) => void;
}

export function useHandlebarAutocomplete({
  documents,
  currentComponents,
  onComponentAdd
}: UseHandlebarAutocompleteProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [currentMatch, setCurrentMatch] = useState<HandlebarMatch | null>(null);

  const autocomplete = useAutocomplete(documents, currentComponents);

  // Function to find handlebar patterns in text at cursor position
  const findHandlebarAtCursor = useCallback((text: string, cursorPos: number): HandlebarMatch | null => {
    // Look backwards from cursor to find opening {{
    let openStart = -1;
    for (let i = cursorPos - 1; i >= 0; i--) {
      if (text.slice(i, i + 2) === '{{') {
        openStart = i;
        break;
      }
      // If we hit a closing }}, stop looking
      if (text.slice(i, i + 2) === '}}') {
        break;
      }
      // If we hit whitespace or newline, stop looking
      if (/\s/.test(text[i])) {
        break;
      }
    }

    if (openStart === -1) {
      return null;
    }

    // Look forward from opening {{ to find closing }}
    let closeEnd = -1;
    for (let i = openStart + 2; i < text.length; i++) {
      if (text.slice(i, i + 2) === '}}') {
        closeEnd = i + 2;
        break;
      }
      // If we hit another opening {{, this is not a valid pattern
      if (text.slice(i, i + 2) === '{{') {
        break;
      }
    }

    const innerText = closeEnd !== -1
      ? text.slice(openStart + 2, closeEnd - 2)
      : text.slice(openStart + 2, cursorPos);

    // Check if cursor is within this handlebar
    if (cursorPos >= openStart && (closeEnd === -1 || cursorPos <= closeEnd)) {
      return {
        start: openStart,
        end: closeEnd !== -1 ? closeEnd : cursorPos,
        query: innerText.trim(),
        key: closeEnd !== -1 ? innerText.trim() : undefined,
        isComplete: closeEnd !== -1
      };
    }

    return null;
  }, []);

  // Function to get cursor position in textarea
  const getCursorPosition = useCallback((): number => {
    if (!textareaRef.current) return 0;
    return textareaRef.current.selectionStart || 0;
  }, []);

  // Function to get text caret position in pixels (simpler approach)
  const getCaretCoordinates = useCallback((): { top: number; left: number } => {
    if (!textareaRef.current) {
      return { top: 0, left: 0 };
    }

    const textarea = textareaRef.current;
    const rect = textarea.getBoundingClientRect();
    const cursorPos = getCursorPosition();
    const text = textarea.value;

    // Create a temporary element to measure the text before cursor
    const mirror = document.createElement('div');
    const style = window.getComputedStyle(textarea);

    // Copy relevant styles to mirror
    mirror.style.font = style.font;
    mirror.style.fontSize = style.fontSize;
    mirror.style.fontFamily = style.fontFamily;
    mirror.style.lineHeight = style.lineHeight;
    mirror.style.padding = style.padding;
    mirror.style.border = style.border;
    mirror.style.width = style.width;
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';
    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.top = '-9999px';
    mirror.style.left = '-9999px';
    mirror.style.overflow = 'hidden';

    // Get text up to cursor position
    const textBeforeCursor = text.substring(0, cursorPos);
    mirror.textContent = textBeforeCursor;

    // Add a measuring span at the end
    const measureSpan = document.createElement('span');
    measureSpan.textContent = '|';
    mirror.appendChild(measureSpan);

    document.body.appendChild(mirror);

    // Get the position of the measuring span
    const spanRect = measureSpan.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();

    document.body.removeChild(mirror);

    // Calculate position relative to viewport
    const left = rect.left + (spanRect.left - mirrorRect.left) + parseInt(style.paddingLeft || '0');
    const top = rect.top + (spanRect.top - mirrorRect.top) + parseInt(style.paddingTop || '0') + 20; // 20px below cursor

    return { top, left };
  }, [getCursorPosition]);

  // Handle text input and detect handlebars
  const handleTextChange = useCallback((text: string) => {
    const cursorPos = getCursorPosition();
    const match = findHandlebarAtCursor(text, cursorPos);

    if (match && !match.isComplete && match.query.length >= 1) {
      // Show autocomplete
      const coords = getCaretCoordinates();
      autocomplete.show(match.query, coords);
      setCurrentMatch(match);
    } else {
      // Hide autocomplete
      autocomplete.hide();
      setCurrentMatch(null);
    }
  }, [findHandlebarAtCursor, getCursorPosition, getCaretCoordinates, autocomplete]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!autocomplete.isVisible || !currentMatch) {
      return false;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        autocomplete.selectNext();
        return true;

      case 'ArrowUp':
        event.preventDefault();
        autocomplete.selectPrevious();
        return true;

      case 'Enter':
      case 'Tab':
        event.preventDefault();
        const selectedItem = autocomplete.getSelectedItem();
        if (selectedItem) {
          handleItemSelect(selectedItem);
        }
        return true;

      case 'Escape':
        event.preventDefault();
        autocomplete.hide();
        setCurrentMatch(null);
        return true;

      default:
        return false;
    }
  }, [autocomplete, currentMatch]);

  // Handle item selection from dropdown
  const handleItemSelect = useCallback((item: AutocompleteItem) => {
    if (!textareaRef.current || !currentMatch) {
      return;
    }

    const textarea = textareaRef.current;
    const text = textarea.value;

    // Generate group-level component reference with specific document targeting
    let componentKey: string;
    let componentValue: string;

    if (item.isInComponents) {
      // Find existing key for this document or group
      const existingKey = Object.keys(currentComponents).find(key => {
        const value = currentComponents[key];
        // Check if it's the same document ID or same group reference targeting this document
        return value === item.id ||
               value === `group:${item.group_id}:${item.id}` ||
               (item.group_id && value.startsWith(`group:${item.group_id}`));
      });
      componentKey = existingKey || generateComponentKey(item.title, currentComponents);

      // If we found an existing key, we might need to update its target to be more specific
      if (existingKey) {
        const existingValue = currentComponents[existingKey];
        const newValue = generateGroupComponentValue(item);

        // Only update if the new value is different (more specific targeting)
        if (existingValue !== newValue) {
          onComponentAdd(componentKey, newValue);
        }
      }
    } else {
      componentKey = generateComponentKey(item.title, currentComponents);
      componentValue = generateGroupComponentValue(item);
      // Add to components map with group-level reference
      onComponentAdd(componentKey, componentValue);
    }

    // Replace the partial handlebar with complete one
    const beforeMatch = text.substring(0, currentMatch.start);
    const afterMatch = text.substring(currentMatch.end);
    const newText = beforeMatch + `{{${componentKey}}}` + afterMatch;

    // Update textarea value
    textarea.value = newText;

    // Position cursor after the completed handlebar
    const newCursorPos = currentMatch.start + `{{${componentKey}}}`.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);

    // Trigger change event
    const event = new Event('input', { bubbles: true });
    textarea.dispatchEvent(event);

    // Hide autocomplete
    autocomplete.hide();
    setCurrentMatch(null);

    // Focus back to textarea
    textarea.focus();
  }, [currentMatch, currentComponents, onComponentAdd]);

  // Generate group-level component value with specific document targeting
  const generateGroupComponentValue = useCallback((item: AutocompleteItem): string => {
    if (item.group_id) {
      // Use group reference with specific document ID
      return `group:${item.group_id}:${item.id}`;
    } else {
      // For individual documents (no group), still use group format but with document as both group and target
      return `group:${item.id}:${item.id}`;
    }
  }, []);

  // Generate a unique component key based on title
  const generateComponentKey = useCallback((title: string, existingComponents: Record<string, string>): string => {
    // Start with title as base
    let baseKey = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
      .replace(/_+/g, '_'); // Collapse multiple underscores

    // Ensure it starts with a letter
    if (!/^[a-z]/.test(baseKey)) {
      baseKey = 'doc_' + baseKey;
    }

    // Make it unique
    let key = baseKey;
    let counter = 1;
    while (Object.keys(existingComponents).includes(key)) {
      key = `${baseKey}_${counter}`;
      counter++;
    }

    return key;
  }, []);

  // Handle click outside to hide autocomplete
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (autocomplete.isVisible) {
        const target = event.target as Element;
        if (!target.closest('.autocomplete-dropdown') &&
            !target.closest('textarea')) {
          autocomplete.hide();
          setCurrentMatch(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [autocomplete]);

  return {
    textareaRef,
    autocomplete,
    currentMatch,
    handleTextChange,
    handleKeyDown,
    handleItemSelect,
    isAutocompleteVisible: autocomplete.isVisible
  };
}