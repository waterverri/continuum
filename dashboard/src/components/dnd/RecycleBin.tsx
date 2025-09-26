import { DroppableZone } from './DroppableZone';
import { useDragState } from '../../hooks/store/useUI';

interface RecycleBinProps {
  className?: string;
}

export function RecycleBin({ className = '' }: RecycleBinProps) {
  const dragState = useDragState();
  const isDocumentDragging = dragState.isDragging && dragState.dragType === 'document';

  if (!isDocumentDragging) {
    return null; // Only show when dragging documents
  }

  return (
    <DroppableZone
      id="recycle-bin"
      type="trash"
      acceptsTypes={['document']}
      className={`recycle-bin ${className}`}
    >
      <div className="recycle-bin-content">
        <div className="recycle-bin-icon">
          🗑️
        </div>
        <div className="recycle-bin-text">
          Drop to delete
        </div>
      </div>
    </DroppableZone>
  );
}