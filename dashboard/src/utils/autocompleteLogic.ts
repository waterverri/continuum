import type { Document } from '../api';

export interface AutocompleteMatch {
  id: string;
  title: string;
  type: 'grouphead' | 'imported';
  document_type?: string;
  alias?: string;
  priority: number; // Lower number = higher priority
}

/**
 * Shared autocomplete logic for both Monaco and Lexical editors
 * Shows groupheads (documents where groupid = docid OR groupid = null)
 * Prioritizes already imported components
 */
export function getAutocompleteMatches(
  query: string,
  documents: Document[],
  currentComponents: Record<string, string>,
  currentDocumentId?: string
): AutocompleteMatch[] {
  const matches: AutocompleteMatch[] = [];
  const queryLower = query.toLowerCase();

  // Get all grouphead documents (groupid = docid OR groupid = null)
  const groupheads = documents.filter(doc =>
    // Don't show the current document being edited
    doc.id !== currentDocumentId &&
    // Only show groupheads: documents where groupid equals docid OR groupid is null
    (doc.group_id === doc.id || doc.group_id === null || doc.group_id === undefined)
  );

  // Get already imported component document IDs for prioritization
  const importedDocIds = new Set(Object.values(currentComponents));

  groupheads.forEach(doc => {
    let shouldInclude = false;
    let matchType: 'grouphead' | 'imported' = 'grouphead';
    let priority = 100; // Default priority

    // Check if this document is already imported (higher priority)
    if (importedDocIds.has(doc.id)) {
      matchType = 'imported';
      priority = 1; // Highest priority
    }

    // Check title match
    if (doc.title.toLowerCase().includes(queryLower)) {
      shouldInclude = true;
      if (matchType === 'grouphead') priority = 10;
    }

    // Check alias match
    if (doc.alias) {
      const aliases = doc.alias.split(',').map(a => a.trim().toLowerCase());
      if (aliases.some(alias => alias.includes(queryLower))) {
        shouldInclude = true;
        if (matchType === 'grouphead') priority = 5; // Alias matches get higher priority than title
      }
    }

    // Check document type match
    if (doc.document_type && doc.document_type.toLowerCase().includes(queryLower)) {
      shouldInclude = true;
      if (matchType === 'grouphead') priority = 20;
    }

    if (shouldInclude) {
      matches.push({
        id: doc.id,
        title: doc.title,
        type: matchType,
        document_type: doc.document_type,
        alias: doc.alias,
        priority
      });
    }
  });

  // Sort by priority (lower number = higher priority), then by title
  matches.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.title.localeCompare(b.title);
  });

  // Limit to 10 results
  return matches.slice(0, 10);
}

/**
 * Generate a component key from document title or alias
 * Converts to alphanumeric + underscore only
 */
export function generateComponentKey(
  document: AutocompleteMatch,
  existingKeys: string[]
): string {
  // Try alias first, then title
  let baseText = '';
  if (document.alias) {
    // Use the first alias
    baseText = document.alias.split(',')[0].trim();
  } else {
    baseText = document.title;
  }

  // Convert to alphanumeric + underscore only
  let keyBase = baseText
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  // Ensure it doesn't start with a number
  if (/^\d/.test(keyBase)) {
    keyBase = 'doc_' + keyBase;
  }

  // Ensure minimum length
  if (keyBase.length === 0) {
    keyBase = 'doc';
  }

  // Make it unique
  let componentKey = keyBase;
  let counter = 1;

  while (existingKeys.includes(componentKey)) {
    componentKey = `${keyBase}_${counter}`;
    counter++;
  }

  return componentKey;
}