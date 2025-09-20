import { useState, useRef, useCallback } from 'react';
import type { Document } from '../api';
import { ExtractTextModal } from './ExtractTextModal';

interface ExtractButtonProps {
  sourceDocument: Document;
  allDocuments: Document[];
  selectedText: string;
  selectionRange: { start: number; end: number } | null;
  onCreateFromSelection?: (selectedText: string, selectionInfo: { start: number; end: number }, title: string, documentType: string, groupId?: string) => void;
  onExtract?: () => void; // Called when extraction is initiated to clear selection
}

export function ExtractButton({
  sourceDocument,
  allDocuments,
  selectedText,
  selectionRange,
  onCreateFromSelection,
  onExtract
}: ExtractButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const extractedTextRef = useRef('');
  const extractedRangeRef = useRef<{ start: number; end: number } | null>(null);

  const handleExtract = useCallback(() => {
    if (!selectedText || !selectionRange) return;

    // Capture the selection data before any state changes
    extractedTextRef.current = selectedText;
    extractedRangeRef.current = selectionRange;

    // Clear the visual selection
    window.getSelection()?.removeAllRanges();

    // Notify parent to clear its selection tracking
    if (onExtract) {
      onExtract();
    }

    // Open modal - this won't affect the markdown content since it's in a separate component
    setShowModal(true);
  }, [selectedText, selectionRange, onExtract]);

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
  if (!selectedText || !selectionRange) {
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