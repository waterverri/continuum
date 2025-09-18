import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureBidirectionalGroupAssignment } from '../../utils/groupAssignment';
import { updateDocument } from '../../api';
import type { Document } from '../../api';

// Mock the API module
vi.mock('../../api', () => ({
  updateDocument: vi.fn()
}));

const mockUpdateDocument = vi.mocked(updateDocument);

describe('groupAssignment', () => {
  const mockDocuments: Document[] = [
    {
      id: 'doc1',
      title: 'Document 1',
      group_id: null,
      project_id: 'project1'
    } as Document,
    {
      id: 'doc2',
      title: 'Document 2',
      group_id: 'doc2', // Already a group head
      project_id: 'project1'
    } as Document,
    {
      id: 'doc3',
      title: 'Document 3',
      group_id: 'doc2', // Member of doc2's group
      project_id: 'project1'
    } as Document,
    {
      id: 'doc4',
      title: 'Document 4',
      group_id: 'different-id', // Has group_id but not self-referencing
      project_id: 'project1'
    } as Document
  ];

  const projectId = 'project1';
  const accessToken = 'test-token';

  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.log/error for cleaner test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ensureBidirectionalGroupAssignment', () => {
    it('should do nothing when no target group ID is provided', async () => {
      await ensureBidirectionalGroupAssignment(
        undefined,
        mockDocuments,
        projectId,
        accessToken
      );

      expect(mockUpdateDocument).not.toHaveBeenCalled();
    });

    it('should do nothing when target group ID is null', async () => {
      await ensureBidirectionalGroupAssignment(
        null as any,
        mockDocuments,
        projectId,
        accessToken
      );

      expect(mockUpdateDocument).not.toHaveBeenCalled();
    });

    it('should do nothing when target group ID is empty string', async () => {
      await ensureBidirectionalGroupAssignment(
        '',
        mockDocuments,
        projectId,
        accessToken
      );

      expect(mockUpdateDocument).not.toHaveBeenCalled();
    });

    it('should handle when target document is not found', async () => {
      await ensureBidirectionalGroupAssignment(
        'non-existent-doc',
        mockDocuments,
        projectId,
        accessToken
      );

      expect(mockUpdateDocument).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        '🔧 Target group document not found:',
        'non-existent-doc'
      );
    });

    it('should update document to become group head when group_id is null', async () => {
      const updatedDoc = {
        ...mockDocuments[0],
        group_id: 'doc1'
      };
      mockUpdateDocument.mockResolvedValue(updatedDoc);

      await ensureBidirectionalGroupAssignment(
        'doc1',
        mockDocuments,
        projectId,
        accessToken
      );

      expect(mockUpdateDocument).toHaveBeenCalledWith(
        projectId,
        'doc1',
        { group_id: 'doc1' },
        accessToken
      );
    });

    it('should update document to become group head when group_id does not equal document id', async () => {
      const updatedDoc = {
        ...mockDocuments[3], // doc4 with group_id 'different-id'
        group_id: 'doc4'
      };
      mockUpdateDocument.mockResolvedValue(updatedDoc);

      await ensureBidirectionalGroupAssignment(
        'doc4',
        mockDocuments,
        projectId,
        accessToken
      );

      expect(mockUpdateDocument).toHaveBeenCalledWith(
        projectId,
        'doc4',
        { group_id: 'doc4' },
        accessToken
      );
    });

    it('should not update document when it is already a group head', async () => {
      await ensureBidirectionalGroupAssignment(
        'doc2', // Already has group_id = 'doc2'
        mockDocuments,
        projectId,
        accessToken
      );

      expect(mockUpdateDocument).not.toHaveBeenCalled();
    });

    it('should call updateDocumentsState callback when provided', async () => {
      const updatedDoc = {
        ...mockDocuments[0],
        group_id: 'doc1'
      };
      mockUpdateDocument.mockResolvedValue(updatedDoc);
      const mockCallback = vi.fn();

      await ensureBidirectionalGroupAssignment(
        'doc1',
        mockDocuments,
        projectId,
        accessToken,
        mockCallback
      );

      expect(mockCallback).toHaveBeenCalledWith(updatedDoc);
    });

    it('should not call updateDocumentsState callback when no update is needed', async () => {
      const mockCallback = vi.fn();

      await ensureBidirectionalGroupAssignment(
        'doc2', // Already a group head
        mockDocuments,
        projectId,
        accessToken,
        mockCallback
      );

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should throw error when API call fails', async () => {
      const apiError = new Error('API update failed');
      mockUpdateDocument.mockRejectedValue(apiError);

      await expect(
        ensureBidirectionalGroupAssignment(
          'doc1',
          mockDocuments,
          projectId,
          accessToken
        )
      ).rejects.toThrow('API update failed');

      expect(console.error).toHaveBeenCalledWith(
        '🔧 Failed to make document a group head:',
        apiError
      );
    });

    it('should not call updateDocumentsState callback when API call fails', async () => {
      const apiError = new Error('API update failed');
      mockUpdateDocument.mockRejectedValue(apiError);
      const mockCallback = vi.fn();

      await expect(
        ensureBidirectionalGroupAssignment(
          'doc1',
          mockDocuments,
          projectId,
          accessToken,
          mockCallback
        )
      ).rejects.toThrow();

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should log correct debug information', async () => {
      const updatedDoc = {
        ...mockDocuments[0],
        group_id: 'doc1'
      };
      mockUpdateDocument.mockResolvedValue(updatedDoc);

      await ensureBidirectionalGroupAssignment(
        'doc1',
        mockDocuments,
        projectId,
        accessToken
      );

      expect(console.log).toHaveBeenCalledWith(
        '🔧 Bidirectional group assignment:',
        expect.objectContaining({
          targetGroupId: 'doc1',
          targetDoc: expect.objectContaining({
            id: 'doc1',
            title: 'Document 1',
            currentGroupId: null
          }),
          needsUpdate: true
        })
      );

      expect(console.log).toHaveBeenCalledWith(
        '🔧 Making API call to set document as group head:',
        'doc1'
      );

      expect(console.log).toHaveBeenCalledWith(
        '🔧 Successfully made document a group head:',
        expect.objectContaining({
          id: 'doc1',
          title: 'Document 1',
          group_id: 'doc1'
        })
      );
    });

    it('should handle empty documents array', async () => {
      await ensureBidirectionalGroupAssignment(
        'doc1',
        [],
        projectId,
        accessToken
      );

      expect(mockUpdateDocument).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        '🔧 Target group document not found:',
        'doc1'
      );
    });
  });
});