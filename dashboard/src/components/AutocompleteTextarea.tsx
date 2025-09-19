import React, { forwardRef, useImperativeHandle } from 'react';
import type { Document } from '../api';
import { useHandlebarAutocomplete } from '../hooks/useHandlebarAutocomplete';
import { AutocompleteDropdown } from './AutocompleteDropdown';

interface AutocompleteTextareaProps {
  value: string;
  onChange: (value: string) => void;
  documents: Document[];
  currentComponents: Record<string, string>;
  onComponentAdd: (key: string, documentId: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
}

export interface AutocompleteTextareaRef {
  focus: () => void;
  blur: () => void;
  getTextarea: () => HTMLTextAreaElement | null;
}

export const AutocompleteTextarea = forwardRef<AutocompleteTextareaRef, AutocompleteTextareaProps>(({
  value,
  onChange,
  documents,
  currentComponents,
  onComponentAdd,
  placeholder = "Enter your content...",
  rows = 15,
  className = "form-textarea",
  disabled = false
}, ref) => {
  const {
    textareaRef,
    autocomplete,
    handleTextChange,
    handleKeyDown,
    handleItemSelect,
    isAutocompleteVisible
  } = useHandlebarAutocomplete({
    documents,
    currentComponents,
    onComponentAdd
  });

  // Expose textarea methods through ref
  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    blur: () => textareaRef.current?.blur(),
    getTextarea: () => textareaRef.current
  }));

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = event.target.value;
    onChange(newValue);
    handleTextChange(newValue);
  };

  const handleKeyDownEvent = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Let the autocomplete hook handle navigation keys
    const handled = handleKeyDown(event);

    // If not handled by autocomplete, allow normal textarea behavior
    if (!handled) {
      // You can add any other custom key handling here
    }
  };

  return (
    <div className="autocomplete-textarea-container" style={{ position: 'relative' }}>
      <textarea
        ref={textareaRef}
        className={className}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDownEvent}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        spellCheck="false" // Disable spellcheck to avoid interfering with handlebars
      />

      {isAutocompleteVisible && (
        <AutocompleteDropdown
          isVisible={autocomplete.isVisible}
          searchQuery={autocomplete.searchQuery}
          items={autocomplete.items}
          selectedIndex={autocomplete.selectedIndex}
          onSelect={handleItemSelect}
          position={autocomplete.position}
        />
      )}
    </div>
  );
});

AutocompleteTextarea.displayName = 'AutocompleteTextarea';