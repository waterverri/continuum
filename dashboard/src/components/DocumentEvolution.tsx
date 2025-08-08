import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Document, Event } from '../api';

interface DocumentEvolutionProps {
  projectId: string;
  document: Document;
  onClose: () => void;
  onShowDocument?: (document: Document) => void;
  onEditDocument?: (document: Document) => void;
}

interface EvolutionStep {
  document: Document;
  event: Event | null;
  eventTime: number | null;
}

export function DocumentEvolution({ 
  projectId, 
  document,
  onClose,
  onShowDocument,
  onEditDocument
}: DocumentEvolutionProps) {
  const [evolutionSteps, setEvolutionSteps] = useState<EvolutionStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvolutionTimeline = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // If document has no group_id, it has no derivatives
      if (!document.group_id) {
        setEvolutionSteps([{
          document,
          event: null,
          eventTime: null
        }]);
        setLoading(false);
        return;
      }

      // Load all documents in the same group with their events
      const { data, error: queryError } = await supabase
        .from('documents')
        .select(`
          *,
          event_documents (
            event_id,
            events (
              id,
              name,
              description,
              time_start,
              time_end,
              display_order
            )
          )
        `)
        .eq('project_id', projectId)
        .eq('group_id', document.group_id);

      if (queryError) throw queryError;

      // Transform documents into evolution steps ordered by event time
      const steps: EvolutionStep[] = [];
      
      for (const doc of data || []) {
        const events = (doc.event_documents || [])
          .map((ed: any) => ed.events)
          .filter(Boolean) as Event[];
        
        if (events.length === 0) {
          // Document with no events - add as step with no event
          steps.push({
            document: doc,
            event: null,
            eventTime: null
          });
        } else {
          // Document with events - create step for each event
          events.forEach(event => {
            steps.push({
              document: doc,
              event: event,
              eventTime: event.time_start || null
            });
          });
        }
      }

      // Sort by event time (null values at the end), then by document creation time
      steps.sort((a, b) => {
        if (a.eventTime === null && b.eventTime === null) {
          return new Date(a.document.created_at).getTime() - new Date(b.document.created_at).getTime();
        }
        if (a.eventTime === null) return 1;
        if (b.eventTime === null) return -1;
        if (a.eventTime !== b.eventTime) {
          return a.eventTime - b.eventTime;
        }
        // Same event time, sort by document creation
        return new Date(a.document.created_at).getTime() - new Date(b.document.created_at).getTime();
      });

      setEvolutionSteps(steps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document evolution');
    } finally {
      setLoading(false);
    }
  }, [projectId, document.group_id]);

  useEffect(() => {
    loadEvolutionTimeline();
  }, [loadEvolutionTimeline]);

  const handleShowDocument = (doc: Document) => {
    if (onShowDocument) {
      onShowDocument(doc);
    }
    onClose();
  };

  const handleEditDocument = (doc: Document) => {
    if (onEditDocument) {
      onEditDocument(doc);
    }
    onClose();
  };

  const handleDocumentMenu = (doc: Document, event?: React.MouseEvent) => {
    // Show document context menu
    if (event) {
      event.preventDefault();
    }
    // This would need to be implemented with a dropdown menu
    console.log('Show menu for document:', doc.title);
  };

  const hasEvolution = evolutionSteps.length > 1;

  if (loading) {
    return (
      <div className="evolution-timeline__loading">
        <div className="loading">Loading evolution timeline...</div>
      </div>
    );
  }

  return (
    <div className="evolution-timeline">
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      <div className="evolution-timeline__header">
        <h4>Evolution Timeline</h4>
        <p className="evolution-timeline__subtitle">
          {hasEvolution 
            ? `${evolutionSteps.length} evolution steps across events` 
            : 'No evolution found - create derivatives and associate them with events'
          }
        </p>
      </div>

      {!hasEvolution ? (
        <div className="empty-state">
          <div className="empty-state__icon">📅</div>
          <h4>No Evolution Found</h4>
          <p>This document has no derivatives or event associations.</p>
          <p>Create derivative documents and associate them with events to track evolution over time.</p>
        </div>
      ) : (
        <div className="evolution-timeline__steps">
          {evolutionSteps.map((step, index) => {
            const isOriginal = step.document.id === document.id;
            const isLast = index === evolutionSteps.length - 1;
            
            return (
              <div key={`${step.document.id}-${step.event?.id || 'no-event'}`} className="evolution-step">
                {/* Timeline connector line */}
                {!isLast && <div className="evolution-step__connector" />}
                
                {/* Timeline dot */}
                <div className={`evolution-step__marker ${isOriginal ? 'evolution-step__marker--original' : ''}`}>
                  {step.event ? '📅' : '📄'}
                </div>
                
                {/* Step content */}
                <div className="evolution-step__content">
                  {/* Event info (if exists) */}
                  {step.event && (
                    <div className="evolution-step__event">
                      <span className="evolution-step__event-name">{step.event.name}</span>
                      {step.eventTime !== null && (
                        <span className="evolution-step__event-time">Time {step.eventTime}</span>
                      )}
                    </div>
                  )}
                  
                  {/* Document card */}
                  <div className="evolution-step__document">
                    <div className="evolution-step__document-header">
                      <h5 className="evolution-step__document-title">
                        {step.document.title}
                        {isOriginal && <span className="original-badge">Original</span>}
                      </h5>
                      <div className="evolution-step__document-type">
                        {step.document.document_type || 'No type'}
                      </div>
                    </div>
                    
                    {/* Action buttons */}
                    <div className="evolution-step__actions">
                      <button 
                        className="btn btn--sm btn--primary"
                        onClick={() => handleShowDocument(step.document)}
                        title="View this document"
                      >
                        Show
                      </button>
                      <button 
                        className="btn btn--sm btn--secondary"
                        onClick={() => handleEditDocument(step.document)}
                        title="Edit this document"
                      >
                        Edit
                      </button>
                      <button 
                        className="btn btn--sm btn--secondary"
                        onClick={(e) => handleDocumentMenu(step.document, e)}
                        title="More options"
                      >
                        Menu
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}