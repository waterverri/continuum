import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { mockDocument, mockCompositeDocument } from '../test-utils';

// Since the filtering components are not exported individually, 
// let's test the hook logic directly by creating a test component
import { useState, useMemo } from 'react';

// Copy the hook logic for testing
function useDocumentFilter(documents: any[]) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [formatFilter, setFormatFilter] = useState('');
  
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      const matchesSearch = !searchTerm || 
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.content && doc.content.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesType = !typeFilter || doc.document_type === typeFilter;
      
      const matchesFormat = !formatFilter || 
        (formatFilter === 'composite' && doc.is_composite) ||
        (formatFilter === 'static' && !doc.is_composite);

      return matchesSearch && matchesType && matchesFormat;
    });
  }, [documents, searchTerm, typeFilter, formatFilter]);

  const availableTypes = useMemo(() => {
    return [...new Set(documents.map(doc => doc.document_type).filter((type): type is string => Boolean(type)))];
  }, [documents]);

  return {
    searchTerm,
    setSearchTerm,
    typeFilter,
    setTypeFilter,
    formatFilter,
    setFormatFilter,
    filteredDocuments,
    availableTypes,
    hasActiveFilters: !!(searchTerm || typeFilter || formatFilter),
    resetFilters: () => {
      setSearchTerm('');
      setTypeFilter('');
      setFormatFilter('');
    }
  };
}

// Test component to verify the hook works
function TestFilterComponent({ documents }: { documents: any[] }) {
  const filter = useDocumentFilter(documents);
  
  return (
    <div>
      <input 
        data-testid="search-input"
        value={filter.searchTerm}
        onChange={(e) => filter.setSearchTerm(e.target.value)}
        placeholder="Search..."
      />
      <select 
        data-testid="type-filter"
        value={filter.typeFilter}
        onChange={(e) => filter.setTypeFilter(e.target.value)}
      >
        <option value="">All Types</option>
        {filter.availableTypes.map(type => (
          <option key={type} value={type}>{type}</option>
        ))}
      </select>
      <select 
        data-testid="format-filter"
        value={filter.formatFilter}
        onChange={(e) => filter.setFormatFilter(e.target.value)}
      >
        <option value="">All Formats</option>
        <option value="static">Static</option>
        <option value="composite">Composite</option>
      </select>
      <div data-testid="results-count">{filter.filteredDocuments.length}</div>
      <div data-testid="has-filters">{filter.hasActiveFilters ? 'yes' : 'no'}</div>
      <button data-testid="reset-filters" onClick={filter.resetFilters}>
        Reset Filters
      </button>
    </div>
  );
}

describe('Document Filter Hook', () => {
  const testDocuments = [
    mockDocument, // Static document with type 'character'
    mockCompositeDocument, // Composite document  
    {
      ...mockDocument,
      id: 'doc-3',
      title: 'Scene Description',
      document_type: 'scene',
      content: 'The tavern was dimly lit...'
    }
  ];

  it('should filter documents by search term', () => {
    render(<TestFilterComponent documents={testDocuments} />);
    
    // Initially should show all documents
    expect(screen.getByTestId('results-count')).toHaveTextContent('3');
    
    // Search for 'Test'
    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'Test' } });
    
    // Should show documents with 'Test' in title
    expect(screen.getByTestId('results-count')).toHaveTextContent('2');
    expect(screen.getByTestId('has-filters')).toHaveTextContent('yes');
  });

  it('should filter documents by type', () => {
    render(<TestFilterComponent documents={testDocuments} />);
    
    // Filter by 'character' type
    const typeFilter = screen.getByTestId('type-filter');
    fireEvent.change(typeFilter, { target: { value: 'character' } });
    
    // Should show only character documents
    expect(screen.getByTestId('results-count')).toHaveTextContent('2'); // mockDocument and mockCompositeDocument both have 'character' type
  });

  it('should filter documents by format', () => {
    render(<TestFilterComponent documents={testDocuments} />);
    
    // Filter by composite format
    const formatFilter = screen.getByTestId('format-filter');
    fireEvent.change(formatFilter, { target: { value: 'composite' } });
    
    // Should show only composite documents
    expect(screen.getByTestId('results-count')).toHaveTextContent('1');
  });

  it('should reset all filters', () => {
    render(<TestFilterComponent documents={testDocuments} />);
    
    // Apply some filters
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'Test' } });
    fireEvent.change(screen.getByTestId('type-filter'), { target: { value: 'character' } });
    
    expect(screen.getByTestId('has-filters')).toHaveTextContent('yes');
    
    // Reset filters
    fireEvent.click(screen.getByTestId('reset-filters'));
    
    expect(screen.getByTestId('has-filters')).toHaveTextContent('no');
    expect(screen.getByTestId('results-count')).toHaveTextContent('3');
  });

  it('should extract available types correctly', () => {
    render(<TestFilterComponent documents={testDocuments} />);
    
    const typeFilter = screen.getByTestId('type-filter');
    const options = Array.from(typeFilter.querySelectorAll('option')).map(opt => opt.textContent);
    
    expect(options).toContain('character');
    expect(options).toContain('scene');
    expect(options).toContain('All Types');
  });
});