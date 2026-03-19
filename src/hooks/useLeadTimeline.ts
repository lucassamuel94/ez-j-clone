import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TimelineItem {
  id: string;
  source: 'note' | 'log';
  action_type: string;
  description: string;
  user_name: string;
  user_id: string | null;
  user_avatar_url?: string | null;
  created_at: string;
  old_value?: string | null;
  new_value?: string | null;
  field_name?: string | null;
  attachments?: any[];
  // for task notes
  task_id?: string | null;
}

// Map lead_activity_logs action_type to unified types
const LOG_ACTION_MAP: Record<string, string> = {
  created: 'system',
  status_changed: 'status_changed',
  temperature_changed: 'system',
  field_updated: 'system',
  owner_assigned: 'system',
  owner_removed: 'system',
  note_added: 'system',
  note_updated: 'system',
  note_deleted: 'system',
  interaction_added: 'system',
  interaction_registered: 'system',
  cadence_started: 'system',
  cadence_step_changed: 'system',
  meeting_scheduled: 'meeting',
  opportunity_created: 'system',
};

function parseNoteActionType(noteText: string): string {
  if (noteText.startsWith('📋')) return 'task';
  if (noteText.includes('📧')) return 'email';
  if (noteText.includes('📅')) return 'calendar_event';
  return 'observation';
}

