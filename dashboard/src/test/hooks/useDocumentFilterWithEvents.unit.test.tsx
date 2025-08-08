import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDocumentFilter } from '../../hooks/useDocumentFilter';

const mockDocuments = [
  {
    id: 'doc-1',
    project_id: 'project-1',
    title: 'Character Profile',
    content: 'Main character description',
    document_type: 'character',
    is_composite: false,
    created_at: '2023-01-01T00:00:00.000Z',
    tags: [
      { id: 'tag-1', name: 'Protagonist', color: '#6366f1' }
    ],
    event_id: null, // Base version
    event_documents: []
  },
  {
    id: 'doc-2',
    project_id: 'project-1',
    title: 'Character Profile (Chapter 2)',
    content: 'Character after development',
    document_type: 'character',
    is_composite: false,
    created_at: '2023-01-02T00:00:00.000Z',
    tags: [
      { id: 'tag-1', name: 'Protagonist', color: '#6366f1' }
    ],
    event_id: 'event-1', // Event version
    event_documents: []
  },
  {
    id: 'doc-3',
    project_id: 'project-1',
    title: 'Location Description',
    content: 'Forest setting',
    document_type: 'location',
    is_composite: false,
    created_at: '2023-01-03T00:00:00.000Z',
    tags: [
      { id: 'tag-2', name: 'Setting', color: '#8b5cf6' }
    ],
    event_id: null,
    event_documents: [
      { event_id: 'event-2', document_id: 'doc-3', created_at: '2023-01-03T00:00:00.000Z' }
    ]
  }
];

const mockEvents = [
  {
    id: 'event-1',
    project_id: 'project-1',
    name: 'Character Development',
    description: 'Character growth scene',
    time_start: 100,
    time_end: 200,
    display_order: 1,
    parent_event_id: null,
    created_at: '2023-01-01T00:00:00.000Z'
  },
  {
    id: 'event-2',
    project_id: 'project-1',
    name: 'Forest Scene',
    description: 'Scene in the forest',
    time_start: 200,
    time_end: 300,
    display_order: 2,
    parent_event_id: null,
    created_at: '2023-01-02T00:00:00.000Z'
  }
];

