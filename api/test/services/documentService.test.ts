import { jest } from '@jest/globals';
import { validateNoCyclicDependencies, resolveCompositeDocument, Document } from '../../src/services/documentService';
import { mockSupabaseClient } from '../setup';

// Mock the supabaseClient module
jest.mock('../../src/db/supabaseClient', () => ({
  createUserSupabaseClient: jest.fn(() => mockSupabaseClient)
}));

describe('DocumentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateNoCyclicDependencies', () => {
    it('should return valid for non-cyclic dependencies', async () => {
      // Mock document that doesn't create cycles
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'doc-2', is_composite: false, components: null },
                error: null
              })
            })
          })
        })
      });

      const result = await validateNoCyclicDependencies(
        'doc-1',
        { intro: 'doc-2' },
        'project-1',
        'test-token'
      );

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should detect direct cyclic dependency', async () => {
      // Mock documents that create a cycle: doc-1 -> doc-2 -> doc-1
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValueOnce({
                data: { 
                  id: 'doc-2', 
                  is_composite: true, 
                  components: { content: 'doc-1' }
                },
                error: null
              })
            })
          })
        })
      });

      const result = await validateNoCyclicDependencies(
        'doc-1',
        { intro: 'doc-2' },
        'project-1',
        'test-token'
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cyclic dependency detected');
    });

    it('should detect indirect cyclic dependency', async () => {
      // Mock documents: doc-1 -> doc-2 -> doc-3 -> doc-1
      const mockCall1 = jest.fn().mockResolvedValueOnce({
        data: { 
          id: 'doc-2', 
          is_composite: true, 
          components: { next: 'doc-3' }
        },
        error: null
      });
      
      const mockCall2 = jest.fn().mockResolvedValueOnce({
        data: { 
          id: 'doc-3', 
          is_composite: true, 
          components: { back: 'doc-1' }
        },
        error: null
      });

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: mockCall1.mockReturnValueOnce(mockCall1()).mockReturnValueOnce(mockCall2())
            })
          })
        })
      });

      const result = await validateNoCyclicDependencies(
        'doc-1',
        { intro: 'doc-2' },
        'project-1',
        'test-token'
      );

      expect(result.valid).toBe(false);
    });

    it('should handle missing component documents gracefully', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Document not found' }
              })
            })
          })
        })
      });

      const result = await validateNoCyclicDependencies(
        'doc-1',
        { intro: 'non-existent-doc' },
        'project-1',
        'test-token'
      );

      expect(result.valid).toBe(true);
    });

    it('should handle database errors', async () => {
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await validateNoCyclicDependencies(
        'doc-1',
        { intro: 'doc-2' },
        'project-1',
        'test-token'
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Failed to validate');
    });
  });

  describe('resolveCompositeDocument', () => {
    const mockDocument: Document = {
      id: 'composite-1',
      project_id: 'project-1',
      title: 'Test Composite',
      is_composite: true,
      components: { intro: 'doc-intro', body: 'doc-body' },
      content: 'Introduction: {{intro}}\n\nBody: {{body}}',
      created_at: '2024-01-01T00:00:00Z'
    };

    it('should resolve static document without changes', async () => {
      const staticDoc: Document = {
        ...mockDocument,
        is_composite: false,
        components: undefined,
        content: 'Static content here'
      };

      const result = await resolveCompositeDocument(
        staticDoc,
        'project-1',
        'test-token'
      );

      expect(result.content).toBe('Static content here');
      expect(result.error).toBeUndefined();
    });

    it('should resolve composite document with static components', async () => {
      // Mock component documents
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn()
                .mockResolvedValueOnce({
                  data: {
                    id: 'doc-intro',
                    is_composite: false,
                    content: 'This is the introduction',
                  },
                  error: null
                })
                .mockResolvedValueOnce({
                  data: {
                    id: 'doc-body',
                    is_composite: false,
                    content: 'This is the main body content',
                  },
                  error: null
                })
            })
          })
        })
      });

      const result = await resolveCompositeDocument(
        mockDocument,
        'project-1',
        'test-token'
      );

      expect(result.content).toBe(
        'Introduction: This is the introduction\n\nBody: This is the main body content'
      );
      expect(result.error).toBeUndefined();
    });

    it('should resolve nested composite documents', async () => {
      // Mock nested composite document
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn()
                .mockResolvedValueOnce({
                  data: {
                    id: 'doc-intro',
                    is_composite: true,
                    components: { greeting: 'doc-greeting' },
                    content: 'Hello: {{greeting}}',
                  },
                  error: null
                })
                .mockResolvedValueOnce({
                  data: {
                    id: 'doc-greeting',
                    is_composite: false,
                    content: 'Welcome to the story',
                  },
                  error: null
                })
                .mockResolvedValueOnce({
                  data: {
                    id: 'doc-body',
                    is_composite: false,
                    content: 'Main story content',
                  },
                  error: null
                })
            })
          })
        })
      });

      const result = await resolveCompositeDocument(
        mockDocument,
        'project-1',
        'test-token'
      );

      expect(result.content).toBe(
        'Introduction: Hello: Welcome to the story\n\nBody: Main story content'
      );
    });

    it('should handle missing component documents', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn()
                .mockResolvedValueOnce({
                  data: null,
                  error: { message: 'Not found' }
                })
                .mockResolvedValueOnce({
                  data: {
                    id: 'doc-body',
                    is_composite: false,
                    content: 'Body content',
                  },
                  error: null
                })
            })
          })
        })
      });

      const result = await resolveCompositeDocument(
        mockDocument,
        'project-1',
        'test-token'
      );

      // Should leave unresolved placeholder and continue with found components
      expect(result.content).toBe(
        'Introduction: {{intro}}\n\nBody: Body content'
      );
    });

    it('should detect circular references', async () => {
      const resolvedDocs = new Set(['composite-1']);

      const result = await resolveCompositeDocument(
        mockDocument,
        'project-1',
        'test-token',
        resolvedDocs
      );

      expect(result.content).toBe('');
      expect(result.error).toContain('Circular reference detected');
    });

    it('should handle database errors during resolution', async () => {
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await resolveCompositeDocument(
        mockDocument,
        'project-1',
        'test-token'
      );

      expect(result.content).toBe('');
      expect(result.error).toContain('Failed to resolve');
    });

    it('should handle documents with no content', async () => {
      const emptyDoc: Document = {
        ...mockDocument,
        content: undefined
      };

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'doc-intro',
                  is_composite: false,
                  content: 'Intro text',
                },
                error: null
              })
            })
          })
        })
      });

      const result = await resolveCompositeDocument(
        emptyDoc,
        'project-1',
        'test-token'
      );

      expect(result.content).toBe('Intro text'); // Should replace {{intro}} with content
    });
  });
});