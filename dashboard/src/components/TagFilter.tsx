import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { getTags } from '../api';
import type { Tag } from '../api';

interface TagFilterProps {
  projectId: string;
  selectedTagIds: string[];
  onTagSelectionChange: (tagIds: string[]) => void;
  compact?: boolean;
}

export function TagFilter({ 
  projectId, 
  selectedTagIds, 
  onTagSelectionChange, 
  compact = false 
}: TagFilterProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);

  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const loadTags = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      const projectTags = await getTags(projectId, token);
      setTags(projectTags);
    } catch (err) {
      console.error('Failed to load tags:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const handleTagToggle = (tagId: string) => {
    const isSelected = selectedTagIds.includes(tagId);
    if (isSelected) {
      onTagSelectionChange(selectedTagIds.filter(id => id !== tagId));
    } else {
      onTagSelectionChange([...selectedTagIds, tagId]);
    }
  };

  const clearAllTags = () => {
    onTagSelectionChange([]);
  };

  if (loading || tags.length === 0) {
    return null; // Don't show filter if no tags exist
  }

  if (compact) {
    // Compact dropdown version for tight spaces
    return (
      <div className="tag-filter tag-filter--compact">
        <select 
          className="filter-select"
          value={selectedTagIds.length === 1 ? selectedTagIds[0] : ''}
          onChange={(e) => {
            const value = e.target.value;
            onTagSelectionChange(value ? [value] : []);
          }}
        >
          <option value="">All Tags</option>
          {tags.map(tag => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Full version with clickable tag badges
  return (
    <div className="tag-filter">
      <div className="tag-filter-header">
        <span className="filter-label">Filter by Tags:</span>
        {selectedTagIds.length > 0 && (
          <button className="btn btn--xs btn--secondary" onClick={clearAllTags}>
            Clear All
          </button>
        )}
      </div>
      
      <div className="tag-filter-options">
        {tags.map(tag => {
          const isSelected = selectedTagIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              className={`tag-filter-option ${isSelected ? 'selected' : ''}`}
              onClick={() => handleTagToggle(tag.id)}
              style={{
                backgroundColor: isSelected ? tag.color : 'transparent',
                borderColor: tag.color,
                color: isSelected ? 'white' : tag.color
              }}
            >
              {tag.name}
              {isSelected && ' ✓'}
            </button>
          );
        })}
      </div>
      
      {selectedTagIds.length > 0 && (
        <div className="tag-filter-summary">
          Showing documents with {selectedTagIds.length} selected tag{selectedTagIds.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}