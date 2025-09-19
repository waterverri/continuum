import { useState, useEffect, useRef, useMemo } from 'react';
import type { Document, Tag } from '../api';

export interface AutocompleteItem {
  id: string;
  title: string;
  alias?: string;
  group_id?: string;
  document_type?: string;
  tags?: Tag[];
  matchType: 'title' | 'alias' | 'tag';
  isInComponents?: boolean;
}

interface AutocompleteDropdownProps {
  isVisible: boolean;
  searchQuery: string;
  items: AutocompleteItem[];
  selectedIndex: number;
  onSelect: (item: AutocompleteItem) => void;
  position: { top: number; left: number };
}

export function AutocompleteDropdown({
  isVisible,
  searchQuery,
  items,
  selectedIndex,
  onSelect,
  position
}: AutocompleteDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Group items by document group for better organization
  const groupedItems = useMemo(() => {
    const groups: Record<string, AutocompleteItem[]> = {};
    const ungrouped: AutocompleteItem[] = [];

    items.forEach(item => {
      if (item.group_id) {
        if (!groups[item.group_id]) {
          groups[item.group_id] = [];
        }
        groups[item.group_id].push(item);
      } else {
        ungrouped.push(item);
      }
    });

    return { groups, ungrouped };
  }, [items]);

  const renderItem = (item: AutocompleteItem, index: number) => {
    const isSelected = index === selectedIndex;

    return (
      <div
        key={`${item.id}-${item.matchType}`}
        className={`autocomplete-item ${isSelected ? 'selected' : ''} ${item.isInComponents ? 'in-components' : ''}`}
        onClick={() => onSelect(item)}
        onMouseEnter={() => {
          // Optional: Update selected index on hover
          // This could be passed as a prop if needed
        }}
      >
        <div className="item-main">
          <span className="item-title">{item.title}</span>
          {item.matchType === 'alias' && item.alias && (
            <span className="item-alias">({item.alias})</span>
          )}
          {item.matchType === 'tag' && (
            <span className="item-tag-match">via tag</span>
          )}
        </div>
        <div className="item-meta">
          {item.document_type && (
            <span className="item-type">{item.document_type}</span>
          )}
          {item.isInComponents && (
            <span className="item-badge">Already used</span>
          )}
        </div>
      </div>
    );
  };

  if (!isVisible || items.length === 0) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      className="autocomplete-dropdown"
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        zIndex: 1000
      }}
    >
      <div className="autocomplete-content">
        {searchQuery && (
          <div className="autocomplete-header">
            <span className="search-query">"{searchQuery}"</span>
            <span className="result-count">{items.length} results</span>
          </div>
        )}

        <div className="autocomplete-items">
          {/* Render items already in components first */}
          {items.filter(item => item.isInComponents).length > 0 && (
            <>
              <div className="autocomplete-section-header">In Components</div>
              {items
                .filter(item => item.isInComponents)
                .map((item) => {
                  const globalIndex = items.findIndex(i => i === item);
                  return renderItem(item, globalIndex);
                })
              }
            </>
          )}

          {/* Render groups */}
          {Object.entries(groupedItems.groups).map(([groupId, groupItems]) => {
            const groupDoc = groupItems[0];
            const groupTitle = groupDoc.title;

            return (
              <div key={groupId} className="autocomplete-group">
                <div className="autocomplete-section-header">
                  Group: {groupTitle} ({groupItems.length} docs)
                </div>
                {groupItems
                  .filter(item => !item.isInComponents)
                  .map((item) => {
                    const globalIndex = items.findIndex(i => i === item);
                    return renderItem(item, globalIndex);
                  })
                }
              </div>
            );
          })}

          {/* Render ungrouped items */}
          {groupedItems.ungrouped.filter(item => !item.isInComponents).length > 0 && (
            <>
              <div className="autocomplete-section-header">Individual Documents</div>
              {groupedItems.ungrouped
                .filter(item => !item.isInComponents)
                .map((item) => {
                  const globalIndex = items.findIndex(i => i === item);
                  return renderItem(item, globalIndex);
                })
              }
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Hook for managing autocomplete state and search logic
export function useAutocomplete(
  documents: Document[],
  currentComponents: Record<string, string>
) {
  const [isVisible, setIsVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Generate autocomplete items based on search query
  const items = useMemo(() => {
    if (!searchQuery || searchQuery.length < 1) {
      return [];
    }

    const query = searchQuery.toLowerCase();
    const results: AutocompleteItem[] = [];
    const componentValues = Object.values(currentComponents);

    documents.forEach(doc => {
      // Check if document is in components either directly or via group reference
      const isInComponents = componentValues.some(value => {
        // Direct document ID match
        if (value === doc.id) return true;

        // Group reference match (group:groupId:docId)
        if (value.startsWith('group:')) {
          const parts = value.split(':');
          if (parts.length >= 3 && parts[2] === doc.id) return true;

          // Also check if it's a group reference that would include this document
          if (parts.length >= 2 && doc.group_id === parts[1]) {
            // If it's a group reference without specific doc ID, or with matching group
            return parts.length === 2 || parts[2] === doc.document_type;
          }
        }

        return false;
      });

      // Search by title
      if (doc.title.toLowerCase().includes(query)) {
        results.push({
          id: doc.id,
          title: doc.title,
          alias: doc.alias,
          group_id: doc.group_id,
          document_type: doc.document_type,
          tags: doc.tags,
          matchType: 'title',
          isInComponents
        });
      }
      // Search by alias
      else if (doc.alias && doc.alias.toLowerCase().split(',').some(alias =>
        alias.trim().toLowerCase().includes(query)
      )) {
        results.push({
          id: doc.id,
          title: doc.title,
          alias: doc.alias,
          group_id: doc.group_id,
          document_type: doc.document_type,
          tags: doc.tags,
          matchType: 'alias',
          isInComponents
        });
      }
      // Search by tag
      else if (doc.tags && doc.tags.some(tag =>
        tag.name.toLowerCase().includes(query)
      )) {
        results.push({
          id: doc.id,
          title: doc.title,
          alias: doc.alias,
          group_id: doc.group_id,
          document_type: doc.document_type,
          tags: doc.tags,
          matchType: 'tag',
          isInComponents
        });
      }
    });

    // Sort results: components first, then by relevance (exact matches first, then partial)
    return results.sort((a, b) => {
      // Items already in components come first
      if (a.isInComponents && !b.isInComponents) return -1;
      if (!a.isInComponents && b.isInComponents) return 1;

      // Then sort by match quality (exact match before partial)
      const aExactTitle = a.title.toLowerCase() === query;
      const bExactTitle = b.title.toLowerCase() === query;
      if (aExactTitle && !bExactTitle) return -1;
      if (!aExactTitle && bExactTitle) return 1;

      const aExactAlias = a.alias && a.alias.toLowerCase().split(',').some(alias =>
        alias.trim().toLowerCase() === query
      );
      const bExactAlias = b.alias && b.alias.toLowerCase().split(',').some(alias =>
        alias.trim().toLowerCase() === query
      );
      if (aExactAlias && !bExactAlias) return -1;
      if (!aExactAlias && bExactAlias) return 1;

      // Finally sort alphabetically
      return a.title.localeCompare(b.title);
    });
  }, [searchQuery, documents, currentComponents]);

  // Reset selected index when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  const show = (query: string, pos: { top: number; left: number }) => {
    setSearchQuery(query);
    setPosition(pos);
    setIsVisible(true);
  };

  const hide = () => {
    setIsVisible(false);
    setSearchQuery('');
    setSelectedIndex(0);
  };

  const selectNext = () => {
    setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
  };

  const selectPrevious = () => {
    setSelectedIndex(prev => Math.max(prev - 1, 0));
  };

  const getSelectedItem = () => {
    return items[selectedIndex] || null;
  };

  return {
    isVisible,
    searchQuery,
    items,
    selectedIndex,
    position,
    show,
    hide,
    selectNext,
    selectPrevious,
    getSelectedItem,
    setSelectedIndex
  };
}