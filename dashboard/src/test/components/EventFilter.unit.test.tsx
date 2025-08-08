import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventFilter } from '../../components/EventFilter';

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
    display_order: 2,
    parent_event_id: 'event-1',
    created_at: '2023-01-01T00:00:00.000Z'
  },
  {
    id: 'event-3',
    project_id: 'project-1',
    name: 'Chapter 2',
    description: 'The next chapter',
    time_start: 300,
    time_end: 400,
    display_order: 3,
    parent_event_id: null,
    created_at: '2023-01-01T00:00:00.000Z'
  }
];

describe('EventFilter', () => {
  const mockProps = {
    events: mockEvents,
    selectedEventIds: [],
    onEventSelectionChange: vi.fn(),
    eventVersionFilter: 'all' as const,
    onVersionFilterChange: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders filter label and select dropdown', () => {
    render(<EventFilter {...mockProps} />);
    
    expect(screen.getByText('Filter by Events')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows all events in dropdown options sorted by time', () => {
    render(<EventFilter {...mockProps} />);
    
    expect(screen.getByText('All Events')).toBeInTheDocument();
    expect(screen.getByText('Chapter 1 (100)')).toBeInTheDocument();
    expect(screen.getByText('Morning Scene (100)')).toBeInTheDocument();
    expect(screen.getByText('Chapter 2 (300)')).toBeInTheDocument();
  });

  it('shows events without time_start', () => {
    const eventsWithoutTime = [
      {
        ...mockEvents[0],
        time_start: undefined
      }
    ];
    
    const propsWithoutTime = {
      ...mockProps,
      events: eventsWithoutTime
    };
    
    render(<EventFilter {...propsWithoutTime} />);
    
    expect(screen.getByText('Chapter 1')).toBeInTheDocument();
  });

  it('calls onEventSelectionChange when event is selected', () => {
    render(<EventFilter {...mockProps} />);
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'event-1' } });
    
    expect(mockProps.onEventSelectionChange).toHaveBeenCalledWith(['event-1']);
  });

  it('calls onEventSelectionChange with empty array when "All Events" is selected', () => {
    const propsWithSelection = {
      ...mockProps,
      selectedEventIds: ['event-1']
    };
    
    render(<EventFilter {...propsWithSelection} />);
    
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '' } });
    
    expect(mockProps.onEventSelectionChange).toHaveBeenCalledWith([]);
  });

  it('shows selected event in dropdown', () => {
    const propsWithSelection = {
      ...mockProps,
      selectedEventIds: ['event-1']
    };
    
    render(<EventFilter {...propsWithSelection} />);
    
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('event-1');
  });

  it('shows empty value when multiple events are selected', () => {
    const propsWithMultipleSelection = {
      ...mockProps,
      selectedEventIds: ['event-1', 'event-2']
    };
    
    render(<EventFilter {...propsWithMultipleSelection} />);
    
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('');
  });

  it('does not render when no events exist', () => {
    const propsWithoutEvents = {
      ...mockProps,
      events: []
    };
    
    const { container } = render(<EventFilter {...propsWithoutEvents} />);
    
    expect(container.firstChild).toBeNull();
  });

  it('sorts events by time_start correctly', () => {
    render(<EventFilter {...mockProps} />);
    
    const select = screen.getByRole('combobox');
    const options = Array.from(select.querySelectorAll('option')).slice(1); // Skip "All Events" option
    
    // Should be sorted by time_start: Chapter 1 (100), Morning Scene (100), Chapter 2 (300)
    expect(options[0].textContent).toContain('Chapter 1 (100)');
    expect(options[1].textContent).toContain('Morning Scene (100)'); 
    expect(options[2].textContent).toContain('Chapter 2 (300)');
  });
});