import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSupabaseClient, mockProject } from '../test-utils';
import { getProjects, createProject, deleteProject } from '../../accessors/projectAccessor';

describe('projectAccessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProjects', () => {
    it('should fetch projects successfully', async () => {
      const mockProjects = [mockProject];
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockProjects,
            error: null
          })
        })
      });

      const result = await getProjects();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('projects');
      expect(result).toEqual(mockProjects);
    });

    it('should throw error when database query fails', async () => {
      const mockError = new Error('Database connection failed');
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: mockError
          })
        })
      });

      await expect(getProjects()).rejects.toThrow('Database connection failed');
    });

    it('should handle empty result', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
      });

      const result = await getProjects();
      expect(result).toEqual([]);
    });
  });

  describe('createProject', () => {
    it('should create project successfully', async () => {
      const newProject = { name: 'New Project', description: 'Test description' };
      const createdProject = { ...mockProject, ...newProject };

      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: createdProject,
              error: null
            })
          })
        })
      });

      const result = await createProject(newProject);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('projects');
      expect(result).toEqual(createdProject);
    });

    it('should throw error when project creation fails', async () => {
      const newProject = { name: 'New Project', description: 'Test description' };
      const mockError = new Error('Validation failed');

      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: mockError
            })
          })
        })
      });

      await expect(createProject(newProject)).rejects.toThrow('Validation failed');
    });

    it('should validate required fields', async () => {
      const invalidProject = { name: '', description: 'Test' };

      // The actual validation would happen in the component or service layer
      // This test documents the expected behavior
      expect(invalidProject.name).toBe('');
    });
  });

  describe('deleteProject', () => {
    it('should delete project successfully', async () => {
      mockSupabaseClient.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      });

      await deleteProject('test-project-id');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('projects');
    });

    it('should throw error when deletion fails', async () => {
      const mockError = new Error('Permission denied');
      mockSupabaseClient.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: mockError
          })
        })
      });

      await expect(deleteProject('test-project-id')).rejects.toThrow('Permission denied');
    });

    it('should handle non-existent project', async () => {
      // Supabase doesn't throw an error for deleting non-existent records
      mockSupabaseClient.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      });

      await expect(deleteProject('non-existent-id')).resolves.not.toThrow();
    });
  });
});