import { jest } from '@jest/globals';
import request from 'supertest';
import { continuumApi } from '../../src/index';
import { mockSupabaseClient } from '../setup';

// Mock the document service
jest.mock('../../src/services/documentService', () => ({
  validateNoCyclicDependencies: jest.fn(),
  resolveCompositeDocument: jest.fn()
}));

import * as documentService from '../../src/services/documentService';
const mockDocumentService = documentService as jest.Mocked<typeof documentService>;

// Mock fetch for auth middleware
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('Documents API Routes', () => {
  const validToken = 'valid-jwt-token';
  const mockUser = { id: 'user-123', email: 'test@example.com' };
  const mockProject = { id: 'project-123', name: 'Test Project' };
  const mockDocument = {
    id: 'doc-123',
    project_id: 'project-123',
    title: 'Test Document',
    content: 'Test content',
    document_type: 'character',
    is_composite: false,
    components: null,
    created_at: '2024-01-01T00:00:00Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful auth by default
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockUser)
    } as Response);
    
    // Reset Supabase mock
    mockSupabaseClient.from.mockReturnThis();
    mockSupabaseClient.select.mockReturnThis();
    mockSupabaseClient.insert.mockReturnThis();
    mockSupabaseClient.update.mockReturnThis();
    mockSupabaseClient.delete.mockReturnThis();
    mockSupabaseClient.eq.mockReturnThis();
    mockSupabaseClient.order.mockReturnThis();
    mockSupabaseClient.single.mockReturnThis();
  });

  describe('GET /api/documents/:projectId', () => {
    it('should return documents for valid project', async () => {
      const documents = [mockDocument];
      mockSupabaseClient.order.mockResolvedValue({
        data: documents,
        error: null
      });

      const response = await request(continuumApi)
        .get('/api/documents/project-123')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(documents);
    });

    it('should return 401 for missing authorization', async () => {
      const response = await request(continuumApi)
        .get('/api/documents/project-123');

      expect(response.status).toBe(401);
    });

    it('should return 500 for database errors', async () => {
      mockSupabaseClient.order.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      });

      const response = await request(continuumApi)
        .get('/api/documents/project-123')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Database connection failed');
    });

    it('should return empty array for project with no documents', async () => {
      mockSupabaseClient.order.mockResolvedValue({
        data: [],
        error: null
      });

      const response = await request(continuumApi)
        .get('/api/documents/project-123')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('GET /api/documents/:projectId/:documentId', () => {
    it('should return specific document', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: mockDocument,
        error: null
      });

      const response = await request(continuumApi)
        .get('/api/documents/project-123/doc-123')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockDocument);
    });

    it('should resolve composite document when requested', async () => {
      const compositeDoc = {
        ...mockDocument,
        is_composite: true,
        components: { intro: 'intro-doc' }
      };
      const resolvedContent = 'Resolved composite content';

      mockSupabaseClient.single.mockResolvedValue({
        data: compositeDoc,
        error: null
      });

      mockDocumentService.resolveCompositeDocument.mockResolvedValue({
        content: resolvedContent
      });

      const response = await request(continuumApi)
        .get('/api/documents/project-123/doc-123?resolve=true')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.resolved_content).toBe(resolvedContent);
      expect(mockDocumentService.resolveCompositeDocument).toHaveBeenCalledWith(
        compositeDoc,
        'project-123',
        validToken
      );
    });

    it('should return 404 for non-existent document', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Document not found' }
      });

      const response = await request(continuumApi)
        .get('/api/documents/project-123/non-existent')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/documents/:projectId', () => {
    const newDocument = {
      title: 'New Document',
      content: 'New content',
      document_type: 'scene',
      is_composite: false
    };

    it('should create new static document', async () => {
      const createdDoc = { ...mockDocument, ...newDocument };
      mockSupabaseClient.single.mockResolvedValue({
        data: createdDoc,
        error: null
      });

      const response = await request(continuumApi)
        .post('/api/documents/project-123')
        .set('Authorization', `Bearer ${validToken}`)
        .send(newDocument);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(createdDoc);
    });

    it('should create composite document with validation', async () => {
      const compositeDoc = {
        title: 'Composite Document',
        content: 'Intro: {{intro}}',
        is_composite: true,
        components: { intro: 'intro-doc-id' }
      };

      mockDocumentService.validateNoCyclicDependencies.mockResolvedValue({
        valid: true
      });

      mockSupabaseClient.single.mockResolvedValue({
        data: { ...mockDocument, ...compositeDoc },
        error: null
      });

      const response = await request(continuumApi)
        .post('/api/documents/project-123')
        .set('Authorization', `Bearer ${validToken}`)
        .send(compositeDoc);

      expect(response.status).toBe(201);
      expect(mockDocumentService.validateNoCyclicDependencies).toHaveBeenCalled();
    });

    it('should reject composite document with cyclic dependencies', async () => {
      const compositeDoc = {
        title: 'Cyclic Document',
        is_composite: true,
        components: { self: 'doc-123' }
      };

      mockDocumentService.validateNoCyclicDependencies.mockResolvedValue({
        valid: false,
        error: 'Cyclic dependency detected'
      });

      const response = await request(continuumApi)
        .post('/api/documents/project-123')
        .set('Authorization', `Bearer ${validToken}`)
        .send(compositeDoc);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Cyclic dependency');
    });

    it('should return 400 for missing required fields', async () => {
      const invalidDoc = { content: 'Content without title' };

      const response = await request(continuumApi)
        .post('/api/documents/project-123')
        .set('Authorization', `Bearer ${validToken}`)
        .send(invalidDoc);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should handle database insertion errors', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Constraint violation' }
      });

      const response = await request(continuumApi)
        .post('/api/documents/project-123')
        .set('Authorization', `Bearer ${validToken}`)
        .send(newDocument);

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/documents/:projectId/:documentId', () => {
    const updateData = {
      title: 'Updated Document',
      content: 'Updated content'
    };

    it('should update existing document', async () => {
      const updatedDoc = { ...mockDocument, ...updateData };
      mockSupabaseClient.single.mockResolvedValue({
        data: updatedDoc,
        error: null
      });

      const response = await request(continuumApi)
        .put('/api/documents/project-123/doc-123')
        .set('Authorization', `Bearer ${validToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(updatedDoc);
    });

    it('should validate composite document updates', async () => {
      const compositeUpdate = {
        is_composite: true,
        components: { intro: 'new-intro-doc' }
      };

      mockDocumentService.validateNoCyclicDependencies.mockResolvedValue({
        valid: true
      });

      mockSupabaseClient.single.mockResolvedValue({
        data: { ...mockDocument, ...compositeUpdate },
        error: null
      });

      const response = await request(continuumApi)
        .put('/api/documents/project-123/doc-123')
        .set('Authorization', `Bearer ${validToken}`)
        .send(compositeUpdate);

      expect(response.status).toBe(200);
      expect(mockDocumentService.validateNoCyclicDependencies).toHaveBeenCalledWith(
        'doc-123',
        compositeUpdate.components,
        'project-123',
        validToken
      );
    });

    it('should return 404 for non-existent document', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { message: 'Document not found' }
      });

      const response = await request(continuumApi)
        .put('/api/documents/project-123/non-existent')
        .set('Authorization', `Bearer ${validToken}`)
        .send(updateData);

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/documents/:projectId/:documentId', () => {
    it('should delete existing document', async () => {
      mockSupabaseClient.eq.mockResolvedValue({
        data: null,
        error: null
      });

      const response = await request(continuumApi)
        .delete('/api/documents/project-123/doc-123')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(204);
    });

    it('should handle deletion errors', async () => {
      mockSupabaseClient.eq.mockResolvedValue({
        data: null,
        error: { message: 'Foreign key constraint' }
      });

      const response = await request(continuumApi)
        .delete('/api/documents/project-123/doc-123')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(500);
    });

    it('should succeed for non-existent document (idempotent)', async () => {
      mockSupabaseClient.eq.mockResolvedValue({
        data: null,
        error: null
      });

      const response = await request(continuumApi)
        .delete('/api/documents/project-123/non-existent')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(204);
    });
  });
});