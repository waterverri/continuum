import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { getTags, getDocumentTags, addTagsToDocument, removeTagFromDocument } from '../api';
import type { Tag } from '../api';

interface TagSelectorProps {
  projectId: string;
  documentId: string;
  onClose: () => void;
}

export function TagSelector({ projectId, documentId, onClose }: TagSelectorProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [documentTags, setDocumentTags] = useState<Tag[]>([]);
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
      
      const [allTagsData, docTagsData] = await Promise.all([
        getTags(projectId, token),
        getDocumentTags(projectId, documentId, token)
      ]);
      
      setAllTags(allTagsData);
      setDocumentTags(docTagsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tags');
    } finally {
      setLoading(false);
    }
  }, [projectId, documentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isTagSelected = (tagId: string) => {
    return documentTags.some(tag => tag.id === tagId);
  };

  const handleTagToggle = async (tag: Tag) => {
    try {
      const token = await getAccessToken();
      const isSelected = isTagSelected(tag.id);
      
      if (isSelected) {
        // Remove tag
        await removeTagFromDocument(projectId, documentId, tag.id, token);
        setDocumentTags(documentTags.filter(t => t.id !== tag.id));
      } else {
        // Add tag
        await addTagsToDocument(projectId, documentId, [tag.id], token);
        setDocumentTags([...documentTags, tag]);
      }
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tag');
    }
  };

  const availableTags = allTags.filter(tag => !isTagSelected(tag.id));
  const hasAvailableTags = availableTags.length > 0;
  const hasSelectedTags = documentTags.length > 0;

  if (loading) return <div className="loading">Loading tags...</div>;

  return (
    <div className="modal-overlay">
      <div className="modal-content tag-selector-modal">
        <div className="modal-header">
          <h3>Document Tags</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-message">
              {error}
              <button onClick={() => setError(null)}>×</button>
            </div>
          )}

          {/* Selected Tags */}
          {hasSelectedTags && (
            <div className="tags-section">
              <h4>Applied Tags ({documentTags.length})</h4>
              <div className="tags-grid">
                {documentTags.map(tag => (
                  <div key={tag.id} className="tag-item selectable selected">
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
                  <div key={tag.id} className="tag-item selectable" onClick={() => handleTagToggle(tag)}>
                    <span 
                      className="tag-badge"
                      style={{ backgroundColor: tag.color, color: 'white' }}
                    >
                      {tag.name}
                    </span>
                    <span className="tag-add">+</span>
                  </div>
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
                {documentTags.length} tag{documentTags.length !== 1 ? 's' : ''} applied
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