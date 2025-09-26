import React from 'react';
import { useDroppable } from '@dnd-kit/core';

interface DroppableZoneProps {
  id: string;
  type: 'document' | 'event' | 'trash';
  item?: any;
  action?: string;
  children: React.ReactNode;
  acceptsTypes?: ('tag' | 'event' | 'document')[];
  className?: string;
  disabled?: boolean;
}

export function DroppableZone({
  id,
  type,
  item,
  action,
  children,
  acceptsTypes = [],
  className = '',
  disabled = false,
}: DroppableZoneProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    disabled,
    data: {
      type,
      item,
      action,
      acceptsTypes,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        ${className}
        ${isOver ? 'drop-zone-active' : ''}
        ${disabled ? 'drop-disabled' : 'drop-enabled'}
      `.trim()}
    >
      {children}
    </div>
  );
}