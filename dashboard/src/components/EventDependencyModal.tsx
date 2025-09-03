import { useState, useEffect, useCallback } from 'react';
import type { Event, EventDependency } from '../api';
import { supabase } from '../supabaseClient';

const API_URL = import.meta.env.VITE_API_URL;

interface EventDependencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event;
  projectId: string;
  onDependencyChange: () => void;
  events: Event[]; // All events in the project for selection
}

export default function EventDependencyModal({
  isOpen,
  onClose,
  event,
  projectId,
  onDependencyChange,
  events
}: EventDependencyModalProps) {
  const [dependencies, setDependencies] = useState<EventDependency[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDependency, setNewDependency] = useState({
    sourceEventId: '',
    rule: ''
  });

  // Load existing dependencies
  const loadDependencies = useCallback(async () => {
    if (!isOpen || !event.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/api/events/${projectId}/${event.id}/dependencies`, {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });
      
      if (!response.ok) {
        const responseText = await response.text();
        console.error('API Response:', response.status, responseText);
        throw new Error(`Failed to load dependencies: ${response.status} - ${responseText.substring(0, 200)}`);
      }
      
      const data = await response.json();
      setDependencies(data.dependencies || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dependencies');
    } finally {
      setLoading(false);
    }
  }, [isOpen, event.id, projectId]);

  useEffect(() => {
    if (isOpen) {
      loadDependencies();
      setShowAddForm(false);
      setNewDependency({ sourceEventId: '', rule: '' });
    }
  }, [isOpen, loadDependencies]);

  // Create new dependency
  const handleCreateDependency = async () => {
    if (!newDependency.sourceEventId || !newDependency.rule.trim()) {
      setError('Please select a source event and enter a dependency rule');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/api/events/${projectId}/${event.id}/dependencies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          source_event_id: newDependency.sourceEventId,
          dependency_rule: newDependency.rule.trim()
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create dependency');
      }
      
      await loadDependencies();
      setShowAddForm(false);
      setNewDependency({ sourceEventId: '', rule: '' });
      onDependencyChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create dependency');
    } finally {
      setLoading(false);
    }
  };

  // Delete dependency
  const handleDeleteDependency = async (dependencyId: string) => {
    if (!confirm('Are you sure you want to delete this dependency?')) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/api/events/${projectId}/${event.id}/dependencies/${dependencyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete dependency');
      }
      
      await loadDependencies();
      onDependencyChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete dependency');
    } finally {
      setLoading(false);
    }
  };

  // Recalculate event dates
  const handleRecalculate = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/api/events/${projectId}/${event.id}/recalculate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to recalculate dates');
      }
      
      onDependencyChange(); // This should refresh the parent component
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to recalculate dates');
    } finally {
      setLoading(false);
    }
  };

  const availableSourceEvents = events.filter(e => e.id !== event.id);

  const getSourceEventName = (sourceEventId: string) => {
    const sourceEvent = events.find(e => e.id === sourceEventId);
    return sourceEvent?.name || 'Unknown Event';
  };

  // Example rules for user reference
  const exampleRules = [
    '2 days after {source.end}',
    'first Monday after {source.end}',
    '1 week before {source.start}',
    '3 business days after {source.end}',
    'same day as {source.start} but next week',
    'last Friday before {source.start}'
  ];

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Event Dependencies</h2>
          <div className="modal-header-subtitle">
            {event.name}
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {loading && (
            <div className="loading-message">Loading...</div>
          )}

          {!loading && (
            <>
              {/* Existing Dependencies */}
              <div className="dependencies-section">
                <div className="section-header">
                  <h3>Current Dependencies</h3>
                  <div className="section-actions">
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={handleRecalculate}
                      disabled={loading}
                    >
                      Recalculate Dates
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() => setShowAddForm(true)}
                      disabled={loading}
                    >
                      Add Dependency
                    </button>
                  </div>
                </div>

                {dependencies.length === 0 ? (
                  <div className="empty-state">
                    <p>No dependencies configured. This event's dates can be set manually.</p>
                  </div>
                ) : (
                  <div className="dependencies-list">
                    {dependencies.map((dep) => (
                      <div key={dep.id} className="dependency-card">
                        <div className="dependency-header">
                          <div className="dependency-info">
                            <span className="source-event-name">
                              {getSourceEventName(dep.source_event_id)}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn btn--danger btn--sm"
                            onClick={() => handleDeleteDependency(dep.id)}
                            disabled={loading}
                          >
                            Delete
                          </button>
                        </div>
                        <div className="dependency-rule">
                          <code>{dep.dependency_rule}</code>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Dependency Form */}
              {showAddForm && (
                <div className="add-dependency-form">
                  <h3>Add New Dependency</h3>
                  
                  <div className="form-group">
                    <label>Source Event</label>
                    <select
                      value={newDependency.sourceEventId}
                      onChange={(e) => setNewDependency(prev => ({ ...prev, sourceEventId: e.target.value }))}
                      className="form-control"
                    >
                      <option value="">Select an event...</option>
                      {availableSourceEvents.map(sourceEvent => (
                        <option key={sourceEvent.id} value={sourceEvent.id}>
                          {sourceEvent.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Dependency Rule</label>
                    <input
                      type="text"
                      value={newDependency.rule}
                      onChange={(e) => setNewDependency(prev => ({ ...prev, rule: e.target.value }))}
                      className="form-control"
                      placeholder="e.g., 2 days after {source.end}"
                    />
                    <div className="form-help">
                      Use natural language to describe when this event should occur relative to the source event.
                    </div>
                  </div>

                  <div className="example-rules">
                    <h4>Example Rules</h4>
                    <div className="examples-list">
                      {exampleRules.map((rule, index) => (
                        <button
                          key={index}
                          type="button"
                          className="example-rule"
                          onClick={() => setNewDependency(prev => ({ ...prev, rule }))}
                        >
                          <code>{rule}</code>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() => setShowAddForm(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={handleCreateDependency}
                      disabled={loading}
                    >
                      Create Dependency
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}