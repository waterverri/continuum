import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import DocumentHistoryModal from '../../components/DocumentHistoryModal';
import type { Document, DocumentHistoryResponse, DocumentHistory } from '../../api';

// Mock document for testing
const mockDocument: Document = {
  id: 'doc-1',
  project_id: 'project-1',
  title: 'Test Document',
  content: 'Test content',
  is_composite: false,
  is_prompt: false,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z'
};

// Mock history entries
const mockHistoryEntries: DocumentHistory[] = [
  {
    id: 'hist-1',
    document_id: 'doc-1',
    project_id: 'project-1',
    title: 'Test Document',
    content: 'Updated content',
    document_type: 'scene',
    group_id: null,
    is_composite: false,
    components: null,
    event_id: null,
    change_type: 'update_content',
    change_description: 'Updated document content',
    user_id: 'user-1',
    created_at: '2025-01-01T12:00:00Z',
    previous_version_id: null,
    profiles: {
      display_name: 'Test User'
    }
  },
  {
    id: 'hist-2', 
    document_id: 'doc-1',
    project_id: 'project-1',
    title: 'Test Document',
    content: 'Initial content',
    document_type: 'scene',
    group_id: null,
    is_composite: false,
    components: null,
    event_id: null,
    change_type: 'create',
    change_description: 'Document created',
    user_id: 'user-1',
    created_at: '2025-01-01T10:00:00Z',
    previous_version_id: null,
    profiles: {
      display_name: 'Test User'
    }
  }
];

const mockHistoryResponse: DocumentHistoryResponse = {
  document: {
    id: 'doc-1',
    title: 'Test Document'
  },
  history: mockHistoryEntries,
  pagination: {
    total: 2,
    limit: 50,
    offset: 0
  }
};

