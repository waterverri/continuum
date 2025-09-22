import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import TurndownService from 'turndown';
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
      console.log('ExtractButton: Selection change detected');
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        console.log('ExtractButton: No selection');
        setHasSelection(false);
        return;
      }

      const selectedText = selection.toString().trim();
      console.log('ExtractButton: Selected text:', selectedText);
      if (!selectedText || selection.getRangeAt(0).collapsed) {
        console.log('ExtractButton: Empty or collapsed selection');
        setHasSelection(false);
        return;
      }

      // Check if selection is within markdown content areas
      const range = selection.getRangeAt(0);
      console.log('ExtractButton: Checking contentRefs:', contentRefs.length);
      const isInMarkdownContent = contentRefs.some(ref => {
        console.log('ExtractButton: Checking ref:', ref.current);
        if (!ref.current || !range.commonAncestorContainer) return false;
        const contains = ref.current.contains(range.commonAncestorContainer) ||
               ref.current === range.commonAncestorContainer;
        console.log('ExtractButton: Ref contains selection:', contains);
        return contains;
      });

      console.log('ExtractButton: Is in markdown content:', isInMarkdownContent);
      setHasSelection(isInMarkdownContent);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [contentRefs]);

  const handleExtract = useCallback(() => {
    console.log('ExtractButton: handleExtract called');
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      console.log('ExtractButton: No selection found');
      return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    if (!selectedText) {
      console.log('ExtractButton: No selected text');
      return;
    }

    // Get HTML content (like Ctrl+C would capture)
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(range.cloneContents());
    const htmlContent = tempDiv.innerHTML;

    // Convert HTML to markdown
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced'
    });
    const markdownContent = turndownService.turndown(htmlContent);

    console.log('ExtractButton: Selected HTML:', htmlContent);
    console.log('ExtractButton: Converted markdown:', markdownContent);
    console.log('ExtractButton: Source document:', sourceDocument);

    // Calculate position in source text using plain text for positioning
    const fullText = sourceDocument.content || '';
    const startIndex = fullText.indexOf(selectedText);
    const selectionRange = startIndex !== -1
      ? { start: startIndex, end: startIndex + selectedText.length }
      : { start: 0, end: selectedText.length };

    // Capture the markdown content instead of plain text
    extractedTextRef.current = markdownContent;
    extractedRangeRef.current = selectionRange;

    console.log('ExtractButton: Opening modal with markdown:', markdownContent);
    // Open modal - keep selection visible
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

  // Don't render if no text is selected, UNLESS modal is open
  console.log('ExtractButton: Render check - hasSelection:', hasSelection, 'showModal:', showModal);
  if (!hasSelection && !showModal) {
    console.log('ExtractButton: Not rendering - no selection and no modal');
    return null;
  }

  console.log('ExtractButton: Rendering button');
  return (
    <>
      <button
        className="btn btn--primary btn--sm extract-btn"
        onClick={handleExtract}
        title="Extract selected text to new document"
      >
        💡 Extract
      </button>

      {/* Render modal outside of hasSelection conditional - always available when showModal is true */}
      {showModal && createPortal(
        <>
          {console.log('ExtractButton: Rendering modal via portal, showModal:', showModal, 'selectedText:', extractedTextRef.current)}
          <ExtractTextModal
            sourceDocument={sourceDocument}
            selectedText={extractedTextRef.current}
            allDocuments={allDocuments}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
          />
        </>,
        document.body
      )}
    </>
  );
}