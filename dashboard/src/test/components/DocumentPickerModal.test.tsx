import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../test-utils';
import { mockDocument, mockCompositeDocument, mockApi } from '../test-utils';

import ProjectDetailPage from '../../pages/ProjectDetailPage';

describe('DocumentPickerModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock API responses
    mockApi.getDocuments.mockResolvedValue([
      mockDocument,
      mockCompositeDocument,
      {
        ...mockDocument,
        id: 'doc-3',
        title: 'Character Profile',
        document_type: 'character',
        content: 'A detailed character description'
      },
      {
        ...mockDocument,
        id: 'doc-4',
        title: 'Scene Description',
        document_type: 'scene',
        content: 'The tavern was dimly lit...'
      }
    ]);
  });

  const openDocumentPicker = async () => {
    render(<ProjectDetailPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading documents...')).not.toBeInTheDocument();
    });

    // Create a new document
    const createButton = screen.getByText('Create New Document');
    fireEvent.click(createButton);

    // Enable composite mode
    const compositeCheckbox = screen.getByLabelText(/composite document/i);
    fireEvent.click(compositeCheckbox);

    // Click add component - this should open key input modal first
    const addComponentButton = screen.getByText('Add Component');
    fireEvent.click(addComponentButton);

    // Enter a component key
    const keyInput = screen.getByLabelText(/placeholder key/i);
    fireEvent.change(keyInput, { target: { value: 'intro' } });
    
    // Click next to open document picker
    const nextButton = screen.getByText('Next: Select Document');
    fireEvent.click(nextButton);

    // Wait for modal to appear
    await waitFor(() => {
      expect(screen.getByText(/Select Document for/i)).toBeInTheDocument();
    });
  };

  it('should display all available documents', async () => {
    await openDocumentPicker();

    // Should show all documents except the current one
    expect(screen.getByText('Test Document')).toBeInTheDocument();
    expect(screen.getByText('Test Composite')).toBeInTheDocument();
    expect(screen.getByText('Character Profile')).toBeInTheDocument();
    expect(screen.getByText('Scene Description')).toBeInTheDocument();
  });

  it('should filter documents by search term', async () => {
    await openDocumentPicker();

    const searchInput = screen.getByPlaceholderText(/search by title or content/i);
    fireEvent.change(searchInput, { target: { value: 'Character' } });

    // Should only show documents matching the search
    expect(screen.getByText('Character Profile')).toBeInTheDocument();
    expect(screen.queryByText('Scene Description')).not.toBeInTheDocument();
  });

  it('should filter documents by type', async () => {
    await openDocumentPicker();

    const typeSelect = screen.getByDisplayValue('All Types');
    fireEvent.change(typeSelect, { target: { value: 'character' } });

    // Should only show character type documents
    expect(screen.getByText('Character Profile')).toBeInTheDocument();
    expect(screen.queryByText('Scene Description')).not.toBeInTheDocument();
  });

  it('should filter documents by format', async () => {
    await openDocumentPicker();

    const formatSelect = screen.getByDisplayValue('All Formats');
    fireEvent.change(formatSelect, { target: { value: 'composite' } });

    // Should only show composite documents
    expect(screen.getByText('Test Composite')).toBeInTheDocument();
    expect(screen.queryByText('Test Document')).not.toBeInTheDocument();
  });

  it('should select a document and close modal', async () => {
    await openDocumentPicker();

    const documentItem = screen.getByText('Character Profile');
    fireEvent.click(documentItem);

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByText(/Select Document for/i)).not.toBeInTheDocument();
    });

    // Component should be added to the form
    await waitFor(() => {
      expect(screen.getByText('Character Profile')).toBeInTheDocument();
    });
  });

  it('should cancel and close modal', async () => {
    await openDocumentPicker();

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByText(/Select Document for/i)).not.toBeInTheDocument();
    });

    // No component should be added
    expect(screen.queryByText('{{intro}}')).not.toBeInTheDocument();
  });

  it('should close modal when clicking overlay', async () => {
    await openDocumentPicker();

    const overlay = screen.getByText(/Select Document for/i).closest('.modal-overlay');
    expect(overlay).toBeInTheDocument();

    // Click on the overlay (outside the modal content)
    fireEvent.click(overlay!);

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByText(/Select Document for/i)).not.toBeInTheDocument();
    });
  });

  it('should show document previews', async () => {
    await openDocumentPicker();

    // Should show content previews for documents
    expect(screen.getByText('This is test content')).toBeInTheDocument();
    expect(screen.getByText('A detailed character description')).toBeInTheDocument();
    expect(screen.getByText('The tavern was dimly lit...')).toBeInTheDocument();
  });

  it('should show document IDs in abbreviated form', async () => {
    await openDocumentPicker();

    // Should show abbreviated document IDs
    expect(screen.getByText(/ID: test-doc.../)).toBeInTheDocument();
    expect(screen.getByText(/ID: test-com.../)).toBeInTheDocument();
  });
});