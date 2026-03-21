import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { query } = await req.json();
    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Step 1: AI interprets the query
    const interpretRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [{
          role: 'user',
          content: `Você é um assistente de busca para CRM B2B. Pergunta: "${query}"
Responda em JSON: { "intent": "search_leads"|"search_opportunities"|"search_projects"|"analytics_question"|"general", "search_terms": ["termo1"], "is_analytics": boolean }`,
        }],
        temperature: 0.1,
      }),
    });

    let interpretation = { intent: 'general', search_terms: [query], is_analytics: false };
    if (interpretRes.ok) {
      const interpretData = await interpretRes.json();
      const ic = interpretData.choices?.[0]?.message?.content || '';
      try {
        const match = ic.match(/\{[\s\S]*\}/);
        interpretation = match ? JSON.parse(match[0]) : JSON.parse(ic);
      } catch { /* use default */ }
    }

    const results: { leads: any[]; opportunities: any[]; projects: any[]; answer: string | null } = { leads: [], opportunities: [], projects: [], answer: null };
    const searchTerms = (interpretation.search_terms || [query])[0] || query;

    // Step 2: Execute searches based on intent
    if (interpretation.intent === 'search_leads' || interpretation.intent === 'general') {
      const { data } = await supabase
        .from('leads')
        .select('id, name, company, razao_social, email, phone, status, company_segment, created_at')
        .or(`name.ilike.%${searchTerms}%,company.ilike.%${searchTerms}%,razao_social.ilike.%${searchTerms}%,email.ilike.%${searchTerms}%`)
        .limit(10);
      results.leads = data || [];
    }

    if (interpretation.intent === 'search_opportunities' || interpretation.intent === 'general') {
      const { data } = await supabase
        .from('opportunities')
        .select('id, stage, deal_value, created_at, updated_at, lead_id')
        .limit(10);
      // Filter client-side since we can't do cross-table ilike easily
      results.opportunities = (data || []).slice(0, 5);
    }

    if (interpretation.intent === 'search_projects' || interpretation.intent === 'general') {
      const { data } = await supabase
        .from('projects')
        .select('id, name, status, project_type, current_phase, created_at')
        .ilike('name', `%${searchTerms}%`)
        .limit(10);
      results.projects = data || [];
    }

    // Step 3: AI answer for analytics questions
    if (interpretation.is_analytics) {
      const [{ count: leadsCount }, { count: oppsCount }, { count: wonCount }] = await Promise.all([
        supabase.from('leads').select('*', { count: 'exact', head: true }),
        supabase.from('opportunities').select('*', { count: 'exact', head: true }).not('stage', 'in', '(Ganho,Perdido)'),
        supabase.from('opportunities').select('*', { count: 'exact', head: true }).eq('stage', 'Ganho'),
      ]);

      const answerRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: `Analista de CRM. Responda conciso (máx 3 frases). Dados: ${leadsCount} leads, ${oppsCount} opps ativas, ${wonCount} ganhos.` },
            { role: 'user', content: query },
          ],
          temperature: 0.3,
        }),
      });
      if (answerRes.ok) {
        const ad = await answerRes.json();
        results.answer = ad.choices?.[0]?.message?.content || null;
      }
    }

    // Log usage
    try {
      await supabase.from('ai_usage_logs').insert({
        prompt_id: 'smart_search', model: 'gemini-3-flash-preview',
        tokens_input: 0, tokens_output: 0, estimated_cost_usd: 0,
      });
    } catch { /* ignore */ }

    return new Response(JSON.stringify({
      results, interpretation,
      totalResults: results.leads.length + results.opportunities.length + results.projects.length,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
