import { jest } from '@jest/globals';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://test-project.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';

// Mock fetch for authentication middleware
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Default mock for fetch - return a successful auth response
mockFetch.mockImplementation((url: string | URL | Request, options?: RequestInit) => {
  const urlString = typeof url === 'string' ? url : url.toString();
  
  if (urlString.includes('/auth/v1/user')) {
    const headers = options?.headers as Record<string, string> || {};
    const authHeader = headers['Authorization'] || headers['authorization'];
    
    if (!authHeader || authHeader === 'Bearer invalid-token') {
      return Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ msg: 'Invalid token' })
      } as Response);
    }
    
    // Return a successful auth response for any other token
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ 
        id: 'mock-user-id',
        email: 'test@example.com',
        aud: 'authenticated'
      })
    } as Response);
  }
  
  // Default fetch mock for other requests
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({})
  } as Response);
});

// Mock Supabase client
export const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis()
};

// Mock the Supabase client module
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}));

// Global test timeout
jest.setTimeout(30000);