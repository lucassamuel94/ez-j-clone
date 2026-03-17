import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CallAnalysis {
  id: string;
  uploaded_by: string;
  sdr_user_id: string;
  lead_id: string | null;
  audio_path: string;
  duration_seconds: number;
  transcription: string | null;
  speaker_segments: Array<{ speaker: string; text: string; start: number; end: number }>;
  ai_analysis: Record<string, unknown> | null;
  call_score: number;
  connection_effective: boolean;
  interest_level: string;
  next_step_defined: boolean;
  conversion_potential: number;
  sdr_talk_percentage: number;
  lead_talk_percentage: number;
  open_questions_count: number;
  interruptions_count: number;
  early_pitch: boolean;
  objections: string[];
  executive_summary: string | null;
  feedback: string | null;
  original_filename: string | null;
  status: string;
  created_at: string;
  transcribed_at: string | null;
  completed_at: string | null;
  media_type: 'audio' | 'video';
  analysis_context: 'sdr_call' | 'demo_closer';
  share_token: string | null;
  converted_to_sale: boolean;
  // joined
  sdr_profile?: { name: string } | null;
  lead_data?: { name: string; company: string } | null;
}

interface UploadParams {
  file: File;
  sdr_user_id: string;
  lead_id?: string;
  media_type?: 'audio' | 'video';
  analysis_context?: 'sdr_call' | 'demo_closer';
}

