import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { Document, Event } from '../api';

interface DocumentEvolutionProps {
  projectId: string;
  document: Document;
  onClose: () => void;
}

export function DocumentEvolution({ 
  projectId, 
  document,
  onClose
}: DocumentEvolutionProps) {
  const [groupDocuments, setGroupDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Remove unused getAccessToken function since we're using direct Supabase queries

  const loadGroupDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // If document has no group_id, it has no derivatives
      if (!document.group_id) {
        setGroupDocuments([document]);
        setLoading(false);
        return;
      }

      // Load all documents in the same group
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
        .eq('group_id', document.group_id)
        .order('created_at', { ascending: true });

      if (queryError) throw queryError;

      setGroupDocuments(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document group');
    } finally {
      setLoading(false);
    }
  }, [projectId, document.group_id]);

  useEffect(() => {
    loadGroupDocuments();
  }, [loadGroupDocuments]);

  const getDocumentEvents = (doc: any): Event[] => {
    return (doc.event_documents || [])
      .map((ed: any) => ed.events)
      .filter(Boolean) as Event[];
  };

  const hasEvolution = groupDocuments.length > 1 || 
    groupDocuments.some(doc => getDocumentEvents(doc).length > 0);

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="modal-header">
            <h3>Document Evolution</h3>
            <button className="modal-close" onClick={onClose}>&times;</button>
          </div>
          <div className="modal-body">
            <div className="loading">Loading evolution...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content document-evolution">
        <div className="modal-header">
          <h3>Document Evolution - {document.title}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-message">
              {error}
              <button onClick={() => setError(null)}>&times;</button>
            </div>
          )}

          <div className="evolution-info">
            <p>
              Showing all documents in the same group {document.group_id ? 
                `(${document.group_id.substring(0, 8)}...)` : 
                '(no group)'
              } and their event associations.
            </p>
          </div>

          {!hasEvolution ? (
            <div className="empty-state">
              <h4>No Evolution Found</h4>
              <p>This document has no derivatives or event associations.</p>
              <p>Create derivative documents and associate them with events to track evolution.</p>
            </div>
          ) : (
            <div className="evolution-list">
              <h4>Document Group ({groupDocuments.length} documents)</h4>
              
              {groupDocuments.map((doc) => {
                const events = getDocumentEvents(doc);
                const isOriginal = doc.id === document.id;
                
                return (
                  <div key={doc.id} className={`evolution-item ${isOriginal ? 'original' : 'derivative'}`}>
                    <div className="evolution-document">
                      <h5>
                        {doc.title}
                        {isOriginal && <span className="original-badge">Original</span>}
                      </h5>
                      <p className="document-type">Type: {doc.document_type || 'No type'}</p>
                      <p className="document-meta">
                        Created: {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="evolution-events">
                      {events.length === 0 ? (
                        <p className="no-events">No events associated</p>
                      ) : (
                        <div className="event-associations">
                          <h6>Associated Events ({events.length})</h6>
                          {events.map((event) => (
                            <div key={event.id} className="event-badge">
                              <strong>{event.name}</strong>
                              {event.time_start && (
                                <span className="event-time">T{event.time_start}</span>
                              )}
                              {event.description && (
                                <p className="event-description">{event.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="modal-footer">
            <button onClick={onClose} className="btn btn-primary">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}