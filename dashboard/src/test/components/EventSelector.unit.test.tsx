import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventSelector } from '../../components/EventSelector';

// Mock the API functions
vi.mock('../../api', () => ({
  getEvents: vi.fn(),
  getEvent: vi.fn(),
  addDocumentToEvent: vi.fn(),
  removeDocumentFromEvent: vi.fn(),
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

const mockDocument = {
  id: 'doc-1',
  project_id: 'project-1',
  title: 'Character Profile',
  content: 'Character description',
  is_composite: false,
  created_at: '2023-01-01T00:00:00.000Z'
};

describe('EventSelector', () => {
  const mockProps = {
    projectId: 'project-1',
    document: mockDocument,
    onClose: vi.fn(),
    onUpdate: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    const { getEvents } = await import('../../api');
    vi.mocked(getEvents).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<EventSelector {...mockProps} />);
    
    expect(screen.getByText('Loading events...')).toBeInTheDocument();
  });

  it('renders events list when loaded', async () => {
    const { getEvents, getEvent } = await import('../../api');
    vi.mocked(getEvents).mockResolvedValue({ events: mockEvents });
    vi.mocked(getEvent).mockResolvedValue({ 
      event: mockEvents[0], 
      documents: [], 
      parentEvents: [], 
      childEvents: [] 
    });

    render(<EventSelector {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Chapter 1')).toBeInTheDocument();
      expect(screen.getByText('Morning Scene')).toBeInTheDocument();
    });
  });

  it('displays document information', async () => {
    const { getEvents, getEvent } = await import('../../api');
    vi.mocked(getEvents).mockResolvedValue({ events: mockEvents });
    vi.mocked(getEvent).mockResolvedValue({ 
      event: mockEvents[0], 
      documents: [], 
      parentEvents: [], 
      childEvents: [] 
    });

    render(<EventSelector {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Document: Character Profile')).toBeInTheDocument();
      expect(screen.getByText('0 events associated')).toBeInTheDocument();
    });
  });

  it('shows associated events correctly', async () => {
    const { getEvents, getEvent } = await import('../../api');
    vi.mocked(getEvents).mockResolvedValue({ events: mockEvents });
    
    // First event is associated
    vi.mocked(getEvent).mockImplementation((projectId, eventId) => {
      if (eventId === 'event-1') {
        return Promise.resolve({ 
          event: mockEvents[0], 
          documents: [{ document_id: 'doc-1' }], 
          parentEvents: [], 
          childEvents: [] 
        });
      }
      return Promise.resolve({ 
        event: mockEvents[1], 
        documents: [], 
        parentEvents: [], 
        childEvents: [] 
      });
    });

    render(<EventSelector {...mockProps} />);
    
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).toBeChecked(); // First event associated
      expect(checkboxes[1]).not.toBeChecked(); // Second event not associated
      expect(screen.getByText('1 event associated')).toBeInTheDocument();
    });
  });

  it('toggles event association when checkbox is clicked', async () => {
    const { getEvents, getEvent, addDocumentToEvent } = await import('../../api');
    vi.mocked(getEvents).mockResolvedValue({ events: mockEvents });
    vi.mocked(getEvent).mockResolvedValue({ 
      event: mockEvents[0], 
      documents: [], 
      parentEvents: [], 
      childEvents: [] 
    });
    vi.mocked(addDocumentToEvent).mockResolvedValue();

    render(<EventSelector {...mockProps} />);
    
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]); // Associate with first event
    });

    await waitFor(() => {
      expect(addDocumentToEvent).toHaveBeenCalledWith(
        'project-1',
        'event-1',
        'doc-1',
        'mock-token'
      );
    });
  });

  it('removes event association when checked checkbox is clicked', async () => {
    const { getEvents, getEvent, removeDocumentFromEvent } = await import('../../api');
    vi.mocked(getEvents).mockResolvedValue({ events: mockEvents });
    
    // First event is already associated
    vi.mocked(getEvent).mockResolvedValue({ 
      event: mockEvents[0], 
      documents: [{ document_id: 'doc-1' }], 
      parentEvents: [], 
      childEvents: [] 
    });
    vi.mocked(removeDocumentFromEvent).mockResolvedValue();

    render(<EventSelector {...mockProps} />);
    
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]); // Remove association with first event
    });

    await waitFor(() => {
      expect(removeDocumentFromEvent).toHaveBeenCalledWith(
        'project-1',
        'event-1',
        'doc-1',
        'mock-token'
      );
    });
  });

  it('calls onUpdate when association is changed', async () => {
    const { getEvents, getEvent, addDocumentToEvent } = await import('../../api');
    vi.mocked(getEvents).mockResolvedValue({ events: mockEvents });
    vi.mocked(getEvent).mockResolvedValue({ 
      event: mockEvents[0], 
      documents: [], 
      parentEvents: [], 
      childEvents: [] 
    });
    vi.mocked(addDocumentToEvent).mockResolvedValue();

    render(<EventSelector {...mockProps} />);
    
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
    });

    await waitFor(() => {
      expect(mockProps.onUpdate).toHaveBeenCalled();
    });
  });

  it('shows hierarchical structure with parent/child events', async () => {
    const { getEvents, getEvent } = await import('../../api');
    vi.mocked(getEvents).mockResolvedValue({ events: mockEvents });
    vi.mocked(getEvent).mockResolvedValue({ 
      event: mockEvents[0], 
      documents: [], 
      parentEvents: [], 
      childEvents: [] 
    });

    render(<EventSelector {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Chapter 1')).toBeInTheDocument();
      expect(screen.getByText('Morning Scene')).toBeInTheDocument();
      // Child event should show parent information
      expect(screen.getByText('Parent:')).toBeInTheDocument();
    });
  });

  it('displays event time information', async () => {
    const { getEvents, getEvent } = await import('../../api');
    vi.mocked(getEvents).mockResolvedValue({ events: mockEvents });
    vi.mocked(getEvent).mockResolvedValue({ 
      event: mockEvents[0], 
      documents: [], 
      parentEvents: [], 
      childEvents: [] 
    });

    render(<EventSelector {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Start:')).toBeInTheDocument();
      expect(screen.getByText('Time 100')).toBeInTheDocument();
      expect(screen.getByText('End:')).toBeInTheDocument();
      expect(screen.getByText('Time 200')).toBeInTheDocument();
    });
  });

  it('handles events without time values', async () => {
    const eventsWithoutTime = [{
      ...mockEvents[0],
      time_start: undefined,
      time_end: undefined
    }];

    const { getEvents, getEvent } = await import('../../api');
    vi.mocked(getEvents).mockResolvedValue({ events: eventsWithoutTime });
    vi.mocked(getEvent).mockResolvedValue({ 
      event: eventsWithoutTime[0], 
      documents: [], 
      parentEvents: [], 
      childEvents: [] 
    });

    render(<EventSelector {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Not set')).toBeInTheDocument();
    });
  });

  it('shows empty state when no events exist', async () => {
    const { getEvents } = await import('../../api');
    vi.mocked(getEvents).mockResolvedValue({ events: [] });

    render(<EventSelector {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('No events found. Create events in the Event Manager to associate them with documents.')).toBeInTheDocument();
    });
  });

  it('closes modal when close button is clicked', async () => {
    const { getEvents } = await import('../../api');
    vi.mocked(getEvents).mockResolvedValue({ events: [] });

    render(<EventSelector {...mockProps} />);
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('×'));
    });
    
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('closes modal when done button is clicked', async () => {
    const { getEvents } = await import('../../api');
    vi.mocked(getEvents).mockResolvedValue({ events: [] });

    render(<EventSelector {...mockProps} />);
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('Done'));
    });
    
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('handles API errors gracefully', async () => {
    const { getEvents } = await import('../../api');
    vi.mocked(getEvents).mockRejectedValue(new Error('Failed to load events'));

    render(<EventSelector {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load events')).toBeInTheDocument();
    });
  });

  it('shows pending state during association changes', async () => {
    const { getEvents, getEvent, addDocumentToEvent } = await import('../../api');
    vi.mocked(getEvents).mockResolvedValue({ events: mockEvents });
    vi.mocked(getEvent).mockResolvedValue({ 
      event: mockEvents[0], 
      documents: [], 
      parentEvents: [], 
      childEvents: [] 
    });
    
    // Make the association call hang to show pending state
    vi.mocked(addDocumentToEvent).mockImplementation(() => new Promise(() => {}));

    render(<EventSelector {...mockProps} />);
    
    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
    });

    await waitFor(() => {
      expect(screen.getByText('Updating...')).toBeInTheDocument();
    });
  });
});