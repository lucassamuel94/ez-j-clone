import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface IntegrationEntry {
  integration_name: string;
  notes: string | null;
  is_new: boolean;
  project_count: number;
  companies: string[];
}

export function useIntegrations() {
  return useQuery({
    queryKey: ['integrations-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_integrations')
        .select('integration_name, notes, is_new, project_id, projects:project_id(company_name)');

      if (error) throw error;

      // Group by integration_name (case-insensitive)
      const map = new Map<string, {
        integration_name: string;
        notes: string | null;
        is_new: boolean;
        projectIds: Set<string>;
        companies: Set<string>;
      }>();

      for (const row of data || []) {
        const key = row.integration_name.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            integration_name: row.integration_name.trim(),
            notes: row.notes,
            is_new: row.is_new,
            projectIds: new Set(),
            companies: new Set(),
          });
        }
        const entry = map.get(key)!;
        entry.projectIds.add(row.project_id);
        if (row.notes && !entry.notes) entry.notes = row.notes;
        if (row.is_new) entry.is_new = true;
        const companyName = (row as any).projects?.company_name;
        if (companyName) entry.companies.add(companyName);
      }

      const result: IntegrationEntry[] = Array.from(map.values()).map((e) => ({
        integration_name: e.integration_name,
        notes: e.notes,
        is_new: e.is_new,
        project_count: e.projectIds.size,
        companies: Array.from(e.companies).sort(),
      }));

      result.sort((a, b) => b.project_count - a.project_count);
      return result;
    },
  });
}
