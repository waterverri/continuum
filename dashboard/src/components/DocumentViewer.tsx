import type { Document } from '../api';

interface DocumentViewerProps {
  document: Document;
  resolvedContent: string | null;
  onResolve: () => void;
}

export function DocumentViewer({ document, resolvedContent, onResolve }: DocumentViewerProps) {
  return (
    <div className="document-viewer">
      <div className="document-viewer__header">
        <h3 className="document-viewer__title">{document.title}</h3>
        <p className="document-viewer__meta">
          <strong>Type:</strong> {document.document_type || 'No type'} • 
          <strong>Format:</strong> {document.is_composite ? 'Composite Document' : 'Static Document'}
        </p>
        {document.is_composite && (
          <button className="btn btn--primary" onClick={onResolve}>
            🔗 Resolve Template
          </button>
        )}
      </div>
      
      {document.is_composite && Object.keys(document.components || {}).length > 0 && (
        <div className="document-components">
          <h4>Components:</h4>
          <div className="components-list">
            {Object.entries(document.components || {}).map(([key, docId]) => (
              <div key={key} className="component-mapping">
                <strong>{`{{${key}}}`}</strong> → {docId}
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="content-section">
        <h4>Raw Content:</h4>
        <div className="content-display content-display--raw">
          {document.content || 'No content'}
        </div>
      </div>
      
      {document.is_composite && resolvedContent && (
        <div className="content-section">
          <h4>Resolved Content:</h4>
          <div className="content-display content-display--resolved">
            {resolvedContent}
          </div>
        </div>
      )}
    </div>
  );
}

export type { DocumentViewerProps };