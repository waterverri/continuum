import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Centralized recursive component resolution with namespacing support
 * 
 * Supports:
 * - Recursive resolution of composite documents
 * - Namespaced component overrides (<docid>.<componentname>)
 * - Group references (group:groupId or group:groupId:preferredType)
 * - Circular reference detection
 * 
 * @param supabase - Supabase client instance
 * @param projectId - Project ID for document queries
 * @param docContent - Document content to resolve
 * @param docComponents - Document's component mappings
 * @param overrides - Component overrides (supports namespaced keys)
 * @param currentDocId - Current document ID (for namespacing)
 * @param visited - Set of visited document IDs (for circular reference detection)
 * @returns Resolved content with all components expanded
 */
export const resolveDocumentWithOverrides = async (
  supabase: SupabaseClient,
  projectId: string,
  docContent: string,
  docComponents: Record<string, string> = {},
  overrides: Record<string, string> = {},
  currentDocId?: string,
  visited: Set<string> = new Set()
): Promise<string> => {
  let resolvedContent = docContent;
  
  // Find all component references in the content
  const componentRegex = /{{([^}]+)}}/g;
  const matches = [...docContent.matchAll(componentRegex)];
  
  for (const match of matches) {
    const componentKey = match[1];
    if (!componentKey) continue;
    
    // Support namespaced component overrides: <docid>.<componentname>
    const namespacedKey = currentDocId ? `${currentDocId}.${componentKey}` : componentKey;
    
    // Check overrides in priority order:
    // 1. Exact namespaced override (docid.componentname)
    // 2. Global component override (componentname) 
    // 3. Document's own component mapping
    let targetDocId = overrides[namespacedKey] || overrides[componentKey] || docComponents[componentKey];
    
    if (!targetDocId) continue;
    
    // Handle group references: group:groupId or group:groupId:preferredType
    if (targetDocId.startsWith('group:')) {
      const groupParts = targetDocId.split(':');
      const groupId = groupParts[1];
      const preferredType = groupParts[2] || null;
      
      // Query for documents in the group
      const { data: groupDocs, error: groupError } = await supabase
        .from('documents')
        .select('id, title, document_type, content, components')
        .eq('project_id', projectId)
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });
      
      if (groupError || !groupDocs || groupDocs.length === 0) {
        console.warn(`Group document not found for group ${groupId}${preferredType ? ' with type ' + preferredType : ''}`);
        continue;
      }
      
      let groupDoc;
      if (preferredType) {
        // Use specific preferred type if available
        groupDoc = groupDocs.find(doc => doc.document_type === preferredType) || groupDocs[0];
      } else {
        // Use default representative document selection (document id = group id)
        groupDoc = groupDocs.find(doc => doc.id === groupId) || groupDocs[0];
      }
      targetDocId = groupDoc.id;
      
      // Update the components mapping to cache this resolution
      docComponents[componentKey] = targetDocId;
    }
    
    // Prevent infinite recursion
    if (visited.has(targetDocId)) {
      console.warn(`Circular reference detected for document ${targetDocId}`);
      continue;
    }
    
    // Get the component document
    const { data: componentDoc, error: componentError } = await supabase
      .from('documents')
      .select('id, content, components')
      .eq('id', targetDocId)
      .eq('project_id', projectId)
      .single();
      
    if (componentError || !componentDoc) {
      console.warn(`Component document ${targetDocId} not found`);
      continue;
    }
    
    let componentContent = componentDoc.content || '';
    
    // If the component has sub-components, recursively resolve it
    if (componentDoc.components && Object.keys(componentDoc.components).length > 0) {
      const newVisited = new Set(visited);
      newVisited.add(targetDocId);
      componentContent = await resolveDocumentWithOverrides(
        supabase,
        projectId,
        componentContent,
        componentDoc.components,
        overrides, // Pass through the same overrides for nested resolution
        componentDoc.id, // Pass the current document ID for namespacing
        newVisited
      );
    }
    
    // Replace the component reference with the resolved content
    resolvedContent = resolvedContent.replace(match[0], componentContent);
  }
  
  return resolvedContent;
};