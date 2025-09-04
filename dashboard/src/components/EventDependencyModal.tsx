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
    rule: '',
    dependencyType: 'start' as 'start' | 'end',
    isDuration: false
  });

  // Load existing dependencies
  const loadDependencies = useCallback(async () => {
    if (!isOpen || !event.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Load dependencies directly with supabase client
      const { data: dependencies, error: depsError } = await supabase
        .from('event_dependencies')
        .select(`
          *,
          source_event:events!source_event_id(*)
        `)
        .eq('dependent_event_id', event.id);
      
      if (depsError) {
        throw new Error(`Failed to load dependencies: ${depsError.message}`);
      }
      
      setDependencies(dependencies || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dependencies');
    } finally {
      setLoading(false);
    }
  }, [isOpen, event.id]);

  useEffect(() => {
    if (isOpen) {
      loadDependencies();
      setShowAddForm(false);
      setNewDependency({ sourceEventId: '', rule: '', dependencyType: 'start', isDuration: false });
    }
  }, [isOpen, loadDependencies]);

  // Create new dependency
  const handleCreateDependency = async () => {
    if ((!newDependency.sourceEventId && !newDependency.isDuration) || !newDependency.rule.trim()) {
      setError(newDependency.isDuration ? 'Please enter a duration rule' : 'Please select a source event and enter a dependency rule');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Step 1: Validate the rule
      const sourceEvent = events.find(e => e.id === newDependency.sourceEventId);
      const validationResponse = await fetch(`${API_URL}/api/events/validate-dependency-rule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          rule: newDependency.rule.trim(),
          source_event_start: sourceEvent?.time_start,
          source_event_end: sourceEvent?.time_end,
          dependent_event_id: event.id,
          source_event_id: newDependency.sourceEventId,
          project_id: projectId,
          dependency_type: newDependency.dependencyType,
          is_duration: newDependency.isDuration
        })
      });
      
      if (!validationResponse.ok) {
        const validationError = await validationResponse.json();
        throw new Error(validationError.error || 'Invalid dependency rule');
      }
      
      
      // Step 2: Create dependency directly with supabase client
      const insertData: any = {
        dependent_event_id: event.id,
        dependency_rule: newDependency.rule.trim(),
        dependency_type: newDependency.dependencyType,
        is_duration: newDependency.isDuration
      };
      
      // Only set source_event_id for non-duration dependencies
      if (!newDependency.isDuration) {
        insertData.source_event_id = newDependency.sourceEventId;
      }
      
      const { error: insertError } = await supabase
        .from('event_dependencies')
        .insert(insertData);
      
      if (insertError) {
        throw new Error(`Failed to create dependency: ${insertError.message}`);
      }
      
      
      // Step 3: Trigger recalculation
      const recalcResponse = await fetch(`${API_URL}/api/events/${projectId}/${event.id}/recalculate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });
      
      if (!recalcResponse.ok) {
        console.warn('Dependency created but recalculation failed');
      }
      
      await loadDependencies();
      setShowAddForm(false);
      setNewDependency({ sourceEventId: '', rule: '', dependencyType: 'start', isDuration: false });
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
      // Delete directly with supabase client
      const { error: deleteError } = await supabase
        .from('event_dependencies')
        .delete()
        .eq('id', dependencyId);
      
      if (deleteError) {
        throw new Error(`Failed to delete dependency: ${deleteError.message}`);
      }
      
      // Trigger recalculation after deletion
      const recalcResponse = await fetch(`${API_URL}/api/events/${projectId}/${event.id}/recalculate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });
      
      if (!recalcResponse.ok) {
        console.warn('Dependency deleted but recalculation failed');
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

  // Example rules for user reference - context-aware
  const getExampleRules = () => {
    if (newDependency.isDuration) {
      return [
        '3 days',
        '1 week',
        '2 weeks',
        '5 business days',
        '1 month',
        '10 days'
      ];
    } else if (newDependency.dependencyType === 'start') {
      return [
        '2 days after {source.end}',
        'first Monday after {source.end}',
        '1 week before {source.start}',
        '3 business days after {source.end}',
        'same day as {source.start}',
        'last Friday before {source.start}'
      ];
    } else {
      return [
        '1 day after {source.end}',
        'same day as {source.end}',
        '3 days after {source.start}',
        'first Friday after {source.end}',
        '1 week after {source.start}',
        'next business day after {source.end}'
      ];
    }
  };

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
                  <div className="dependencies-sections">
                    {/* Start Dependencies */}
                    <div className="dependency-type-section">
                      <h4>Start Time Dependencies</h4>
                      {dependencies.filter(dep => dep.dependency_type === 'start').map((dep) => (
                        <div key={dep.id} className="dependency-card">
                          <div className="dependency-header">
                            <div className="dependency-info">
                              <span className="dependency-type-badge start">Start</span>
                              {dep.is_duration ? (
                                <span className="source-event-name">Duration Rule</span>
                              ) : (
                                <span className="source-event-name">
                                  {getSourceEventName(dep.source_event_id)}
                                </span>
                              )}
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
                      {dependencies.filter(dep => dep.dependency_type === 'start').length === 0 && (
                        <p className="no-dependencies">No start dependencies configured.</p>
                      )}
                    </div>

                    {/* End Dependencies */}
                    <div className="dependency-type-section">
                      <h4>End Time Dependencies</h4>
                      {dependencies.filter(dep => dep.dependency_type === 'end').map((dep) => (
                        <div key={dep.id} className="dependency-card">
                          <div className="dependency-header">
                            <div className="dependency-info">
                              <span className="dependency-type-badge end">End</span>
                              {dep.is_duration ? (
                                <span className="source-event-name">Duration Rule</span>
                              ) : (
                                <span className="source-event-name">
                                  {getSourceEventName(dep.source_event_id)}
                                </span>
                              )}
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
                      {dependencies.filter(dep => dep.dependency_type === 'end').length === 0 && (
                        <p className="no-dependencies">No end dependencies configured.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Add New Dependency Form */}
              {showAddForm && (
                <div className="add-dependency-form">
                  <h3>Add New Dependency</h3>
                  
                  <div className="form-group">
                    <label>Dependency Type</label>
                    <select
                      value={newDependency.dependencyType}
                      onChange={(e) => setNewDependency(prev => ({ 
                        ...prev, 
                        dependencyType: e.target.value as 'start' | 'end',
                        isDuration: false, // Reset duration when type changes
                        sourceEventId: '', // Reset source when type changes
                        rule: '' // Reset rule when type changes
                      }))}
                      className="form-control"
                    >
                      <option value="start">Start Time</option>
                      <option value="end">End Time</option>
                    </select>
                  </div>

                  {newDependency.dependencyType === 'end' && (
                    <div className="form-group">
                      <label>Rule Type</label>
                      <div className="radio-group">
                        <label className="radio-option">
                          <input
                            type="radio"
                            name="ruleType"
                            checked={!newDependency.isDuration}
                            onChange={() => setNewDependency(prev => ({ 
                              ...prev, 
                              isDuration: false,
                              sourceEventId: '',
                              rule: ''
                            }))}
                          />
                          <span>Natural Language (relative to another event)</span>
                        </label>
                        <label className="radio-option">
                          <input
                            type="radio"
                            name="ruleType"
                            checked={newDependency.isDuration}
                            onChange={() => setNewDependency(prev => ({ 
                              ...prev, 
                              isDuration: true,
                              sourceEventId: '',
                              rule: ''
                            }))}
                          />
                          <span>Duration (from start time)</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {!newDependency.isDuration && (
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
                  )}

                  <div className="form-group">
                    <label>
                      {newDependency.isDuration ? 'Duration Rule' : 'Dependency Rule'}
                    </label>
                    <input
                      type="text"
                      value={newDependency.rule}
                      onChange={(e) => setNewDependency(prev => ({ ...prev, rule: e.target.value }))}
                      className="form-control"
                      placeholder={
                        newDependency.isDuration 
                          ? "e.g., 3 days, 2 weeks, 5 business days"
                          : "e.g., 2 days after {source.end}"
                      }
                    />
                    <div className="form-help">
                      {newDependency.isDuration 
                        ? 'Specify how long this event lasts from its start time.'
                        : 'Use natural language to describe when this event should occur relative to the source event.'
                      }
                    </div>
                  </div>

                  <div className="example-rules">
                    <h4>Example {newDependency.isDuration ? 'Durations' : 'Rules'}</h4>
                    <div className="examples-list">
                      {getExampleRules().map((rule, index) => (
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