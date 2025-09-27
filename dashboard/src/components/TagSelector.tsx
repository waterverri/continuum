import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { getTags, getDocumentTags, addTagsToDocument, removeTagFromDocument, getEventTags, addTagsToEvent, removeTagFromEvent } from '../api';
import type { Tag } from '../api';
import { DraggableItem } from './dnd/DraggableItem';

interface TagSelectorProps {
  projectId: string;
  entityType: 'document' | 'event';
  entityId: string;
  entityName: string;
  onClose: () => void;
  onUpdate?: () => void;
}

export function TagSelector({ projectId, entityType, entityId, entityName, onClose, onUpdate }: TagSelectorProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [entityTags, setEntityTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      
      const allTagsData = await getTags(projectId, token);
      let entityTagsData: Tag[];
      
      if (entityType === 'document') {
        entityTagsData = await getDocumentTags(projectId, entityId, token);
      } else {
        entityTagsData = await getEventTags(projectId, entityId, token);
      }
      
      setAllTags(allTagsData);
      setEntityTags(entityTagsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tags');
    } finally {
      setLoading(false);
    }
  }, [projectId, entityType, entityId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isTagSelected = (tagId: string) => {
    return entityTags.some(tag => tag.id === tagId);
  };

  const handleTagToggle = async (tag: Tag) => {
    try {
      const token = await getAccessToken();
      const isSelected = isTagSelected(tag.id);
      
      if (isSelected) {
        // Remove tag
        if (entityType === 'document') {
          await removeTagFromDocument(projectId, entityId, tag.id, token);
        } else {
          await removeTagFromEvent(projectId, entityId, tag.id, token);
        }
        setEntityTags(entityTags.filter(t => t.id !== tag.id));
      } else {
        // Add tag
        if (entityType === 'document') {
          await addTagsToDocument(projectId, entityId, [tag.id], token);
        } else {
          await addTagsToEvent(projectId, entityId, [tag.id], token);
        }
        setEntityTags([...entityTags, tag]);
      }
      
      onUpdate?.();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tag');
    }
  };

  const availableTags = allTags.filter(tag => !isTagSelected(tag.id));
  const hasAvailableTags = availableTags.length > 0;
  const hasSelectedTags = entityTags.length > 0;

  if (loading) return <div className="loading">Loading tags...</div>;

  return (
    <div className="modal-overlay">
      <div className="modal-content tag-selector-modal">
        <div className="modal-header">
          <h3>{entityType === 'document' ? 'Document' : 'Event'} Tags</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="entity-info">
            <h4>{entityType === 'document' ? 'Document' : 'Event'}: {entityName}</h4>
          </div>

          {error && (
            <div className="error-message">
              {error}
              <button onClick={() => setError(null)}>×</button>
            </div>
          )}

          {/* Selected Tags */}
          {hasSelectedTags && (
            <div className="tags-section">
              <h4>Applied Tags ({entityTags.length})</h4>
              <div className="tags-grid">
                {entityTags.map(tag => (
                  <DraggableItem
                    key={tag.id}
                    id={`tag-${tag.id}`}
                    type="tag"
                    item={tag}
                  >
                    <div className="tag-item selectable selected">
                      <span
                        className="tag-badge"
                        style={{ backgroundColor: tag.color, color: 'white' }}
                      >
                        {tag.name}
                      </span>
                      <button
                        className="tag-remove"
                        onClick={() => handleTagToggle(tag)}
                        title={`Remove ${tag.name} tag`}
                      >
                        ×
                      </button>
                    </div>
                  </DraggableItem>
                ))}
              </div>
            </div>
          )}

          {/* Available Tags */}
          {hasAvailableTags && (
            <div className="tags-section">
              <h4>Available Tags ({availableTags.length})</h4>
              <div className="tags-grid">
                {availableTags.map(tag => (
                  <DraggableItem
                    key={tag.id}
                    id={`tag-${tag.id}`}
                    type="tag"
                    item={tag}
                  >
                    <div className="tag-item selectable" onClick={() => handleTagToggle(tag)}>
                      <span
                        className="tag-badge"
                        style={{ backgroundColor: tag.color, color: 'white' }}
                      >
                        {tag.name}
                      </span>
                      <span className="tag-add">+</span>
                    </div>
                  </DraggableItem>
                ))}
              </div>
            </div>
          )}

          {/* Empty States */}
          {!hasSelectedTags && !hasAvailableTags && (
            <div className="empty-state">
              <p>No tags available.</p>
              <p>Create tags from the project settings to organize your documents.</p>
            </div>
          )}

          {!hasSelectedTags && hasAvailableTags && (
            <div className="help-text">
              <p>Click on any tag below to add it to this document.</p>
            </div>
          )}

          {hasSelectedTags && !hasAvailableTags && (
            <div className="help-text">
              <p>All available tags are applied to this document.</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div className="tag-summary">
            {hasSelectedTags && (
              <span className="tag-count">
                {entityTags.length} tag{entityTags.length !== 1 ? 's' : ''} applied
              </span>
            )}
          </div>
          <button className="btn btn--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}