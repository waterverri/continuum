import { useState, useEffect, useCallback } from 'react';
import type { Document, DocumentHistory, DocumentHistoryResponse } from '../api';

interface DocumentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document;
  projectId: string;
  onRollback?: (historyId: string) => Promise<void>;
  loadDocumentHistory: (documentId: string, limit?: number, offset?: number) => Promise<DocumentHistoryResponse>;
  loadHistoryEntry: (documentId: string, historyId: string) => Promise<DocumentHistory>;
}

interface HistoryEntryPreviewProps {
  entry: DocumentHistory;
  isSelected: boolean;
  onClick: () => void;
  onRollback?: (historyId: string) => void;
  canRollback: boolean;
}

function HistoryEntryPreview({ entry, isSelected, onClick, onRollback, canRollback }: HistoryEntryPreviewProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getChangeTypeLabel = (changeType: DocumentHistory['change_type']) => {
    const labels = {
      create: 'Created',
      update_content: 'Content Updated',
      update_title: 'Title Updated', 
      update_type: 'Type Updated',
      update_components: 'Components Updated',
      move_group: 'Moved to Group',
      link_event: 'Linked to Event',
      unlink_event: 'Unlinked from Event',
      delete: 'Deleted'
    };
    return labels[changeType] || changeType;
  };

  const getChangeTypeColor = (changeType: DocumentHistory['change_type']) => {
    const colors = {
      create: '#22c55e',
      update_content: '#3b82f6',
      update_title: '#8b5cf6',
      update_type: '#f59e0b',
      update_components: '#06b6d4',
      move_group: '#84cc16',
      link_event: '#ec4899',
      unlink_event: '#ef4444',
      delete: '#dc2626'
    };
    return colors[changeType] || '#6b7280';
  };

  return (
    <div 
      className={`history-entry ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="history-entry-header">
        <div className="history-entry-meta">
          <span 
            className="change-type-badge"
            style={{ backgroundColor: getChangeTypeColor(entry.change_type) }}
          >
            {getChangeTypeLabel(entry.change_type)}
          </span>
          <span className="history-date">{formatDate(entry.created_at)}</span>
          {entry.profiles?.display_name && (
            <span className="history-author">by {entry.profiles.display_name}</span>
          )}
        </div>
        <div className="history-entry-actions">
          {canRollback && onRollback && (
            <button
              type="button"
              className="button-secondary small"
              onClick={(e) => {
                e.stopPropagation();
                onRollback(entry.id);
              }}
              title="Rollback to this version"
            >
              Rollback
            </button>
          )}
        </div>
      </div>
      
      {entry.change_description && (
        <div className="history-entry-description">
          {entry.change_description}
        </div>
      )}
      
      <div className="history-entry-details">
        <span className="history-detail">Title: {entry.title}</span>
        {entry.document_type && (
          <span className="history-detail">Type: {entry.document_type}</span>
        )}
        {entry.is_composite && (
          <span className="history-detail">Composite Document</span>
        )}
      </div>
    </div>
  );
}

interface HistoryDetailViewProps {
  entry: DocumentHistory;
  onClose: () => void;
}

function HistoryDetailView({ entry, onClose }: HistoryDetailViewProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getChangeTypeLabel = (changeType: DocumentHistory['change_type']) => {
    const labels = {
      create: 'Document Created',
      update_content: 'Content Updated',
      update_title: 'Title Updated',
      update_type: 'Type Updated', 
      update_components: 'Components Updated',
      move_group: 'Moved to Group',
      link_event: 'Linked to Event',
      unlink_event: 'Unlinked from Event',
      delete: 'Document Deleted'
    };
    return labels[changeType] || changeType;
  };

  return (
    <div className="history-detail-view">
      <div className="history-detail-header">
        <div>
          <h3>{getChangeTypeLabel(entry.change_type)}</h3>
          <div className="history-detail-meta">
            <span>{formatDate(entry.created_at)}</span>
            {entry.profiles?.display_name && (
              <span> • by {entry.profiles.display_name}</span>
            )}
          </div>
        </div>
        <button 
          type="button"
          className="button-secondary small"
          onClick={onClose}
        >
          Back to List
        </button>
      </div>
      
      {entry.change_description && (
        <div className="history-detail-description">
          <h4>Change Description</h4>
          <p>{entry.change_description}</p>
        </div>
      )}
      
      <div className="history-detail-snapshot">
        <h4>Document State</h4>
        <div className="document-snapshot">
          <div className="snapshot-field">
            <label>Title:</label>
            <span>{entry.title}</span>
          </div>
          
          {entry.document_type && (
            <div className="snapshot-field">
              <label>Type:</label>
              <span>{entry.document_type}</span>
            </div>
          )}
          
          <div className="snapshot-field">
            <label>Composite:</label>
            <span>{entry.is_composite ? 'Yes' : 'No'}</span>
          </div>
          
          {entry.is_composite && entry.components && (
            <div className="snapshot-field">
              <label>Components:</label>
              <div className="components-list">
                {Object.entries(entry.components).map(([key, value]) => (
                  <div key={key} className="component-item">
                    <code>{key}</code> → <code>{value}</code>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {entry.content && (
            <div className="snapshot-field">
              <label>Content:</label>
              <div className="content-preview">
                <pre>{entry.content.substring(0, 500)}{entry.content.length > 500 ? '...' : ''}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DocumentHistoryModal({ 
  isOpen, 
  onClose, 
  document, 
  projectId: _projectId, // eslint-disable-line @typescript-eslint/no-unused-vars
  onRollback,
  loadDocumentHistory,
  loadHistoryEntry
}: DocumentHistoryModalProps) {
  const [historyData, setHistoryData] = useState<DocumentHistoryResponse | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<DocumentHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [view, setView] = useState<'list' | 'detail'>('list');

  const limit = 20;

  const loadHistory = useCallback(async (pageNum = 0, append = false) => {
    if (!isOpen || !document.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await loadDocumentHistory(
        document.id, 
        limit, 
        pageNum * limit
      );
      
      if (append && historyData) {
        setHistoryData({
          ...response,
          history: [...historyData.history, ...response.history]
        });
      } else {
        setHistoryData(response);
      }
      
      setHasMore(response.history.length === limit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document history');
    } finally {
      setLoading(false);
    }
  }, [isOpen, document.id, loadDocumentHistory, historyData, limit]);

  const loadMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadHistory(nextPage, true);
  }, [page, loadHistory]);

  const handleEntryClick = useCallback(async (entry: DocumentHistory) => {
    setLoading(true);
    try {
      const fullEntry = await loadHistoryEntry(document.id, entry.id);
      setSelectedEntry(fullEntry);
      setView('detail');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history entry');
    } finally {
      setLoading(false);
    }
  }, [document.id, loadHistoryEntry]);

  const handleRollback = useCallback(async (historyId: string) => {
    if (!onRollback) return;
    
    try {
      await onRollback(historyId);
      // Reload history after rollback
      setPage(0);
      await loadHistory(0, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rollback document');
    }
  }, [onRollback, loadHistory]);

  useEffect(() => {
    if (isOpen) {
      setView('list');
      setSelectedEntry(null);
      setPage(0);
      loadHistory(0, false);
    } else {
      setHistoryData(null);
      setError(null);
    }
  }, [isOpen, loadHistory]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Document History</h2>
          <div className="modal-header-subtitle">
            {document.title}
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

          {view === 'list' && (
            <div className="history-list-view">
              {!historyData && loading ? (
                <div className="loading-message">Loading history...</div>
              ) : historyData?.history.length === 0 ? (
                <div className="empty-state">
                  <p>No history entries found for this document.</p>
                </div>
              ) : (
                <>
                  <div className="history-list">
                    {historyData?.history.map((entry) => (
                      <HistoryEntryPreview
                        key={entry.id}
                        entry={entry}
                        isSelected={false}
                        onClick={() => handleEntryClick(entry)}
                        onRollback={onRollback ? handleRollback : undefined}
                        canRollback={!!onRollback && entry.change_type !== 'delete'}
                      />
                    ))}
                  </div>
                  
                  {hasMore && (
                    <div className="load-more-container">
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={loadMore}
                        disabled={loading}
                      >
                        {loading ? 'Loading...' : 'Load More'}
                      </button>
                    </div>
                  )}
                  
                  {historyData && (
                    <div className="history-pagination-info">
                      Showing {historyData.history.length} of {historyData.pagination.total} entries
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {view === 'detail' && selectedEntry && (
            <HistoryDetailView
              entry={selectedEntry}
              onClose={() => setView('list')}
            />
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="button-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}