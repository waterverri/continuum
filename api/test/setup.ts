// @ts-nocheck
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

// Create a simple mock function that always returns success
const mockQuery = () => Promise.resolve({ data: mockData, error: null });

// Mock Supabase client
export const mockSupabaseClient: any = {
  auth: {
    getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    admin: {
      getUserById: jest.fn().mockResolvedValue({
        data: { user: { id: 'mock-user-id', email: 'test@example.com' } },
        error: null
      })
    }
  },
  from: jest.fn(() => mockSupabaseClient),
  select: jest.fn(() => mockSupabaseClient),
  insert: jest.fn(() => mockSupabaseClient),
  update: jest.fn(() => mockSupabaseClient),
  delete: jest.fn(() => mockSupabaseClient),
  eq: jest.fn(() => mockSupabaseClient),
  neq: jest.fn(() => mockSupabaseClient),
  in: jest.fn(() => mockSupabaseClient),
  order: jest.fn(() => mockSupabaseClient),
  single: jest.fn(mockQuery),
  then: jest.fn((callback: any) => callback({ data: mockData, error: null })),
  // Make queries return arrays by default
  mockReturnValue: () => Promise.resolve({ data: [mockData], error: null })
};

// Default mock data
const mockData = {
  id: 'mock-id',
  name: 'Mock Tag',
  color: '#007bff',
  project_id: 'test-project-id'
};

// Mock the Supabase client module
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}));

// Global test timeout
jest.setTimeout(30000);