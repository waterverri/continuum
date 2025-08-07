import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDocumentFilter } from '../../hooks/useDocumentFilter';
import type { Document } from '../../api';

const mockDocuments: Document[] = [
  {
    id: 'doc-1',
    project_id: 'project-1',
    title: 'Character Profile: Alice',
    document_type: 'character',
    content: 'Alice is a brave warrior with a mysterious past.',
    is_composite: false,
    created_at: '2023-01-01T00:00:00.000Z',
    tags: [
      { id: 'tag-1', project_id: 'project-1', name: 'Character', color: '#6366f1', created_at: '2023-01-01T00:00:00.000Z' },
      { id: 'tag-2', project_id: 'project-1', name: 'Main', color: '#8b5cf6', created_at: '2023-01-01T00:00:00.000Z' }
    ]
  },
  {
    id: 'doc-2',
    project_id: 'project-1',
    title: 'The Ancient Forest',
    document_type: 'location',
    content: 'A dark forest filled with ancient trees and hidden secrets.',
    is_composite: false,
    created_at: '2023-01-02T00:00:00.000Z',
    tags: [
      { id: 'tag-3', project_id: 'project-1', name: 'Location', color: '#ec4899', created_at: '2023-01-01T00:00:00.000Z' }
    ]
  },
  {
    id: 'doc-3',
    project_id: 'project-1',
    title: 'Master Template',
    document_type: 'template',
    content: 'Template content with {{placeholder}}',
    is_composite: true,
    created_at: '2023-01-03T00:00:00.000Z',
    tags: [
      { id: 'tag-1', project_id: 'project-1', name: 'Character', color: '#6366f1', created_at: '2023-01-01T00:00:00.000Z' },
      { id: 'tag-4', project_id: 'project-1', name: 'Template', color: '#22c55e', created_at: '2023-01-01T00:00:00.000Z' }
    ]
  },
  {
    id: 'doc-4',
    project_id: 'project-1',
    title: 'Untagged Document',
    document_type: 'note',
    content: 'This document has no tags.',
    is_composite: false,
    created_at: '2023-01-04T00:00:00.000Z',
    tags: []
  }
];

describe('useDocumentFilter', () => {
  it('returns all documents when no filters are applied', () => {
    const { result } = renderHook(() => useDocumentFilter(mockDocuments));
    
    expect(result.current.filteredDocuments).toEqual(mockDocuments);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('filters documents by search term', () => {
    const { result } = renderHook(() => useDocumentFilter(mockDocuments));
    
    act(() => {
      result.current.setSearchTerm('Alice');
    });
    
    expect(result.current.filteredDocuments).toHaveLength(1);
    expect(result.current.filteredDocuments[0].title).toBe('Character Profile: Alice');
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('filters documents by document type', () => {
    const { result } = renderHook(() => useDocumentFilter(mockDocuments));
    
    act(() => {
      result.current.setTypeFilter('character');
    });
    
    expect(result.current.filteredDocuments).toHaveLength(1);
    expect(result.current.filteredDocuments[0].document_type).toBe('character');
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('filters documents by format (composite vs static)', () => {
    const { result } = renderHook(() => useDocumentFilter(mockDocuments));
    
    act(() => {
      result.current.setFormatFilter('composite');
    });
    
    expect(result.current.filteredDocuments).toHaveLength(1);
    expect(result.current.filteredDocuments[0].is_composite).toBe(true);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('filters documents by tags', () => {
    const { result } = renderHook(() => useDocumentFilter(mockDocuments));
    
    act(() => {
      result.current.setSelectedTagIds(['tag-1']); // Character tag
    });
    
    expect(result.current.filteredDocuments).toHaveLength(2);
    expect(result.current.filteredDocuments.every(doc => 
      doc.tags?.some(tag => tag.id === 'tag-1')
    )).toBe(true);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('filters documents by multiple tags (OR logic)', () => {
    const { result } = renderHook(() => useDocumentFilter(mockDocuments));
    
    act(() => {
      result.current.setSelectedTagIds(['tag-2', 'tag-3']); // Main OR Location
    });
    
    expect(result.current.filteredDocuments).toHaveLength(2);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('excludes documents with no matching tags', () => {
    const { result } = renderHook(() => useDocumentFilter(mockDocuments));
    
    act(() => {
      result.current.setSelectedTagIds(['tag-nonexistent']);
    });
    
    expect(result.current.filteredDocuments).toHaveLength(0);
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('combines multiple filters (AND logic)', () => {
    const { result } = renderHook(() => useDocumentFilter(mockDocuments));
    
    act(() => {
      result.current.setSearchTerm('Template');
      result.current.setFormatFilter('composite');
      result.current.setSelectedTagIds(['tag-1']); // Character tag
    });
    
    expect(result.current.filteredDocuments).toHaveLength(1);
    expect(result.current.filteredDocuments[0].title).toBe('Master Template');
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('resets all filters', () => {
    const { result } = renderHook(() => useDocumentFilter(mockDocuments));
    
    // Apply filters
    act(() => {
      result.current.setSearchTerm('Alice');
      result.current.setTypeFilter('character');
      result.current.setFormatFilter('static');
      result.current.setSelectedTagIds(['tag-1']);
    });
    
    expect(result.current.hasActiveFilters).toBe(true);
    
    // Reset filters
    act(() => {
      result.current.resetFilters();
    });
    
    expect(result.current.searchTerm).toBe('');
    expect(result.current.typeFilter).toBe('');
    expect(result.current.formatFilter).toBe('');
    expect(result.current.selectedTagIds).toEqual([]);
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.filteredDocuments).toEqual(mockDocuments);
  });

  it('extracts available document types correctly', () => {
    const { result } = renderHook(() => useDocumentFilter(mockDocuments));
    
    const expectedTypes = ['character', 'location', 'template', 'note'];
    expect(result.current.availableTypes).toEqual(expect.arrayContaining(expectedTypes));
    expect(result.current.availableTypes).toHaveLength(4);
  });

  it('handles documents without tags gracefully', () => {
    const { result } = renderHook(() => useDocumentFilter(mockDocuments));
    
    act(() => {
      result.current.setSelectedTagIds(['tag-1']);
    });
    
    // Document without tags should not appear in filtered results
    const untaggedDoc = result.current.filteredDocuments.find(doc => doc.id === 'doc-4');
    expect(untaggedDoc).toBeUndefined();
  });
});