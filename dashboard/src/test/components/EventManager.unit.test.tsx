import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { EventManager } from '../../components/EventManager';

// Mock the API functions
vi.mock('../../api', () => ({
  getEvents: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  getTags: vi.fn(),
  getEventTags: vi.fn(),
}));

// Mock the supabase client
vi.mock('../../supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-token' } }
      })
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'project-1', name: 'Test Project', base_date: '2023-01-01' },
            error: null
          })
        })
      })
    })
  }
}));

const mockEvents = [
  {
    id: 'event-1',
    project_id: 'project-1',
    name: 'Chapter 1',
    description: 'The beginning',
    time_start: 100,
    time_end: 200,
    display_order: 1,
    parent_event_id: null,
    created_at: '2023-01-01T00:00:00.000Z'
  },
  {
    id: 'event-2',
    project_id: 'project-1',
    name: 'Morning Scene',
    description: 'Character wakes up',
    time_start: 100,
    time_end: 150,
    display_order: 1,
    parent_event_id: 'event-1',
    created_at: '2023-01-01T00:00:00.000Z'
  }
];

describe('EventManager', () => {
  const mockProps = {
    projectId: 'project-1',
    onClose: vi.fn(),
    onEventSelect: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    const { getEvents } = await import('../../api');
    vi.mocked(getEvents).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<EventManager {...mockProps} />);
    
    expect(screen.getByText('Loading events...')).toBeInTheDocument();
  });

  it('renders events list when loaded', async () => {
    const { getEvents } = await import('../../api');
    vi.mocked(getEvents).mockResolvedValue({ 
      events: mockEvents, 
      hierarchy: [
        { parent_event_id: 'event-1', child_event_id: 'event-2', created_at: '2023-01-01T00:00:00.000Z' }
      ]
    });

    render(<EventManager {...mockProps} />);
    
    await waitFor(() => {
      // Use getAllByText since "Chapter 1" appears multiple times (as event name and as parent reference)
      expect(screen.getAllByText('Chapter 1')).toHaveLength(2);
      expect(screen.getByText('Morning Scene')).toBeInTheDocument();
    });
  });

  it('displays event details correctly', async () => {
    const { getEvents } = await import('../../api');
    vi.mocked(getEvents).mockResolvedValue({ events: mockEvents });

    render(<EventManager {...mockProps} />);
    
    await waitFor(() => {
      // This test also uses mockEvents which includes both events, so Chapter 1 appears twice
      expect(screen.getAllByText('Chapter 1')).toHaveLength(2);
      expect(screen.getByText('The beginning')).toBeInTheDocument();
      // Since both events have time information, use getAllByText
      expect(screen.getAllByText('Start:')).toHaveLength(2);
      expect(screen.getAllByText('Time 100')).toHaveLength(2); // Both events start at time 100
      expect(screen.getAllByText('End:')).toHaveLength(2);
      expect(screen.getByText('Time 200')).toBeInTheDocument(); // Only first event ends at 200
    });
  });

  it('shows create new event button', async () => {
    const { getEvents } = await import('../../api');
    vi.mocked(getEvents).mockResolvedValue({ events: [] });

    render(<EventManager {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Create New Event')).toBeInTheDocument();
    });
  });

  it('opens create form when create button is clicked', async () => {
    const { getEvents } = await import('../../api');
    vi.mocked(getEvents).mockResolvedValue({ events: [] });

    render(<EventManager {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Create New Event')).toBeInTheDocument();
    });
    
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create New Event' }));
    });
    
    await waitFor(() => {
      expect(screen.getByLabelText('Name *')).toBeInTheDocument();
      // After clicking, both button text and form header will be present
      expect(screen.getAllByText('Create New Event')).toHaveLength(2);
    });
  });

  it('validates required fields in create form', async () => {
    const { getEvents } = await import('../../api');
    vi.mocked(getEvents).mockResolvedValue({ events: [] });

    render(<EventManager {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Create New Event')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create New Event' }));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create Event' })).toBeInTheDocument();
    });

    // Submit form without name - should show validation error or prevent submission
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create Event' }));
    });
    
    // Check that form is still there (validation prevented submission) or error is shown
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create Event' })).toBeInTheDocument();
    });
  });

  it('creates event when form is submitted with valid data', async () => {
    const { getEvents, createEvent } = await import('../../api');
    vi.mocked(getEvents).mockResolvedValue({ events: [] });
    vi.mocked(createEvent).mockResolvedValue(mockEvents[0]);

    render(<EventManager {...mockProps} />);
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('Create New Event'));
    });

    // Fill form
    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'New Event' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'New Description' } });
    
    // Submit form
    fireEvent.click(screen.getByText('Create Event'));

    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledWith(
        'project-1',
        {
          name: 'New Event',
          description: 'New Description',
          time_start: undefined,
          time_end: undefined,
          display_order: 0,
          parent_event_id: undefined
        },
        'mock-token'
      );
    });
  });

  it('opens edit form when edit button is clicked', async () => {
    const { getEvents } = await import('../../api');
    vi.mocked(getEvents).mockResolvedValue({ events: mockEvents });

    render(<EventManager {...mockProps} />);
    
    await waitFor(() => {
      const editButtons = screen.getAllByText('Edit');
      fireEvent.click(editButtons[0]);
      expect(screen.getByText('Edit Event')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Chapter 1')).toBeInTheDocument();
    });
  });

  it('calls delete API when delete is confirmed', async () => {
    const { getEvents, deleteEvent } = await import('../../api');
    vi.mocked(getEvents).mockResolvedValue({ events: mockEvents });
    vi.mocked(deleteEvent).mockResolvedValue();

    // Mock window.confirm
    window.confirm = vi.fn().mockReturnValue(true);

    render(<EventManager {...mockProps} />);
    
    await waitFor(() => {
      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);
    });

    await waitFor(() => {
      expect(deleteEvent).toHaveBeenCalledWith('project-1', 'event-1', 'mock-token');
    });
  });

  it('does not delete when cancel is clicked', async () => {
    const { getEvents, deleteEvent } = await import('../../api');
    vi.mocked(getEvents).mockResolvedValue({ events: mockEvents });

    // Mock window.confirm to return false
    window.confirm = vi.fn().mockReturnValue(false);

    render(<EventManager {...mockProps} />);
    
    await waitFor(() => {
      const deleteButtons = screen.getAllByText('Delete');
      fireEvent.click(deleteButtons[0]);
    });

    expect(deleteEvent).not.toHaveBeenCalled();
  });

  it('calls onEventSelect when select button is clicked', async () => {
    const { getEvents } = await import('../../api');
    vi.mocked(getEvents).mockResolvedValue({ events: mockEvents });

    render(<EventManager {...mockProps} />);
    
    await waitFor(() => {
      const selectButtons = screen.getAllByText('Select');
      fireEvent.click(selectButtons[0]);
    });

    expect(mockProps.onEventSelect).toHaveBeenCalledWith(mockEvents[0]);
  });

  it('shows hierarchical structure correctly', async () => {
    const { getEvents } = await import('../../api');
    vi.mocked(getEvents).mockResolvedValue({ events: mockEvents });

    render(<EventManager {...mockProps} />);
    
    await waitFor(() => {
      // Parent event should be visible
      // Child event should be visible and indented
      expect(screen.getByText('Morning Scene')).toBeInTheDocument();
      // Child event should show parent reference
      expect(screen.getByText('Parent:')).toBeInTheDocument();
      // "Chapter 1" appears twice - once as parent event title, once as parent reference
      expect(screen.getAllByText('Chapter 1')).toHaveLength(2);
    });
  });

  it('handles empty events state', async () => {
    const { getEvents } = await import('../../api');
    vi.mocked(getEvents).mockResolvedValue({ events: [] });

    render(<EventManager {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('No events found. Create your first event to get started.')).toBeInTheDocument();
    });
  });

  it('closes modal when close button is clicked', async () => {
    const { getEvents } = await import('../../api');
    vi.mocked(getEvents).mockResolvedValue({ events: [] });

    render(<EventManager {...mockProps} />);
    
    await act(async () => {
      fireEvent.click(screen.getByText('×'));
    });
    
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('handles API errors gracefully', async () => {
    const { getEvents } = await import('../../api');
    vi.mocked(getEvents).mockRejectedValue(new Error('Failed to load events'));

    render(<EventManager {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load events')).toBeInTheDocument();
    });
  });
});