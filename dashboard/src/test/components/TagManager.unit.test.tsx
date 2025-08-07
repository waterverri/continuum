import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TagManager } from '../../components/TagManager';

// Mock the API functions
vi.mock('../../api', () => ({
  getTags: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
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

const mockTags = [
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
  }
];

describe('TagManager', () => {
  const mockOnClose = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders tag manager with existing tags', async () => {
    const { getTags } = await import('../../api');
    vi.mocked(getTags).mockResolvedValue(mockTags);

    render(<TagManager projectId="project-1" onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Manage Tags')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Project Tags (2)')).toBeInTheDocument();
      expect(screen.getByText('Character')).toBeInTheDocument();
      expect(screen.getByText('Location')).toBeInTheDocument();
    });
  });

  it('shows create new tag form when button is clicked', async () => {
    const { getTags } = await import('../../api');
    vi.mocked(getTags).mockResolvedValue([]);

    render(<TagManager projectId="project-1" onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('+ New Tag')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('+ New Tag'));

    expect(screen.getByText('Create New Tag')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter tag name')).toBeInTheDocument();
  });

  it('creates a new tag when form is submitted', async () => {
    const { getTags, createTag } = await import('../../api');
    vi.mocked(getTags).mockResolvedValue([]);
    vi.mocked(createTag).mockResolvedValue({
      id: 'new-tag',
      project_id: 'project-1',
      name: 'New Tag',
      color: '#6366f1',
      created_at: '2023-01-01T00:00:00.000Z'
    });

    render(<TagManager projectId="project-1" onClose={mockOnClose} />);

    // Wait for initial load and click new tag button
    await waitFor(() => {
      expect(screen.getByText('+ New Tag')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('+ New Tag'));

    // Fill in the form
    const nameInput = screen.getByPlaceholderText('Enter tag name');
    fireEvent.change(nameInput, { target: { value: 'New Tag' } });

    // Submit the form
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(createTag).toHaveBeenCalledWith('project-1', 'New Tag', '#6366f1', 'mock-token');
    });
  });

  it('shows empty state when no tags exist', async () => {
    const { getTags } = await import('../../api');
    vi.mocked(getTags).mockResolvedValue([]);

    render(<TagManager projectId="project-1" onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('No tags created yet.')).toBeInTheDocument();
      expect(screen.getByText('Tags help organize and filter your documents.')).toBeInTheDocument();
    });
  });
});