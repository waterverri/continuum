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
    display_order: 1,
    parent_event_id: 'event-1',
    created_at: '2023-01-01T00:00:00.000Z'
  },
  {
    id: 'event-3',
    project_id: 'project-1',
    name: 'Chapter 2',
    description: 'The continuation',
    time_start: 300,
    time_end: null,
    display_order: 2,
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

  it('renders filter title and expand button', () => {
    render(<EventFilter {...mockProps} />);
    
    expect(screen.getByText('Events')).toBeInTheDocument();
    expect(screen.getByText('▼')).toBeInTheDocument();
  });

  it('shows event count when events are selected', () => {
    const propsWithSelection = {
      ...mockProps,
      selectedEventIds: ['event-1', 'event-2']
    };

    render(<EventFilter {...propsWithSelection} />);
    
    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  it('expands filter content when clicked', () => {
    render(<EventFilter {...mockProps} />);
    
    fireEvent.click(screen.getByText('Events'));
    
    expect(screen.getByText('Document Type')).toBeInTheDocument();
    expect(screen.getByText('Filter by Events')).toBeInTheDocument();
  });

  it('renders version filter options', () => {
    render(<EventFilter {...mockProps} />);
    
    fireEvent.click(screen.getByText('Events'));
    
    expect(screen.getByText('All Documents')).toBeInTheDocument();
    expect(screen.getByText('Base Versions Only')).toBeInTheDocument();
    expect(screen.getByText('Event Versions Only')).toBeInTheDocument();
  });

  it('calls onVersionFilterChange when version filter is changed', () => {
    render(<EventFilter {...mockProps} />);
    
    fireEvent.click(screen.getByText('Events'));
    fireEvent.click(screen.getByText('Base Versions Only'));
    
    expect(mockProps.onVersionFilterChange).toHaveBeenCalledWith('base');
  });

  it('renders all events in hierarchical structure', () => {
    render(<EventFilter {...mockProps} />);
    
    fireEvent.click(screen.getByText('Events'));
    
    // Root events
    expect(screen.getByText('Chapter 1')).toBeInTheDocument();
    expect(screen.getByText('Chapter 2')).toBeInTheDocument();
    
    // Child event
    expect(screen.getByText('Morning Scene')).toBeInTheDocument();
  });

  it('displays event time information', () => {
    render(<EventFilter {...mockProps} />);
    
    fireEvent.click(screen.getByText('Events'));
    
    expect(screen.getAllByText('T100')).toHaveLength(2); // Two events have T100
    expect(screen.getByText('T300')).toBeInTheDocument();
  });

  it('handles events without time values', () => {
    const eventsWithoutTime = [{
      ...mockEvents[0],
      time_start: undefined
    }];

    render(<EventFilter {...mockProps} events={eventsWithoutTime} />);
    
    fireEvent.click(screen.getByText('Events'));
    
    expect(screen.getByText('No time')).toBeInTheDocument();
  });

  it('calls onEventSelectionChange when event is selected', () => {
    render(<EventFilter {...mockProps} />);
    
    fireEvent.click(screen.getByText('Events'));
    
    const checkboxes = screen.getAllByRole('checkbox');
    const eventCheckbox = checkboxes.find(checkbox => 
      checkbox.getAttribute('type') === 'checkbox' && 
      checkbox.closest('label')?.textContent?.includes('Chapter 1')
    );
    
    if (eventCheckbox) {
      fireEvent.click(eventCheckbox);
    }
    
    expect(mockProps.onEventSelectionChange).toHaveBeenCalledWith(['event-1']);
  });

  it('calls onEventSelectionChange when event is deselected', () => {
    const propsWithSelection = {
      ...mockProps,
      selectedEventIds: ['event-1', 'event-2']
    };

    render(<EventFilter {...propsWithSelection} />);
    
    fireEvent.click(screen.getByText('Events'));
    
    const checkboxes = screen.getAllByRole('checkbox');
    const eventCheckbox = checkboxes.find(checkbox => 
      checkbox.getAttribute('type') === 'checkbox' && 
      checkbox.closest('label')?.textContent?.includes('Chapter 1')
    );
    
    if (eventCheckbox) {
      fireEvent.click(eventCheckbox);
    }
    
    expect(mockProps.onEventSelectionChange).toHaveBeenCalledWith(['event-2']);
  });

  it('shows clear all button when events are selected', () => {
    const propsWithSelection = {
      ...mockProps,
      selectedEventIds: ['event-1']
    };

    render(<EventFilter {...propsWithSelection} />);
    
    fireEvent.click(screen.getByText('Events'));
    
    expect(screen.getByText('Clear All')).toBeInTheDocument();
  });

  it('clears all selections when clear all is clicked', () => {
    const propsWithSelection = {
      ...mockProps,
      selectedEventIds: ['event-1', 'event-2']
    };

    render(<EventFilter {...propsWithSelection} />);
    
    fireEvent.click(screen.getByText('Events'));
    fireEvent.click(screen.getByText('Clear All'));
    
    expect(mockProps.onEventSelectionChange).toHaveBeenCalledWith([]);
  });

  it('shows selected state for checked events', () => {
    const propsWithSelection = {
      ...mockProps,
      selectedEventIds: ['event-1']
    };

    render(<EventFilter {...propsWithSelection} />);
    
    fireEvent.click(screen.getByText('Events'));
    
    const checkboxes = screen.getAllByRole('checkbox');
    const eventCheckbox = checkboxes.find(checkbox => 
      checkbox.getAttribute('type') === 'checkbox' && 
      checkbox.closest('label')?.textContent?.includes('Chapter 1')
    );
    
    expect(eventCheckbox).toBeChecked();
  });

  it('shows correct version filter selection', () => {
    const propsWithBaseFilter = {
      ...mockProps,
      eventVersionFilter: 'base' as const
    };

    render(<EventFilter {...propsWithBaseFilter} />);
    
    fireEvent.click(screen.getByText('Events'));
    
    const baseRadio = screen.getByRole('radio', { name: 'Base Versions Only' });
    expect(baseRadio).toBeChecked();
  });

  it('renders empty state when no events provided', () => {
    render(<EventFilter {...mockProps} events={[]} />);
    
    expect(screen.getByText('No events available')).toBeInTheDocument();
  });

  it('expands and collapses correctly', () => {
    render(<EventFilter {...mockProps} />);
    
    // Initially collapsed
    expect(screen.queryByText('Document Type')).not.toBeInTheDocument();
    
    // Click to expand
    fireEvent.click(screen.getByText('Events'));
    expect(screen.getByText('Document Type')).toBeInTheDocument();
    
    // Click to collapse
    fireEvent.click(screen.getByText('Events'));
    expect(screen.queryByText('Document Type')).not.toBeInTheDocument();
  });

  it('handles child events correctly in hierarchy', () => {
    render(<EventFilter {...mockProps} />);
    
    fireEvent.click(screen.getByText('Events'));
    
    // Morning Scene should be nested under Chapter 1
    const morningScene = screen.getByText('Morning Scene');
    expect(morningScene).toBeInTheDocument();
    
    // Should have child event styling (this would be tested via CSS classes)
    const label = morningScene.closest('label');
    expect(label).toHaveClass('child-event');
  });
});