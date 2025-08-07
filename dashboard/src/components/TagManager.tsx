import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { getTags, createTag, updateTag, deleteTag } from '../api';
import type { Tag } from '../api';

interface TagManagerProps {
  projectId: string;
  onClose: () => void;
}

interface TagFormData {
  name: string;
  color: string;
}

const TAG_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet  
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6b7280', // Gray
];

export function TagManager({ projectId, onClose }: TagManagerProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [formData, setFormData] = useState<TagFormData>({ name: '', color: TAG_COLORS[0] });

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
      setError(err instanceof Error ? err.message : 'Failed to load tags');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const handleCreateTag = async () => {
    if (!formData.name.trim()) {
      setError('Tag name is required');
      return;
    }

    try {
      const token = await getAccessToken();
      const newTag = await createTag(projectId, formData.name.trim(), formData.color, token);
      setTags([...tags, newTag]);
      setFormData({ name: '', color: TAG_COLORS[0] });
      setIsCreating(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tag');
    }
  };

  const handleUpdateTag = async () => {
    if (!editingTag || !formData.name.trim()) {
      setError('Tag name is required');
      return;
    }

    try {
      const token = await getAccessToken();
      const updatedTag = await updateTag(projectId, editingTag.id, {
        name: formData.name.trim(),
        color: formData.color
      }, token);
      setTags(tags.map(tag => tag.id === updatedTag.id ? updatedTag : tag));
      setEditingTag(null);
      setFormData({ name: '', color: TAG_COLORS[0] });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tag');
    }
  };

  const handleDeleteTag = async (tag: Tag) => {
    if (!confirm(`Are you sure you want to delete the tag "${tag.name}"? This will remove it from all documents.`)) {
      return;
    }

    try {
      const token = await getAccessToken();
      await deleteTag(projectId, tag.id, token);
      setTags(tags.filter(t => t.id !== tag.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tag');
    }
  };

  const startEdit = (tag: Tag) => {
    setEditingTag(tag);
    setFormData({ name: tag.name, color: tag.color });
    setIsCreating(false);
  };

  const cancelEdit = () => {
    setEditingTag(null);
    setIsCreating(false);
    setFormData({ name: '', color: TAG_COLORS[0] });
    setError(null);
  };

  const startCreate = () => {
    setIsCreating(true);
    setEditingTag(null);
    setFormData({ name: '', color: TAG_COLORS[0] });
    setError(null);
  };

  if (loading) return <div className="loading">Loading tags...</div>;

  return (
    <div className="modal-overlay">
      <div className="modal-content tag-manager-modal">
        <div className="modal-header">
          <h3>Manage Tags</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-message">
              {error}
              <button onClick={() => setError(null)}>×</button>
            </div>
          )}

          {/* Create/Edit Form */}
          {(isCreating || editingTag) && (
            <div className="tag-form">
              <h4>{editingTag ? 'Edit Tag' : 'Create New Tag'}</h4>
              
              <div className="form-group">
                <label className="form-label">
                  Name:
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter tag name"
                    maxLength={50}
                  />
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">Color:</label>
                <div className="color-picker">
                  {TAG_COLORS.map(color => (
                    <button
                      key={color}
                      className={`color-option ${formData.color === color ? 'selected' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData(prev => ({ ...prev, color }))}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              <div className="tag-preview">
                <span 
                  className="tag-badge"
                  style={{ backgroundColor: formData.color, color: 'white' }}
                >
                  {formData.name || 'Preview'}
                </span>
              </div>

              <div className="form-actions">
                <button 
                  className="btn btn--primary" 
                  onClick={editingTag ? handleUpdateTag : handleCreateTag}
                  disabled={!formData.name.trim()}
                >
                  {editingTag ? 'Update' : 'Create'}
                </button>
                <button className="btn btn--secondary" onClick={cancelEdit}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Tags List */}
          <div className="tags-section">
            <div className="tags-header">
              <h4>Project Tags ({tags.length})</h4>
              {!isCreating && !editingTag && (
                <button className="btn btn--primary btn--sm" onClick={startCreate}>
                  + New Tag
                </button>
              )}
            </div>

            {tags.length === 0 ? (
              <div className="empty-state">
                <p>No tags created yet.</p>
                <p>Tags help organize and filter your documents.</p>
              </div>
            ) : (
              <div className="tags-list">
                {tags.map(tag => (
                  <div key={tag.id} className="tag-item">
                    <span 
                      className="tag-badge"
                      style={{ backgroundColor: tag.color, color: 'white' }}
                    >
                      {tag.name}
                    </span>
                    
                    <div className="tag-actions">
                      <button 
                        className="btn btn--sm"
                        onClick={() => startEdit(tag)}
                        disabled={isCreating || !!editingTag}
                      >
                        Edit
                      </button>
                      <button 
                        className="btn btn--sm btn--danger"
                        onClick={() => handleDeleteTag(tag)}
                        disabled={isCreating || !!editingTag}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn--secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}