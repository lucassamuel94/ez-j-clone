import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserRole } from '@/hooks/useUserRole';

export interface DocFile {
  type: 'link' | 'file';
  name: string;
  url: string;
}

export interface ApiAnalysisRequest {
  id: string;
  title: string;
  description: string;
  documentation_url: string;
  documentation_files: DocFile[];
  status: string;
  feasibility: string | null;
  analysis_response: string | null;
  requested_by: string;
  assigned_to: string | null;
  deadline_at: string | null;
  created_at: string;
  updated_at: string;
  requester_name?: string;
  assignee_name?: string;
}

export function useApiAnalysis() {
  const { user } = useCurrentUser();
  const { role } = useUserRole();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['api-analysis-requests'],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('api_analysis_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profile names
      const userIds = new Set<string>();
      data.forEach((r) => {
        userIds.add(r.requested_by);
        if (r.assigned_to) userIds.add(r.assigned_to);
      });

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', Array.from(userIds));

      const nameMap = new Map(profiles?.map((p) => [p.id, p.name]) || []);

      return data.map((r) => ({
        ...r,
        documentation_files: (r.documentation_files as unknown as DocFile[]) || [],
        requester_name: nameMap.get(r.requested_by) || 'Desconhecido',
        assignee_name: r.assigned_to ? nameMap.get(r.assigned_to) || 'Não atribuído' : 'Não atribuído',
      })) as ApiAnalysisRequest[];
    },
  });

  const createRequest = useMutation({
    mutationFn: async (payload: { title: string; description: string; documentation_url: string; documentation_files: DocFile[] }) => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Não autenticado');

      const insertData = {
        title: payload.title,
        description: payload.description,
        documentation_url: payload.documentation_url,
        documentation_files: JSON.parse(JSON.stringify(payload.documentation_files)),
        requested_by: authUser.id,
      };
      const { data, error } = await supabase.from('api_analysis_requests').insert(insertData as any).select('id').single();
      if (error) throw error;

      // Fire automatic message trigger
      supabase.functions.invoke('trigger-automatic-message', {
        body: {
          trigger_key: 'api_analysis_created',
          context: { titulo_analise: payload.title, descricao_analise: payload.description },
        },
      }).catch(console.error);

      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-analysis-requests'] }),
  });

  const updateRequest = useMutation({
    mutationFn: async (payload: { id: string; status?: string; analysis_response?: string; feasibility?: string | null; assigned_to?: string | null }) => {
      const { id, ...updates } = payload;
      const { error } = await supabase.from('api_analysis_requests').update(updates).eq('id', id);
      if (error) throw error;

      // Fire automatic message trigger when completed
      if (updates.status === 'concluido') {
        // Fetch analysis title for context
        const { data: analysis } = await supabase
          .from('api_analysis_requests')
          .select('title, feasibility')
          .eq('id', id)
          .single();

        supabase.functions.invoke('trigger-automatic-message', {
          body: {
            trigger_key: 'api_analysis_completed',
            context: {
              titulo_analise: analysis?.title || '',
              viabilidade: analysis?.feasibility || '',
            },
          },
        }).catch(console.error);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-analysis-requests'] }),
  });

  const deleteRequest = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('api_analysis_requests').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-analysis-requests'] }),
  });

  const uploadFile = async (file: File): Promise<DocFile> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new Error('Não autenticado');

    const ext = file.name.split('.').pop();
    const path = `${authUser.id}/${Date.now()}-${file.name}`;

    const { error } = await supabase.storage.from('api-analysis-docs').upload(path, file);
    if (error) throw error;

    const { data: signedData } = await supabase.storage
      .from('api-analysis-docs')
      .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year

    return {
      type: 'file',
      name: file.name,
      url: signedData?.signedUrl || path,
    };
  };

  return {
    requests: query.data || [],
    isLoading: query.isLoading,
    createRequest,
    updateRequest,
    deleteRequest,
    uploadFile,
    currentUserId: user?.id,
    role,
  };
}
