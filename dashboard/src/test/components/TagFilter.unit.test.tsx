import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TagFilter } from '../../components/TagFilter';

// Mock the API functions
vi.mock('../../api', () => ({
  getTags: vi.fn()
}));

// Mock the supabase client
vi.mock('../../supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-token' } },
        error: null
      })
    }
  }
}));

const mockTags = [
  {
    id: 'tag-1',
    project_id: 'project-1',
    name: 'Character',
    color: '#ff0000',
    created_at: '2023-01-01T00:00:00.000Z'
  },
  {
    id: 'tag-2', 
    project_id: 'project-1',
    name: 'Location',
    color: '#00ff00',
    created_at: '2023-01-01T00:00:00.000Z'
  },
  {
    id: 'tag-3',
    project_id: 'project-1', 
    name: 'Plot',
    color: '#0000ff',
    created_at: '2023-01-01T00:00:00.000Z'
  }
];

describe('TagFilter', () => {
  const mockProps = {
    projectId: 'project-1',
    selectedTagIds: [],
    onTagSelectionChange: vi.fn()
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { getTags } = await import('../../api');
    vi.mocked(getTags).mockResolvedValue(mockTags);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders filter label and select dropdown', async () => {
    render(<TagFilter {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Filter by Tags')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  it('shows all tags in dropdown options', async () => {
    render(<TagFilter {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('All Tags')).toBeInTheDocument();
      expect(screen.getByText('Character')).toBeInTheDocument();
      expect(screen.getByText('Location')).toBeInTheDocument();
      expect(screen.getByText('Plot')).toBeInTheDocument();
    });
  });

  it('calls onTagSelectionChange when tag is selected', async () => {
    render(<TagFilter {...mockProps} />);
    
    await waitFor(() => {
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'tag-1' } });
    });
    
    expect(mockProps.onTagSelectionChange).toHaveBeenCalledWith(['tag-1']);
  });

  it('calls onTagSelectionChange with empty array when "All Tags" is selected', async () => {
    const propsWithSelection = {
      ...mockProps,
      selectedTagIds: ['tag-1']
    };
    
    render(<TagFilter {...propsWithSelection} />);
    
    await waitFor(() => {
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '' } });
    });
    
    expect(mockProps.onTagSelectionChange).toHaveBeenCalledWith([]);
  });

  it('shows selected tag in dropdown', async () => {
    const propsWithSelection = {
      ...mockProps,
      selectedTagIds: ['tag-1']
    };
    
    render(<TagFilter {...propsWithSelection} />);
    
    await waitFor(() => {
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('tag-1');
    });
  });

  it('shows empty value when multiple tags are selected', async () => {
    const propsWithMultipleSelection = {
      ...mockProps,
      selectedTagIds: ['tag-1', 'tag-2']
    };
    
    render(<TagFilter {...propsWithMultipleSelection} />);
    
    await waitFor(() => {
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('');
    });
  });

  it('does not render when no tags exist', async () => {
    const { getTags } = await import('../../api');
    vi.mocked(getTags).mockResolvedValue([]);
    
    const { container } = render(<TagFilter {...mockProps} />);
    
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('handles loading state', async () => {
    const { getTags } = await import('../../api');
    vi.mocked(getTags).mockImplementation(() => new Promise(() => {})); // Never resolves
    
    const { container } = render(<TagFilter {...mockProps} />);
    
    // Should not render anything during loading
    expect(container.firstChild).toBeNull();
  });
});