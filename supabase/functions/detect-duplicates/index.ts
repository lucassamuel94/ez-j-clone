import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function similarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.includes(shorter)) return shorter.length / longer.length;

  let matches = 0;
  const range = Math.floor(Math.max(a.length, b.length) / 2) - 1;
  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);

  for (let i = 0; i < a.length; i++) {
    const lo = Math.max(0, i - range);
    const hi = Math.min(i + range + 1, b.length);
    for (let j = lo; j < hi; j++) {
      if (!bMatches[j] && a[i] === b[j]) {
        aMatches[i] = true; bMatches[j] = true; matches++; break;
      }
    }
  }
  if (matches === 0) return 0;

  let t = 0, k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  return (matches / a.length + matches / b.length + (matches - t / 2) / matches) / 3;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, name, company, email, phone, whatsapp, cnpj, razao_social, nome_fantasia, status, created_at')
      .not('status', 'eq', 'descartado')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) throw error;

    const duplicateGroups: Array<{ leads: any[]; matchType: string; confidence: number }> = [];
    const processed = new Set<string>();

    for (let i = 0; i < (leads || []).length; i++) {
      if (processed.has(leads![i].id)) continue;
      const lead = leads![i];
      const group: any[] = [lead];

      for (let j = i + 1; j < (leads || []).length; j++) {
        if (processed.has(leads![j].id)) continue;
        const other = leads![j];
        let matchType = '';
        let confidence = 0;

        if (lead.cnpj && other.cnpj && lead.cnpj.replace(/\D/g, '') === other.cnpj.replace(/\D/g, '')) {
          matchType = 'CNPJ idêntico'; confidence = 0.95;
        } else if (lead.email && other.email && lead.email.toLowerCase() === other.email.toLowerCase()) {
          matchType = 'Email idêntico'; confidence = 0.90;
        } else if (lead.phone && other.phone && lead.phone.replace(/\D/g, '') === other.phone.replace(/\D/g, '')) {
          matchType = 'Telefone idêntico'; confidence = 0.85;
        } else if (lead.whatsapp && other.whatsapp && lead.whatsapp.replace(/\D/g, '') === other.whatsapp.replace(/\D/g, '')) {
          matchType = 'WhatsApp idêntico'; confidence = 0.85;
        } else {
          const compA = lead.razao_social || lead.nome_fantasia || lead.company || '';
          const compB = other.razao_social || other.nome_fantasia || other.company || '';
          const sim = similarity(compA, compB);
          if (sim >= 0.85) { matchType = 'Razão social similar'; confidence = sim * 0.8; }
        }

        if (confidence >= 0.6) {
          group.push({ ...other, matchType, confidence });
          processed.add(other.id);
        }
      }

      if (group.length > 1) {
        processed.add(lead.id);
        duplicateGroups.push({ leads: group, matchType: group[1].matchType, confidence: group[1].confidence });
      }
    }

    duplicateGroups.sort((a, b) => b.confidence - a.confidence);

    return new Response(JSON.stringify({
      duplicates: duplicateGroups.slice(0, 50),
      totalLeadsScanned: (leads || []).length,
      totalDuplicateGroups: duplicateGroups.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
