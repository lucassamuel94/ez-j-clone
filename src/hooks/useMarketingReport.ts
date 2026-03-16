import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';

export interface MarketingFunnelRow {
  source: string;
  totalLeads: number;
  novo: number;
  emContato: number;
  reuniao: number;
  sqo: number;
  proposta: number;
  ganho: number;
  perdido: number;
  outros: number;
  receita: number;
  taxaConversao: number;
  semUtm: number;
}

export interface SLAMetrics {
  leadsNaoAcionados: number;
  tempoMedioPrimeiroContatoHoras: number | null;
  tempoMedioSQODias: number | null;
  tempoMedioDescarteDias: number | null;
  leadsNaoAcionadosList: Array<{
    id: string;
    name: string;
    company: string;
    phone: string;
    email: string;
    source: string;
    created_at: string;
    horasEspera: number;
  }>;
  slaPorFonte: Array<{
    source: string;
    total: number;
    naoAcionados: number;
    tempoMedioPrimeiroContatoHoras: number | null;
  }>;
}

export interface MarketingCampaignRow {
  campaign: string;
  sources: string[];
  totalLeads: number;
  reuniao: number;
  sqo: number;
  ganho: number;
  receita: number;
  taxaConversao: number;
}

export interface MarketingKPIs {
  totalLeads: number;
  taxaSQL: number;
  taxaSQO: number;
  taxaConversao: number;
  receitaTotal: number;
  totalGanhos: number;
}

interface UseMarketingReportParams {
  dateRange: { start: string; end: string };
  leadType: 'all' | 'INBOUND' | 'OUTBOUND';
  utmMedium?: string;
  utmSource?: string;
}

