import { useState, useEffect, useRef } from 'react';
import type { Tag } from '../api';
import { getTags, addTagsToDocument, removeTagFromDocument } from '../api';
import { supabase } from '../supabaseClient';
import { DraggableItem } from './dnd/DraggableItem';

interface InlineTagManagerProps {
  projectId: string;
  documentId: string;
  currentTags: Tag[];
  onTagUpdate?: (documentId: string, tagIds: string[]) => void;
  createOnly?: boolean;
  placeholder?: string;
}

export function InlineTagManager({ 
  projectId, 
  documentId, 
  currentTags, 
  onTagUpdate,
  createOnly = false,
  placeholder = "Type tag name..."
}: InlineTagManagerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [filteredTags, setFilteredTags] = useState<Tag[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load available tags
  useEffect(() => {
    const loadTags = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        
        const tags = await getTags(projectId, session.access_token);
        setAvailableTags(tags);
      } catch (error) {
        console.error('Failed to load tags:', error);
      }
    };
    
    loadTags();
  }, [projectId]);

  // Filter tags based on input
  useEffect(() => {
    if (inputValue.length >= 3) {
      const filtered = availableTags.filter(tag => 
        tag.name.toLowerCase().includes(inputValue.toLowerCase()) &&
        !currentTags.some(currentTag => currentTag.id === tag.id)
      );
      setFilteredTags(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [inputValue, availableTags, currentTags]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    
    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSuggestions]);

  const handleAddTag = async (tag: Tag) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      
      if (!createOnly) {
        await addTagsToDocument(projectId, documentId, [tag.id], session.access_token);
        
        if (onTagUpdate) {
          onTagUpdate(documentId, [...currentTags.map(t => t.id), tag.id]);
        }
      } else {
        // For create-only mode, just trigger the update callback
        if (onTagUpdate) {
          onTagUpdate('', []); // Signal that tags list should be refreshed
        }
      }
      
      setInputValue('');
      setShowSuggestions(false);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to add tag:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAndAddTag = async () => {
    const tagName = inputValue.trim();
    if (!tagName) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      
      // Create new tag
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/tags/${projectId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          name: tagName,
          color: '#' + Math.floor(Math.random()*16777215).toString(16) // Random color
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create tag');
      }
      
      const { tag: newTag } = await response.json();
      
      // Add to document only if not create-only mode
      if (!createOnly) {
        await addTagsToDocument(projectId, documentId, [newTag.id], session.access_token);
        
        if (onTagUpdate) {
          onTagUpdate(documentId, [...currentTags.map(t => t.id), newTag.id]);
        }
      } else {
        // For create-only mode, just trigger the update callback
        if (onTagUpdate) {
          onTagUpdate('', []); // Signal that tags list should be refreshed
        }
      }
      
      // Update available tags
      setAvailableTags(prev => [...prev, newTag]);
      setInputValue('');
      setShowSuggestions(false);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to create and add tag:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      
      await removeTagFromDocument(projectId, documentId, tagId, session.access_token);
      
      if (onTagUpdate) {
        const newTagIds = currentTags.filter(t => t.id !== tagId).map(t => t.id);
        onTagUpdate(documentId, newTagIds);
      }
    } catch (error) {
      console.error('Failed to remove tag:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredTags.length > 0) {
        handleAddTag(filteredTags[0]);
      } else if (inputValue.trim()) {
        handleCreateAndAddTag();
      }
    } else if (e.key === 'Escape') {
      setInputValue('');
      setShowSuggestions(false);
      setIsEditing(false);
    }
  };

  return (
    <div className="inline-tag-manager">
      <div className="inline-tag-manager__tags">
        {!createOnly && currentTags.map(tag => (
          <DraggableItem
            key={tag.id}
            id={`tag-${tag.id}`}
            type="tag"
            item={tag}
          >
            <div
              className="inline-tag-badge"
              style={{ backgroundColor: tag.color, color: 'white' }}
            >
              <span>{tag.name}</span>
              <button
                className="inline-tag-badge__remove"
                onClick={() => handleRemoveTag(tag.id)}
                disabled={loading}
                title="Remove tag"
              >
                ×
              </button>
            </div>
          </DraggableItem>
        ))}
        
        {isEditing ? (
          <div className="inline-tag-input-container">
            <input
              ref={inputRef}
              type="text"
              className="inline-tag-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              autoFocus
              disabled={loading}
            />
            
            {showSuggestions && filteredTags.length > 0 && (
              <div ref={suggestionsRef} className="inline-tag-suggestions">
                {filteredTags.map(tag => (
                  <button
                    key={tag.id}
                    className="inline-tag-suggestion"
                    onClick={() => handleAddTag(tag)}
                    disabled={loading}
                  >
                    <span 
                      className="inline-tag-suggestion__color"
                      style={{ backgroundColor: tag.color }}
                    ></span>
                    {tag.name}
                  </button>
                ))}
                {inputValue.trim() && !filteredTags.some(t => t.name.toLowerCase() === inputValue.toLowerCase()) && (
                  <button
                    className="inline-tag-suggestion inline-tag-suggestion--create"
                    onClick={handleCreateAndAddTag}
                    disabled={loading}
                  >
                    + Create "{inputValue}"
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <button 
            className={`inline-tag-add-btn ${createOnly ? 'inline-tag-add-btn--create-only' : ''}`}
            onClick={() => setIsEditing(true)}
            disabled={loading}
            title={createOnly ? 'Create new tag' : 'Add tag'}
          >
            {createOnly ? '+ Create Tag' : '+'}
          </button>
        )}
      </div>
    </div>
  );
}