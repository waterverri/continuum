
export interface TimelineControlsProps {
  viewMode: 'gantt' | 'list';
  onViewModeChange: (mode: 'gantt' | 'list') => void;
  zoomLevel: number;
  panOffset: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onZoomToFit: () => void;
  onBaseDateClick: () => void;
  filteredEventsCount: number;
  totalEventsCount: number;
  timeRange: number;
}

export function TimelineControls({
  viewMode,
  onViewModeChange,
  zoomLevel,
  panOffset,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onZoomToFit,
  onBaseDateClick,
  filteredEventsCount,
  totalEventsCount,
  timeRange
}: TimelineControlsProps) {
  return (
    <div className="timeline-modal__header">
      <div className="timeline-modal__title">
        <h2>📅 Event Timeline</h2>
        <p>
          {filteredEventsCount}
          {totalEventsCount !== filteredEventsCount ? `/${totalEventsCount}` : ''} events • {timeRange} time units
        </p>
      </div>
      
      <div className="timeline-modal__controls">
        <button 
          className="btn btn--secondary"
          onClick={onBaseDateClick}
          title="Set base date (T0 = ?)"
        >
          📅 Base Date
        </button>
        
        <div className="view-mode-toggle">
          <button 
            className={`toggle-btn ${viewMode === 'gantt' ? 'active' : ''}`}
            onClick={() => onViewModeChange('gantt')}
          >
            📊 Gantt
          </button>
          <button 
            className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => onViewModeChange('list')}
          >
            📋 List
          </button>
        </div>
        
        {viewMode === 'gantt' && (
          <>
            <div className="zoom-controls">
              <label>Zoom:</label>
              <button 
                className="zoom-btn"
                onClick={onZoomOut}
                title="Zoom out"
              >
                −
              </button>
              <span className="zoom-level">
                {zoomLevel >= 100 ? `${Math.round(zoomLevel)}x` : `${Math.round(zoomLevel * 100)}%`}
              </span>
              <button 
                className="zoom-btn"
                onClick={onZoomIn}
                title="Zoom in"
              >
                +
              </button>
              <button 
                className="zoom-btn"
                onClick={onZoomReset}
                title="Reset zoom"
              >
                ⌂
              </button>
              <button 
                className="zoom-btn"
                onClick={onZoomToFit}
                title="Fit to view"
              >
                ⛶
              </button>
            </div>
            <div className="pan-controls">
              <label title="Current pan position. Drag timeline to pan, pinch to zoom, or double-tap to create events">
                {panOffset === 0 ? 'Centered' : `Pan: ${panOffset > 0 ? '+' : ''}${panOffset.toFixed(0)}px`}
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
}