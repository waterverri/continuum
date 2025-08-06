import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';

// Mock Supabase client for tests
export const mockSupabaseClient = {
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    }),
    signOut: vi.fn().mockResolvedValue({ error: null })
  },
  from: vi.fn(() => mockSupabaseClient),
  select: vi.fn(() => mockSupabaseClient),
  eq: vi.fn(() => mockSupabaseClient),
  filter: vi.fn(() => mockSupabaseClient),
  single: vi.fn(() => mockSupabaseClient),
  order: vi.fn().mockResolvedValue({ data: [], error: null }),
  insert: vi.fn().mockResolvedValue({ data: [], error: null }),
  update: vi.fn().mockResolvedValue({ data: [], error: null }),
  delete: vi.fn().mockResolvedValue({ data: [], error: null })
};

// Mock the supabase client module
vi.mock('../supabaseClient', () => ({
  supabase: mockSupabaseClient
}));

// Mock data for tests
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
  getDocuments: vi.fn().mockResolvedValue([]),
  createDocument: vi.fn().mockResolvedValue(mockDocument),
  updateDocument: vi.fn().mockResolvedValue(mockDocument),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  getDocument: vi.fn().mockResolvedValue(mockDocument)
};

vi.mock('../api', () => mockApi);

// Custom render function with providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };