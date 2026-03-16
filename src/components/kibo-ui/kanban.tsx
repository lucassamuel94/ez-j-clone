'use client';

import {
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import tunnel from 'tunnel-rat';

const headerTunnel = tunnel();

// ---------- Context ----------

interface KanbanContextProps {
  activeId: UniqueIdentifier | null;
}

const KanbanContext = createContext<KanbanContextProps>({ activeId: null });

// ---------- Provider ----------

interface KanbanProviderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onDragEnd' | 'onDragOver' | 'onDragStart'> {
  onDragEnd: (event: DragEndEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
  onDragStart?: (event: DragStartEvent) => void;
}

export function KanbanProvider({
  children,
  className,
  onDragEnd,
  onDragOver,
  onDragStart: onDragStartProp,
  ...props
}: KanbanProviderProps) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id);
    onDragStartProp?.(event);
  }, [onDragStartProp]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      onDragEnd(event);
    },
    [onDragEnd]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      onDragOver?.(event);
    },
    [onDragOver]
  );

  const value = useMemo(() => ({ activeId }), [activeId]);

  return (
    <KanbanContext.Provider value={value}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
      >
        <div className={cn('flex h-full', className)} {...props}>
          {children}
        </div>
      </DndContext>
    </KanbanContext.Provider>
  );
}

// ---------- Board ----------

interface KanbanBoardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'id'> {
  id: UniqueIdentifier;
}

export function KanbanBoard({ id, children, className, ...props }: KanbanBoardProps) {
  const { setNodeRef, isOver } = useSortable({
    id,
    data: { type: 'column' },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-[280px] min-w-[280px] flex-col rounded-lg',
        isOver && 'ring-2 ring-primary/20',
        className
      )}
      {...props}
    >
      <headerTunnel.Out />
      {children}
    </div>
  );
}

// ---------- Header ----------

interface KanbanHeaderProps extends HTMLAttributes<HTMLDivElement> {}

export function KanbanHeader({ children, className, ...props }: KanbanHeaderProps) {
  return (
    <div className={cn('flex items-center gap-2 p-2 sticky top-0 z-10 bg-inherit', className)} {...props}>
      {children}
    </div>
  );
}

// ---------- Cards container ----------

interface KanbanCardsProps extends HTMLAttributes<HTMLDivElement> {
  items: UniqueIdentifier[];
}

export function KanbanCards({ items, children, className, ...props }: KanbanCardsProps) {
  return (
    <SortableContext items={items} strategy={verticalListSortingStrategy}>
      <div
        className={cn('flex flex-col gap-2 p-2', className)}
        {...props}
      >
        {children}
      </div>
    </SortableContext>
  );
}

// ---------- Card ----------

interface KanbanCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'id'> {
  id: UniqueIdentifier;
  asHandle?: boolean;
}

export function KanbanCard({ id, children, className, asHandle, ...props }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: { type: 'card' },
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleProps = asHandle ? { ...attributes, ...listeners } : {};

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md',
        isDragging && 'shadow-lg ring-2 ring-primary/20',
        className
      )}
      {...handleProps}
      {...props}
    >
      {children}
    </div>
  );
}

// ---------- Overlay ----------

interface KanbanOverlayProps {
  children?: ReactNode;
}

export function KanbanOverlay({ children }: KanbanOverlayProps) {
  return (
    <DragOverlay>
      {children ? (
        <div className="rounded-lg border bg-card p-3 shadow-xl ring-2 ring-primary/20">
          {children}
        </div>
      ) : null}
    </DragOverlay>
  );
}

export { KanbanContext };
