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
import type { DragItem, DropTarget } from '../../store/types';
import type { Document, Tag, Event } from '../../api';

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
    const dropData = over?.data?.current;

    if (dropData && dropData.type && (dropData.type === 'document' || dropData.type === 'event' || dropData.type === 'trash')) {
      const dropTarget: DropTarget = {
        type: dropData.type,
        item: dropData.item,
        action: dropData.action,
        acceptsTypes: dropData.acceptsTypes
      };
      setDropTarget(dropTarget);
    } else {
      setDropTarget(null);
    }
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
      await handleDragOperation(dragData, dropData);
    } catch (error) {
      console.error('❌ DROP FAILED:', error);
    }

    endDrag();
  };

  const handleDragOperation = async (dragData: any, dropData: any) => {
    const { type: dragType, item: dragItem } = dragData;
    const { type: dropType, item: dropItem } = dropData;

    // Tag → Document
    if (dragType === 'tag' && dropType === 'document') {
      await assignTagToDocument(dropItem.id, dragItem.id);
    }

    // Tag → Event
    else if (dragType === 'tag' && dropType === 'event') {
      await assignTagToEvent(dropItem.id, dragItem.id);
    }

    // Event → Document
    else if (dragType === 'event' && dropType === 'document') {
      await assignEventToDocument(dropItem.id, dragItem.id);
    }

    // Document → Document (grouping)
    else if (dragType === 'document' && dropType === 'document') {
      if (dragItem.id !== dropItem.id) {
        await moveDocumentToGroup(dragItem.id, dropItem.id);
      } else {
      }
    }

    // Document → Recycle Bin
    else if (dragType === 'document' && dropType === 'trash') {

      try {
        await deleteDocument(dragItem.id);
      } catch (error) {
        throw error;
      }
    }

    // Handle other operations as needed
    else {
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
  item: DragItem;
}

function DragPreview({ type, item }: DragPreviewProps) {
  switch (type) {
    case 'tag':
      return (
        <div className="drag-preview tag-preview" style={{ backgroundColor: (item.item as Tag).color }}>
          {(item.item as Tag).name}
        </div>
      );
    case 'event':
      return (
        <div className="drag-preview event-preview">
          {(item.item as Event).name}
        </div>
      );
    case 'document':
      return (
        <div className="drag-preview document-preview">
          {(item.item as Document).title}
        </div>
      );
    default:
      return null;
  }
}