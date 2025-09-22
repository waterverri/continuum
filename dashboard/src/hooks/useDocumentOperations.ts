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
  setDocumentToDelete: (document: Document | null) => void;
  openModal: (modalName: any) => void;
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
  setDocumentToDelete,
  openModal,
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
      
      // Get the original document to check if group assignment changed
      const originalDoc = documents.find(doc => doc.id === documentId);
      const isGroupAssignmentChange = originalDoc && originalDoc.group_id !== formData.group_id;
      
      // Update the main document
      const updatedDoc = await updateDocument(projectId, documentId, formData, token);
      
      // If group assignment changed and a new group was assigned, ensure the target document is a group head
      console.log('🔧 Checking group assignment:', {
        isGroupAssignmentChange,
        newGroupId: formData.group_id,
        shouldUpdateTarget: isGroupAssignmentChange && formData.group_id
      });
      
      if (isGroupAssignmentChange && formData.group_id) {
        const targetGroupDoc = documents.find(doc => doc.id === formData.group_id);
        console.log('🔧 Target document search result:', targetGroupDoc ? {
          id: targetGroupDoc.id,
          title: targetGroupDoc.title,
          currentGroupId: targetGroupDoc.group_id
        } : 'NOT FOUND');
        
        if (targetGroupDoc) {
          console.log('🔧 About to make second API call for target document B:', {
            documentId: targetGroupDoc.id,
            currentGroupId: targetGroupDoc.group_id,
            newGroupId: targetGroupDoc.id
          });
          
          try {
            // Always make the target document a group head by setting its group_id to its own id
            const updatedTargetDoc = await updateDocument(projectId, targetGroupDoc.id, {
              group_id: targetGroupDoc.id,
            }, token);
            
            console.log('🔧 Second API call SUCCESS - Target document updated:', {
              id: updatedTargetDoc.id,
              title: updatedTargetDoc.title,
              group_id: updatedTargetDoc.group_id,
              expectedGroupId: targetGroupDoc.id
            });
            
            // Update both documents in our local state
            setDocuments(documents.map(doc => 
              doc.id === targetGroupDoc.id 
                ? { ...doc, group_id: targetGroupDoc.id }
                : doc.id === updatedDoc.id ? updatedDoc : doc
            ));
          } catch (secondUpdateError) {
            console.error('🔧 Second API call FAILED:', secondUpdateError);
            // Still update the main document in local state even if second call fails
            setDocuments(documents.map(doc => doc.id === updatedDoc.id ? updatedDoc : doc));
          }
        } else {
          console.log('🔧 Target document not found in documents array');
          // Just update the main document in local state
          setDocuments(documents.map(doc => doc.id === updatedDoc.id ? updatedDoc : doc));
        }
      } else {
        console.log('🔧 No group assignment change detected');
        // No group assignment change, just update the main document
        setDocuments(documents.map(doc => doc.id === updatedDoc.id ? updatedDoc : doc));
      }
      
      setSelectedDocument(updatedDoc);
      return updatedDoc;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update document');
      throw err;
    }
  }, [projectId, documents, getAccessToken, setDocuments, setSelectedDocument, setError]);

  const handleDeleteDocument = useCallback(async (documentId: string) => {
    if (!projectId) return;
    
    // Find the document to delete
    const document = documents.find(doc => doc.id === documentId);
    if (!document) return;
    
    // Set up modal state and open it
    setDocumentToDelete(document);
    openModal('showDocumentDeletion');
  }, [projectId, documents, setDocumentToDelete, openModal]);

  const handleConfirmDeleteDocument = useCallback(async (documentId: string) => {
    if (!projectId) return;
    
    try {
      const token = await getAccessToken();
      const documentToDelete = documents.find(doc => doc.id === documentId);
      
      // If this is a group head document, reassign group head first
      if (documentToDelete?.group_id && documentToDelete.id === documentToDelete.group_id) {
        const groupDocuments = documents.filter(doc => doc.group_id === documentToDelete.group_id && doc.id !== documentId);
        
        if (groupDocuments.length > 0) {
          // Pick the first remaining document as new group head
          const newGroupHead = groupDocuments[0];
          
          // Update the new group head to have its id as group_id
          await updateDocument(projectId, newGroupHead.id, {
            ...newGroupHead,
            group_id: newGroupHead.id,
          }, token);
          
          // Update all other group documents to reference the new head
          await Promise.all(
            groupDocuments.slice(1).map(doc => 
              updateDocument(projectId, doc.id, {
                ...doc,
                group_id: newGroupHead.id,
              }, token)
            )
          );
        }
      }
      
      // Delete the document
      await deleteDocument(projectId, documentId, token);
      setDocuments(documents.filter(doc => doc.id !== documentId));
      setSelectedDocument(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
      throw err;
    }
  }, [projectId, documents, getAccessToken, setDocuments, setSelectedDocument, setError]);

  const handleConfirmDeleteGroup = useCallback(async (groupId: string) => {
    if (!projectId) return;
    
    try {
      const token = await getAccessToken();
      const groupDocuments = documents.filter(doc => doc.group_id === groupId);
      
      // Delete all documents in the group
      await Promise.all(
        groupDocuments.map(doc => deleteDocument(projectId, doc.id, token))
      );
      
      // Remove deleted documents from state
      const deletedIds = new Set(groupDocuments.map(doc => doc.id));
      setDocuments(documents.filter(doc => !deletedIds.has(doc.id)));
      setSelectedDocument(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete group');
      throw err;
    }
  }, [projectId, documents, getAccessToken, setDocuments, setSelectedDocument, setError]);

  const handleResolveDocument = useCallback(async (doc: Document) => {
    if (!projectId || !(doc.components && Object.keys(doc.components).length > 0)) return;
    
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

      // Handle special "CREATE_NEW_GROUP" case
      let effectiveGroupId = groupId;
      let shouldUpdateSourceGroup = false;

      if (groupId === 'CREATE_NEW_GROUP') {
        effectiveGroupId = sourceDocument.id;
        shouldUpdateSourceGroup = !sourceDocument.group_id; // Only update if source isn't already in a group
      }

      // Create new document with selected text
      const extractedDoc = await createDocument(projectId, {
        title,
        content: selectedText,
        document_type: documentType,
        group_id: effectiveGroupId, // Add to group if specified
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
        components: updatedComponents,
        group_id: shouldUpdateSourceGroup ? sourceDocument.id : sourceDocument.group_id
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
    handleConfirmDeleteDocument,
    handleConfirmDeleteGroup,
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