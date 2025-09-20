import { useState, useRef, useCallback, useEffect } from 'react';
import type { Document } from '../api';
import { ExtractTextModal } from './ExtractTextModal';

interface ExtractButtonProps {
  sourceDocument: Document;
  allDocuments: Document[];
  onCreateFromSelection?: (selectedText: string, selectionInfo: { start: number; end: number }, title: string, documentType: string, groupId?: string) => void;
  contentRefs: React.RefObject<HTMLDivElement | null>[];
}

export function ExtractButton({
  sourceDocument,
  allDocuments,
  onCreateFromSelection,
  contentRefs
}: ExtractButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const extractedTextRef = useRef('');
  const extractedRangeRef = useRef<{ start: number; end: number } | null>(null);

  // Listen for text selection changes
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        setHasSelection(false);
        return;
      }

      const selectedText = selection.toString().trim();
      if (!selectedText || selection.getRangeAt(0).collapsed) {
        setHasSelection(false);
        return;
      }

      // Check if selection is within markdown content areas
      const range = selection.getRangeAt(0);
      const isInMarkdownContent = contentRefs.some(ref => {
        if (!ref.current || !range.commonAncestorContainer) return false;
        return ref.current.contains(range.commonAncestorContainer) ||
               ref.current === range.commonAncestorContainer;
      });

      setHasSelection(isInMarkdownContent);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [contentRefs]);

  const handleExtract = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    // Calculate position in source text
    const fullText = sourceDocument.content || '';
    const startIndex = fullText.indexOf(selectedText);
    const selectionRange = startIndex !== -1
      ? { start: startIndex, end: startIndex + selectedText.length }
      : { start: 0, end: selectedText.length };

    // Capture the selection data before any state changes
    extractedTextRef.current = selectedText;
    extractedRangeRef.current = selectionRange;

    // Clear the visual selection
    selection.removeAllRanges();
    setHasSelection(false);

    // Open modal
    setShowModal(true);
  }, [sourceDocument.content]);

  const handleConfirm = useCallback((title: string, documentType: string, groupId?: string) => {
    if (extractedTextRef.current && extractedRangeRef.current && onCreateFromSelection) {
      onCreateFromSelection(extractedTextRef.current, extractedRangeRef.current, title, documentType, groupId);
    }
    setShowModal(false);
    extractedTextRef.current = '';
    extractedRangeRef.current = null;
  }, [onCreateFromSelection]);

  const handleCancel = useCallback(() => {
    setShowModal(false);
    extractedTextRef.current = '';
    extractedRangeRef.current = null;
  }, []);

  // Don't render if no text is selected
  if (!hasSelection) {
    return null;
  }

  return (
    <>
      <button
        className="btn btn--primary btn--sm extract-btn"
        onClick={handleExtract}
        title="Extract selected text to new document"
      >
        💡 Extract
      </button>

      {showModal && (
        <ExtractTextModal
          sourceDocument={sourceDocument}
          selectedText={extractedTextRef.current}
          allDocuments={allDocuments}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </>
  );
}