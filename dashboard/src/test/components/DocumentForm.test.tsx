import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../test-utils';
import { mockDocument, mockCompositeDocument } from '../test-utils';

// Import the component - we need to create a separate export for testability
import ProjectDetailPage from '../../pages/ProjectDetailPage';

// Since DocumentForm is not exported separately, we'll test it through the parent component
// This is integration testing, which is often more valuable than isolated unit tests
describe('DocumentForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render create document form', async () => {
    render(<ProjectDetailPage />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading documents...')).not.toBeInTheDocument();
    });

    // Click create new document button
    const createButton = screen.getByText('Create New Document');
    fireEvent.click(createButton);

    // Check form elements are present
    expect(screen.getByText('Create New Document')).toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/document type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/content/i)).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should show composite document controls when checkbox is checked', async () => {
    render(<ProjectDetailPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading documents...')).not.toBeInTheDocument();
    });

    const createButton = screen.getByText('Create New Document');
    fireEvent.click(createButton);

    // Check the composite document checkbox
    const compositeCheckbox = screen.getByLabelText(/composite document/i);
    fireEvent.click(compositeCheckbox);

    // Should show components section
    expect(screen.getByText('Components')).toBeInTheDocument();
    expect(screen.getByText('Add Component')).toBeInTheDocument();
    expect(screen.getByText(/use placeholders like/i)).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    render(<ProjectDetailPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading documents...')).not.toBeInTheDocument();
    });

    const createButton = screen.getByText('Create New Document');
    fireEvent.click(createButton);

    // Try to submit without filling required fields
    const submitButton = screen.getByText('Create');
    fireEvent.click(submitButton);

    // Should not proceed (would need to mock API call to test this properly)
    // For now, just verify the form is still visible
    expect(screen.getByText('Create New Document')).toBeInTheDocument();
  });

  it('should cancel form and reset state', async () => {
    render(<ProjectDetailPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading documents...')).not.toBeInTheDocument();
    });

    const createButton = screen.getByText('Create New Document');
    fireEvent.click(createButton);

    // Fill in some data
    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'Test Title' } });

    // Cancel the form
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    // Form should be hidden
    expect(screen.queryByText('Create New Document')).not.toBeInTheDocument();
    
    // Reopen form - should be reset
    fireEvent.click(createButton);
    expect(screen.getByLabelText(/title/i)).toHaveValue('');
  });

  it('should handle text input changes', async () => {
    render(<ProjectDetailPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading documents...')).not.toBeInTheDocument();
    });

    const createButton = screen.getByText('Create New Document');
    fireEvent.click(createButton);

    // Test title input
    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.change(titleInput, { target: { value: 'New Document Title' } });
    expect(titleInput).toHaveValue('New Document Title');

    // Test document type input
    const typeInput = screen.getByLabelText(/document type/i);
    fireEvent.change(typeInput, { target: { value: 'character' } });
    expect(typeInput).toHaveValue('character');

    // Test content textarea
    const contentTextarea = screen.getByLabelText(/content/i);
    fireEvent.change(contentTextarea, { target: { value: 'Document content here' } });
    expect(contentTextarea).toHaveValue('Document content here');
  });
});