export function useMarketingReport({ dateRange, leadType, utmMedium, utmSource }: UseMarketingReportParams) {
  const { data: leadsData, isLoading: isLoadingLeads } = useQuery({
    queryKey: ['marketing-leads', dateRange.start, dateRange.end, leadType],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select('id, name, company, phone, email, source, status, sqo_approved_at, utm_source, utm_medium, utm_campaign, created_at, last_contact_at, updated_at')
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end);

      if (leadType !== 'all') {
        query = query.eq('lead_type', leadType);
      }

      const { data, error } = await query.limit(5000);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const leadIds = useMemo(() => (leadsData || []).map(l => l.id), [leadsData]);

  const { data: opportunitiesData, isLoading: isLoadingOpps } = useQuery({
    queryKey: ['marketing-opportunities', leadIds],
    queryFn: async () => {
      if (leadIds.length === 0) return [];
      // Batch in groups of 200 for .in() limits
      const allOpps: Array<{ lead_id: string; stage: string; deal_value: number | null }> = [];
      for (let i = 0; i < leadIds.length; i += 200) {
        const batch = leadIds.slice(i, i + 200);
        const { data, error } = await supabase
          .from('opportunities')
          .select('lead_id, stage, deal_value')
          .in('lead_id', batch);
        if (error) throw error;
        if (data) allOpps.push(...data);
      }
      return allOpps;
    },
    enabled: leadIds.length > 0,
    staleTime: 30_000,
  });

  const result = useMemo(() => {
    if (!leadsData) return { funnelBySource: [], campaignRows: [], kpis: null, rawLeads: leadsData || [], oppsMap: new Map() };

    // Apply UTM filters client-side
    const filteredLeads = leadsData.filter((lead) => {
      if (utmMedium && utmMedium !== 'all') {
        const lm = (lead as Record<string, unknown>).utm_medium as string | null;
        if (lm !== utmMedium) return false;
      }
      if (utmSource && utmSource !== 'all') {
        const ls = (lead as Record<string, unknown>).utm_source as string | null;
        if (ls !== utmSource) return false;
      }
      return true;
    });

    const oppsMap = new Map<string, Array<{ stage: string; deal_value: number | null }>>();
    for (const opp of (opportunitiesData || [])) {
      if (!opp.lead_id) continue;
      const arr = oppsMap.get(opp.lead_id) || [];
      arr.push(opp);
      oppsMap.set(opp.lead_id, arr);
    }

    // Group by source
    const sourceMap = new Map<string, typeof filteredLeads>();
    for (const lead of filteredLeads) {
      const src = lead.source || 'Sem fonte';
      const arr = sourceMap.get(src) || [];
      arr.push(lead);
      sourceMap.set(src, arr);
    }

    const MEETING_STATUSES = ['Reunião agendada', 'Oportunidade criada'];
    const CONTACT_STATUSES = ['Em contato', 'Ocupado', 'Agendar retorno', 'Sem retorno', 'Interesse', 'Interesse/Agendar Retorno', 'Reagendar Reunião'];

    const funnelBySource: MarketingFunnelRow[] = [];

    for (const [source, leads] of sourceMap) {
      let novo = 0, emContato = 0, reuniao = 0, sqo = 0, proposta = 0, ganho = 0, perdido = 0, outros = 0, receita = 0, semUtm = 0;

      for (const lead of leads) {
        const isNovo = lead.status === 'Novo';
        const isContact = CONTACT_STATUSES.includes(lead.status);
        const isMeeting = MEETING_STATUSES.includes(lead.status);

        if (isNovo) novo++;
        else if (isContact) emContato++;
        else if (isMeeting) reuniao++;
        else outros++;

        if (lead.sqo_approved_at) sqo++;

        const camp = (lead as Record<string, unknown>).utm_campaign as string | null;
        if (!camp) semUtm++;

        const opps = oppsMap.get(lead.id) || [];
        for (const opp of opps) {
          if (['Proposta', 'Negociação'].includes(opp.stage)) proposta++;
          if (opp.stage === 'Ganho') {
            ganho++;
            receita += opp.deal_value || 0;
          }
          if (opp.stage === 'Perdido') perdido++;
        }
      }

      funnelBySource.push({
        source,
        totalLeads: leads.length,
        novo,
        emContato,
        reuniao,
        sqo,
        proposta,
        ganho,
        perdido,
        outros,
        receita,
        taxaConversao: leads.length > 0 ? (ganho / leads.length) * 100 : 0,
        semUtm,
      });
    }

    funnelBySource.sort((a, b) => b.totalLeads - a.totalLeads);

    // Group by utm_campaign
    const campaignMap = new Map<string, typeof filteredLeads>();
    for (const lead of filteredLeads) {
      const camp = (lead as Record<string, unknown>).utm_campaign as string | null;
      if (!camp) continue;
      const arr = campaignMap.get(camp) || [];
      arr.push(lead);
      campaignMap.set(camp, arr);
    }

    const campaignRows: MarketingCampaignRow[] = [];
    for (const [campaign, leads] of campaignMap) {
      let reuniao = 0, sqo = 0, ganho = 0, receita = 0;
      for (const lead of leads) {
        if (MEETING_STATUSES.includes(lead.status)) reuniao++;
        if (lead.sqo_approved_at) sqo++;
        const opps = oppsMap.get(lead.id) || [];
        for (const opp of opps) {
          if (opp.stage === 'Ganho') {
            ganho++;
            receita += opp.deal_value || 0;
          }
        }
      }
      campaignRows.push({
        campaign,
        sources: [...new Set(leads.map(l => l.source || 'Sem fonte'))],
        totalLeads: leads.length,
        reuniao,
        sqo,
        ganho,
        receita,
        taxaConversao: leads.length > 0 ? (ganho / leads.length) * 100 : 0,
      });
    }
    campaignRows.sort((a, b) => b.totalLeads - a.totalLeads);

    // KPIs
    const totalLeads = filteredLeads.length;
    let totalReuniao = 0, totalSQO = 0, totalGanho = 0, totalReceita = 0;
    for (const row of funnelBySource) {
      totalReuniao += row.reuniao;
      totalSQO += row.sqo;
      totalGanho += row.ganho;
      totalReceita += row.receita;
    }

    const kpis: MarketingKPIs = {
      totalLeads,
      taxaSQL: totalLeads > 0 ? (totalReuniao / totalLeads) * 100 : 0,
      taxaSQO: totalLeads > 0 ? (totalSQO / totalLeads) * 100 : 0,
      taxaConversao: totalLeads > 0 ? (totalGanho / totalLeads) * 100 : 0,
      receitaTotal: totalReceita,
      totalGanhos: totalGanho,
    };

    // SLA Metrics
    const now = Date.now();
    const msToHours = (ms: number) => ms / (1000 * 60 * 60);
    const msToDays = (ms: number) => ms / (1000 * 60 * 60 * 24);

    // Leads não acionados (status Novo)
    const leadsNovos = filteredLeads.filter(l => l.status === 'Novo');
    const leadsNaoAcionadosList = leadsNovos.map(l => ({
      id: l.id,
      name: l.name,
      company: l.company,
      phone: l.phone,
      email: l.email,
      source: l.source || 'Sem fonte',
      created_at: l.created_at,
      horasEspera: Math.round(msToHours(now - new Date(l.created_at).getTime()) * 10) / 10,
    })).sort((a, b) => b.horasEspera - a.horasEspera);

    // Tempo médio primeiro contato
    const leadsComContato = filteredLeads.filter(l => l.last_contact_at && l.status !== 'Novo');
    let tempoMedioPrimeiroContatoHoras: number | null = null;
    if (leadsComContato.length > 0) {
      const totalHoras = leadsComContato.reduce((sum, l) => {
        const diff = new Date(l.last_contact_at!).getTime() - new Date(l.created_at).getTime();
        return sum + Math.max(0, msToHours(diff));
      }, 0);
      tempoMedioPrimeiroContatoHoras = Math.round((totalHoras / leadsComContato.length) * 10) / 10;
    }

    // Tempo médio até SQO
    const leadsComSQO = filteredLeads.filter(l => l.sqo_approved_at);
    let tempoMedioSQODias: number | null = null;
    if (leadsComSQO.length > 0) {
      const totalDias = leadsComSQO.reduce((sum, l) => {
        const diff = new Date(l.sqo_approved_at!).getTime() - new Date(l.created_at).getTime();
        return sum + Math.max(0, msToDays(diff));
      }, 0);
      tempoMedioSQODias = Math.round((totalDias / leadsComSQO.length) * 10) / 10;
    }

    // Tempo médio até descarte
    const leadsDescartados = filteredLeads.filter(l => l.status === 'Descartado' && l.updated_at);
    let tempoMedioDescarteDias: number | null = null;
    if (leadsDescartados.length > 0) {
      const totalDias = leadsDescartados.reduce((sum, l) => {
        const diff = new Date(l.updated_at!).getTime() - new Date(l.created_at).getTime();
        return sum + Math.max(0, msToDays(diff));
      }, 0);
      tempoMedioDescarteDias = Math.round((totalDias / leadsDescartados.length) * 10) / 10;
    }

    // SLA por fonte
    const slaSourceMap = new Map<string, { total: number; naoAcionados: number; contatoHoras: number[] }>();
    for (const lead of filteredLeads) {
      const src = lead.source || 'Sem fonte';
      const entry = slaSourceMap.get(src) || { total: 0, naoAcionados: 0, contatoHoras: [] };
      entry.total++;
      if (lead.status === 'Novo') entry.naoAcionados++;
      if (lead.last_contact_at && lead.status !== 'Novo') {
        const diff = new Date(lead.last_contact_at).getTime() - new Date(lead.created_at).getTime();
        entry.contatoHoras.push(Math.max(0, msToHours(diff)));
      }
      slaSourceMap.set(src, entry);
    }

    const slaPorFonte = Array.from(slaSourceMap.entries()).map(([source, data]) => ({
      source,
      total: data.total,
      naoAcionados: data.naoAcionados,
      tempoMedioPrimeiroContatoHoras: data.contatoHoras.length > 0
        ? Math.round((data.contatoHoras.reduce((a, b) => a + b, 0) / data.contatoHoras.length) * 10) / 10
        : null,
    })).sort((a, b) => b.naoAcionados - a.naoAcionados);

    const slaMetrics: SLAMetrics = {
      leadsNaoAcionados: leadsNovos.length,
      tempoMedioPrimeiroContatoHoras,
      tempoMedioSQODias,
      tempoMedioDescarteDias,
      leadsNaoAcionadosList,
      slaPorFonte,
    };

    return { funnelBySource, campaignRows, kpis, rawLeads: leadsData, oppsMap, slaMetrics };
  }, [leadsData, opportunitiesData, utmMedium, utmSource]);

  return {
    ...result,
    isLoading: isLoadingLeads || isLoadingOpps,
  };
}
