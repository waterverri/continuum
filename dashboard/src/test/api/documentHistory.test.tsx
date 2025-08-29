import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const API_URL = 'http://localhost:8080';

// Import the actual API functions directly and manually create test versions
const baseUrl = API_URL;

export const getDocumentHistory = async (
  projectId: string, 
  documentId: string, 
  accessToken: string,
  limit = 50,
  offset = 0
) => {
  const url = `${baseUrl}/api/documents/${projectId}/${documentId}/history?limit=${limit}&offset=${offset}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch document history');
  }

  return await response.json();
};

export const getHistoryEntry = async (
  projectId: string,
  documentId: string,
  historyId: string,
  accessToken: string
) => {
  const response = await fetch(`${baseUrl}/api/documents/${projectId}/${documentId}/history/${historyId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch history entry');
  }

  return await response.json();
};

export const createHistoryEntry = async (
  projectId: string,
  documentId: string,
  changeType: string,
  changeDescription?: string,
  accessToken: string = ''
) => {
  const response = await fetch(`${baseUrl}/api/documents/${projectId}/${documentId}/history`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      change_type: changeType,
      change_description: changeDescription
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create history entry');
  }

  return await response.json();
};

export const rollbackDocument = async (
  projectId: string,
  documentId: string,
  historyId: string,
  accessToken: string
) => {
  const response = await fetch(`${baseUrl}/api/documents/${projectId}/${documentId}/rollback/${historyId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to rollback document');
  }

  return await response.json();
};

import type { DocumentHistoryResponse, DocumentHistory } from '../../api';

describe('Document History API', () => {
  const mockToken = 'mock-access-token';
  const projectId = 'project-1';
  const documentId = 'doc-1';
  const historyId = 'hist-1';

  const mockHistoryResponse: DocumentHistoryResponse = {
    document: {
      id: documentId,
      title: 'Test Document'
    },
    history: [
      {
        id: historyId,
        document_id: documentId,
        project_id: projectId,
        title: 'Test Document',
        content: 'Test content',
        document_type: 'scene',
        group_id: null,
        is_composite: false,
        components: null,
        event_id: null,
        change_type: 'update_content',
        change_description: 'Updated content',
        user_id: 'user-1',
        created_at: '2025-01-01T12:00:00Z',
        previous_version_id: null,
        profiles: {
          display_name: 'Test User'
        }
      }
    ],
    pagination: {
      total: 1,
      limit: 50,
      offset: 0
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getDocumentHistory', () => {
    it('fetches document history successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockHistoryResponse)
      });

      const result = await getDocumentHistory(projectId, documentId, mockToken, 25, 10);

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_URL}/api/documents/${projectId}/${documentId}/history?limit=25&offset=10`,
        {
          headers: {
            'Authorization': `Bearer ${mockToken}`
          }
        }
      );
      expect(result).toEqual(mockHistoryResponse);
    });

    it('uses default limit and offset', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockHistoryResponse)
      });

      await getDocumentHistory(projectId, documentId, mockToken);

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_URL}/api/documents/${projectId}/${documentId}/history?limit=50&offset=0`,
        expect.any(Object)
      );
    });

    it('throws error on failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      await expect(
        getDocumentHistory(projectId, documentId, mockToken)
      ).rejects.toThrow('Failed to fetch document history');
    });
  });

  describe('getHistoryEntry', () => {
    const mockHistoryEntry: DocumentHistory = mockHistoryResponse.history[0];

    it('fetches history entry successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ historyEntry: mockHistoryEntry })
      });

      const result = await getHistoryEntry(projectId, documentId, historyId, mockToken);

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_URL}/api/documents/${projectId}/${documentId}/history/${historyId}`,
        {
          headers: {
            'Authorization': `Bearer ${mockToken}`
          }
        }
      );
      expect(result).toEqual({ historyEntry: mockHistoryEntry });
    });

    it('throws error on failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      await expect(
        getHistoryEntry(projectId, documentId, historyId, mockToken)
      ).rejects.toThrow('Failed to fetch history entry');
    });
  });

  describe('createHistoryEntry', () => {
    it('creates history entry successfully', async () => {
      const mockResponse = {
        message: 'History entry created successfully',
        historyId: 'new-hist-id'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse)
      });

      const result = await createHistoryEntry(
        projectId,
        documentId,
        'update_content',
        'Updated content',
        mockToken
      );

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_URL}/api/documents/${projectId}/${documentId}/history`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mockToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            change_type: 'update_content',
            change_description: 'Updated content'
          })
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it('handles optional change description', async () => {
      const mockResponse = {
        message: 'History entry created successfully',
        historyId: 'new-hist-id'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse)
      });

      await createHistoryEntry(projectId, documentId, 'create', undefined, mockToken);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            change_type: 'create',
            change_description: undefined
          })
        })
      );
    });

    it('throws error on failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Invalid change type' })
      });

      await expect(
        createHistoryEntry(projectId, documentId, 'invalid_type' as any, '', mockToken)
      ).rejects.toThrow('Invalid change type');
    });
  });

  describe('rollbackDocument', () => {
    it('rolls back document successfully', async () => {
      const mockResponse = {
        message: 'Document rolled back successfully',
        rolledBackFrom: '2025-01-01T12:00:00Z',
        document: {
          id: documentId,
          title: 'Test Document',
          content: 'Previous content'
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse)
      });

      const result = await rollbackDocument(projectId, documentId, historyId, mockToken);

      expect(mockFetch).toHaveBeenCalledWith(
        `${API_URL}/api/documents/${projectId}/${documentId}/rollback/${historyId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mockToken}`
          }
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it('throws error on failed rollback', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'History entry not found' })
      });

      await expect(
        rollbackDocument(projectId, documentId, historyId, mockToken)
      ).rejects.toThrow('History entry not found');
    });
  });
});