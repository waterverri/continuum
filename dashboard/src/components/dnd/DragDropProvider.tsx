import React from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useDragState, useDragActions } from '../../hooks/store/useUI';
import { useDocumentActions } from '../../hooks/store/useDocuments';
import { useTagActions } from '../../hooks/store/useTags';
import { useEventActions } from '../../hooks/store/useEvents';

interface DragDropProviderProps {
  children: React.ReactNode;
}

export function DragDropProvider({ children }: DragDropProviderProps) {
  const dragState = useDragState();
  const { startDrag, endDrag, setDropTarget } = useDragActions();
  const { assignTagToDocument, moveDocumentToGroup, deleteDocument } = useDocumentActions();
  const { assignTagToEvent } = useTagActions();
  const { assignEventToDocument } = useEventActions();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const dragData = active.data.current;

    if (dragData) {
      startDrag(dragData.type, dragData.item);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setDropTarget(over?.data?.current || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      endDrag();
      return;
    }

    const dragData = active.data.current;
    const dropData = over.data.current;

    if (!dragData || !dropData) {
      endDrag();
      return;
    }

    try {
      // Handle different drag operations
      await handleDragOperation(dragData, dropData);
    } catch (error) {
      console.error('Drag operation failed:', error);
      // TODO: Show error toast
    }

    endDrag();
  };

  const handleDragOperation = async (dragData: any, dropData: any) => {
    const { type: dragType, item: dragItem } = dragData;
    const { type: dropType, item: dropItem } = dropData;

    // Tag → Document
    if (dragType === 'tag' && dropType === 'document') {
      await assignTagToDocument(dropItem.id, dragItem.id);
      // TODO: Show confirmation dialog for tag inheritance if document has events
    }

    // Tag → Event
    else if (dragType === 'tag' && dropType === 'event') {
      await assignTagToEvent(dropItem.id, dragItem.id);
      // TODO: Show confirmation dialog for tag inheritance to linked documents
    }

    // Event → Document
    else if (dragType === 'event' && dropType === 'document') {
      await assignEventToDocument(dropItem.id, dragItem.id);
    }

    // Document → Document (grouping)
    else if (dragType === 'document' && dropType === 'document') {
      if (dragItem.id !== dropItem.id) {
        await moveDocumentToGroup(dragItem.id, dropItem.id);
      }
    }

    // Document → Recycle Bin
    else if (dragType === 'document' && dropType === 'trash') {
      // TODO: Show confirmation dialog
      await deleteDocument(dragItem.id);
    }

    // Handle other operations as needed
    else {
      console.log('Unhandled drag operation:', { dragType, dropType });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlay>
        {dragState.isDragging && dragState.dragItem && (
          <DragPreview type={dragState.dragType} item={dragState.dragItem} />
        )}
      </DragOverlay>
    </DndContext>
  );
}

interface DragPreviewProps {
  type: 'tag' | 'event' | 'document' | null;
  item: any;
}

function DragPreview({ type, item }: DragPreviewProps) {
  switch (type) {
    case 'tag':
      return (
        <div className="drag-preview tag-preview" style={{ backgroundColor: item.color }}>
          {item.name}
        </div>
      );
    case 'event':
      return (
        <div className="drag-preview event-preview">
          {item.name}
        </div>
      );
    case 'document':
      return (
        <div className="drag-preview document-preview">
          {item.title}
        </div>
      );
    default:
      return null;
  }
}