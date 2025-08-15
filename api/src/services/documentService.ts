import { createUserSupabaseClient } from '../db/supabaseClient';

export interface Document {
  id: string;
  project_id: string;
  title: string;
  group_id?: string;
  document_type?: string;
  content?: string;
  is_composite: boolean;
  components?: Record<string, string>; // key -> document_id mapping
  created_at: string;
}

/**
 * Validates that adding/updating a composite document won't create cyclic dependencies
 */
export async function validateNoCyclicDependencies(
  documentId: string,
  components: Record<string, string>,
  projectId: string,
  userToken: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Build dependency graph starting from this document
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    // Check if any component creates a cycle
    for (const reference of Object.values(components)) {
      if (reference.startsWith('group:')) {
        // For group references, we need to check all documents in the group
        const parts = reference.split(':');
        const groupId = parts[1];
        const userSupabase = createUserSupabaseClient(userToken);
        
        const { data: groupDocs, error } = await userSupabase
          .from('documents')
          .select('id')
          .eq('project_id', projectId)
          .eq('group_id', groupId);
        
        if (!error && groupDocs) {
          for (const doc of groupDocs) {
            if (await hasCycle(doc.id, documentId, visited, recursionStack, projectId, userToken)) {
              return { 
                valid: false, 
                error: `Cyclic dependency detected: Group ${groupId} contains document ${doc.id} that would create a circular reference` 
              };
            }
          }
        }
      } else {
        // Direct document reference
        if (await hasCycle(reference, documentId, visited, recursionStack, projectId, userToken)) {
          return { 
            valid: false, 
            error: `Cyclic dependency detected: Document ${reference} would create a circular reference` 
          };
        }
      }
    }
    
    return { valid: true };
  } catch (error) {
    console.error('Error validating cyclic dependencies:', error);
    return { 
      valid: false, 
      error: 'Failed to validate document dependencies' 
    };
  }
}

/**
 * Recursive function to detect cycles in document dependencies using DFS
 */
async function hasCycle(
  currentDocId: string,
  targetDocId: string,
  visited: Set<string>,
  recursionStack: Set<string>,
  projectId: string,
  userToken: string
): Promise<boolean> {
  // If we've reached the target document, we found a cycle
  if (currentDocId === targetDocId) {
    return true;
  }
  
  // If already in recursion stack, we found a cycle
  if (recursionStack.has(currentDocId)) {
    return true;
  }
  
  // If already visited and not in recursion stack, no cycle from this path
  if (visited.has(currentDocId)) {
    return false;
  }
  
  // Mark as visited and add to recursion stack
  visited.add(currentDocId);
  recursionStack.add(currentDocId);
  
  try {
    // Create user-authenticated client for RLS
    const userSupabase = createUserSupabaseClient(userToken);
    
    // Get the document and check its components
    const { data: doc, error } = await userSupabase
      .from('documents')
      .select('id, is_composite, components')
      .eq('id', currentDocId)
      .eq('project_id', projectId)
      .single();
    
    if (error || !doc) {
      // Document not found or error - assume no cycle
      recursionStack.delete(currentDocId);
      return false;
    }
    
    // If it's a composite document, check its components
    if (doc.is_composite && doc.components) {
      for (const componentId of Object.values(doc.components as Record<string, string>)) {
        if (await hasCycle(componentId, targetDocId, visited, recursionStack, projectId, userToken)) {
          return true;
        }
      }
    }
    
    // Remove from recursion stack
    recursionStack.delete(currentDocId);
    return false;
  } catch (error) {
    console.error(`Error checking document ${currentDocId}:`, error);
    recursionStack.delete(currentDocId);
    return false;
  }
}

/**
 * Recursively resolves a composite document by replacing placeholders with actual content
 */
export async function resolveCompositeDocument(
  document: Document,
  projectId: string,
  userToken: string,
  resolvedDocs = new Set<string>()
): Promise<{ content: string; error?: string }> {
  try {
    // Prevent infinite recursion
    if (resolvedDocs.has(document.id)) {
      return { 
        content: '', 
        error: `Circular reference detected in document ${document.id}` 
      };
    }
    
    // If not composite, return content as-is
    if (!document.is_composite || !document.components) {
      return { content: document.content || '' };
    }
    
    resolvedDocs.add(document.id);
    let resolvedContent = document.content || '';
    
    // Create user-authenticated client for RLS
    const userSupabase = createUserSupabaseClient(userToken);
    
    // Replace each placeholder with resolved content
    for (const [placeholder, reference] of Object.entries(document.components)) {
      let componentDoc: Document | null = null;
      
      if (reference.startsWith('group:')) {
        // Handle group reference with optional preferred type: group:groupId:preferredType
        const parts = reference.split(':');
        const groupId = parts[1];
        const preferredType = parts[2] || null;
        
        const { data: groupDocs, error } = await userSupabase
          .from('documents')
          .select('*')
          .eq('project_id', projectId)
          .eq('group_id', groupId)
          .order('created_at', { ascending: false });
        
        if (error || !groupDocs || groupDocs.length === 0) {
          console.warn(`Group ${groupId} not found for placeholder ${placeholder}`);
          continue;
        }
        
        // Select document from group based on preference
        if (preferredType) {
          // Use specific preferred type if available
          componentDoc = groupDocs.find(doc => doc.document_type === preferredType) || groupDocs[0];
        } else {
          // Use default representative document selection (document id = group id)
          componentDoc = groupDocs.find(doc => doc.id === groupId) || groupDocs[0];
        }
      } else {
        // Handle direct document reference
        const { data: doc, error } = await userSupabase
          .from('documents')
          .select('*')
          .eq('id', reference)
          .eq('project_id', projectId)
          .single();
        
        if (error || !doc) {
          console.warn(`Component document ${reference} not found for placeholder ${placeholder}`);
          continue;
        }
        
        componentDoc = doc;
      }
      
      if (!componentDoc) {
        console.warn(`No component document found for reference ${reference} in placeholder ${placeholder}`);
        continue;
      }
      
      // Recursively resolve if the component is also composite
      const { content: componentContent, error: resolveError } = await resolveCompositeDocument(
        componentDoc as Document,
        projectId,
        userToken,
        new Set(resolvedDocs) // Pass a copy to avoid shared state issues
      );
      
      if (resolveError) {
        return { content: '', error: resolveError };
      }
      
      // Replace the placeholder with resolved content
      const placeholderPattern = new RegExp(`\\{\\{${placeholder}\\}\\}`, 'g');
      resolvedContent = resolvedContent.replace(placeholderPattern, componentContent);
    }
    
    resolvedDocs.delete(document.id);
    return { content: resolvedContent };
  } catch (error) {
    console.error('Error resolving composite document:', error);
    return { 
      content: '', 
      error: 'Failed to resolve composite document' 
    };
  }
}