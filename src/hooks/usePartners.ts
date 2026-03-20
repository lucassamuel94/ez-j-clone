import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Partner {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  partner_type: string;
  commission_rate: number;
  status: string;
  notes: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  // Enriched fields
  referral_count: number;
  total_revenue: number;
  total_commission: number;
}

export interface PartnerReferral {
  id: string;
  company: string;
  stage: string;
  deal_value: number | null;
  won_at: string | null;
  closer_name: string | null;
  opportunity_type: string | null;
}

export function usePartners() {
  return useQuery<Partner[]>({
    queryKey: ['partners'],
    queryFn: async () => {
      const { data: partners, error } = await (supabase as any)
        .from('partners')
        .select('*')
        .order('name');

      if (error) throw error;
      if (!partners || partners.length === 0) return [];

      const partnerIds = partners.map((p: any) => p.id);

      // Fetch leads linked to partners + their won opportunities
      const { data: leads } = await (supabase as any)
        .from('leads')
        .select('id, partner_id, company')
        .in('partner_id', partnerIds);

      const leadIds = (leads || []).map((l: any) => l.id);

      let opps: any[] = [];
      if (leadIds.length > 0) {
        const { data } = await supabase
          .from('opportunities')
          .select('lead_id, stage, deal_value, won_at')
          .in('lead_id', leadIds)
          .eq('stage', 'Ganho');
        opps = data || [];
      }

      // Build partner → lead → opp maps
      const leadPartnerMap = new Map<string, string>();
      for (const l of (leads || []) as any[]) {
        if (l.partner_id) leadPartnerMap.set(l.id, l.partner_id);
      }

      const partnerStats = new Map<string, { count: number; revenue: number }>();
      for (const l of (leads || []) as any[]) {
        if (!l.partner_id) continue;
        const stats = partnerStats.get(l.partner_id) || { count: 0, revenue: 0 };
        stats.count++;
        partnerStats.set(l.partner_id, stats);
      }

      for (const o of opps) {
        const pid = leadPartnerMap.get(o.lead_id);
        if (!pid) continue;
        const stats = partnerStats.get(pid) || { count: 0, revenue: 0 };
        stats.revenue += o.deal_value || 0;
        partnerStats.set(pid, stats);
      }

      return partners.map((p: any) => {
        const stats = partnerStats.get(p.id) || { count: 0, revenue: 0 };
        return {
          ...p,
          referral_count: stats.count,
          total_revenue: stats.revenue,
          total_commission: stats.revenue * ((p.commission_rate || 0) / 100),
        };
      });
    },
    staleTime: 30_000,
  });
}

export function usePartnerReferrals(partnerId: string | null) {
  return useQuery<PartnerReferral[]>({
    queryKey: ['partner-referrals', partnerId],
    queryFn: async () => {
      const { data: leads } = await (supabase as any)
        .from('leads')
        .select('id, company')
        .eq('partner_id', partnerId!);

      if (!leads || leads.length === 0) return [];

      const leadIds = leads.map((l: any) => l.id);
      const leadCompanyMap = new Map<string, string>(leads.map((l: any) => [l.id, l.company]));

      const { data: opps } = await supabase
        .from('opportunities')
        .select(`
          id, lead_id, stage, deal_value, won_at, opportunity_type,
          closer:profiles!opportunities_assigned_to_user_id_fkey(name)
        `)
        .in('lead_id', leadIds)
        .order('created_at', { ascending: false });

      // One row per lead (best opportunity)
      const seen = new Set<string>();
      const result: PartnerReferral[] = [];

      for (const o of (opps || []) as any[]) {
        if (seen.has(o.lead_id)) continue;
        seen.add(o.lead_id);
        result.push({
          id: o.id,
          company: leadCompanyMap.get(o.lead_id) || '—',
          stage: o.stage,
          deal_value: o.deal_value,
          won_at: o.won_at,
          closer_name: o.closer?.name || null,
          opportunity_type: o.opportunity_type,
        });
      }

      // Add leads without opportunities
      for (const l of leads as any[]) {
        if (!seen.has(l.id)) {
          result.push({
            id: l.id,
            company: l.company || '—',
            stage: 'Sem oportunidade',
            deal_value: null,
            won_at: null,
            closer_name: null,
            opportunity_type: null,
          });
        }
      }

      return result;
    },
    enabled: !!partnerId,
  });
}

export function useCreatePartner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (partner: {
      name: string;
      email?: string;
      phone?: string;
      company?: string;
      partner_type: string;
      commission_rate?: number;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from('partners').insert({
        ...partner,
        created_by_user_id: user?.id || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      toast.success('Parceiro cadastrado');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao cadastrar parceiro');
    },
  });
}

export function useUpdatePartner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Partner> }) => {
      const { error } = await (supabase as any)
        .from('partners')
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      toast.success('Parceiro atualizado');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao atualizar parceiro');
    },
  });
}

export function useDeletePartner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('partners').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      toast.success('Parceiro removido');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Erro ao remover parceiro');
    },
  });
}
