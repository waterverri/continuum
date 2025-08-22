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
            <div className="tag-filter-cards">
              {selectedConditions.map((condition, index) => {
                const tag = getTagById(condition.tagId);
                if (!tag) return null;
                
                return (
                  <div key={`${condition.tagId}-${index}`} className="tag-filter-card">
                    <div 
                      className="tag-filter-card__badge"
                      style={{ backgroundColor: tag.color, color: 'white' }}
                    >
                      <span className="tag-filter-card__name">{tag.name}</span>
                      <button
                        className="tag-filter-card__mode"
                        onClick={() => handleModeChange(index, cycleMode(condition.mode))}
                        title={getFilterModeTooltip(condition.mode)}
                      >
                        {getFilterModeIcon(condition.mode)}
                      </button>
                      <button
                        className="tag-filter-card__remove"
                        onClick={() => handleRemoveCondition(index)}
                        title="Remove condition"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        
        {selectedConditions.length === 0 && (
          <div className="tag-filter-empty">
            <p>No tag filters active</p>
            <p>Click tags in Project Tags to add filters</p>
          </div>
        )}
      </div>
    </div>
  );
}

export type { TagFilterCondition };