import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

const BATCH_SIZE = 15;

/**
 * Hook that virtualizes items per column for Kanban infinite scroll.
 * Returns a map of columnId -> visible items, plus a sentinel ref creator.
 */
export function useInfiniteColumnScroll<T>(
  columns: { id: string; items: T[] }[],
  batchSize = BATCH_SIZE
) {
  const [limits, setLimits] = useState<Record<string, number>>({});

  // Reset limits when columns data changes significantly (e.g. filter change)
  const columnFingerprint = columns.map(c => `${c.id}:${c.items.length}`).join('|');
  const prevFingerprint = useRef(columnFingerprint);

  useEffect(() => {
    if (prevFingerprint.current !== columnFingerprint) {
      setLimits({});
      prevFingerprint.current = columnFingerprint;
    }
  }, [columnFingerprint]);

  const getVisibleItems = useCallback(
    (columnId: string, allItems: T[]): T[] => {
      const limit = limits[columnId] ?? batchSize;
      return allItems.slice(0, limit);
    },
    [limits, batchSize]
  );

  const hasMore = useCallback(
    (columnId: string, totalCount: number): boolean => {
      const limit = limits[columnId] ?? batchSize;
      return limit < totalCount;
    },
    [limits, batchSize]
  );

  const loadMore = useCallback(
    (columnId: string) => {
      setLimits(prev => ({
        ...prev,
        [columnId]: (prev[columnId] ?? batchSize) + batchSize,
      }));
    },
    [batchSize]
  );

  const remainingCount = useCallback(
    (columnId: string, totalCount: number): number => {
      const limit = limits[columnId] ?? batchSize;
      return Math.max(0, totalCount - limit);
    },
    [limits, batchSize]
  );

  return { getVisibleItems, hasMore, loadMore, remainingCount };
}
