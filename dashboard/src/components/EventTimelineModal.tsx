import { useEffect, useCallback, useRef, useState, useLayoutEffect } from 'react';
import { EventFilters } from './EventFilters';
import { TimelineControls } from './TimelineControls';
import { TimelineVisualization } from './TimelineVisualization';
import { TimelineListView } from './TimelineListView';
import { TimelineModals } from './TimelineModals';
import { useTimelineState } from '../hooks/useTimelineState';
import { useTimelineOperations } from '../hooks/useTimelineOperations';
import { useTimelineViewport } from '../hooks/useTimelineViewport';
import type { Event, Document } from '../api';

interface EventTimelineModalProps {
  projectId: string;
  onClose: () => void;
  onEventClick?: (event: Event) => void;
  onDocumentView?: (document: Document) => void;
  onDocumentEdit?: (document: Document) => void;
  onDocumentDelete?: (documentId: string) => void;
  onCloseAllModals?: () => void;
  onEventsChange?: () => void;
}

export function EventTimelineModal({ 
  projectId, 
  onClose, 
  onDocumentView, 
  onDocumentEdit, 
  onDocumentDelete, 
  onCloseAllModals, 
  onEventsChange 
}: EventTimelineModalProps) {
  // Timeline container ref for getting actual width
  const timelineRef = useRef<HTMLDivElement>(null);
  const [timelineWidth, setTimelineWidth] = useState(1000); // fallback width
  
  // Update timeline width when component mounts or resizes
  useLayoutEffect(() => {
    const updateWidth = () => {
      if (timelineRef.current) {
        const width = timelineRef.current.getBoundingClientRect().width;
        if (width > 0) {
          setTimelineWidth(width);
        }
      }
    };

    updateWidth();
    
    const resizeObserver = new ResizeObserver(updateWidth);
    if (timelineRef.current) {
      resizeObserver.observe(timelineRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Initialize state management hook
  const state = useTimelineState();
  
  // Initialize operations hook
  const operations = useTimelineOperations({
    projectId,
    baseDate: state.baseDate,
    setEvents: state.setEvents,
    setLoading: state.setLoading,
    setError: state.setError,
    setEventTags: state.setEventTags,
    setEventDocuments: state.setEventDocuments,
    setSelectedEvent: state.setSelectedEvent,
    setEditingEvent: state.setEditingEvent,
    setShowEventDetails: state.setShowEventDetails,
    setIsCreatingEvent: state.setIsCreatingEvent,
    setBaseDate: state.setBaseDate,
    setFormData: state.setFormData,
    resetForm: state.resetForm,
    onEventsChange
  });
  
  // Initialize viewport management hook
  const viewport = useTimelineViewport({
    timelineData: state.timelineData,
    events: state.events,
    isCreatingEvent: state.isCreatingEvent,
    timelineWidth
  });

  // Load initial data
  useEffect(() => {
    operations.loadProjectBaseDate();
    operations.loadTimeline();
  }, [operations.loadProjectBaseDate, operations.loadTimeline]);

  // Click-to-create event functionality
  const handleTimelineDoubleClick = useCallback((e: React.MouseEvent) => {
    if (viewport.isDragging) return;
    
    const timelineElement = e.currentTarget as HTMLElement;
    const clickTime = viewport.calculateTimeFromMousePosition(e, timelineElement);
    
    // Create event with 5-unit duration by default
    const startTime = clickTime;
    const endTime = clickTime + 5;
    
    state.setCreateEventPosition({ timeStart: startTime, timeEnd: endTime });
    state.setFormData({
      name: '',
      description: '',
      time_start: operations.timeToDate(startTime).toISOString().slice(0, 16),
      time_end: operations.timeToDate(endTime).toISOString().slice(0, 16),
      display_order: 0,
      parent_event_id: ''
    });
    state.setIsCreatingEvent(true);
    e.preventDefault();
    e.stopPropagation();
  }, [viewport.isDragging, viewport.calculateTimeFromMousePosition, operations.timeToDate, state]);

  // Touch event handlers - wrapper to pass double click handler
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    viewport.handleTouchEnd(e, handleTimelineDoubleClick);
  }, [viewport.handleTouchEnd, handleTimelineDoubleClick]);

  // Event handlers for modal interactions
  const handleEventDetailsClose = useCallback(() => {
    state.setShowEventDetails(false);
    state.setSelectedEvent(null);
    state.setEditingEvent(null);
  }, [state]);

  const handleCancelEditEvent = useCallback(() => {
    state.setEditingEvent(null);
  }, [state]);

  const handleCancelCreateEvent = useCallback(() => {
    state.setIsCreatingEvent(false);
    state.resetForm();
  }, [state]);

  const handleBaseDateModalClose = useCallback(() => {
    state.setShowBaseDateModal(false);
  }, [state]);

  if (state.loading) {
    return (
      <div className="modal-overlay modal-overlay--fullscreen">
        <div className="timeline-modal">
          <div className="timeline-modal__header">
            <h2>📅 Event Timeline</h2>
            <button className="modal-close" onClick={onClose}>&times;</button>
          </div>
          <div className="timeline-modal__body">
            <div className="timeline-loading">
              <div className="loading-spinner"></div>
              <p>Loading timeline...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay modal-overlay--fullscreen">
      <div className="timeline-modal">
        {/* Timeline Controls Header */}
        <TimelineControls
          viewMode={state.viewMode}
          onViewModeChange={state.setViewMode}
          zoomLevel={viewport.zoomLevel}
          viewportStartTime={viewport.viewportStartTime}
          onZoomIn={viewport.handleZoomIn}
          onZoomOut={viewport.handleZoomOut}
          onZoomReset={viewport.handleZoomReset}
          onZoomToFit={viewport.handleZoomToFit}
          onBaseDateClick={() => state.setShowBaseDateModal(true)}
          onClose={onClose}
          filteredEventsCount={state.filteredEvents.length}
          totalEventsCount={state.events.length}
          timeRange={state.timelineData.timeRange}
        />

        {/* Error Display */}
        {state.error && (
          <div className="timeline-modal__error">
            {state.error}
            <button onClick={() => state.setError(null)}>&times;</button>
          </div>
        )}

        {/* Event Filters */}
        {state.events.length > 0 && (
          <div className="timeline-modal__filters">
            <EventFilters
              projectId={projectId}
              events={state.events}
              filters={state.filters}
              onFiltersChange={state.setFilters}
              baseDate={state.baseDate}
            />
          </div>
        )}

        {/* Timeline Content */}
        <div className="timeline-modal__body">
          {state.events.length === 0 ? (
            <div className="timeline-empty">
              <div className="empty-icon">📅</div>
              <h3>No Events Found</h3>
              <p>Create events to visualize them on the timeline.</p>
            </div>
          ) : state.filteredEvents.length === 0 ? (
            <div className="timeline-empty">
              <div className="empty-icon">🔍</div>
              <h3>No Events Match Filters</h3>
              <p>Try adjusting your filter criteria or clearing them to see more events.</p>
            </div>
          ) : (
            <div ref={timelineRef} className={`timeline-content ${state.viewMode}`}>
              {state.viewMode === 'gantt' ? (
                <TimelineVisualization
                  events={state.filteredEvents}
                  viewport={viewport.viewport}
                  isDragging={viewport.isDragging}
                  viewportStartTime={viewport.viewportStartTime}
                  zoomLevel={viewport.zoomLevel}
                  isCreatingEvent={state.isCreatingEvent}
                  collapsedParents={state.collapsedParents}
                  formatDateDisplay={operations.formatDateDisplay}
                  onMouseDown={viewport.handleMouseDown}
                  onMouseMove={viewport.handleMouseMove}
                  onMouseUp={viewport.handleMouseUp}
                  onDoubleClick={handleTimelineDoubleClick}
                  onWheel={viewport.handleWheel}
                  onTouchStart={viewport.handleTouchStart}
                  onTouchMove={viewport.handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onEventClick={operations.loadEventDetails}
                  onEventEdit={operations.startEditEvent}
                  onEventDelete={operations.handleDeleteEvent}
                  onParentToggle={state.toggleParentCollapse}
                />
              ) : (
                <TimelineListView
                  events={state.filteredEvents}
                  formatDateDisplay={operations.formatDateDisplay}
                  onEventClick={operations.loadEventDetails}
                />
              )}
            </div>
          )}
        </div>

        {/* All Modals */}
        <TimelineModals
          // Event Details Modal
          showEventDetails={state.showEventDetails}
          selectedEvent={state.selectedEvent}
          editingEvent={state.editingEvent}
          eventDocuments={state.eventDocuments}
          
          // Event Create Modal
          isCreatingEvent={state.isCreatingEvent}
          createEventPosition={state.createEventPosition}
          
          // Base Date Modal
          showBaseDateModal={state.showBaseDateModal}
          baseDate={state.baseDate}
          
          // Form data
          formData={state.formData}
          events={state.events}
          loading={state.loading}
          
          // Utility functions
          formatDateDisplay={operations.formatDateDisplay}
          timeToDate={operations.timeToDate}
          
          // Event handlers
          onEventDetailsClose={handleEventDetailsClose}
          onStartEditEvent={operations.startEditEvent}
          onFormDataChange={state.setFormData}
          onSaveEditEvent={operations.handleEditEvent}
          onCancelEditEvent={handleCancelEditEvent}
          
          onCreateEventSubmit={operations.handleCreateEvent}
          onCancelCreateEvent={handleCancelCreateEvent}
          
          onBaseDateModalClose={handleBaseDateModalClose}
          onBaseDateChange={state.setBaseDate}
          onBaseDateSave={operations.handleBaseDateChange}
          
          // Document handlers
          onDocumentView={onDocumentView}
          onDocumentEdit={onDocumentEdit}
          onDocumentDelete={onDocumentDelete}
          onCloseAllModals={onCloseAllModals}
        />
      </div>
    </div>
  );
}