describe('DocumentHistoryModal', () => {
  const mockLoadDocumentHistory = vi.fn();
  const mockLoadHistoryEntry = vi.fn();
  const mockOnRollback = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadDocumentHistory.mockResolvedValue(mockHistoryResponse);
    mockLoadHistoryEntry.mockResolvedValue(mockHistoryEntries[0]);
  });

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    document: mockDocument,
    projectId: 'project-1',
    loadDocumentHistory: mockLoadDocumentHistory,
    loadHistoryEntry: mockLoadHistoryEntry,
    onRollback: mockOnRollback
  };

  it('renders nothing when closed', () => {
    render(
      <DocumentHistoryModal
        {...defaultProps}
        isOpen={false}
      />
    );

    expect(screen.queryByText('Document History')).not.toBeInTheDocument();
  });

  it('renders modal with document title when open', async () => {
    await act(async () => {
      render(<DocumentHistoryModal {...defaultProps} />);
    });

    expect(screen.getByText('Document History')).toBeInTheDocument();
    // Check for the document title in the header subtitle specifically
    expect(screen.getAllByText('Test Document')).toHaveLength(3); // Header + 2 history entries
  });

  it('loads history on open', async () => {
    await act(async () => {
      render(<DocumentHistoryModal {...defaultProps} />);
    });

    await waitFor(() => {
      expect(mockLoadDocumentHistory).toHaveBeenCalledWith('doc-1', 20, 0);
    });
  });

  it('displays history entries', async () => {
    await act(async () => {
      render(<DocumentHistoryModal {...defaultProps} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Content Updated')).toBeInTheDocument();
      expect(screen.getByText('Created')).toBeInTheDocument();
      expect(screen.getAllByText('by User')).toHaveLength(2);
    });
  });

  it('shows rollback buttons for non-delete entries', async () => {
    await act(async () => {
      render(<DocumentHistoryModal {...defaultProps} />);
    });

    await waitFor(() => {
      const rollbackButtons = screen.getAllByText('Rollback');
      expect(rollbackButtons).toHaveLength(2); // Both entries should have rollback buttons
    });
  });

  it('calls rollback handler when rollback button is clicked', async () => {
    await act(async () => {
      render(<DocumentHistoryModal {...defaultProps} />);
    });

    await waitFor(() => {
      const rollbackButtons = screen.getAllByText('Rollback');
      expect(rollbackButtons.length).toBeGreaterThan(0);
    });

    const firstRollbackButton = screen.getAllByText('Rollback')[0];
    await act(async () => {
      fireEvent.click(firstRollbackButton);
    });

    expect(mockOnRollback).toHaveBeenCalledWith('hist-1');
  });

  it('loads detailed history entry when entry is clicked', async () => {
    await act(async () => {
      render(<DocumentHistoryModal {...defaultProps} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Content Updated')).toBeInTheDocument();
    });

    // Click on the first history entry
    const historyEntry = screen.getByText('Content Updated').closest('.history-entry');
    expect(historyEntry).toBeInTheDocument();
    
    await act(async () => {
      fireEvent.click(historyEntry!);
    });

    await waitFor(() => {
      expect(mockLoadHistoryEntry).toHaveBeenCalledWith('doc-1', 'hist-1');
    });
  });

  it('shows empty state when no history entries', async () => {
    const emptyResponse: DocumentHistoryResponse = {
      ...mockHistoryResponse,
      history: [],
      pagination: { ...mockHistoryResponse.pagination, total: 0 }
    };
    
    mockLoadDocumentHistory.mockResolvedValue(emptyResponse);

    await act(async () => {
      render(<DocumentHistoryModal {...defaultProps} />);
    });

    await waitFor(() => {
      expect(screen.getByText('No history entries found for this document.')).toBeInTheDocument();
    });
  });

  it('handles loading state', async () => {
    mockLoadDocumentHistory.mockImplementation(() => new Promise(() => {})); // Never resolves

    await act(async () => {
      render(<DocumentHistoryModal {...defaultProps} />);
    });

    expect(screen.getByText('Loading history...')).toBeInTheDocument();
  });

  it('handles error state', async () => {
    const errorMessage = 'Failed to load history';
    mockLoadDocumentHistory.mockRejectedValue(new Error(errorMessage));

    await act(async () => {
      render(<DocumentHistoryModal {...defaultProps} />);
    });

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('closes modal when close button is clicked', async () => {
    await act(async () => {
      render(<DocumentHistoryModal {...defaultProps} />);
    });

    const closeButton = screen.getByText('×');
    await act(async () => {
      fireEvent.click(closeButton);
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes modal when overlay is clicked', async () => {
    await act(async () => {
      render(<DocumentHistoryModal {...defaultProps} />);
    });

    const overlay = screen.getByText('Document History').closest('.modal-overlay');
    expect(overlay).toBeInTheDocument();
    
    await act(async () => {
      fireEvent.click(overlay!);
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('does not close modal when content is clicked', async () => {
    await act(async () => {
      render(<DocumentHistoryModal {...defaultProps} />);
    });

    const content = screen.getByText('Document History');
    await act(async () => {
      fireEvent.click(content);
    });

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('displays change type badges with correct labels', async () => {
    await act(async () => {
      render(<DocumentHistoryModal {...defaultProps} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Content Updated')).toBeInTheDocument();
      expect(screen.getByText('Created')).toBeInTheDocument();
    });
  });

  it('displays pagination info', async () => {
    await act(async () => {
      render(<DocumentHistoryModal {...defaultProps} />);
    });

    await waitFor(() => {
      expect(screen.getByText('Showing 2 of 2 entries')).toBeInTheDocument();
    });
  });

  it('works without rollback functionality', async () => {
    await act(async () => {
      render(
        <DocumentHistoryModal
          {...defaultProps}
          onRollback={undefined}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Content Updated')).toBeInTheDocument();
    });

    // Rollback buttons should not be present
    expect(screen.queryByText('Rollback')).not.toBeInTheDocument();
  });
});