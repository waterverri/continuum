import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentList, DocumentListItem } from '../../components/DocumentList';
import type { Document, Tag } from '../../api';

// Mock document for testing
const mockDocument: Document = {
  id: 'doc1',
  title: 'Test Document',
  content: 'Test content',
  document_type: 'character',
  is_composite: false,
  components: {},
  created_at: '2024-01-01T00:00:00Z',
  project_id: 'project1',
  tags: [
    { id: 'tag1', name: 'Test Tag', color: '#ff0000' } as Tag
  ]
};

const mockDocuments = [mockDocument];

describe('DocumentListItem', () => {
  const mockProps = {
    document: mockDocument,
    onClick: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onCreateDerivative: vi.fn(),
    onManageTags: vi.fn(),
    showActions: true,
    variant: 'sidebar' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders document information correctly', () => {
    render(<DocumentListItem {...mockProps} />);

    expect(screen.getByText('Test Document')).toBeInTheDocument();
    expect(screen.getByText(/📄 Static/)).toBeInTheDocument();
    expect(screen.getByText(/character/)).toBeInTheDocument();
    expect(screen.getByText('Test Tag')).toBeInTheDocument();
  });

  it('shows edit icon when onEdit is provided', () => {
    render(<DocumentListItem {...mockProps} />);

    const editButton = screen.getByTitle('Edit document');
    expect(editButton).toBeInTheDocument();
    expect(editButton.textContent).toBe('✏️');
  });

  it('shows menu button and opens dropdown on click', async () => {
    render(<DocumentListItem {...mockProps} />);

    const menuButton = screen.getByTitle('More actions');
    expect(menuButton).toBeInTheDocument();
    expect(menuButton.textContent).toBe('⋯');

    // Click menu button
    fireEvent.click(menuButton);

    // Check dropdown items appear
    await waitFor(() => {
      expect(screen.getByText('+ Derivative')).toBeInTheDocument();
      expect(screen.getByText('🏷️ Tags')).toBeInTheDocument();
      expect(screen.getByText('🗑️ Delete')).toBeInTheDocument();
    });
  });

  it('calls onEdit when edit button is clicked', () => {
    render(<DocumentListItem {...mockProps} />);

    const editButton = screen.getByTitle('Edit document');
    fireEvent.click(editButton);

    expect(mockProps.onEdit).toHaveBeenCalledWith(mockDocument);
  });

  it('calls onCreateDerivative when derivative option is clicked', async () => {
    render(<DocumentListItem {...mockProps} />);

    // Open dropdown
    const menuButton = screen.getByTitle('More actions');
    fireEvent.click(menuButton);

    // Click derivative option
    await waitFor(() => {
      const derivativeButton = screen.getByText('+ Derivative');
      fireEvent.click(derivativeButton);
    });

    expect(mockProps.onCreateDerivative).toHaveBeenCalledWith(mockDocument);
  });

  it('calls onManageTags when tags option is clicked', async () => {
    render(<DocumentListItem {...mockProps} />);

    // Open dropdown
    const menuButton = screen.getByTitle('More actions');
    fireEvent.click(menuButton);

    // Click tags option
    await waitFor(() => {
      const tagsButton = screen.getByText('🏷️ Tags');
      fireEvent.click(tagsButton);
    });

    expect(mockProps.onManageTags).toHaveBeenCalledWith(mockDocument);
  });

  it('calls onDelete when delete option is clicked', async () => {
    render(<DocumentListItem {...mockProps} />);

    // Open dropdown
    const menuButton = screen.getByTitle('More actions');
    fireEvent.click(menuButton);

    // Click delete option
    await waitFor(() => {
      const deleteButton = screen.getByText('🗑️ Delete');
      fireEvent.click(deleteButton);
    });

    expect(mockProps.onDelete).toHaveBeenCalledWith('doc1');
  });

  it('closes dropdown when clicking outside', async () => {
    render(<DocumentListItem {...mockProps} />);

    // Open dropdown
    const menuButton = screen.getByTitle('More actions');
    fireEvent.click(menuButton);

    // Verify dropdown is open
    await waitFor(() => {
      expect(screen.getByText('+ Derivative')).toBeInTheDocument();
    });

    // Click outside (on document.body)
    fireEvent.mouseDown(document.body);

    // Verify dropdown is closed
    await waitFor(() => {
      expect(screen.queryByText('+ Derivative')).not.toBeInTheDocument();
    });
  });

  it('calls onClick when document content is clicked', () => {
    render(<DocumentListItem {...mockProps} />);

    const documentContent = screen.getByText('Test Document').closest('.document-item__content');
    expect(documentContent).toBeInTheDocument();
    
    fireEvent.click(documentContent!);
    expect(mockProps.onClick).toHaveBeenCalledWith(mockDocument);
  });

  it('prevents event propagation when action buttons are clicked', async () => {
    render(<DocumentListItem {...mockProps} />);

    // Click edit button - should not trigger onClick
    const editButton = screen.getByTitle('Edit document');
    fireEvent.click(editButton);

    expect(mockProps.onEdit).toHaveBeenCalledWith(mockDocument);
    expect(mockProps.onClick).not.toHaveBeenCalled();

    // Reset mocks
    vi.clearAllMocks();

    // Click menu button - should not trigger onClick
    const menuButton = screen.getByTitle('More actions');
    fireEvent.click(menuButton);

    expect(mockProps.onClick).not.toHaveBeenCalled();
  });

  it('applies selected styling when isSelected is true', () => {
    render(<DocumentListItem {...mockProps} isSelected={true} />);

    const documentItem = screen.getByText('Test Document').closest('.document-item');
    expect(documentItem).toHaveClass('document-item--selected');
  });

  it('handles composite documents correctly', () => {
    const compositeDocument: Document = {
      ...mockDocument,
      components: { placeholder: 'doc-id-123' }
    };

    render(<DocumentListItem {...mockProps} document={compositeDocument} />);

    expect(screen.getByText(/🔗 Composite/)).toBeInTheDocument();
  });
});

describe('DocumentList', () => {
  const mockProps = {
    documents: mockDocuments,
    onDocumentClick: vi.fn(),
    onDocumentEdit: vi.fn(),
    onDocumentDelete: vi.fn(),
    onCreateDerivative: vi.fn(),
    onManageTags: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all documents', () => {
    render(<DocumentList {...mockProps} />);

    expect(screen.getByText('Test Document')).toBeInTheDocument();
  });

  it('shows empty state when no documents', () => {
    render(<DocumentList {...mockProps} documents={[]} />);

    expect(screen.getByText('No documents found.')).toBeInTheDocument();
  });

  it('shows custom empty message', () => {
    const customMessage = 'No matching documents found.';
    render(<DocumentList {...mockProps} documents={[]} emptyMessage={customMessage} />);

    expect(screen.getByText(customMessage)).toBeInTheDocument();
  });

  it('passes correct props to DocumentListItem', () => {
    const selectedDocumentId = 'doc1';
    render(<DocumentList {...mockProps} selectedDocumentId={selectedDocumentId} />);

    const documentItem = screen.getByText('Test Document').closest('.document-item');
    expect(documentItem).toHaveClass('document-item--selected');
  });
});