describe('useDocumentFilter with Events', () => {
  it('initializes with correct default values', () => {
    const { result } = renderHook(() => 
      useDocumentFilter(mockDocuments, mockEvents)
    );

    expect(result.current.selectedEventIds).toEqual([]);
    expect(result.current.eventVersionFilter).toBe('all');
    expect(result.current.filteredDocuments).toHaveLength(3);
    expect(result.current.events).toEqual(mockEvents);
  });

  it('filters documents by selected events (via event_id)', () => {
    const { result } = renderHook(() => 
      useDocumentFilter(mockDocuments, mockEvents)
    );

    act(() => {
      result.current.setSelectedEventIds(['event-1']);
    });

    expect(result.current.filteredDocuments).toHaveLength(1);
    expect(result.current.filteredDocuments[0].id).toBe('doc-2');
  });

  it('filters documents by selected events (via event_documents)', () => {
    const { result } = renderHook(() => 
      useDocumentFilter(mockDocuments, mockEvents)
    );

    act(() => {
      result.current.setSelectedEventIds(['event-2']);
    });

    expect(result.current.filteredDocuments).toHaveLength(1);
    expect(result.current.filteredDocuments[0].id).toBe('doc-3');
  });

  it('filters documents by multiple selected events', () => {
    const { result } = renderHook(() => 
      useDocumentFilter(mockDocuments, mockEvents)
    );

    act(() => {
      result.current.setSelectedEventIds(['event-1', 'event-2']);
    });

    expect(result.current.filteredDocuments).toHaveLength(2);
    expect(result.current.filteredDocuments.map(d => d.id)).toEqual(['doc-2', 'doc-3']);
  });

  it('filters documents by event version filter - base only', () => {
    const { result } = renderHook(() => 
      useDocumentFilter(mockDocuments, mockEvents)
    );

    act(() => {
      result.current.setEventVersionFilter('base');
    });

    expect(result.current.filteredDocuments).toHaveLength(2);
    expect(result.current.filteredDocuments.map(d => d.id)).toEqual(['doc-1', 'doc-3']);
  });

  it('filters documents by event version filter - versions only', () => {
    const { result } = renderHook(() => 
      useDocumentFilter(mockDocuments, mockEvents)
    );

    act(() => {
      result.current.setEventVersionFilter('versions');
    });

    expect(result.current.filteredDocuments).toHaveLength(1);
    expect(result.current.filteredDocuments[0].id).toBe('doc-2');
  });

  it('combines event and version filters', () => {
    const { result } = renderHook(() => 
      useDocumentFilter(mockDocuments, mockEvents)
    );

    act(() => {
      result.current.setSelectedEventIds(['event-1']);
      result.current.setEventVersionFilter('versions');
    });

    expect(result.current.filteredDocuments).toHaveLength(1);
    expect(result.current.filteredDocuments[0].id).toBe('doc-2');
  });

  it('combines event filters with other filters', () => {
    const { result } = renderHook(() => 
      useDocumentFilter(mockDocuments, mockEvents)
    );

    act(() => {
      result.current.setSelectedEventIds(['event-1']);
      result.current.setTypeFilter('character');
    });

    expect(result.current.filteredDocuments).toHaveLength(1);
    expect(result.current.filteredDocuments[0].id).toBe('doc-2');
  });

  it('shows no results when conflicting filters are applied', () => {
    const { result } = renderHook(() => 
      useDocumentFilter(mockDocuments, mockEvents)
    );

    act(() => {
      result.current.setSelectedEventIds(['event-1']);
      result.current.setTypeFilter('location'); // event-1 document is character type
    });

    expect(result.current.filteredDocuments).toHaveLength(0);
  });

  it('resets all filters including event filters', () => {
    const { result } = renderHook(() => 
      useDocumentFilter(mockDocuments, mockEvents)
    );

    // Set some filters
    act(() => {
      result.current.setSelectedEventIds(['event-1']);
      result.current.setEventVersionFilter('base');
      result.current.setSearchTerm('character');
      result.current.setTypeFilter('character');
    });

    // Reset all filters
    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.selectedEventIds).toEqual([]);
    expect(result.current.eventVersionFilter).toBe('all');
    expect(result.current.searchTerm).toBe('');
    expect(result.current.typeFilter).toBe('');
    expect(result.current.filteredDocuments).toHaveLength(3);
  });

  it('correctly identifies active filters with events', () => {
    const { result } = renderHook(() => 
      useDocumentFilter(mockDocuments, mockEvents)
    );

    expect(result.current.hasActiveFilters).toBe(false);

    act(() => {
      result.current.setSelectedEventIds(['event-1']);
    });

    expect(result.current.hasActiveFilters).toBe(true);

    act(() => {
      result.current.setSelectedEventIds([]);
      result.current.setEventVersionFilter('base');
    });

    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('works without events parameter', () => {
    const { result } = renderHook(() => 
      useDocumentFilter(mockDocuments)
    );

    expect(result.current.events).toEqual([]);
    expect(result.current.selectedEventIds).toEqual([]);
    expect(result.current.filteredDocuments).toHaveLength(3);
  });

  it('handles empty documents array with events', () => {
    const { result } = renderHook(() => 
      useDocumentFilter([], mockEvents)
    );

    act(() => {
      result.current.setSelectedEventIds(['event-1']);
    });

    expect(result.current.filteredDocuments).toHaveLength(0);
  });

  it('handles documents without event_documents or event_id', () => {
    const docsWithoutEvents = [
      {
        id: 'doc-1',
        project_id: 'project-1',
        title: 'Simple Doc',
        content: 'Simple content',
        document_type: 'note',
        is_composite: false,
        created_at: '2023-01-01T00:00:00.000Z',
        tags: [],
        event_id: null,
        event_documents: []
      }
    ];

    const { result } = renderHook(() => 
      useDocumentFilter(docsWithoutEvents, mockEvents)
    );

    act(() => {
      result.current.setSelectedEventIds(['event-1']);
    });

    // Document should be filtered out since it's not associated with the selected event
    expect(result.current.filteredDocuments).toHaveLength(0);
  });

  it('combines search, tag, and event filters correctly', () => {
    const { result } = renderHook(() => 
      useDocumentFilter(mockDocuments, mockEvents)
    );

    act(() => {
      result.current.setSearchTerm('Character');
      result.current.setSelectedTagIds(['tag-1']);
      result.current.setSelectedEventIds(['event-1']);
    });

    expect(result.current.filteredDocuments).toHaveLength(1);
    expect(result.current.filteredDocuments[0].id).toBe('doc-2');
  });
});