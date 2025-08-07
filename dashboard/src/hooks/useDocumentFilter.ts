import { useState, useMemo } from 'react';
import type { Document } from '../api';

export function useDocumentFilter(documents: Document[]) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [formatFilter, setFormatFilter] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      // Search filter
      const matchesSearch = !searchTerm || 
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.content && doc.content.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Type filter
      const matchesType = !typeFilter || doc.document_type === typeFilter;
      
      // Format filter
      const matchesFormat = !formatFilter || 
        (formatFilter === 'composite' && doc.is_composite) ||
        (formatFilter === 'static' && !doc.is_composite);

      // Tag filter
      const matchesTags = selectedTagIds.length === 0 || 
        (doc.tags && selectedTagIds.some(tagId => 
          doc.tags!.some(tag => tag.id === tagId)
        ));

      return matchesSearch && matchesType && matchesFormat && matchesTags;
    });
  }, [documents, searchTerm, typeFilter, formatFilter, selectedTagIds]);

  const availableTypes = useMemo(() => {
    return [...new Set(documents.map(doc => doc.document_type).filter((type): type is string => Boolean(type)))];
  }, [documents]);

  const resetFilters = () => {
    setSearchTerm('');
    setTypeFilter('');
    setFormatFilter('');
    setSelectedTagIds([]);
  };

  const hasActiveFilters = !!(searchTerm || typeFilter || formatFilter || selectedTagIds.length > 0);

  return {
    searchTerm,
    setSearchTerm,
    typeFilter,
    setTypeFilter,
    formatFilter,
    setFormatFilter,
    selectedTagIds,
    setSelectedTagIds,
    filteredDocuments,
    availableTypes,
    resetFilters,
    hasActiveFilters
  };
}