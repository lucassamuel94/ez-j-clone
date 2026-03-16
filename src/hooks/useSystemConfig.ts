import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useSystemConfig(key: string) {
  return useQuery({
    queryKey: ['system-config', key],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_system_config', {
        config_key: key,
      });
      if (error) throw error;
      return (data as string) || null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateSystemConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      key,
      value,
    }: {
      key: string;
      value: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { error } = await supabase
        .from('system_config')
        .update({ value, updated_at: new Date().toISOString(), updated_by: session.user.id })
        .eq('key', key);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['system-config', variables.key] });
      toast.success('Configuração salva com sucesso');
    },
    onError: () => {
      toast.error('Erro ao salvar configuração');
    },
  });
}
