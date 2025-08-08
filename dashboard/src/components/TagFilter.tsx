import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { getTags } from '../api';
import type { Tag } from '../api';

interface TagFilterProps {
  projectId: string;
  selectedTagIds: string[];
  onTagSelectionChange: (tagIds: string[]) => void;
}

export function TagFilter({ 
  projectId, 
  selectedTagIds, 
  onTagSelectionChange
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


  if (loading || tags.length === 0) {
    return null; // Don't show filter if no tags exist
  }

  // Always use compact dropdown design
  return (
    <div className="filter-section">
      <label className="filter-label">Filter by Tags</label>
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