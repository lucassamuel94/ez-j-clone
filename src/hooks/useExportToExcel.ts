import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface ExportLeadParams {
  tab: string;
  sdrId?: string | null;
  search?: string;
  statuses?: string[] | null;
}

interface ExportOpportunityParams {
  tab: string;
  closerId?: string | null;
  search?: string;
  stages?: string[] | null;
  meetingFrom?: string | null;
  meetingTo?: string | null;
  wonFrom?: string | null;
  wonTo?: string | null;
}

const UNASSIGNED_SENTINEL = '00000000-0000-0000-0000-000000000000';

function formatDate(d: string | null | undefined): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function formatCurrency(v: number | null | undefined): string {
  if (!v) return '';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function useExportLeadsToExcel() {
  const [isExporting, setIsExporting] = useState(false);

  const exportLeads = useCallback(async (params: ExportLeadParams) => {
    setIsExporting(true);
    try {
      const sdrIdParam = !params.sdrId || params.sdrId === 'all'
        ? null
        : params.sdrId === 'unassigned'
          ? UNASSIGNED_SENTINEL
          : params.sdrId;

      const { data, error } = await supabase.rpc('get_filtered_lead_ids', {
        p_tab: params.tab,
        p_sdr_id: sdrIdParam,
        p_search: params.search?.trim() || '',
        p_statuses: params.statuses || null,
        p_limit: 10000,
      } as any);
      if (error) throw error;

      const ids = (data as string[]) || [];
      if (ids.length === 0) {
        toast.info('Nenhum lead para exportar com os filtros atuais.');
        return;
      }

      // Fetch lead data in batches of 500
      const allLeads: any[] = [];
      for (let i = 0; i < ids.length; i += 500) {
        const batch = ids.slice(i, i + 500);
        const { data: leads, error: leadsErr } = await supabase
          .from('leads')
          .select('name, company, cnpj, phone, whatsapp, email, status, temperature, city, state, source, created_at, next_action_at, last_contact_at, owner_user_id')
          .in('id', batch);
        if (leadsErr) throw leadsErr;
        allLeads.push(...(leads || []));
      }

      // Fetch owner names
      const ownerIds = [...new Set(allLeads.map(l => l.owner_user_id).filter(Boolean))];
      let ownerMap: Record<string, string> = {};
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', ownerIds);
        ownerMap = Object.fromEntries((profiles || []).map(p => [p.id, p.name]));
      }

      const rows = allLeads.map(l => ({
        'Nome': l.name || '',
        'Empresa': l.company || '',
        'CNPJ': l.cnpj || '',
        'Telefone': l.phone || '',
        'WhatsApp': l.whatsapp || '',
        'E-mail': l.email || '',
        'Status': l.status || '',
        'Temperatura': l.temperature || '',
        'Cidade': l.city || '',
        'UF': l.state || '',
        'Origem': l.source || '',
        'Responsável': ownerMap[l.owner_user_id] || '',
        'Criado em': formatDate(l.created_at),
        'Próxima Ação': formatDate(l.next_action_at),
        'Último Contato': formatDate(l.last_contact_at),
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Leads');
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadWorkbook(wb, `leads_${dateStr}.xlsx`);
      toast.success(`${rows.length} leads exportados com sucesso`);
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Erro ao exportar leads');
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportLeads, isExporting };
}

export function useExportOpportunitiesToExcel() {
  const [isExporting, setIsExporting] = useState(false);

  const exportOpportunities = useCallback(async (params: ExportOpportunityParams) => {
    setIsExporting(true);
    try {
      const closerIdParam = !params.closerId || params.closerId === 'all'
        ? null
        : params.closerId === 'unassigned'
          ? UNASSIGNED_SENTINEL
          : params.closerId;

      // Use the paginated RPC with a large page to get all data with joined fields
      const { data: result, error } = await supabase.rpc('search_opportunities_paginated', {
        p_tab: params.tab,
        p_closer_id: closerIdParam,
        p_search: params.search?.trim() || '',
        p_stages: params.stages && params.stages.length > 0 ? params.stages : null,
        p_meeting_from: params.meetingFrom || null,
        p_meeting_to: params.meetingTo || null,
        p_won_from: params.wonFrom || null,
        p_won_to: params.wonTo || null,
        p_page: 1,
        p_page_size: 10000,
      } as any);

      if (error) throw error;

      const parsed = result as any;
      const opps = parsed.data || [];

      if (opps.length === 0) {
        toast.info('Nenhuma oportunidade para exportar com os filtros atuais.');
        return;
      }

      const rows = opps.map((o: any) => ({
        'Contato': o.lead_name || '',
        'Empresa': o.lead_company || '',
        'CNPJ': o.lead_cnpj || '',
        'Telefone': o.lead_phone || '',
        'WhatsApp': o.lead_whatsapp || '',
        'E-mail': o.lead_email || '',
        'Estágio': o.stage || '',
        'Valor': formatCurrency(Number(o.deal_value) || 0),
        'Temperatura': o.lead_temperature || '',
        'SDR': o.sdr_name || '',
        'Closer': o.closer_name || '',
        'Reunião': formatDate(o.meeting_datetime),
        'Criado em': formatDate(o.created_at),
        'Atualizado em': formatDate(o.updated_at),
        'Site': o.lead_website || '',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Oportunidades');
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadWorkbook(wb, `oportunidades_${dateStr}.xlsx`);
      toast.success(`${rows.length} oportunidades exportadas com sucesso`);
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Erro ao exportar oportunidades');
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportOpportunities, isExporting };
}
