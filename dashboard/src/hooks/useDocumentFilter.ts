import { useState, useMemo } from 'react';
import type { Document, Event } from '../api';
import type { TagFilterCondition } from '../components/TagFilterWidget';

export function useDocumentFilter(documents: Document[], events: Event[] = []) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [formatFilter, setFormatFilter] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [eventVersionFilter, setEventVersionFilter] = useState<'all' | 'base' | 'versions'>('all');
  const [tagFilterConditions, setTagFilterConditions] = useState<TagFilterCondition[]>([]);
  
  // Helper function to check if a document group matches tag filter conditions
  const doesGroupMatchTagConditions = (groupDocuments: Document[], conditions: TagFilterCondition[]) => {
    if (conditions.length === 0) return true;
    
    return conditions.every(condition => {
      const { tagId, mode } = condition;
      
      const docsWithTag = groupDocuments.filter(doc => 
        doc.tags?.some(tag => tag.id === tagId)
      );
      
      switch (mode) {
        case 'exist_all':
          return docsWithTag.length === groupDocuments.length;
        case 'exist_one':
          return docsWithTag.length > 0;
        case 'not_exist_all':
          return docsWithTag.length === 0;
        case 'not_exist_one':
          return docsWithTag.length < groupDocuments.length;
        default:
          return true;
      }
    });
  };
  
  const filteredDocuments = useMemo(() => {
    // First group documents by group_id
    const documentGroups = documents.reduce<{ [key: string]: Document[] }>((acc, doc) => {
      const groupKey = doc.group_id || `singleton-${doc.id}`;
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(doc);
      return acc;
    }, {});
    
    // Filter groups based on tag conditions
    const validGroups = Object.values(documentGroups).filter(groupDocs => 
      doesGroupMatchTagConditions(groupDocs, tagFilterConditions)
    );
    
    // Flatten back to individual documents and apply other filters
    const validDocuments = validGroups.flat();
    
    return validDocuments.filter(doc => {
      // Search filter
      const matchesSearch = !searchTerm || 
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.content && doc.content.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Type filter
      const matchesType = !typeFilter || doc.document_type === typeFilter;
      
      // Format filter
      const matchesFormat = !formatFilter ||
        (formatFilter === 'composite' && doc.components && Object.keys(doc.components).length > 0) ||
        (formatFilter === 'static' && !(doc.components && Object.keys(doc.components).length > 0));

      // Legacy tag filter (for backward compatibility)
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
  }, [documents, searchTerm, typeFilter, formatFilter, selectedTagIds, selectedEventIds, eventVersionFilter, tagFilterConditions]);

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
    setTagFilterConditions([]);
  };

  const hasActiveFilters = !!(searchTerm || typeFilter || formatFilter || selectedTagIds.length > 0 || selectedEventIds.length > 0 || eventVersionFilter !== 'all' || tagFilterConditions.length > 0);

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
    tagFilterConditions,
    setTagFilterConditions,
    filteredDocuments,
    availableTypes,
    resetFilters,
    hasActiveFilters,
    events
  };
}