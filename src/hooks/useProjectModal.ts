import { useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useProjectModal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get('project') || searchParams.get('projeto') || null;

  // Normalize: if "projeto" param exists, replace with "project"
  useEffect(() => {
    if (searchParams.has('projeto') && !searchParams.has('project')) {
      const id = searchParams.get('projeto')!;
      const next = new URLSearchParams(searchParams);
      next.delete('projeto');
      next.set('project', id);
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project-by-id', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });

  const isOpen = !!projectId;

  const openProject = useCallback(
    (id: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('project', id);
          return next;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  const closeProject = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('project');
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  return useMemo(
    () => ({ project: project ?? null, isOpen, isLoading, openProject, closeProject }),
    [project, isOpen, isLoading, openProject, closeProject],
  );
}
