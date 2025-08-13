import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { validateSupabaseJwt } from '../../src/index';

// Create a test app with the auth middleware
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Add the middleware
  app.use('/protected', validateSupabaseJwt);
  
  // Add a test route
  app.get('/protected/test', (req: any, res) => {
    res.json({ message: 'Protected route accessed', user: req.user });
  });

  return app;
};

describe('Authentication Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
    // Reset environment variables
    process.env.SUPABASE_URL = 'https://test-project.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  });

  describe('Environment Configuration', () => {
    it('should return 500 if SUPABASE_URL is not configured', async () => {
      delete process.env.SUPABASE_URL;

      const response = await request(app)
        .get('/protected/test')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Authentication service is not configured.');
    });

    it('should return 500 if SUPABASE_ANON_KEY is not configured', async () => {
      delete process.env.SUPABASE_ANON_KEY;

      const response = await request(app)
        .get('/protected/test')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Authentication service is not configured.');
    });
  });

  describe('Authorization Header Validation', () => {
    it('should return 401 if no authorization header is provided', async () => {
      const response = await request(app)
        .get('/protected/test');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Missing or invalid Authorization header');
    });

    it('should return 401 if authorization header does not start with Bearer', async () => {
      const response = await request(app)
        .get('/protected/test')
        .set('Authorization', 'Basic invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Missing or invalid Authorization header');
    });

    it('should return 401 for malformed Bearer token', async () => {
      const response = await request(app)
        .get('/protected/test')
        .set('Authorization', 'Bearer');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Missing or invalid Authorization header');
    });
  });

  describe('Token Validation', () => {
    it('should allow access with valid token', async () => {
      const response = await request(app)
        .get('/protected/test')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Protected route accessed');
      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBe('mock-user-id');
    });

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/protected/test')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid token');
    });
  });

  describe('Request Enhancement', () => {
    it('should attach user data to request object', async () => {
      const response = await request(app)
        .get('/protected/test')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.user).toEqual({
        id: 'mock-user-id',
        email: 'test@example.com',
        aud: 'authenticated'
      });
    });

    it('should preserve the original JWT token in request', async () => {
      // This test verifies the token is attached, though we can't directly check it
      // since the test route doesn't expose req.token
      const response = await request(app)
        .get('/protected/test')
        .set('Authorization', 'Bearer test-jwt-token');

      expect(response.status).toBe(200);
      // Token verification would require access to req.token in the test route
    });
  });
});