export const useCallAnalyses = (filters?: { sdr_user_id?: string; month?: number; year?: number; dateFrom?: string; dateTo?: string; analysis_context?: 'sdr_call' | 'demo_closer' }) => {
  const queryClient = useQueryClient();

  const queryResult = useQuery({
    queryKey: ['call-analyses', filters],
    queryFn: async () => {
      let query = (supabase
        .from('call_analyses' as any)
        .select('*') as any)
        .order('created_at', { ascending: false });

      if (filters?.sdr_user_id) {
        query = query.eq('sdr_user_id', filters.sdr_user_id);
      }
      if (filters?.analysis_context) {
        query = query.eq('analysis_context', filters.analysis_context);
      }
      if (filters?.month && filters?.year) {
        const start = new Date(filters.year, filters.month - 1, 1).toISOString();
        const end = new Date(filters.year, filters.month, 0, 23, 59, 59).toISOString();
        query = query.gte('created_at', start).lte('created_at', end);
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Enrich with profile/lead names
      const rows = (data || []) as any[];
      if (rows.length === 0) return [] as CallAnalysis[];

      const sdrIds = [...new Set(rows.map((r: any) => r.sdr_user_id))];
      const leadIds = [...new Set(rows.filter((r: any) => r.lead_id).map((r: any) => r.lead_id))];

      const [{ data: profiles }, { data: leads }] = await Promise.all([
        supabase.from('profiles').select('id, name').in('id', sdrIds),
        leadIds.length > 0
          ? supabase.from('leads').select('id, name, company').in('id', leadIds)
          : Promise.resolve({ data: [] }),
      ]);

      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));
      const leadMap = Object.fromEntries((leads || []).map((l: any) => [l.id, l]));

      return rows.map((r: any) => ({
        ...r,
        sdr_profile: profileMap[r.sdr_user_id] ? { name: profileMap[r.sdr_user_id].name } : null,
        lead_data: r.lead_id && leadMap[r.lead_id] ? { name: leadMap[r.lead_id].name, company: leadMap[r.lead_id].company } : null,
      })) as CallAnalysis[];
    },
    refetchInterval: (query) => {
      const data = query.state.data as CallAnalysis[] | undefined;
      const hasProcessing = data?.some(a => a.status === 'processing' || a.status === 'transcribed');
      return hasProcessing ? 5000 : false;
    },
  });

  // Realtime subscription — re-subscribe when filters change
  useEffect(() => {
    const channelName = `call-analyses-realtime-${JSON.stringify(filters)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_analyses' }, () => {
        queryClient.invalidateQueries({ queryKey: ['call-analyses'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_analyses' }, () => {
        queryClient.invalidateQueries({ queryKey: ['call-analyses'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient, filters]);

  return queryResult;
};

/**
 * Upload-only: saves audio to storage and creates record with status 'uploaded'.
 * Does NOT trigger transcription/analysis.
 */
export const useUploadCallAnalysis = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, sdr_user_id, lead_id, media_type = 'audio', analysis_context = 'sdr_call' }: UploadParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const ext = file.name.split('.').pop() || 'mp3';
      const path = `${user.id}/${Date.now()}.${ext}`;
      const bucket = media_type === 'video' ? 'demo-recordings' : 'call-recordings';

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file);

      if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);

      const { data: analysis, error: insertError } = await supabase
        .from('call_analyses' as any)
        .insert({
          uploaded_by: user.id,
          sdr_user_id,
          lead_id: lead_id || null,
          audio_path: path,
          original_filename: file.name,
          status: 'uploaded',
          media_type,
          analysis_context,
        } as any)
        .select()
        .single();

      if (insertError) throw new Error(`Erro ao criar registro: ${insertError.message}`);

      return analysis as unknown as CallAnalysis;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-analyses'] });
      toast.success('Áudio salvo! Clique em "Analisar" quando quiser iniciar a transcrição.');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
};

/**
 * Start transcription + analysis for one or more uploaded records.
 */
export const useStartAnalysis = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (analysisIds: string[]) => {
      // Update all to 'processing'
      const { error: updateError } = await (supabase
        .from('call_analyses' as any)
        .update({ status: 'processing' } as any) as any)
        .in('id', analysisIds);

      if (updateError) throw new Error(`Erro ao atualizar status: ${updateError.message}`);

      // Fetch audio_paths and media_type
      const { data: records, error: fetchError } = await (supabase
        .from('call_analyses' as any)
        .select('id, audio_path, media_type') as any)
        .in('id', analysisIds);

      if (fetchError) throw new Error(`Erro ao buscar registros: ${fetchError.message}`);

      // Trigger transcription for each (sequentially to avoid overload)
      for (const record of (records || [])) {
        const fnName = record.media_type === 'video' ? 'transcribe-video' : 'transcribe-call';
        const { error: fnError } = await supabase.functions.invoke(fnName, {
          body: { analysis_id: record.id, audio_path: record.audio_path },
        });
        if (fnError) {
          console.error(`${fnName} error for ${record.id}:`, fnError);
        }
      }

      return analysisIds;
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: ['call-analyses'] });
      toast.success(`Análise iniciada para ${ids.length} registro${ids.length > 1 ? 's' : ''}!`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
};

export const useUpdateCallAnalysisLead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ analysisId, leadId }: { analysisId: string; leadId: string | null }) => {
      const { error } = await (supabase
        .from('call_analyses' as any)
        .update({ lead_id: leadId } as any) as any)
        .eq('id', analysisId);
      if (error) throw new Error(`Erro ao atualizar lead: ${error.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-analyses'] });
      toast.success('Lead atualizado com sucesso.');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
};

/**
 * Retry analysis for records stuck in 'error' or 'transcribed' status.
 * If transcription exists, calls analyze-call/analyze-demo directly.
 * Otherwise restarts from transcription.
 */
export const useRetryAnalysis = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (analysis: CallAnalysis) => {
      const hasTranscription = !!analysis.transcribed_at || !!analysis.transcription;

      if (hasTranscription) {
        // Transcription exists — go straight to AI analysis
        await (supabase
          .from('call_analyses' as any)
          .update({ status: 'processing' } as any) as any)
          .eq('id', analysis.id);

        const fnName = analysis.analysis_context === 'demo_closer' ? 'analyze-demo' : 'analyze-call';
        const { error } = await supabase.functions.invoke(fnName, {
          body: { analysis_id: analysis.id },
        });
        if (error) throw new Error(`Erro ao chamar ${fnName}: ${error.message}`);
      } else {
        // No transcription — restart from scratch (reset retry count)
        await (supabase
          .from('call_analyses' as any)
          .update({ status: 'processing', feedback: null, worker_retry_count: 0 } as any) as any)
          .eq('id', analysis.id);

        const fnName = analysis.media_type === 'video' ? 'transcribe-video' : 'transcribe-call';
        const { error } = await supabase.functions.invoke(fnName, {
          body: { analysis_id: analysis.id, audio_path: analysis.audio_path },
        });
        if (error) throw new Error(`Erro ao chamar ${fnName}: ${error.message}`);
      }

      return analysis.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-analyses'] });
      toast.success('Reanálise iniciada!');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
};

export const useDeleteCallAnalysis = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (analysisId: string) => {
      const { error } = await (supabase
        .from('call_analyses' as any)
        .delete() as any)
        .eq('id', analysisId);
      if (error) throw new Error(`Erro ao deletar: ${error.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-analyses'] });
      toast.success('Análise removida com sucesso.');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
};

export const useCallAnalysisStats = (
  sdrUserId?: string,
  analysisContext?: 'sdr_call' | 'demo_closer',
) => {
  return useQuery({
    queryKey: ['call-analysis-stats', sdrUserId, analysisContext],
    queryFn: async () => {
      let query = supabase
        .from('call_analyses' as any)
        .select('call_score, next_step_defined, conversion_potential, objections, sdr_user_id, created_at, interest_level, analysis_context')
        .eq('status', 'completed');

      if (sdrUserId) query = query.eq('sdr_user_id', sdrUserId);
      if (analysisContext) query = query.eq('analysis_context', analysisContext);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any[];
    },
  });
};

export const useShareCallAnalysis = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (analysis: { id: string; share_token: string | null }) => {
      if (analysis.share_token) return analysis.share_token;
      const token = crypto.randomUUID();
      const { error } = await (supabase
        .from('call_analyses' as any)
        .update({ share_token: token } as any) as any)
        .eq('id', analysis.id);
      if (error) throw new Error(`Erro ao compartilhar: ${error.message}`);
      return token;
    },
    onSuccess: (token) => {
      const url = `${window.location.origin}/call-analysis/share/${token}`;
      navigator.clipboard.writeText(url).catch(() => {});
      toast.success('Link copiado para a área de transferência!');
      queryClient.invalidateQueries({ queryKey: ['call-analyses'] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
};

export const useRevokeCallAnalysisShare = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (analysisId: string) => {
      const { error } = await (supabase
        .from('call_analyses' as any)
        .update({ share_token: null } as any) as any)
        .eq('id', analysisId);
      if (error) throw new Error(`Erro ao revogar: ${error.message}`);
    },
    onSuccess: () => {
      toast.success('Compartilhamento revogado.');
      queryClient.invalidateQueries({ queryKey: ['call-analyses'] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
};

export const usePublicCallAnalysis = (token: string | undefined) => {
  return useQuery({
    queryKey: ['public-call-analysis', token],
    enabled: !!token,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('call_analyses' as any)
        .select('*') as any)
        .eq('share_token', token)
        .single();
      if (error) throw error;
      const row = data as any;

      // Enrich with profile/lead names
      const [{ data: profile }, { data: lead }] = await Promise.all([
        row.sdr_user_id
          ? supabase.from('profiles').select('id, name').eq('id', row.sdr_user_id).single()
          : Promise.resolve({ data: null }),
        row.lead_id
          ? supabase.from('leads').select('id, name, company').eq('id', row.lead_id).single()
          : Promise.resolve({ data: null }),
      ]);

      return {
        ...row,
        sdr_profile: profile ? { name: (profile as any).name } : null,
        lead_data: lead ? { name: (lead as any).name, company: (lead as any).company } : null,
      } as CallAnalysis;
    },
  });
};

export const useToggleConvertedToSale = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await (supabase
        .from('call_analyses' as any)
        .update({ converted_to_sale: value } as any) as any)
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, { value }) => {
      queryClient.invalidateQueries({ queryKey: ['call-analyses'] });
      toast.success(value ? 'Análise marcada como venda!' : 'Marcação de venda removida.');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
};

export const useBulkDeleteCallAnalyses = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await (supabase
        .from('call_analyses' as any)
        .delete() as any)
        .in('id', ids);
      if (error) throw new Error(`Erro ao excluir: ${error.message}`);
      return ids;
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: ['call-analyses'] });
      toast.success(`${ids.length} análise${ids.length > 1 ? 's' : ''} removida${ids.length > 1 ? 's' : ''} com sucesso.`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
};
