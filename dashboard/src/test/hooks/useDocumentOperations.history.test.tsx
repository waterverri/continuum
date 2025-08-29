import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDocumentOperations } from '../../hooks/useDocumentOperations';
import type { Document, DocumentHistoryResponse, DocumentHistory } from '../../api';

// Mock the API functions
vi.mock('../../api', () => ({
  getDocumentHistory: vi.fn(),
  getHistoryEntry: vi.fn(),
  rollbackDocument: vi.fn(),
  getDocuments: vi.fn(),
  getTags: vi.fn(),
  getPresets: vi.fn(),
}));

// Mock supabase client
vi.mock('../../supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-token' } }
      })
    }
  }
}));

const { getDocumentHistory, getHistoryEntry, rollbackDocument } = await import('../../api');

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

const mockHistoryEntry: DocumentHistory = {
  id: 'hist-1',
  document_id: 'doc-1',
  project_id: 'project-1',
  title: 'Test Document',
  content: 'Previous content',
  document_type: 'scene',
  group_id: null,
  is_composite: false,
  components: null,
  event_id: null,
  change_type: 'update_content',
  change_description: 'Updated content',
  user_id: 'user-1',
  created_at: '2025-01-01T10:00:00Z',
  previous_version_id: null,
  profiles: {
    display_name: 'Test User'
  }
};

const mockHistoryResponse: DocumentHistoryResponse = {
  document: {
    id: 'doc-1',
    title: 'Test Document'
  },
  history: [mockHistoryEntry],
  pagination: {
    total: 1,
    limit: 50,
    offset: 0
  }
};

