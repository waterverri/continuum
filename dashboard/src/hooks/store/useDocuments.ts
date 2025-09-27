import { useMemo } from 'react';
import { useGlobalStore } from '../../store';
import type { Document } from '../../api';
import type { GlobalState, GlobalStateActions } from '../../store/types';

export function useDocuments() {
  return useGlobalStore((state: GlobalState & GlobalStateActions) => state.documents);
}

export function useDocumentList() {
  return useGlobalStore((state: GlobalState & GlobalStateActions) => state.documents.items);
}

export function useDocument(documentId: string | null) {
  return useGlobalStore((state: GlobalState & GlobalStateActions) =>
    documentId ? state.documents.items.find(doc => doc.id === documentId) : null
  );
}

export function useSelectedDocument() {
  const selectedDocumentId = useGlobalStore((state: GlobalState & GlobalStateActions) => state.selections.selectedDocumentId);
  return useGlobalStore((state: GlobalState & GlobalStateActions) =>
    selectedDocumentId ? state.documents.items.find(doc => doc.id === selectedDocumentId) : null
  );
}

export function useDocumentActions() {
  const setDocuments = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setDocuments);
  const addDocument = useGlobalStore((state: GlobalState & GlobalStateActions) => state.addDocument);
  const updateDocument = useGlobalStore((state: GlobalState & GlobalStateActions) => state.updateDocument);
  const removeDocument = useGlobalStore((state: GlobalState & GlobalStateActions) => state.removeDocument);
  const setDocumentsLoading = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setDocumentsLoading);
  const setDocumentsError = useGlobalStore((state: GlobalState & GlobalStateActions) => state.setDocumentsError);
  const assignTagToDocument = useGlobalStore((state: GlobalState & GlobalStateActions) => state.assignTagToDocument);
  const removeTagFromDocument = useGlobalStore((state: GlobalState & GlobalStateActions) => state.removeTagFromDocument);
  const moveDocumentToGroup = useGlobalStore((state: GlobalState & GlobalStateActions) => state.moveDocumentToGroup);
  const deleteDocument = useGlobalStore((state: GlobalState & GlobalStateActions) => state.deleteDocument);

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
  const filters = useGlobalStore((state: GlobalState & GlobalStateActions) => state.filters);
  const tags = useGlobalStore((state: GlobalState & GlobalStateActions) => state.tags.items);

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