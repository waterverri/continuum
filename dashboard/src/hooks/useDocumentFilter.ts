import { useState, useMemo } from 'react';
import type { Document, Event } from '../api';

export function useDocumentFilter(documents: Document[], events: Event[] = []) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [formatFilter, setFormatFilter] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [eventVersionFilter, setEventVersionFilter] = useState<'all' | 'base' | 'versions'>('all');
  
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

      // Event filter
      const matchesEvents = selectedEventIds.length === 0 || 
        (doc.event_documents && selectedEventIds.some(eventId => 
          doc.event_documents!.some(eventDoc => eventDoc.event_id === eventId)
        )) ||
        (doc.event_id && selectedEventIds.includes(doc.event_id));

      // Event version filter
      const matchesEventVersion = 
        eventVersionFilter === 'all' ||
        (eventVersionFilter === 'base' && !doc.event_id) ||
        (eventVersionFilter === 'versions' && doc.event_id);

      return matchesSearch && matchesType && matchesFormat && matchesTags && matchesEvents && matchesEventVersion;
    });
  }, [documents, searchTerm, typeFilter, formatFilter, selectedTagIds, selectedEventIds, eventVersionFilter]);

  const availableTypes = useMemo(() => {
    return [...new Set(documents.map(doc => doc.document_type).filter((type): type is string => Boolean(type)))];
  }, [documents]);

  const resetFilters = () => {
    setSearchTerm('');
    setTypeFilter('');
    setFormatFilter('');
    setSelectedTagIds([]);
    setSelectedEventIds([]);
    setEventVersionFilter('all');
  };

  const hasActiveFilters = !!(searchTerm || typeFilter || formatFilter || selectedTagIds.length > 0 || selectedEventIds.length > 0 || eventVersionFilter !== 'all');

  return {
    searchTerm,
    setSearchTerm,
    typeFilter,
    setTypeFilter,
    formatFilter,
    setFormatFilter,
    selectedTagIds,
    setSelectedTagIds,
    selectedEventIds,
    setSelectedEventIds,
    eventVersionFilter,
    setEventVersionFilter,
    filteredDocuments,
    availableTypes,
    resetFilters,
    hasActiveFilters,
    events
  };
}