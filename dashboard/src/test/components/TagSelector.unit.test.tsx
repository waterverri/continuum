import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TagSelector } from '../../components/TagSelector';

// Mock the API functions
vi.mock('../../api', () => ({
  getTags: vi.fn(),
  getDocumentTags: vi.fn(),
  addTagsToDocument: vi.fn(),
  removeTagFromDocument: vi.fn(),
}));

// Mock the supabase client
vi.mock('../../supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-token' } }
      })
    }
  }
}));

const mockAllTags = [
  {
    id: 'tag-1',
    project_id: 'project-1',
    name: 'Character',
    color: '#6366f1',
    created_at: '2023-01-01T00:00:00.000Z'
  },
  {
    id: 'tag-2',
    project_id: 'project-1',
    name: 'Location',
    color: '#8b5cf6',
    created_at: '2023-01-01T00:00:00.000Z'
  },
  {
    id: 'tag-3',
    project_id: 'project-1',
    name: 'Plot',
    color: '#ec4899',
    created_at: '2023-01-01T00:00:00.000Z'
  }
];

const mockDocumentTags = [
  {
    id: 'tag-1',
    project_id: 'project-1',
    name: 'Character',
    color: '#6366f1',
    created_at: '2023-01-01T00:00:00.000Z'
  }
];

describe('TagSelector', () => {
  const mockOnClose = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders tag selector with applied and available tags', async () => {
    const { getTags, getDocumentTags } = await import('../../api');
    vi.mocked(getTags).mockResolvedValue(mockAllTags);
    vi.mocked(getDocumentTags).mockResolvedValue(mockDocumentTags);

    render(<TagSelector projectId="project-1" documentId="doc-1" onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Document Tags')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Applied Tags (1)')).toBeInTheDocument();
      expect(screen.getByText('Available Tags (2)')).toBeInTheDocument();
      expect(screen.getByText('Character')).toBeInTheDocument();
      expect(screen.getByText('Location')).toBeInTheDocument();
      expect(screen.getByText('Plot')).toBeInTheDocument();
    });
  });

  it('adds a tag when available tag is clicked', async () => {
    const { getTags, getDocumentTags, addTagsToDocument } = await import('../../api');
    vi.mocked(getTags).mockResolvedValue(mockAllTags);
    vi.mocked(getDocumentTags).mockResolvedValue([]);
    vi.mocked(addTagsToDocument).mockResolvedValue();

    render(<TagSelector projectId="project-1" documentId="doc-1" onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Available Tags (3)')).toBeInTheDocument();
    });

    // Click on a tag to add it
    fireEvent.click(screen.getByText('Character'));

    await waitFor(() => {
      expect(addTagsToDocument).toHaveBeenCalledWith('project-1', 'doc-1', ['tag-1'], 'mock-token');
    });
  });

  it('removes a tag when remove button is clicked', async () => {
    const { getTags, getDocumentTags, removeTagFromDocument } = await import('../../api');
    vi.mocked(getTags).mockResolvedValue(mockAllTags);
    vi.mocked(getDocumentTags).mockResolvedValue(mockDocumentTags);
    vi.mocked(removeTagFromDocument).mockResolvedValue();

    render(<TagSelector projectId="project-1" documentId="doc-1" onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Applied Tags (1)')).toBeInTheDocument();
    });

    // Click the remove button (×)
    const removeButton = screen.getByTitle('Remove Character tag');
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(removeTagFromDocument).toHaveBeenCalledWith('project-1', 'doc-1', 'tag-1', 'mock-token');
    });
  });

  it('shows empty state when no tags available', async () => {
    const { getTags, getDocumentTags } = await import('../../api');
    vi.mocked(getTags).mockResolvedValue([]);
    vi.mocked(getDocumentTags).mockResolvedValue([]);

    render(<TagSelector projectId="project-1" documentId="doc-1" onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('No tags available.')).toBeInTheDocument();
      expect(screen.getByText('Create tags from the project settings to organize your documents.')).toBeInTheDocument();
    });
  });

  it('shows help text when all tags are applied', async () => {
    const { getTags, getDocumentTags } = await import('../../api');
    vi.mocked(getTags).mockResolvedValue(mockAllTags);
    vi.mocked(getDocumentTags).mockResolvedValue(mockAllTags); // All tags applied

    render(<TagSelector projectId="project-1" documentId="doc-1" onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Applied Tags (3)')).toBeInTheDocument();
      expect(screen.getByText('All available tags are applied to this document.')).toBeInTheDocument();
    });
  });
});