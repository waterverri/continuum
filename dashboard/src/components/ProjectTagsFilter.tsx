import { useState, useEffect, useRef } from 'react';
import type { Tag } from '../api';
import { supabase } from '../supabaseClient';

interface ProjectTagsFilterProps {
  projectId: string;
  tags: Tag[];
  onTagCreated: () => void;
  onFilterChange: (filteredTags: Tag[]) => void;
}

export function ProjectTagsFilter({ 
  projectId, 
  tags, 
  onTagCreated,
  onFilterChange
}: ProjectTagsFilterProps) {
  const [inputValue, setInputValue] = useState('');
  const [showCreateOption, setShowCreateOption] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Filter tags and notify parent when input changes
  useEffect(() => {
    if (inputValue.trim()) {
      const filtered = tags.filter(tag => 
        tag.name.toLowerCase().includes(inputValue.toLowerCase())
      );
      onFilterChange(filtered);
      
      // Show create option if no exact match exists  
      const exactMatch = tags.some(tag => 
        tag.name.toLowerCase() === inputValue.toLowerCase()
      );
      setShowCreateOption(!exactMatch && inputValue.trim().length > 0);
      setShowSuggestions(showCreateOption); // Only show dropdown if there's a create option
    } else {
      onFilterChange(tags);
      setShowCreateOption(false);
      setShowSuggestions(false);
    }
  }, [inputValue, tags, onFilterChange]);

  // Update showSuggestions when showCreateOption changes
  useEffect(() => {
    setShowSuggestions(showCreateOption);
  }, [showCreateOption]);

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

  const handleCreateTag = async () => {
    const tagName = inputValue.trim();
    if (!tagName) return;
    
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      
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
      
      setInputValue('');
      setShowSuggestions(false);
      onTagCreated(); // Refresh the tags list
    } catch (error) {
      console.error('Failed to create tag:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showCreateOption) {
        handleCreateTag();
      }
    } else if (e.key === 'Escape') {
      setInputValue('');
      setShowSuggestions(false);
    }
  };

  return (
    <div className="project-tags-filter">
      <div className="project-tags-filter__input-container">
        <input
          ref={inputRef}
          type="text"
          className="project-tags-filter__input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (showCreateOption) {
              setShowSuggestions(true);
            }
          }}
          placeholder="Filter tags or type to create..."
          disabled={loading}
        />
        
        {showSuggestions && showCreateOption && (
          <div ref={suggestionsRef} className="project-tags-filter__suggestions">
            <div className="project-tags-filter__section">
              <button
                className="project-tags-filter__create"
                onClick={handleCreateTag}
                disabled={loading}
              >
                + Create "{inputValue}"
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}