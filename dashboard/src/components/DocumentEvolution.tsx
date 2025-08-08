import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { getDocumentEvolution, createDocumentVersion } from '../api';
import type { Document, Event } from '../api';

interface DocumentEvolutionProps {
  projectId: string;
  groupId: string;
  onClose: () => void;
  availableEvents?: Event[];
}

export function DocumentEvolution({ 
  projectId, 
  groupId, 
  onClose, 
  availableEvents = [] 
}: DocumentEvolutionProps) {
  const [evolution, setEvolution] = useState<Record<string, { base: Document | null, versions: Document[] }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedBaseDocument, setSelectedBaseDocument] = useState<Document | null>(null);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);
  const [versionFormData, setVersionFormData] = useState({
    title: '',
    content: '',
    document_type: ''
  });

  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const loadEvolution = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAccessToken();
      const evolutionData = await getDocumentEvolution(projectId, groupId, token);
      setEvolution(evolutionData.evolution);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document evolution');
    } finally {
      setLoading(false);
    }
  }, [projectId, groupId]);

  useEffect(() => {
    loadEvolution();
  }, [loadEvolution]);

  const handleCreateVersion = async (baseDocument: Document, event: Event) => {
    setSelectedBaseDocument(baseDocument);
    setSelectedEvent(event);
    setVersionFormData({
      title: `${baseDocument.title || 'Document'} (${event.name})`,
      content: baseDocument.content || '',
      document_type: baseDocument.document_type || ''
    });
    setIsCreatingVersion(true);
  };

  const handleSubmitVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedBaseDocument || !selectedEvent) return;

    try {
      const token = await getAccessToken();
      await createDocumentVersion(
        projectId,
        selectedEvent.id,
        {
          source_document_id: selectedBaseDocument.id,
          title: versionFormData.title || undefined,
          content: versionFormData.content || undefined,
          document_type: versionFormData.document_type || undefined
        },
        token
      );
      
      setIsCreatingVersion(false);
      setSelectedBaseDocument(null);
      setSelectedEvent(null);
      setVersionFormData({ title: '', content: '', document_type: '' });
      await loadEvolution();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create document version');
    }
  };

  const formatEventTime = (eventTime?: number) => {
    return eventTime != null ? `Time ${eventTime}` : 'No time set';
  };

  const renderDocumentCard = (doc: Document, isBase = false) => (
    <div key={doc.id} className={`document-card ${isBase ? 'base-document' : 'version-document'}`}>
      <div className="document-header">
        <h5 className="document-title">
          {doc.title || 'Untitled'}
          {isBase && <span className="base-indicator">Base</span>}
        </h5>
        {!isBase && doc.events && (
          <span className="event-info">
            Event: {doc.events.name} ({formatEventTime(doc.events.time_start)})
          </span>
        )}
      </div>
      
      {doc.content && (
        <div className="document-content-preview">
          {doc.content.substring(0, 200)}
          {doc.content.length > 200 && '...'}
        </div>
      )}
      
      <div className="document-meta">
        <span>Type: {doc.document_type || 'Default'}</span>
        <span>Created: {new Date(doc.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  );

  const renderVersionCreationButton = (baseDoc: Document) => {
    if (availableEvents.length === 0) return null;

    return (
      <div className="version-actions">
        <details className="version-creator">
          <summary className="btn btn-secondary btn-sm">
            Create New Version
          </summary>
          <div className="event-selector">
            <p>Select an event for this version:</p>
            {availableEvents.map(event => (
              <button
                key={event.id}
                className="event-option"
                onClick={() => handleCreateVersion(baseDoc, event)}
              >
                <strong>{event.name}</strong>
                {event.description && <span className="event-description">{event.description}</span>}
                <span className="event-time">{formatEventTime(event.time_start)}</span>
              </button>
            ))}
          </div>
        </details>
      </div>
    );
  };

  const documentTypes = Object.keys(evolution);

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content document-evolution">
          <div className="modal-header">
            <h3>Document Evolution</h3>
            <button className="modal-close" onClick={onClose}>&times;</button>
          </div>
          <div className="modal-body">
            <div className="loading">Loading evolution timeline...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content document-evolution">
        <div className="modal-header">
          <h3>Document Evolution</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-message">
              {error}
              <button onClick={() => setError(null)}>&times;</button>
            </div>
          )}

          {isCreatingVersion && selectedBaseDocument && selectedEvent && (
            <div className="version-form-overlay">
              <form onSubmit={handleSubmitVersion} className="version-form">
                <h4>Create Version for Event: {selectedEvent.name}</h4>
                <p>Base Document: {selectedBaseDocument.title}</p>
                
                <div className="form-group">
                  <label htmlFor="version-title">Version Title</label>
                  <input
                    id="version-title"
                    type="text"
                    value={versionFormData.title}
                    onChange={(e) => setVersionFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Version title"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="version-type">Document Type</label>
                  <input
                    id="version-type"
                    type="text"
                    value={versionFormData.document_type}
                    onChange={(e) => setVersionFormData(prev => ({ ...prev, document_type: e.target.value }))}
                    placeholder="Document type"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="version-content">Content</label>
                  <textarea
                    id="version-content"
                    value={versionFormData.content}
                    onChange={(e) => setVersionFormData(prev => ({ ...prev, content: e.target.value }))}
                    rows={10}
                    placeholder="Document content"
                  />
                </div>

                <div className="form-actions">
                  <button 
                    type="button" 
                    onClick={() => setIsCreatingVersion(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Create Version
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="evolution-content">
            {documentTypes.length === 0 ? (
              <p className="empty-state">
                No document evolution data found for this group.
              </p>
            ) : (
              <div className="document-types">
                {documentTypes.map(docType => {
                  const { base, versions } = evolution[docType];
                  
                  return (
                    <div key={docType} className="document-type-group">
                      <h4 className="document-type-title">
                        Type: {docType}
                        <span className="version-count">
                          {versions.length + (base ? 1 : 0)} version{versions.length + (base ? 1 : 0) !== 1 ? 's' : ''}
                        </span>
                      </h4>
                      
                      <div className="evolution-timeline">
                        {base && (
                          <div className="evolution-stage base-stage">
                            <div className="stage-header">
                              <h5>Base Version</h5>
                              {renderVersionCreationButton(base)}
                            </div>
                            {renderDocumentCard(base, true)}
                          </div>
                        )}
                        
                        {versions.length > 0 && (
                          <div className="evolution-stage versions-stage">
                            <div className="stage-header">
                              <h5>Event Versions ({versions.length})</h5>
                            </div>
                            <div className="versions-list">
                              {versions.map(version => renderDocumentCard(version))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}