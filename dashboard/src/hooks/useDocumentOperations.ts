import { useCallback } from 'react';
import { 
  getDocuments, 
  createDocument, 
  updateDocument, 
  deleteDocument, 
  getDocument,
  getPresets,
  createPreset,
  updatePreset,
  updatePresetOverrides,
  deletePreset,
  getTags,
  getDocumentTags,
  addTagsToDocument,
  addDocumentToEvent,
  getDocumentHistory,
  getHistoryEntry,
  rollbackDocument,
} from '../api';
import { supabase } from '../supabaseClient';
import type { Document, Preset, Tag, DocumentHistory, DocumentHistoryResponse } from '../api';
import type { DocumentFormData } from './useProjectDetailState';

interface UseDocumentOperationsProps {
  projectId: string | undefined;
  documents: Document[];
  setDocuments: (documents: Document[]) => void;
  presets: Preset[];
  setPresets: (presets: Preset[]) => void;
  setTags: (tags: Tag[]) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setSelectedDocument: (document: Document | null) => void;
  setResolvedContent: (content: string | null) => void;
}

export function useDocumentOperations({
  projectId,
  documents,
  setDocuments,
  presets,
  setPresets,
  setTags,
  setError,
  setLoading,
  setSelectedDocument,
  setResolvedContent,
}: UseDocumentOperationsProps) {
  
  const getAccessToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  }, []);

  const loadDocuments = useCallback(async () => {
    if (!projectId) return;
    
    try {
      setLoading(true);
      const token = await getAccessToken();
      const docs = await getDocuments(projectId, token);
      
      // Load tags and event associations for each document
      const docsWithTagsAndEvents = await Promise.all(
        docs.map(async (doc) => {
          try {
            const [docTags, eventAssociations] = await Promise.all([
              getDocumentTags(projectId, doc.id, token),
              // Load event associations directly via Supabase
              (async () => {
                const { supabase } = await import('../supabaseClient');
                const { data: eventDocs } = await supabase
                  .from('event_documents')
                  .select('event_id, document_id, created_at')
                  .eq('document_id', doc.id);
                return eventDocs || [];
              })()
            ]);
            
            return { ...doc, tags: docTags, event_documents: eventAssociations };
          } catch (err) {
            console.error(`Failed to load data for document ${doc.id}:`, err);
            return { ...doc, tags: [], event_documents: [] };
          }
        })
      );
      
      setDocuments(docsWithTagsAndEvents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [projectId, getAccessToken, setDocuments, setError, setLoading]);

  const loadPresets = useCallback(async () => {
    if (!projectId) return;
    
    try {
      const token = await getAccessToken();
      const projectPresets = await getPresets(projectId, token);
      setPresets(projectPresets);
    } catch (err) {
      console.error('Failed to load presets:', err);
    }
  }, [projectId, getAccessToken, setPresets]);

  const loadTags = useCallback(async () => {
    if (!projectId) return;
    
    try {
      const token = await getAccessToken();
      const projectTags = await getTags(projectId, token);
      setTags(projectTags);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  }, [projectId, getAccessToken, setTags]);

  const handleCreateDocument = useCallback(async (formData: DocumentFormData) => {
    if (!projectId) return;
    
    try {
      const token = await getAccessToken();
      const newDoc = await createDocument(projectId, formData, token);
      setDocuments([newDoc, ...documents]);
      return newDoc;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create document');
      throw err;
    }
  }, [projectId, documents, getAccessToken, setDocuments, setError]);

  const handleUpdateDocument = useCallback(async (documentId: string, formData: DocumentFormData) => {
    if (!projectId) return;
    
    try {
      const token = await getAccessToken();
      const updatedDoc = await updateDocument(projectId, documentId, formData, token);
      setDocuments(documents.map(doc => doc.id === updatedDoc.id ? updatedDoc : doc));
      setSelectedDocument(updatedDoc);
      return updatedDoc;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update document');
      throw err;
    }
  }, [projectId, documents, getAccessToken, setDocuments, setSelectedDocument, setError]);

  const handleDeleteDocument = useCallback(async (documentId: string) => {
    if (!projectId || !confirm('Are you sure you want to delete this document?')) return;
    
    try {
      const token = await getAccessToken();
      await deleteDocument(projectId, documentId, token);
      setDocuments(documents.filter(doc => doc.id !== documentId));
      setSelectedDocument(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    }
  }, [projectId, documents, getAccessToken, setDocuments, setSelectedDocument, setError]);

  const handleResolveDocument = useCallback(async (doc: Document) => {
    if (!projectId || !doc.is_composite) return;
    
    try {
      const token = await getAccessToken();
      const resolvedDoc = await getDocument(projectId, doc.id, token, true);
      setResolvedContent(resolvedDoc.resolved_content || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve document');
    }
  }, [projectId, getAccessToken, setResolvedContent, setError]);

  const handleCreatePreset = useCallback(async (name: string, document: Document) => {
    if (!projectId) return;
    
    try {
      const token = await getAccessToken();
      const newPreset = await createPreset(projectId, name, document.id, token);
      setPresets([newPreset, ...presets]);
      return newPreset;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create preset');
      throw err;
    }
  }, [projectId, presets, getAccessToken, setPresets, setError]);

  const handleUpdatePreset = useCallback(async (presetId: string, name: string, documentId?: string) => {
    try {
      const token = await getAccessToken();
      const updatedPreset = await updatePreset(presetId, name, documentId, token);
      setPresets(presets.map(preset => preset.id === presetId ? updatedPreset : preset));
      return updatedPreset;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preset');
      throw err;
    }
  }, [presets, getAccessToken, setPresets, setError]);

  const handleUpdatePresetOverrides = useCallback(async (presetId: string, overrides: Record<string, string>) => {
    try {
      const token = await getAccessToken();
      const updatedPreset = await updatePresetOverrides(presetId, overrides, token);
      setPresets(presets.map(preset => preset.id === presetId ? updatedPreset : preset));
      return updatedPreset;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preset overrides');
      throw err;
    }
  }, [presets, getAccessToken, setPresets, setError]);

  const handleDeletePreset = useCallback(async (presetId: string) => {
    if (!confirm('Are you sure you want to delete this preset?')) return;
    
    try {
      const token = await getAccessToken();
      await deletePreset(presetId, token);
      setPresets(presets.filter(preset => preset.id !== presetId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete preset');
    }
  }, [presets, getAccessToken, setPresets, setError]);

  const handleCreateDerivative = useCallback(async (derivativeType: string, title: string, sourceDocument: Document) => {
    if (!projectId) return;
    
    try {
      const token = await getAccessToken();
      
      // Create derivative document with same group_id as source
      const groupId = sourceDocument.group_id || sourceDocument.id; // Use source's group_id or create new group
      
      const derivativeDoc = await createDocument(projectId, {
        title,
        content: '', // Start with empty content
        document_type: derivativeType,
        is_composite: false,
        components: {},
        group_id: groupId
      }, token);

      // If source document doesn't have a group_id yet, update it to be part of the same group
      if (!sourceDocument.group_id) {
        await updateDocument(projectId, sourceDocument.id, {
          ...sourceDocument,
          group_id: groupId
        }, token);
        
        // Update local state
        setDocuments(documents.map(doc => 
          doc.id === sourceDocument.id 
            ? { ...doc, group_id: groupId }
            : doc
        ));
      }

      // Copy tags from source document to derivative document
      if (sourceDocument.tags && sourceDocument.tags.length > 0) {
        try {
          const tagIds = sourceDocument.tags.map(tag => tag.id);
          await addTagsToDocument(projectId, derivativeDoc.id, tagIds, token);
        } catch (err) {
          console.warn('Failed to copy tags to derivative document:', err);
        }
      }

      // Copy event associations from source document to derivative document
      if (sourceDocument.event_documents && sourceDocument.event_documents.length > 0) {
        try {
          await Promise.all(
            sourceDocument.event_documents.map(eventDoc => 
              addDocumentToEvent(projectId, eventDoc.event_id, derivativeDoc.id, token)
            )
          );
        } catch (err) {
          console.warn('Failed to copy event associations to derivative document:', err);
        }
      }

      setDocuments([derivativeDoc, ...documents]);
      return derivativeDoc;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create derivative document');
      throw err;
    }
  }, [projectId, documents, getAccessToken, setDocuments, setError]);

  const handleCreateFromSelection = useCallback(async (
    sourceDocument: Document, 
    selectedText: string, 
    selectionInfo: { start: number; end: number },
    title: string,
    documentType: string,
    groupId?: string
  ) => {
    if (!projectId) return;
    
    try {
      const token = await getAccessToken();
      
      // Create new document with selected text
      const extractedDoc = await createDocument(projectId, {
        title,
        content: selectedText,
        document_type: documentType,
        group_id: groupId, // Add to group if specified
        is_composite: false,
        components: {}
      }, token);

      // Generate a unique component key based on the title
      const componentKey = title.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
      
      // Update source document to be composite and add component reference
      const updatedComponents = { ...sourceDocument.components, [componentKey]: extractedDoc.id };
      
      // Replace selected text with placeholder in source content
      const sourceContent = sourceDocument.content || '';
      const beforeText = sourceContent.substring(0, selectionInfo.start);
      const afterText = sourceContent.substring(selectionInfo.end);
      const updatedContent = beforeText + `{{${componentKey}}}` + afterText;
      
      const updatedSourceDoc = await updateDocument(projectId, sourceDocument.id, {
        ...sourceDocument,
        content: updatedContent,
        is_composite: true,
        components: updatedComponents
      }, token);

      // Copy tags from source document to extracted document
      if (sourceDocument.tags && sourceDocument.tags.length > 0) {
        try {
          const tagIds = sourceDocument.tags.map(tag => tag.id);
          await addTagsToDocument(projectId, extractedDoc.id, tagIds, token);
        } catch (err) {
          console.warn('Failed to copy tags to extracted document:', err);
        }
      }

      // Copy event associations from source document to extracted document
      if (sourceDocument.event_documents && sourceDocument.event_documents.length > 0) {
        try {
          await Promise.all(
            sourceDocument.event_documents.map(eventDoc => 
              addDocumentToEvent(projectId, eventDoc.event_id, extractedDoc.id, token)
            )
          );
        } catch (err) {
          console.warn('Failed to copy event associations to extracted document:', err);
        }
      }

      // Update local state
      setDocuments([extractedDoc, ...documents.map(doc => 
        doc.id === sourceDocument.id ? updatedSourceDoc : doc
      )]);
      setSelectedDocument(updatedSourceDoc);
      
      return { extractedDoc, updatedSourceDoc };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create document from selection');
      throw err;
    }
  }, [projectId, documents, getAccessToken, setDocuments, setSelectedDocument, setError]);

  const loadDocumentHistory = useCallback(async (documentId: string, limit = 50, offset = 0): Promise<DocumentHistoryResponse> => {
    if (!projectId) throw new Error('Project ID is required');
    
    try {
      const token = await getAccessToken();
      return await getDocumentHistory(projectId, documentId, token, limit, offset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document history');
      throw err;
    }
  }, [projectId, getAccessToken, setError]);

  const loadHistoryEntry = useCallback(async (documentId: string, historyId: string): Promise<DocumentHistory> => {
    if (!projectId) throw new Error('Project ID is required');
    
    try {
      const token = await getAccessToken();
      const response = await getHistoryEntry(projectId, documentId, historyId, token);
      return response.historyEntry;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history entry');
      throw err;
    }
  }, [projectId, getAccessToken, setError]);

  const handleRollbackDocument = useCallback(async (documentId: string, historyId: string): Promise<Document> => {
    if (!projectId) throw new Error('Project ID is required');
    
    if (!confirm('Are you sure you want to rollback this document? This will create a new history entry with the previous state.')) {
      throw new Error('Rollback cancelled');
    }
    
    try {
      const token = await getAccessToken();
      const result = await rollbackDocument(projectId, documentId, historyId, token);
      
      // Update local document state
      setDocuments(documents.map(doc => doc.id === documentId ? result.document : doc));
      setSelectedDocument(result.document);
      
      return result.document;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rollback document');
      throw err;
    }
  }, [projectId, documents, getAccessToken, setDocuments, setSelectedDocument, setError]);

  return {
    loadDocuments,
    loadPresets,
    loadTags,
    handleCreateDocument,
    handleUpdateDocument,
    handleDeleteDocument,
    handleResolveDocument,
    handleCreatePreset,
    handleUpdatePreset,
    handleUpdatePresetOverrides,
    handleDeletePreset,
    handleCreateDerivative,
    handleCreateFromSelection,
    loadDocumentHistory,
    loadHistoryEntry,
    handleRollbackDocument,
    getAccessToken,
  };
}