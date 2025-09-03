import { useState, useEffect, useCallback } from 'react';
import type { Document, DocumentHistory, DocumentHistoryResponse } from '../api';

interface DocumentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document;
  projectId: string;
  onRollback?: (historyId: string) => Promise<void>;
  onDeleteHistory?: (historyId: string) => Promise<void>;
  loadDocumentHistory: (documentId: string, limit?: number, offset?: number) => Promise<DocumentHistoryResponse>;
  loadHistoryEntry: (documentId: string, historyId: string) => Promise<DocumentHistory>;
}

interface HistoryEntryPreviewProps {
  entry: DocumentHistory;
  isSelected: boolean;
  onClick: () => void;
  onRollback?: (historyId: string) => void;
  onDelete?: (historyId: string) => void;
  canRollback: boolean;
  canDelete: boolean;
}

function HistoryEntryPreview({ entry, isSelected, onClick, onRollback, onDelete, canRollback, canDelete }: HistoryEntryPreviewProps) {
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
        <div className="history-entry-left">
          <span 
            className="change-type-badge"
            style={{ backgroundColor: getChangeTypeColor(entry.change_type) }}
          >
            {getChangeTypeLabel(entry.change_type)}
          </span>
          <div className="history-entry-info">
            <div className="history-title">{entry.title}</div>
            <div className="history-meta">
              <span className="history-date">{formatDate(entry.created_at)}</span>
              {entry.user_name && (
                <span className="history-author">by {entry.user_name}</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="history-entry-actions">
          {canRollback && onRollback && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={(e) => {
                e.stopPropagation();
                onRollback(entry.id);
              }}
              title="Rollback to this version"
            >
              ↶ Rollback
            </button>
          )}
          {canDelete && onDelete && (
            <button
              type="button"
              className="btn btn--danger btn--sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(entry.id);
              }}
              title="Delete this history entry"
            >
              🗑️
            </button>
          )}
        </div>
      </div>
      
      {entry.change_description && (
        <div className="history-entry-description">
          {entry.change_description}
        </div>
      )}
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
          <h3>{entry.title}</h3>
          <div className="history-detail-meta">
            <span className="change-type-label">{getChangeTypeLabel(entry.change_type)}</span>
            <span> • {formatDate(entry.created_at)}</span>
            {entry.user_name && <span> • by {entry.user_name}</span>}
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
          <p>{entry.change_description}</p>
        </div>
      )}
      
      {entry.content && (
        <div className="history-content-viewer">
          <div className="content-display">
            <pre>{entry.content}</pre>
          </div>
        </div>
      )}
      
      <div className="history-metadata-sidebar">
        <h4>Document Properties</h4>
        <div className="metadata-grid">
          {entry.document_type && (
            <div className="metadata-field">
              <label>Type:</label>
              <span>{entry.document_type}</span>
            </div>
          )}
          
          <div className="metadata-field">
            <label>Composite:</label>
            <span>{entry.is_composite ? 'Yes' : 'No'}</span>
          </div>
          
          {entry.is_composite && entry.components && (
            <div className="metadata-field components-field">
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
  onDeleteHistory,
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
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const limit = 20;

  const loadInitialHistory = useCallback(async () => {
    if (!document.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await loadDocumentHistory(document.id, limit, 0);
      setHistoryData(response);
      setHasMore(response.history.length === limit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document history');
    } finally {
      setLoading(false);
    }
  }, [document.id, loadDocumentHistory, limit]);

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
      
      setHistoryData(currentData => {
        if (append && currentData) {
          return {
            ...response,
            history: [...currentData.history, ...response.history]
          };
        } else {
          return response;
        }
      });
      
      setHasMore(response.history.length === limit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document history');
    } finally {
      setLoading(false);
    }
  }, [isOpen, document.id, loadDocumentHistory, limit]);

  const loadMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadHistory(nextPage, true);
  }, [page, loadHistory]);

  const handleEntryClick = useCallback(async (entry: DocumentHistory) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const fullEntry = await loadHistoryEntry(document.id, entry.id);
      setSelectedEntry(fullEntry);
      setView('detail');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history entry');
    } finally {
      setLoadingDetail(false);
    }
  }, [document.id, loadHistoryEntry]);

  const handleRollback = useCallback(async (historyId: string) => {
    if (!onRollback) return;
    
    try {
      await onRollback(historyId);
      // Reload history after rollback
      setPage(0);
      loadInitialHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rollback document');
    }
  }, [onRollback, loadInitialHistory]);

  const handleDelete = useCallback(async (historyId: string) => {
    if (!onDeleteHistory) return;
    
    try {
      await onDeleteHistory(historyId);
      // Reload history after delete
      setPage(0);
      loadInitialHistory();
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete history entry');
    }
  }, [onDeleteHistory, loadInitialHistory]);

  useEffect(() => {
    if (isOpen) {
      setView('list');
      setSelectedEntry(null);
      setPage(0);
      setLoadingDetail(false);
      setDeleteConfirmId(null);
      loadInitialHistory();
    } else {
      setHistoryData(null);
      setError(null);
      setLoadingDetail(false);
      setDeleteConfirmId(null);
    }
  }, [isOpen, loadInitialHistory]);

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

          {loadingDetail && (
            <div className="loading-message">Loading history details...</div>
          )}

          {!loadingDetail && view === 'list' && (
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
                        onDelete={onDeleteHistory ? (id) => setDeleteConfirmId(id) : undefined}
                        canRollback={!!onRollback && entry.change_type !== 'delete'}
                        canDelete={!!onDeleteHistory}
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

          {!loadingDetail && view === 'detail' && selectedEntry && (
            <HistoryDetailView
              entry={selectedEntry}
              onClose={() => {
                setView('list');
                setSelectedEntry(null);
                setError(null);
              }}
            />
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="button-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirmId && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmId(null)}>
          <div className="modal-content small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm Delete</h3>
              <button type="button" className="modal-close" onClick={() => setDeleteConfirmId(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this history entry? This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn--secondary" 
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn--danger" 
                onClick={() => handleDelete(deleteConfirmId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}