export const useLeadTimeline = (leadId: string | null) => {
  const queryClient = useQueryClient();

  // Fetch notes
  const { data: notes } = useQuery({
    queryKey: ['lead-timeline-notes', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('lead_notes')
        .select('*, profiles:user_id(name, avatar_url)')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!leadId,
  });

  // Fetch activity logs
  const { data: logs } = useQuery({
    queryKey: ['lead-timeline-logs', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('lead_activity_logs')
        .select('*, profiles:user_id(name, avatar_url)')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!leadId,
  });

  // Merge into unified timeline
  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];

    // Convert notes
    for (const n of notes || []) {
      const noteText = n.note || '';
      const taskIdMatch = noteText.match(/\[task_id:([a-f0-9-]+)\]/);
      const userMatch = noteText.match(/\]\s*\(([^)]+)\)\s*/);
      const profileName = (n.profiles as any)?.name;
      const profileAvatar = (n.profiles as any)?.avatar_url;
      
      items.push({
        id: n.id,
        source: 'note',
        action_type: parseNoteActionType(noteText),
        description: noteText,
        user_name: profileName || (userMatch ? userMatch[1] : 'Sistema'),
        user_id: n.user_id,
        user_avatar_url: profileAvatar || null,
        created_at: n.created_at,
        attachments: Array.isArray(n.attachments) ? n.attachments : (n.attachments ? JSON.parse(String(n.attachments)) : undefined),
        task_id: taskIdMatch ? taskIdMatch[1] : null,
      });
    }

    // Convert logs (skip note_added/note_updated/note_deleted to avoid duplicates)
    const SKIP_LOG_TYPES = new Set(['note_added', 'note_updated', 'note_deleted']);
    for (const l of logs || []) {
      if (SKIP_LOG_TYPES.has(l.action_type)) continue;
      items.push({
        id: l.id,
        source: 'log',
        action_type: l.action_type,
        description: l.description,
        user_name: (l.profiles as any)?.name || 'Sistema',
        user_id: l.user_id,
        user_avatar_url: (l.profiles as any)?.avatar_url || null,
        created_at: l.created_at,
        old_value: l.old_value,
        new_value: l.new_value,
        field_name: l.field_name || null,
      });
    }

    // Sort chronologically (ascending)
    items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // --- Robust deduplication ---
    const normalizeDesc = (d: string) =>
      d.replace(/\[.*?\]\s*\(.*?\)\s*/g, '')
       .replace(/\s+/g, ' ')
       .trim()
       .toLowerCase();

    const LONG_TEXT_FIELDS = new Set([
      'qualification_notes', 'notes', 'main_pain_point', 'observation',
      'description', 'solution_urgency', 'next_steps',
    ]);

    const getWindow = (a: TimelineItem, b: TimelineItem): number => {
      // field_updated on long text fields → 120s window
      if (
        a.action_type === 'field_updated' &&
        b.action_type === 'field_updated' &&
        a.field_name && a.field_name === b.field_name &&
        LONG_TEXT_FIELDS.has(a.field_name)
      ) return 120_000;
      // cross-source → 120s window
      if (a.source !== b.source) return 120_000;
      // default → 5s
      return 5_000;
    };

    const descSimilar = (a: string, b: string): boolean => {
      const na = normalizeDesc(a);
      const nb = normalizeDesc(b);
      if (!na || !nb) return false;
      return na === nb || na.includes(nb) || nb.includes(na);
    };

    const deduped: TimelineItem[] = [];
    for (const item of items) {
      // Rule A: field_updated bursts — keep only the latest for same user+field in window
      if (item.action_type === 'field_updated' && item.field_name) {
        const existingIdx = deduped.findIndex((k) =>
          k.action_type === 'field_updated' &&
          k.field_name === item.field_name &&
          k.user_id === item.user_id &&
          Math.abs(new Date(item.created_at).getTime() - new Date(k.created_at).getTime()) <= 120_000
        );
        if (existingIdx >= 0) {
          // keep the more recent one
          if (new Date(item.created_at) > new Date(deduped[existingIdx].created_at)) {
            deduped[existingIdx] = item;
          }
          continue;
        }
      }

      const dominated = deduped.some((kept) => {
        if (kept.user_id !== item.user_id) return false;
        const timeDiff = Math.abs(new Date(item.created_at).getTime() - new Date(kept.created_at).getTime());
        const window = getWindow(kept, item);
        if (timeDiff > window) return false;

        // Rule B: cross-source — note vs log with similar description
        if (kept.source !== item.source) {
          return descSimilar(kept.description, item.description);
        }
        // Rule C: same-source — same action_type + similar description
        return kept.action_type === item.action_type && descSimilar(kept.description, item.description);
      });

      if (!dominated) {
        // If this note dominates a previously kept log, replace it (prefer notes)
        const existingLogIdx = item.source === 'note'
          ? deduped.findIndex((k) =>
              k.source === 'log' &&
              k.user_id === item.user_id &&
              Math.abs(new Date(item.created_at).getTime() - new Date(k.created_at).getTime()) <= 120_000 &&
              descSimilar(k.description, item.description)
            )
          : -1;
        if (existingLogIdx >= 0) {
          deduped[existingLogIdx] = item;
        } else {
          deduped.push(item);
        }
      }
    }
    return deduped;
  }, [notes, logs]);

  // Create note mutation
  const createNote = useMutation({
    mutationFn: async ({ note, attachments }: { note: string; attachments?: any[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !leadId) throw new Error('Not authenticated');
      const profileRes = await supabase.from('profiles').select('name').eq('id', user.id).single();
      const userName = profileRes.data?.name || 'Usuário';
      const fullNote = `[Observação] (${userName}) ${note}`;
      const { error } = await supabase.from('lead_notes').insert({
        lead_id: leadId,
        user_id: user.id,
        note: fullNote,
        attachments: attachments || null,
      } as any);
      if (error) throw error;
      // Also log activity
      await supabase.from('lead_activity_logs').insert({
        lead_id: leadId,
        user_id: user.id,
        action_type: 'note_added',
        description: 'adicionou uma observação',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-timeline-notes', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-timeline-logs', leadId] });
      queryClient.invalidateQueries({ queryKey: ['notes', leadId] });
    },
    onError: (error: any) => {
      console.error('Erro ao salvar comentário:', error);
      const msg = error?.message || error?.details || 'Erro desconhecido';
      toast.error(`Erro ao salvar comentário: ${msg}`);
    },
  });

  // Update note mutation
  const updateNote = useMutation({
    mutationFn: async ({ noteId, noteText }: { noteId: string; noteText: string }) => {
      const { error } = await supabase.from('lead_notes').update({ note: noteText } as any).eq('id', noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-timeline-notes', leadId] });
      queryClient.invalidateQueries({ queryKey: ['notes', leadId] });
      toast.success('Comentário atualizado');
    },
    onError: () => toast.error('Erro ao atualizar'),
  });

  // Delete note mutation (optimistic)
  const deleteNote = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from('lead_notes').delete().eq('id', noteId);
      if (error) throw error;
    },
    onMutate: async (noteId: string) => {
      await queryClient.cancelQueries({ queryKey: ['lead-timeline-notes', leadId] });
      await queryClient.cancelQueries({ queryKey: ['notes', leadId] });

      const prevTimeline = queryClient.getQueryData(['lead-timeline-notes', leadId]);
      const prevNotes = queryClient.getQueryData(['notes', leadId]);

      queryClient.setQueryData(['lead-timeline-notes', leadId], (old: any[] | undefined) =>
        old ? old.filter((n: any) => n.id !== noteId) : []
      );
      queryClient.setQueryData(['notes', leadId], (old: any[] | undefined) =>
        old ? old.filter((n: any) => n.id !== noteId) : []
      );

      return { prevTimeline, prevNotes };
    },
    onSuccess: () => {
      toast.success('Comentário excluído');
    },
    onError: (_err, _noteId, context) => {
      if (context?.prevTimeline) queryClient.setQueryData(['lead-timeline-notes', leadId], context.prevTimeline);
      if (context?.prevNotes) queryClient.setQueryData(['notes', leadId], context.prevNotes);
      toast.error('Erro ao excluir comentário');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-timeline-notes', leadId] });
      queryClient.invalidateQueries({ queryKey: ['notes', leadId] });
    },
  });

  return {
    timeline,
    isLoading: !notes && !logs,
    createNote,
    updateNote,
    deleteNote,
  };
};
