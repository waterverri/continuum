import { useMemo } from 'react';
import { useGlobalStore } from '../../store';
import type { Document } from '../../api';

export function useDocuments() {
  return useGlobalStore((state) => state.documents);
}

export function useDocumentList() {
  return useGlobalStore((state) => state.documents.items);
}

export function useDocument(documentId: string | null) {
  return useGlobalStore((state) =>
    documentId ? state.documents.items.find(doc => doc.id === documentId) : null
  );
}

export function useSelectedDocument() {
  const selectedDocumentId = useGlobalStore((state) => state.selections.selectedDocumentId);
  return useGlobalStore((state) =>
    selectedDocumentId ? state.documents.items.find(doc => doc.id === selectedDocumentId) : null
  );
}

export function useDocumentActions() {
  const setDocuments = useGlobalStore((state) => state.setDocuments);
  const addDocument = useGlobalStore((state) => state.addDocument);
  const updateDocument = useGlobalStore((state) => state.updateDocument);
  const removeDocument = useGlobalStore((state) => state.removeDocument);
  const setDocumentsLoading = useGlobalStore((state) => state.setDocumentsLoading);
  const setDocumentsError = useGlobalStore((state) => state.setDocumentsError);
  const assignTagToDocument = useGlobalStore((state) => state.assignTagToDocument);
  const removeTagFromDocument = useGlobalStore((state) => state.removeTagFromDocument);
  const moveDocumentToGroup = useGlobalStore((state) => state.moveDocumentToGroup);
  const deleteDocument = useGlobalStore((state) => state.deleteDocument);

  return {
    setDocuments,
    addDocument,
    updateDocument,
    removeDocument,
    setDocumentsLoading,
    setDocumentsError,
    assignTagToDocument,
    removeTagFromDocument,
    moveDocumentToGroup,
    deleteDocument,
  };
}

export function useFilteredDocuments() {
  const documents = useDocumentList();
  const filters = useGlobalStore((state) => state.filters);
  const tags = useGlobalStore((state) => state.tags.items);

  return useMemo(() => {
    // Helper function to check if a document group matches tag filter conditions
    const doesGroupMatchTagConditions = (groupDocuments: Document[], conditions: typeof filters.tagFilterConditions) => {
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
      doesGroupMatchTagConditions(groupDocs, filters.tagFilterConditions)
    );

    // Flatten back to individual documents and apply other filters
    const validDocuments = validGroups.flat();

    return validDocuments.filter(doc => {
      // Search filter
      const matchesSearch = !filters.searchTerm ||
        doc.title.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        (doc.content && doc.content.toLowerCase().includes(filters.searchTerm.toLowerCase()));

      // Type filter
      const matchesType = !filters.typeFilter || doc.document_type === filters.typeFilter;

      // Format filter
      const matchesFormat = !filters.formatFilter ||
        (filters.formatFilter === 'composite' && doc.components && Object.keys(doc.components).length > 0) ||
        (filters.formatFilter === 'static' && !(doc.components && Object.keys(doc.components).length > 0));

      // Legacy tag filter (for backward compatibility)
      const matchesTags = filters.selectedTagIds.length === 0 ||
        (doc.tags && filters.selectedTagIds.some(tagId =>
          doc.tags!.some(tag => tag.id === tagId)
        ));

      // Event filter
      const matchesEvents = filters.selectedEventIds.length === 0 ||
        (doc.event_documents && filters.selectedEventIds.some(eventId =>
          doc.event_documents!.some(eventDoc => eventDoc.event_id === eventId)
        )) ||
        (doc.event_id && filters.selectedEventIds.includes(doc.event_id));

      // Event version filter
      const matchesEventVersion =
        filters.eventVersionFilter === 'all' ||
        (filters.eventVersionFilter === 'base' && !doc.event_id) ||
        (filters.eventVersionFilter === 'versions' && doc.event_id);

      return matchesSearch && matchesType && matchesFormat && matchesTags && matchesEvents && matchesEventVersion;
    });
  }, [documents, filters, tags]);
}

export function useAvailableDocumentTypes() {
  const documents = useDocumentList();

  return useMemo(() => {
    return [...new Set(documents.map(doc => doc.document_type).filter((type): type is string => Boolean(type)))];
  }, [documents]);
}