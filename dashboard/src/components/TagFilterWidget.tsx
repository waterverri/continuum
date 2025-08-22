import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { getTags } from '../api';
import type { Tag } from '../api';

export type TagFilterMode = 'exist_all' | 'exist_one' | 'not_exist_all' | 'not_exist_one';

interface TagFilterCondition {
  tagId: string;
  mode: TagFilterMode;
}

interface TagFilterWidgetProps {
  projectId: string;
  selectedConditions: TagFilterCondition[];
  onConditionsChange: (conditions: TagFilterCondition[]) => void;
  availableTags?: Tag[];
}

export function TagFilterWidget({ 
  projectId, 
  selectedConditions, 
  onConditionsChange,
  availableTags: propAvailableTags
}: TagFilterWidgetProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState<string>('');

  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const loadTags = useCallback(async () => {
    if (propAvailableTags) {
      setTags(propAvailableTags);
      return;
    }
    
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
  }, [projectId, propAvailableTags]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const handleAddCondition = () => {
    if (!selectedTagId) return;
    
    const newCondition: TagFilterCondition = {
      tagId: selectedTagId,
      mode: 'exist_all'
    };
    
    onConditionsChange([...selectedConditions, newCondition]);
    setSelectedTagId('');
    setIsEditing(false);
  };

  const handleRemoveCondition = (index: number) => {
    const newConditions = selectedConditions.filter((_, i) => i !== index);
    onConditionsChange(newConditions);
  };

  const handleModeChange = (index: number, mode: TagFilterMode) => {
    const newConditions = [...selectedConditions];
    newConditions[index] = { ...newConditions[index], mode };
    onConditionsChange(newConditions);
  };

  const getFilterModeIcon = (mode: TagFilterMode) => {
    switch (mode) {
      case 'exist_all': return '✓✓';
      case 'exist_one': return '✓';
      case 'not_exist_all': return '✗✗';
      case 'not_exist_one': return '✗';
      default: return '?';
    }
  };

  const getFilterModeTooltip = (mode: TagFilterMode) => {
    switch (mode) {
      case 'exist_all': return 'Exists on all documents in group';
      case 'exist_one': return 'Exists on at least one document in group';
      case 'not_exist_all': return 'Does not exist on any document in group';
      case 'not_exist_one': return 'Does not exist on at least one document in group';
      default: return '';
    }
  };

  const cycleMode = (currentMode: TagFilterMode): TagFilterMode => {
    const modes: TagFilterMode[] = ['exist_all', 'exist_one', 'not_exist_all', 'not_exist_one'];
    const currentIndex = modes.indexOf(currentMode);
    return modes[(currentIndex + 1) % modes.length];
  };

  const getTagById = (tagId: string) => tags.find(tag => tag.id === tagId);

  const availableTagsForSelection = tags.filter(tag => 
    !selectedConditions.some(condition => condition.tagId === tag.id)
  );

  if (loading || tags.length === 0) {
    return null;
  }

  return (
    <div className="tag-filter-widget">
      <div className="tag-filter-widget__header">
        <h4>Tag Filters</h4>
      </div>
      
      <div className="tag-filter-widget__content">
        {/* Selected Conditions */}
        {selectedConditions.length > 0 && (
          <div className="tag-filter-conditions">
            <h5>Active Filters:</h5>
            {selectedConditions.map((condition, index) => {
              const tag = getTagById(condition.tagId);
              if (!tag) return null;
              
              return (
                <div key={`${condition.tagId}-${index}`} className="tag-filter-condition">
                  <div className="tag-filter-condition__tag">
                    <span 
                      className="tag-badge tag-badge--sm"
                      style={{ backgroundColor: tag.color, color: 'white' }}
                    >
                      {tag.name}
                    </span>
                  </div>
                  
                  <button
                    className="tag-filter-condition__mode"
                    onClick={() => handleModeChange(index, cycleMode(condition.mode))}
                    title={getFilterModeTooltip(condition.mode)}
                  >
                    {getFilterModeIcon(condition.mode)}
                  </button>
                  
                  <button
                    className="tag-filter-condition__remove"
                    onClick={() => handleRemoveCondition(index)}
                    title="Remove condition"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Add New Condition */}
        {availableTagsForSelection.length > 0 && (
          <div className="tag-filter-add">
            {isEditing ? (
              <div className="tag-filter-add__form">
                <select 
                  className="tag-filter-add__select"
                  value={selectedTagId}
                  onChange={(e) => setSelectedTagId(e.target.value)}
                >
                  <option value="">Select tag...</option>
                  {availableTagsForSelection.map(tag => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
                <button 
                  className="btn btn--xs btn--primary"
                  onClick={handleAddCondition}
                  disabled={!selectedTagId}
                >
                  Add
                </button>
                <button 
                  className="btn btn--xs btn--secondary"
                  onClick={() => {
                    setIsEditing(false);
                    setSelectedTagId('');
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button 
                className="tag-filter-add__btn"
                onClick={() => setIsEditing(true)}
                title="Add tag filter"
              >
                + Add Filter
              </button>
            )}
          </div>
        )}
        
        {selectedConditions.length === 0 && (
          <div className="tag-filter-empty">
            <p>No tag filters active</p>
            <p>Add filters to refine document groups</p>
          </div>
        )}
      </div>
    </div>
  );
}

export type { TagFilterCondition };