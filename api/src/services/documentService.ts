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
    for (const componentId of Object.values(components)) {
      if (await hasCycle(componentId, documentId, visited, recursionStack, projectId, userToken)) {
        return { 
          valid: false, 
          error: `Cyclic dependency detected: Document ${componentId} would create a circular reference` 
        };
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
    const userSupabase = await createUserSupabaseClient(userToken);
    
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
    const userSupabase = await createUserSupabaseClient(userToken);
    
    // Replace each placeholder with resolved content
    for (const [placeholder, componentId] of Object.entries(document.components)) {
      // Fetch the component document
      const { data: componentDoc, error } = await userSupabase
        .from('documents')
        .select('*')
        .eq('id', componentId)
        .eq('project_id', projectId)
        .single();
      
      if (error || !componentDoc) {
        console.warn(`Component document ${componentId} not found for placeholder ${placeholder}`);
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