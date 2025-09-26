import React from 'react';
import { useDraggable } from '@dnd-kit/core';

interface DraggableItemProps {
  id: string;
  type: 'tag' | 'event' | 'document';
  item: any;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export function DraggableItem({
  id,
  type,
  item,
  children,
  disabled = false,
  className = '',
}: DraggableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id,
    disabled,
    data: {
      type,
      item,
    },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        ${className}
        ${isDragging ? 'dragging' : ''}
        ${disabled ? 'drag-disabled' : 'drag-enabled'}
      `.trim()}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}