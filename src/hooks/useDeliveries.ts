import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DeliveryIntegration {
  id: string;
  integration_name: string;
  notes: string | null;
  is_new: boolean;
}

export interface DeliveryRecord {
  id: string;
  project_id: string;
  company_name: string | null;
  cnpj: string | null;
  project_type_label: string | null;
  version: string | null;
  complexity_level: string | null;
  uses_gpt: boolean;
  has_integration: boolean;
  admin_link: string;
  ux_responsible: string | null;
  dev_responsible: string | null;
  closer_name: string | null;
  observations: string | null;
  delivered_at: string;
  integrations: DeliveryIntegration[];
}

export function useDeliveries() {
  return useQuery({
    queryKey: ['deliveries'],
    queryFn: async () => {
      const { data: deliveries, error: dError } = await supabase
        .from('project_deliveries')
        .select('*')
        .order('delivered_at', { ascending: false });

      if (dError) throw dError;

      const { data: integrations, error: iError } = await supabase
        .from('project_integrations')
        .select('id, delivery_id, integration_name, notes, is_new');

      if (iError) throw iError;

      const integrationMap = new Map<string, DeliveryIntegration[]>();
      for (const int of integrations || []) {
        const key = (int as any).delivery_id as string;
        if (!integrationMap.has(key)) integrationMap.set(key, []);
        integrationMap.get(key)!.push({
          id: int.id,
          integration_name: int.integration_name,
          notes: int.notes,
          is_new: int.is_new,
        });
      }

      const result: DeliveryRecord[] = (deliveries || []).map((d) => ({
        id: d.id,
        project_id: d.project_id,
        company_name: d.company_name,
        cnpj: d.cnpj,
        project_type_label: d.project_type_label,
        version: d.version,
        complexity_level: d.complexity_level,
        uses_gpt: d.uses_gpt,
        has_integration: d.has_integration,
        admin_link: d.admin_link,
        ux_responsible: d.ux_responsible,
        dev_responsible: d.dev_responsible,
        closer_name: d.closer_name,
        observations: d.observations,
        delivered_at: d.delivered_at,
        integrations: integrationMap.get(d.id) || [],
      }));

      return result;
    },
  });
}

export function useDeleteDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Delete related integrations first
      await supabase.from('project_integrations').delete().eq('delivery_id', id);
      const { error } = await supabase.from('project_deliveries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      toast.success('Entrega excluída com sucesso');
    },
    onError: () => {
      toast.error('Erro ao excluir entrega');
    },
  });
}

export function useUpdateDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const { error } = await supabase.from('project_deliveries').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      toast.success('Entrega atualizada com sucesso');
    },
    onError: () => {
      toast.error('Erro ao atualizar entrega');
    },
  });
}
