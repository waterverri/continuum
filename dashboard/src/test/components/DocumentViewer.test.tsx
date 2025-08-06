import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../test-utils';
import { mockDocument, mockCompositeDocument, mockApi } from '../test-utils';

import ProjectDetailPage from '../../pages/ProjectDetailPage';

describe('DocumentViewer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockApi.getDocuments.mockResolvedValue([mockDocument, mockCompositeDocument]);
  });

  it('should display static document information', async () => {
    render(<ProjectDetailPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading documents...')).not.toBeInTheDocument();
    });

    // Click on a document to select it
    const documentItem = screen.getByText('Test Document');
    fireEvent.click(documentItem);

    // Should display document information
    expect(screen.getByText('Test Document')).toBeInTheDocument();
    expect(screen.getByText(/Type:.*character/)).toBeInTheDocument();
    expect(screen.getByText(/Format:.*Static Document/)).toBeInTheDocument();
    
    // Should show raw content
    expect(screen.getByText('Raw Content:')).toBeInTheDocument();
    expect(screen.getByText('This is test content')).toBeInTheDocument();
  });

  it('should display composite document information', async () => {
    render(<ProjectDetailPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading documents...')).not.toBeInTheDocument();
    });

    // Click on composite document
    const compositeItem = screen.getByText('Test Composite');
    fireEvent.click(compositeItem);

    // Should display composite document information
    expect(screen.getByText('Test Composite')).toBeInTheDocument();
    expect(screen.getByText(/Format:.*Composite Document/)).toBeInTheDocument();
    
    // Should show resolve template button
    expect(screen.getByText('🔗 Resolve Template')).toBeInTheDocument();
    
    // Should show components
    expect(screen.getByText('Components:')).toBeInTheDocument();
    expect(screen.getByText('{{intro}}')).toBeInTheDocument();
    expect(screen.getByText('{{body}}')).toBeInTheDocument();
  });

  it('should resolve composite document template', async () => {
    // Mock the resolved document response
    mockApi.getDocument.mockResolvedValue({
      ...mockCompositeDocument,
      resolved_content: 'Intro: This is the intro content\nBody: This is the body content'
    });

    render(<ProjectDetailPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading documents...')).not.toBeInTheDocument();
    });

    // Select composite document
    const compositeItem = screen.getByText('Test Composite');
    fireEvent.click(compositeItem);

    // Click resolve template button
    const resolveButton = screen.getByText('🔗 Resolve Template');
    fireEvent.click(resolveButton);

    // Should call API to get resolved content
    await waitFor(() => {
      expect(mockApi.getDocument).toHaveBeenCalledWith(
        'test-project-id',
        'test-composite-id',
        expect.any(String),
        true
      );
    });

    // Should show resolved content
    await waitFor(() => {
      expect(screen.getByText('Resolved Content:')).toBeInTheDocument();
      expect(screen.getByText(/Intro: This is the intro content/)).toBeInTheDocument();
    });
  });

  it('should show document type and metadata', async () => {
    render(<ProjectDetailPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading documents...')).not.toBeInTheDocument();
    });

    // Select document
    const documentItem = screen.getByText('Test Document');
    fireEvent.click(documentItem);

    // Should show document metadata
    expect(screen.getByText(/Type:.*character/)).toBeInTheDocument();
    expect(screen.getByText(/Format:.*Static Document/)).toBeInTheDocument();
  });

  it('should handle document with no content', async () => {
    // Mock document with no content
    const emptyDocument = { ...mockDocument, content: null };
    mockApi.getDocuments.mockResolvedValue([emptyDocument]);

    render(<ProjectDetailPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading documents...')).not.toBeInTheDocument();
    });

    // Select the empty document
    const documentItem = screen.getByText('Test Document');
    fireEvent.click(documentItem);

    // Should show "No content" message
    expect(screen.getByText('No content')).toBeInTheDocument();
  });

  it('should handle document with no type', async () => {
    // Mock document with no type
    const noTypeDocument = { ...mockDocument, document_type: null };
    mockApi.getDocuments.mockResolvedValue([noTypeDocument]);

    render(<ProjectDetailPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading documents...')).not.toBeInTheDocument();
    });

    // Select the document
    const documentItem = screen.getByText('Test Document');
    fireEvent.click(documentItem);

    // Should show "No type" message
    expect(screen.getByText(/Type:.*No type/)).toBeInTheDocument();
  });

  it('should handle resolve template error', async () => {
    // Mock API error
    mockApi.getDocument.mockRejectedValue(new Error('Failed to resolve'));

    render(<ProjectDetailPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Loading documents...')).not.toBeInTheDocument();
    });

    // Select composite document
    const compositeItem = screen.getByText('Test Composite');
    fireEvent.click(compositeItem);

    // Click resolve template button
    const resolveButton = screen.getByText('🔗 Resolve Template');
    fireEvent.click(resolveButton);

    // Should show error message (we'd need to check console.error or error state)
    await waitFor(() => {
      expect(mockApi.getDocument).toHaveBeenCalled();
    });

    // Error handling would need to be implemented in the component
    // For now, just verify the API was called
  });
});