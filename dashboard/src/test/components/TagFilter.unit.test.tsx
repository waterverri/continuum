import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TagFilter } from '../../components/TagFilter';

// Mock the API functions
vi.mock('../../api', () => ({
  getTags: vi.fn(),
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
  },
  {
    id: 'tag-3',
    project_id: 'project-1',
    name: 'Plot',
    color: '#ec4899',
    created_at: '2023-01-01T00:00:00.000Z'
  }
];

describe('TagFilter', () => {
  const mockOnTagSelectionChange = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders compact tag filter dropdown', async () => {
    const { getTags } = await import('../../api');
    vi.mocked(getTags).mockResolvedValue(mockTags);

    render(
      <TagFilter 
        projectId="project-1" 
        selectedTagIds={[]} 
        onTagSelectionChange={mockOnTagSelectionChange}
        compact={true}
      />
    );

    await waitFor(() => {
      const dropdown = screen.getByRole('combobox');
      expect(dropdown).toBeInTheDocument();
      expect(screen.getByDisplayValue('All Tags')).toBeInTheDocument();
    });
  });

  it('renders full tag filter with clickable badges', async () => {
    const { getTags } = await import('../../api');
    vi.mocked(getTags).mockResolvedValue(mockTags);

    render(
      <TagFilter 
        projectId="project-1" 
        selectedTagIds={[]} 
        onTagSelectionChange={mockOnTagSelectionChange}
        compact={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Filter by Tags:')).toBeInTheDocument();
      expect(screen.getByText('Character')).toBeInTheDocument();
      expect(screen.getByText('Location')).toBeInTheDocument();
      expect(screen.getByText('Plot')).toBeInTheDocument();
    });
  });

  it('handles tag selection in full mode', async () => {
    const { getTags } = await import('../../api');
    vi.mocked(getTags).mockResolvedValue(mockTags);

    render(
      <TagFilter 
        projectId="project-1" 
        selectedTagIds={[]} 
        onTagSelectionChange={mockOnTagSelectionChange}
        compact={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Character')).toBeInTheDocument();
    });

    // Click on Character tag
    fireEvent.click(screen.getByText('Character'));

    expect(mockOnTagSelectionChange).toHaveBeenCalledWith(['tag-1']);
  });

  it('handles tag deselection in full mode', async () => {
    const { getTags } = await import('../../api');
    vi.mocked(getTags).mockResolvedValue(mockTags);

    render(
      <TagFilter 
        projectId="project-1" 
        selectedTagIds={['tag-1']} 
        onTagSelectionChange={mockOnTagSelectionChange}
        compact={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Character ✓')).toBeInTheDocument();
    });

    // Click on selected Character tag to deselect it
    fireEvent.click(screen.getByText('Character ✓'));

    expect(mockOnTagSelectionChange).toHaveBeenCalledWith([]);
  });

  it('handles tag selection in compact mode', async () => {
    const { getTags } = await import('../../api');
    vi.mocked(getTags).mockResolvedValue(mockTags);

    render(
      <TagFilter 
        projectId="project-1" 
        selectedTagIds={[]} 
        onTagSelectionChange={mockOnTagSelectionChange}
        compact={true}
      />
    );

    await waitFor(() => {
      const dropdown = screen.getByRole('combobox');
      expect(dropdown).toBeInTheDocument();
    });

    // Select Character tag from dropdown
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'tag-1' } });

    expect(mockOnTagSelectionChange).toHaveBeenCalledWith(['tag-1']);
  });

  it('shows clear all button when tags are selected in full mode', async () => {
    const { getTags } = await import('../../api');
    vi.mocked(getTags).mockResolvedValue(mockTags);

    render(
      <TagFilter 
        projectId="project-1" 
        selectedTagIds={['tag-1', 'tag-2']} 
        onTagSelectionChange={mockOnTagSelectionChange}
        compact={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Clear All')).toBeInTheDocument();
      expect(screen.getByText('Showing documents with 2 selected tags')).toBeInTheDocument();
    });

    // Click clear all
    fireEvent.click(screen.getByText('Clear All'));

    expect(mockOnTagSelectionChange).toHaveBeenCalledWith([]);
  });

  it('does not render when no tags exist', async () => {
    const { getTags } = await import('../../api');
    vi.mocked(getTags).mockResolvedValue([]);

    const { container } = render(
      <TagFilter 
        projectId="project-1" 
        selectedTagIds={[]} 
        onTagSelectionChange={mockOnTagSelectionChange}
        compact={false}
      />
    );

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});