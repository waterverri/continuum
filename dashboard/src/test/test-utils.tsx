import type { ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

// Mock data for tests - defined first so it can be used in mocks
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  aud: 'authenticated',
  role: 'authenticated'
};

export const mockSession = {
  user: mockUser,
  access_token: 'mock-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  expires_at: Date.now() + 3600000
};

// Create a chainable mock for Supabase operations
const createChainableMock = (): any => {
  const mock: any = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ 
        data: { session: mockSession }, 
        error: null 
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } }
      }),
      signOut: vi.fn().mockResolvedValue({ error: null })
    },
    from: vi.fn(() => createChainableMock()),
    select: vi.fn(() => createChainableMock()),
    eq: vi.fn(() => createChainableMock()),
    filter: vi.fn(() => createChainableMock()),
    single: vi.fn(() => createChainableMock()),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    insert: vi.fn().mockResolvedValue({ data: [], error: null }),
    update: vi.fn().mockResolvedValue({ data: [], error: null }),
    delete: vi.fn().mockResolvedValue({ data: [], error: null })
  };
  return mock;
};

// Mock Supabase client for tests
export const mockSupabaseClient = createChainableMock();

// Mock the supabase client module
vi.mock('../supabaseClient', () => ({
  supabase: mockSupabaseClient
}));

export const mockProject = {
  id: 'test-project-id',
  name: 'Test Project',
  description: 'A test project',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

export const mockDocument = {
  id: 'test-document-id',
  project_id: 'test-project-id',
  title: 'Test Document',
  content: 'This is test content',
  document_type: 'character',
  is_composite: false,
  components: null,
  group_id: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

export const mockCompositeDocument = {
  ...mockDocument,
  id: 'test-composite-id',
  title: 'Test Composite',
  content: 'Intro: {{intro}}\nBody: {{body}}',
  is_composite: true,
  components: {
    intro: 'intro-doc-id',
    body: 'body-doc-id'
  }
};

// Mock API module
export const mockApi = {
  getDocuments: vi.fn().mockResolvedValue([mockDocument, mockCompositeDocument]),
  createDocument: vi.fn().mockResolvedValue(mockDocument),
  updateDocument: vi.fn().mockResolvedValue(mockDocument),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  getDocument: vi.fn().mockResolvedValue(mockDocument)
};

// Helper function to setup API mocks with default responses
export const setupApiMocks = () => {
  mockApi.getDocuments.mockResolvedValue([mockDocument, mockCompositeDocument]);
  mockApi.createDocument.mockResolvedValue(mockDocument);
  mockApi.updateDocument.mockResolvedValue(mockDocument);
  mockApi.deleteDocument.mockResolvedValue(undefined);
  mockApi.getDocument.mockResolvedValue(mockDocument);
};

// Custom render function with providers
interface TestProviderOptions {
  initialEntries?: string[];
  initialIndex?: number;
}

const createTestWrapper = (options: TestProviderOptions = {}) => {
  const { initialEntries = ['/projects/test-project-id'], initialIndex = 0 } = options;
  
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
      {children}
    </MemoryRouter>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { routerOptions?: TestProviderOptions },
) => {
  const { routerOptions, ...renderOptions } = options || {};
  const Wrapper = createTestWrapper(routerOptions);
  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

export * from '@testing-library/react';
export { customRender as render };