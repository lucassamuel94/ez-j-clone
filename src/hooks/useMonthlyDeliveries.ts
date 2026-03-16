import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MonthlyDeliveryItem {
  id: string;
  company_name: string | null;
  project_type_label: string | null;
  complexity_level: string | null;
  uses_gpt: boolean;
  has_integration: boolean;
  delivered_at: string;
  version: string | null;
  ux_responsible: string | null;
  dev_responsible: string | null;
  treinamento_responsible: string | null;
}

export interface TeamDeliveryGroup {
  responsible: string;
  count: number;
  items: MonthlyDeliveryItem[];
}

export interface MonthlyDeliveriesData {
  ux: TeamDeliveryGroup[];
  dev: TeamDeliveryGroup[];
  treinamento: TeamDeliveryGroup[];
  totalUx: number;
  totalDev: number;
  totalTreinamento: number;
}

export function useMonthlyDeliveries(month: number, year: number) {
  return useQuery({
    queryKey: ['monthly-deliveries', month, year],
    queryFn: async (): Promise<MonthlyDeliveriesData> => {
      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();

      // --- UX & Treinamento: still from project_deliveries ---
      const { data: deliveries, error } = await supabase
        .from('project_deliveries')
        .select('id, company_name, project_type_label, complexity_level, uses_gpt, has_integration, delivered_at, version, ux_responsible, dev_responsible, project_id')
        .gte('delivered_at', startDate)
        .lte('delivered_at', endDate)
        .order('delivered_at', { ascending: false });

      if (error) throw error;

      // Get treinamento responsible from projects
      const projectIds = [...new Set((deliveries || []).map(d => d.project_id))];
      let treinamentoMap = new Map<string, string>();

      if (projectIds.length > 0) {
        const { data: projects } = await supabase
          .from('projects')
          .select('id, treinamento_user_id')
          .in('id', projectIds)
          .not('treinamento_user_id', 'is', null);

        const userIds = [...new Set((projects || []).map(p => p.treinamento_user_id).filter(Boolean))] as string[];
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', userIds);

          const profileMap = new Map((profiles || []).map(p => [p.id, p.name]));
          for (const p of projects || []) {
            if (p.treinamento_user_id) {
              treinamentoMap.set(p.id, profileMap.get(p.treinamento_user_id) || 'Desconhecido');
            }
          }
        }
      }

      const deliveryItems: MonthlyDeliveryItem[] = (deliveries || []).map(d => ({
        id: d.id,
        company_name: d.company_name,
        project_type_label: d.project_type_label,
        complexity_level: d.complexity_level,
        uses_gpt: d.uses_gpt,
        has_integration: d.has_integration,
        delivered_at: d.delivered_at,
        version: d.version,
        ux_responsible: d.ux_responsible,
        dev_responsible: d.dev_responsible,
        treinamento_responsible: treinamentoMap.get(d.project_id) || null,
      }));

      // --- Dev Chatbot: from project_phases (dev_chatbot phase completed) ---
      const { data: devPhases, error: devError } = await supabase
        .from('project_phases')
        .select('id, project_id, completed_at, assigned_user_id')
        .eq('phase_name', 'dev_chatbot')
        .eq('status', 'CONCLUÍDO')
        .gte('completed_at', startDate)
        .lte('completed_at', endDate)
        .order('completed_at', { ascending: false });

      if (devError) throw devError;

      let devItems: MonthlyDeliveryItem[] = [];

      if (devPhases && devPhases.length > 0) {
        const devProjectIds = [...new Set(devPhases.map(p => p.project_id))];
        const devUserIds = [...new Set(devPhases.map(p => p.assigned_user_id).filter(Boolean))] as string[];

        // Fetch project details and user names in parallel
        const [projectsRes, profilesRes] = await Promise.all([
          supabase
            .from('projects')
            .select('id, company_name, project_type, complexity_level, has_ai, has_integration, version')
            .in('id', devProjectIds),
          devUserIds.length > 0
            ? supabase.from('profiles').select('id, name').in('id', devUserIds)
            : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        ]);

        const devProjectMap = new Map((projectsRes.data || []).map(p => [p.id, p]));
        const devProfileMap = new Map((profilesRes.data || []).map(p => [p.id, p.name]));

        devItems = devPhases.map(phase => {
          const proj = devProjectMap.get(phase.project_id);
          return {
            id: phase.id,
            company_name: proj?.company_name || null,
            project_type_label: proj?.project_type || null,
            complexity_level: proj?.complexity_level || null,
            uses_gpt: proj?.has_ai ?? false,
            has_integration: proj?.has_integration ?? false,
            delivered_at: phase.completed_at!,
            version: proj?.version || null,
            ux_responsible: null,
            dev_responsible: phase.assigned_user_id ? (devProfileMap.get(phase.assigned_user_id) || 'Desconhecido') : null,
            treinamento_responsible: null,
          };
        });
      }

      return {
        ux: groupByResponsible(deliveryItems, 'ux_responsible'),
        dev: groupByResponsible(devItems, 'dev_responsible'),
        treinamento: groupByResponsible(deliveryItems, 'treinamento_responsible'),
        totalUx: deliveryItems.filter(i => i.ux_responsible).length,
        totalDev: devItems.filter(i => i.dev_responsible).length,
        totalTreinamento: deliveryItems.filter(i => i.treinamento_responsible).length,
      };
    },
    staleTime: 5 * 60_000,
  });
}

function groupByResponsible(
  items: MonthlyDeliveryItem[],
  field: 'ux_responsible' | 'dev_responsible' | 'treinamento_responsible',
): TeamDeliveryGroup[] {
  const map = new Map<string, MonthlyDeliveryItem[]>();
  for (const item of items) {
    const name = item[field];
    if (!name) continue;
    if (!map.has(name)) map.set(name, []);
    map.get(name)!.push(item);
  }
  return Array.from(map.entries())
    .map(([responsible, groupItems]) => ({ responsible, count: groupItems.length, items: groupItems }))
    .sort((a, b) => b.count - a.count);
}