describe('useDocumentOperations - History functionality', () => {
  const mockSetDocuments = vi.fn();
  const mockSetPresets = vi.fn();
  const mockSetTags = vi.fn();
  const mockSetError = vi.fn();
  const mockSetLoading = vi.fn();
  const mockSetSelectedDocument = vi.fn();
  const mockSetResolvedContent = vi.fn();

  const defaultProps = {
    projectId: 'project-1',
    documents: [mockDocument],
    setDocuments: mockSetDocuments,
    presets: [],
    setPresets: mockSetPresets,
    setTags: mockSetTags,
    setError: mockSetError,
    setLoading: mockSetLoading,
    setSelectedDocument: mockSetSelectedDocument,
    setResolvedContent: mockSetResolvedContent
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementations
    vi.mocked(getDocumentHistory).mockResolvedValue(mockHistoryResponse);
    vi.mocked(getHistoryEntry).mockResolvedValue({ historyEntry: mockHistoryEntry });
    vi.mocked(rollbackDocument).mockResolvedValue({
      message: 'Document rolled back successfully',
      rolledBackFrom: '2025-01-01T10:00:00Z',
      document: { ...mockDocument, content: 'Previous content' }
    });
  });

  it('loadDocumentHistory fetches history successfully', async () => {
    const { result } = renderHook(() => useDocumentOperations(defaultProps));

    let historyResult: DocumentHistoryResponse | undefined;
    await act(async () => {
      historyResult = await result.current.loadDocumentHistory('doc-1', 25, 10);
    });

    expect(getDocumentHistory).toHaveBeenCalledWith('project-1', 'doc-1', 'mock-token', 25, 10);
    expect(historyResult).toEqual(mockHistoryResponse);
  });

  it('loadDocumentHistory uses default parameters', async () => {
    const { result } = renderHook(() => useDocumentOperations(defaultProps));

    await act(async () => {
      await result.current.loadDocumentHistory('doc-1');
    });

    expect(getDocumentHistory).toHaveBeenCalledWith('project-1', 'doc-1', 'mock-token', 50, 0);
  });

  it('loadDocumentHistory handles errors', async () => {
    const errorMessage = 'Failed to load history';
    vi.mocked(getDocumentHistory).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useDocumentOperations(defaultProps));

    await act(async () => {
      try {
        await result.current.loadDocumentHistory('doc-1');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe(errorMessage);
      }
    });

    expect(mockSetError).toHaveBeenCalledWith(errorMessage);
  });

  it('loadHistoryEntry fetches entry details successfully', async () => {
    const { result } = renderHook(() => useDocumentOperations(defaultProps));

    let entryResult: DocumentHistory | undefined;
    await act(async () => {
      entryResult = await result.current.loadHistoryEntry('doc-1', 'hist-1');
    });

    expect(getHistoryEntry).toHaveBeenCalledWith('project-1', 'doc-1', 'hist-1', 'mock-token');
    expect(entryResult).toEqual(mockHistoryEntry);
  });

  it('loadHistoryEntry handles errors', async () => {
    const errorMessage = 'Failed to load history entry';
    vi.mocked(getHistoryEntry).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useDocumentOperations(defaultProps));

    await act(async () => {
      try {
        await result.current.loadHistoryEntry('doc-1', 'hist-1');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe(errorMessage);
      }
    });

    expect(mockSetError).toHaveBeenCalledWith(errorMessage);
  });

  it('handleRollbackDocument performs rollback successfully', async () => {
    // Mock confirm to return true
    const originalConfirm = global.confirm;
    global.confirm = vi.fn().mockReturnValue(true);

    const rolledBackDoc = { ...mockDocument, content: 'Previous content' };
    vi.mocked(rollbackDocument).mockResolvedValue({
      message: 'Document rolled back successfully',
      rolledBackFrom: '2025-01-01T10:00:00Z',
      document: rolledBackDoc
    });

    const { result } = renderHook(() => useDocumentOperations(defaultProps));

    let rollbackResult: Document | undefined;
    await act(async () => {
      rollbackResult = await result.current.handleRollbackDocument('doc-1', 'hist-1');
    });

    expect(rollbackDocument).toHaveBeenCalledWith('project-1', 'doc-1', 'hist-1', 'mock-token');
    expect(rollbackResult).toEqual(rolledBackDoc);
    expect(mockSetDocuments).toHaveBeenCalled();
    expect(mockSetSelectedDocument).toHaveBeenCalledWith(rolledBackDoc);

    // Restore original confirm
    global.confirm = originalConfirm;
  });

  it('handleRollbackDocument cancels when user declines confirmation', async () => {
    // Mock confirm to return false
    const originalConfirm = global.confirm;
    global.confirm = vi.fn().mockReturnValue(false);

    const { result } = renderHook(() => useDocumentOperations(defaultProps));

    await act(async () => {
      try {
        await result.current.handleRollbackDocument('doc-1', 'hist-1');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Rollback cancelled');
      }
    });

    expect(rollbackDocument).not.toHaveBeenCalled();
    expect(mockSetDocuments).not.toHaveBeenCalled();
    expect(mockSetSelectedDocument).not.toHaveBeenCalled();

    // Restore original confirm
    global.confirm = originalConfirm;
  });

  it('handleRollbackDocument handles errors', async () => {
    // Mock confirm to return true
    const originalConfirm = global.confirm;
    global.confirm = vi.fn().mockReturnValue(true);

    const errorMessage = 'Failed to rollback document';
    vi.mocked(rollbackDocument).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useDocumentOperations(defaultProps));

    await act(async () => {
      try {
        await result.current.handleRollbackDocument('doc-1', 'hist-1');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe(errorMessage);
      }
    });

    expect(mockSetError).toHaveBeenCalledWith(errorMessage);

    // Restore original confirm
    global.confirm = originalConfirm;
  });

  it('throws error when projectId is not provided', async () => {
    const propsWithoutProject = { ...defaultProps, projectId: undefined };
    const { result } = renderHook(() => useDocumentOperations(propsWithoutProject));

    await act(async () => {
      try {
        await result.current.loadDocumentHistory('doc-1');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Project ID is required');
      }
    });

    expect(getDocumentHistory).not.toHaveBeenCalled();
  });
});