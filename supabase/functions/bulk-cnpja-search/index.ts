import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Same cleaning logic as the frontend
function cleanCompanyName(name: string): string {
  const productSuffixes = [
    'ezchat', 'ez chat', 'ez-chat', 'new deal', 'newdeal',
    'chatbot', 'chat bot', 'chat-bot', 'whatsapp', 'wpp',
    'automação', 'automacao', 'automation', 'plataforma', 'platform',
    'sistema', 'systems', 'system', 'software', 'saas', 'app', 'crm', 'erp',
    'hub', 'labs', 'lab', 'tech', 'tec', 'studio', 'studios', 'academy',
    'bot', 'bots', 'ia', 'ai', 'pro', 'plus', 'premium', 'enterprise',
    'soluções digitais', 'solucoes digitais', 'evolução', 'evolucao', 'evolution',
  ];

  let cleaned = name.trim();
  for (const suffix of productSuffixes) {
    const regex = new RegExp(`\\b${suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    cleaned = cleaned.replace(regex, '');
  }

  const stopWords = new Set([
    'ltda', 'me', 'sa', 's/a', 'eireli', 'epp', 'ss',
    'proteção', 'veicular', 'associação', 'associados', 'associada',
    'serviços', 'servicos', 'soluções', 'solucoes', 'tecnologia',
    'consultoria', 'assessoria', 'gestão', 'gestao', 'comercio',
    'comércio', 'indústria', 'industria', 'distribuidora', 'importação',
    'exportação', 'importacao', 'exportacao', 'empreendimentos',
    'participações', 'participacoes', 'holdings', 'holding',
    'grupo', 'cia', 'companhia', 'limitada', 'individual',
    'microempresa', 'empresa', 'empresarial', 'brasil', 'brasileira',
    'nacional', 'internacional', 'global', 'digital', 'online',
    'marketing', 'comunicação', 'comunicacao', 'editora', 'agência', 'agencia',
  ]);

  const words = cleaned.split(/\s+/).filter(w => {
    const lower = w.toLowerCase().replace(/[.,;:\-()]/g, '');
    return lower.length > 1 && !stopWords.has(lower);
  });

  return words.slice(0, 3).join(' ').trim();
}

function formatPhone(phone: any): string {
  if (!phone) return "";
  if (typeof phone === "string") {
    const digits = phone.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 11) return `+55${digits}`;
    if (digits.length >= 12 && digits.startsWith("55")) return `+${digits}`;
    return phone;
  }
  const area = phone.area || "";
  const number = phone.number || "";
  if (!area && !number) return "";
  return `+55${area}${number}`;
}

interface LogEntry {
  leadId: string;
  company: string;
  searchName: string;
  status: 'found' | 'not_found' | 'skipped' | 'error';
  skipReason?: string;
  cnpjReturned?: string;
  razaoSocialReturned?: string;
  fieldsUpdated: string[];
  errorMsg?: string;
  source?: 'cnpja' | 'perplexity';
}

// Reduced batch size for faster checkpoints - especially important for Perplexity
const BATCH_SIZE = 10;
const CHECKPOINT_INTERVAL = 3; // Save progress every N leads
const MAX_EXECUTION_MS = 45_000; // Early exit at 45s to avoid timeout

const DATA_CONDITIONS_MAP: Record<string, { field: string; mode: 'empty' | 'filled' }> = {
  sem_cnpj: { field: 'cnpj', mode: 'empty' },
  com_cnpj: { field: 'cnpj', mode: 'filled' },
  sem_telefone: { field: 'phone', mode: 'empty' },
  sem_email: { field: 'email', mode: 'empty' },
  sem_nome_fantasia: { field: 'nome_fantasia', mode: 'empty' },
  sem_razao_social: { field: 'razao_social', mode: 'empty' },
  sem_website: { field: 'website', mode: 'empty' },
  sem_segmento: { field: 'company_segment', mode: 'empty' },
  sem_cidade: { field: 'city', mode: 'empty' },
  sem_porte: { field: 'porte', mode: 'empty' },
  sem_cnae: { field: 'cnae_fiscal_descricao', mode: 'empty' },
};

// ── CNPJá enrichment for a single lead ──
async function enrichViaCnpja(
  lead: any,
  cnpjaKey: string,
  preserveExisting: boolean,
  cacheDays: number,
  ignoreCnpjaCache: boolean,
): Promise<{ logEntry: LogEntry; updates: Record<string, any> | null; found: boolean; error: boolean; skipped: boolean }> {
  const rawName = lead.razao_social || lead.nome_fantasia || lead.company;
  if (!rawName || rawName.trim().length < 2) {
    return {
      logEntry: { leadId: lead.id, company: lead.company || '(vazio)', searchName: '(nome muito curto)', status: 'skipped', skipReason: 'Nome vazio ou < 2 caracteres', fieldsUpdated: [], source: 'cnpja' },
      updates: null, found: false, error: false, skipped: true,
    };
  }

  const searchName = cleanCompanyName(rawName);
  if (!searchName || searchName.trim().length < 2) {
    return {
      logEntry: { leadId: lead.id, company: rawName, searchName: `"${searchName}" (limpo demais)`, status: 'skipped', skipReason: 'Após remover termos genéricos, insuficiente', fieldsUpdated: [], source: 'cnpja' },
      updates: null, found: false, error: false, skipped: true,
    };
  }

  // Cache check
  if (!ignoreCnpjaCache && lead.cnpja_last_searched_at) {
    const daysSince = (Date.now() - new Date(lead.cnpja_last_searched_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < cacheDays) {
      return {
        logEntry: { leadId: lead.id, company: rawName, searchName, status: 'skipped', skipReason: `Cache de ${Math.floor(daysSince)} dias`, fieldsUpdated: [], source: 'cnpja' },
        updates: null, found: false, error: false, skipped: true,
      };
    }
  }

  // Call CNPJá API
  let result: any = null;
  let retries = 0;
  const MAX_RETRIES = 5;

  while (retries <= MAX_RETRIES) {
    try {
      const url = new URL("https://api.cnpja.com/office");
      url.searchParams.set("names.in", searchName);
      url.searchParams.set("limit", "1");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: { Authorization: cnpjaKey },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.status === 429) {
        retries++;
        if (retries > MAX_RETRIES) break;
        const backoffMs = Math.min(15000 * Math.pow(1.5, retries - 1), 120000);
        console.log(`Rate limit for "${searchName}", waiting ${Math.round(backoffMs / 1000)}s (attempt ${retries}/${MAX_RETRIES})`);
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }

      if (!response.ok) {
        console.error(`CNPJá error ${response.status} for "${searchName}"`);
        break;
      }

      const data = await response.json();
      let results: any[] = [];
      if (Array.isArray(data)) results = data;
      else if (data?.data && Array.isArray(data.data)) results = data.data;
      else if (data?.records && Array.isArray(data.records)) results = data.records;

      if (results.length > 0) {
        const item = results[0];
        const company = item.company || {};
        const address = item.address || {};
        const mainActivity = item.mainActivity || {};
        const status = item.status || {};

        result = {
          cnpj: item.taxId || item.cnpj || "",
          razao_social: company.name || item.name || "",
          nome_fantasia: item.alias || "",
          porte: company.size?.text || "",
          capital_social: company.equity || null,
          situacao_cadastral: status.text || "",
          cnae_fiscal: mainActivity.id || null,
          cnae_fiscal_descricao: mainActivity.text || "",
          data_inicio_atividade: item.founded || "",
          logradouro: address.street || "",
          numero: address.number || "",
          complemento: address.details || "",
          bairro: address.district || "",
          city: address.city || "",
          state: address.state || "",
          cep: address.zip || "",
          phone: item.phones?.[0] ? formatPhone(item.phones[0]) : "",
          phone_2: item.phones?.[1] ? formatPhone(item.phones[1]) : "",
          email: item.emails?.[0]?.address || "",
        };
      }
      break;
    } catch (e: any) {
      retries++;
      if (retries > MAX_RETRIES) {
        console.error(`Failed after ${MAX_RETRIES} retries for "${searchName}":`, e.message);
        break;
      }
      const backoffMs = Math.min(5000 * Math.pow(1.5, retries - 1), 60000);
      await new Promise(r => setTimeout(r, backoffMs));
    }
  }

  if (!result) {
    if (retries > MAX_RETRIES) {
      return {
        logEntry: { leadId: lead.id, company: rawName, searchName, status: 'error', fieldsUpdated: [], errorMsg: `Falhou após ${MAX_RETRIES} tentativas`, source: 'cnpja' },
        updates: { cnpja_last_searched_at: new Date().toISOString() }, found: false, error: true, skipped: false,
      };
    }
    return {
      logEntry: { leadId: lead.id, company: rawName, searchName, status: 'not_found', fieldsUpdated: [], source: 'cnpja' },
      updates: { cnpja_last_searched_at: new Date().toISOString() }, found: false, error: false, skipped: false,
    };
  }

  // Build updates
  const shouldSet = (field: string, value: any) => {
    if (!value) return false;
    if (!preserveExisting) return true;
    const current = (lead as any)[field];
    return current === null || current === undefined || current === '';
  };

  const updates: Record<string, any> = { cnpja_last_searched_at: new Date().toISOString() };
  const fieldMap: Record<string, string> = {
    cnpj: result.cnpj, razao_social: result.razao_social,
    nome_fantasia: result.nome_fantasia, porte: result.porte,
    cnae_fiscal: result.cnae_fiscal, cnae_fiscal_descricao: result.cnae_fiscal_descricao,
    situacao_cadastral: result.situacao_cadastral, capital_social: result.capital_social,
    data_inicio_atividade: result.data_inicio_atividade,
    city: result.city, state: result.state, cep: result.cep,
    logradouro: result.logradouro, numero: result.numero,
    complemento: result.complemento, bairro: result.bairro,
    phone: result.phone, phone_2: result.phone_2, email: result.email,
  };
  if (result.cnae_fiscal_descricao && shouldSet('company_segment', result.cnae_fiscal_descricao)) {
    fieldMap.company_segment = result.cnae_fiscal_descricao;
  }
  for (const [field, value] of Object.entries(fieldMap)) {
    if (shouldSet(field, value)) updates[field] = value;
  }

  return {
    logEntry: {
      leadId: lead.id, company: rawName, searchName, status: 'found',
      cnpjReturned: result.cnpj || '(sem CNPJ)', razaoSocialReturned: result.razao_social || '(sem razão)',
      fieldsUpdated: Object.keys(updates), source: 'cnpja',
    },
    updates, found: true, error: false, skipped: false,
  };
}

// ── Perplexity enrichment for a single lead ──
async function enrichViaPerplexity(
  lead: any,
  perplexityKey: string,
  preserveExisting: boolean,
): Promise<{ logEntry: LogEntry; updates: Record<string, any> | null; found: boolean; error: boolean; skipped: boolean }> {
  const companyName = lead.razao_social || lead.nome_fantasia || lead.company;
  if (!companyName || companyName.trim().length < 2) {
    return {
      logEntry: { leadId: lead.id, company: lead.company || '(vazio)', searchName: '(nome curto)', status: 'skipped', skipReason: 'Nome insuficiente para Perplexity', fieldsUpdated: [], source: 'perplexity' },
      updates: null, found: false, error: false, skipped: true,
    };
  }

  try {
    const cnpjPart = lead.cnpj ? ` (CNPJ: ${lead.cnpj})` : '';
    const prompt = `Busque informações sobre a empresa "${companyName}"${cnpjPart} no site oficial e redes sociais.

Extraia especificamente:
1. Segmento de mercado/indústria
2. Website oficial (se disponível)
3. Telefone(s) de contato (fixo ou celular)
4. WhatsApp de contato
5. E-mail(s) de contato ou suporte
6. Número de funcionários (se disponível)
7. Faturamento estimado em R$ (se disponível)

Priorize informações do website oficial, página de contato, rodapé, e redes sociais (LinkedIn, Instagram, Facebook).
Retorne as informações encontradas em formato JSON estruturado com as chaves: segmento_mercado, website, telefone, telefone_secundario, whatsapp, email, numero_funcionarios, faturamento_estimado.`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return {
        logEntry: { leadId: lead.id, company: companyName, searchName: companyName, status: 'error', fieldsUpdated: [], errorMsg: `Perplexity HTTP ${response.status}: ${errText.slice(0, 100)}`, source: 'perplexity' },
        updates: null, found: false, error: true, skipped: false,
      };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        logEntry: { leadId: lead.id, company: companyName, searchName: companyName, status: 'not_found', fieldsUpdated: [], source: 'perplexity' },
        updates: null, found: false, error: false, skipped: false,
      };
    }

    const enrichedData = JSON.parse(jsonMatch[0]);
    const updates: Record<string, any> = {};
    const fieldsUpdated: string[] = [];

    const shouldSet = (field: string, value: any) => {
      if (!value) return false;
      if (!preserveExisting) return true;
      const current = (lead as any)[field];
      return current === null || current === undefined || current === '';
    };

    if (enrichedData.segmento_mercado || enrichedData.segment) {
      const val = enrichedData.segmento_mercado || enrichedData.segment;
      if (shouldSet('company_segment', val)) { updates.company_segment = val; fieldsUpdated.push('company_segment'); }
    }
    if (enrichedData.website) {
      if (shouldSet('website', enrichedData.website)) { updates.website = enrichedData.website; fieldsUpdated.push('website'); }
    }
    if (enrichedData.telefone && shouldSet('phone', enrichedData.telefone)) { updates.phone = enrichedData.telefone; fieldsUpdated.push('phone'); }
    if (enrichedData.telefone_secundario && shouldSet('phone_2', enrichedData.telefone_secundario)) { updates.phone_2 = enrichedData.telefone_secundario; fieldsUpdated.push('phone_2'); }
    if (enrichedData.whatsapp && shouldSet('whatsapp', enrichedData.whatsapp)) { updates.whatsapp = enrichedData.whatsapp; fieldsUpdated.push('whatsapp'); }
    if (enrichedData.email && shouldSet('email', enrichedData.email)) { updates.email = enrichedData.email; fieldsUpdated.push('email'); }
    if (enrichedData.numero_funcionarios && shouldSet('employee_count', enrichedData.numero_funcionarios)) { updates.employee_count = String(enrichedData.numero_funcionarios); fieldsUpdated.push('employee_count'); }
    if (enrichedData.faturamento_estimado && shouldSet('revenue_range', enrichedData.faturamento_estimado)) { updates.revenue_range = String(enrichedData.faturamento_estimado); fieldsUpdated.push('revenue_range'); }

    if (fieldsUpdated.length === 0) {
      return {
        logEntry: { leadId: lead.id, company: companyName, searchName: companyName, status: 'found', fieldsUpdated: [], source: 'perplexity' },
        updates: null, found: true, error: false, skipped: false,
      };
    }

    return {
      logEntry: { leadId: lead.id, company: companyName, searchName: companyName, status: 'found', fieldsUpdated, source: 'perplexity' },
      updates, found: true, error: false, skipped: false,
    };
  } catch (e: any) {
    return {
      logEntry: { leadId: lead.id, company: companyName, searchName: companyName, status: 'error', fieldsUpdated: [], errorMsg: e.message || 'Erro Perplexity', source: 'perplexity' },
      updates: null, found: false, error: true, skipped: false,
    };
  }
}

// Helper to save partial checkpoint
async function saveCheckpoint(
  supabase: any,
  jobId: string,
  job: any,
  counters: { cnpjaFound: number; perplexityFound: number; notFound: number; skipped: number; errors: number; updated: number; processed: number },
  batchLogs: LogEntry[],
  currentProcessed: number,
  statusOverride?: string,
) {
  const existingLogs = Array.isArray(job.logs) ? job.logs : [];
  const allLogs = [...existingLogs, ...batchLogs];
  const trimmedLogs = allLogs.length > 500 ? allLogs.slice(-500) : allLogs;

  const { error: checkpointError } = await supabase.from('enrichment_jobs').update({
    processed: (job.processed || 0) + counters.updated,
    cnpja_success: (job.cnpja_success || 0) + counters.cnpjaFound,
    perplexity_success: (job.perplexity_success || 0) + counters.perplexityFound,
    not_found_count: (job.not_found_count || 0) + counters.notFound,
    skipped_count: (job.skipped_count || 0) + counters.skipped,
    error_count: (job.error_count || 0) + counters.errors,
    total_processed: currentProcessed + counters.processed,
    logs: trimmedLogs,
    ...(statusOverride ? { status: statusOverride } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', jobId);
  if (checkpointError) {
    console.error(`Checkpoint save failed for job ${jobId}:`, checkpointError.message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const jobId = body.job_id;
    const offset = body.offset || 0;

    if (!jobId) {
      return new Response(JSON.stringify({ error: "job_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch job details
    const { data: job, error: jobError } = await supabase
      .from('enrichment_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (job.status === 'cancelled') {
      console.log(`Job ${jobId} was cancelled, stopping.`);
      return new Response(JSON.stringify({ success: true, cancelled: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const options = job.options || {};
    const preserveExisting = options.preserve_existing || false;
    const ignoreCnpjaCache = options.ignore_cache || false;
    const cacheDays = options.cache_days || 90;
    const userFilter = options.user_filter || null;
    const statusFilter = options.status_filter || null;
    const userLimit = options.user_limit || 0;
    const dataConditions: string[] = Array.isArray(options.data_conditions) ? options.data_conditions : [];

    // Determine which sources to run (backward compatible)
    const runCnpja = options.run_cnpja !== undefined ? !!options.run_cnpja : true; // default true for old jobs
    const runPerplexity = options.run_perplexity !== undefined ? !!options.run_perplexity : !!options.enrich_perplexity;

    // Validate API keys
    const cnpjaKey = Deno.env.get('CNPJA_API_KEY');
    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');

    if (runCnpja && !cnpjaKey) {
      await supabase.from('enrichment_jobs').update({
        status: 'error', error_message: 'CNPJA_API_KEY não configurada',
      }).eq('id', jobId);
      return new Response(JSON.stringify({ error: "CNPJA_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (runPerplexity && !perplexityKey) {
      await supabase.from('enrichment_jobs').update({
        status: 'error', error_message: 'PERPLEXITY_API_KEY não configurada',
      }).eq('id', jobId);
      return new Response(JSON.stringify({ error: "PERPLEXITY_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build query for leads
    let query = supabase
      .from('leads')
      .select('id, company, razao_social, nome_fantasia, cnpja_last_searched_at, cnpj, porte, cnae_fiscal, cnae_fiscal_descricao, situacao_cadastral, capital_social, data_inicio_atividade, city, state, cep, logradouro, numero, complemento, bairro, phone, phone_2, email, company_segment, website, whatsapp, employee_count, revenue_range')
      .or('company.neq.,razao_social.neq.');

    // Apply data_conditions filters dynamically
    if (dataConditions.length > 0) {
      for (const condKey of dataConditions) {
        const cond = DATA_CONDITIONS_MAP[condKey];
        if (cond) {
          if (cond.mode === 'filled') {
            query = query.not(cond.field, 'is', null).neq(cond.field, '');
          } else {
            query = query.or(`${cond.field}.is.null,${cond.field}.eq.`);
          }
        }
      }
    } else {
      query = query.or('cnpj.is.null,cnpj.eq.');
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1);

    if (userFilter?.ids?.length > 0) {
      query = query.in('owner_user_id', userFilter.ids);
    }
    if (statusFilter?.length > 0) {
      query = query.in('status', statusFilter);
    }

    const { data: leads, error: leadsError } = await query;

    if (leadsError) {
      await supabase.from('enrichment_jobs').update({
        status: 'error', error_message: leadsError.message,
      }).eq('id', jobId);
      return new Response(JSON.stringify({ error: leadsError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!leads || leads.length === 0) {
      await supabase.from('enrichment_jobs').update({
        status: 'completed', updated_at: new Date().toISOString(),
      }).eq('id', jobId);
      console.log(`Job ${jobId} completed at offset ${offset}`);
      return new Response(JSON.stringify({ success: true, completed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check user limit
    const currentProcessed = job.total_processed || 0;
    if (userLimit > 0 && currentProcessed >= userLimit) {
      await supabase.from('enrichment_jobs').update({
        status: 'completed', updated_at: new Date().toISOString(),
      }).eq('id', jobId);
      return new Response(JSON.stringify({ success: true, completed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const counters = { cnpjaFound: 0, perplexityFound: 0, notFound: 0, skipped: 0, errors: 0, updated: 0, processed: 0 };
    const batchLogs: LogEntry[] = [];
    let lastCheckpointAt = 0; // tracks how many logs were flushed

    for (const lead of leads) {
      // ── Time-based early exit ──
      const elapsed = Date.now() - startTime;
      if (elapsed > MAX_EXECUTION_MS) {
        console.log(`Job ${jobId} early exit at ${elapsed}ms, saving progress and re-invoking`);
        // Save partial and re-invoke
        await saveCheckpoint(supabase, jobId, job, counters, batchLogs, currentProcessed);
        // Update job.logs so next checkpoint doesn't re-add
        job.logs = [...(Array.isArray(job.logs) ? job.logs : []), ...batchLogs];
        // Re-invoke with current offset + processed
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
        const functionUrl = `${supabaseUrl}/functions/v1/bulk-cnpja-search`;
        fetch(functionUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
          body: JSON.stringify({ job_id: jobId, offset: offset + counters.processed }),
        }).catch(err => console.error('Early-exit reinvocation failed:', err));
        return new Response(JSON.stringify({ success: true, earlyExit: true, processed: counters.processed }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Check cancellation every 3 leads ──
      if (counters.processed > 0 && counters.processed % 3 === 0) {
        const { data: freshJob } = await supabase
          .from('enrichment_jobs')
          .select('status')
          .eq('id', jobId)
          .single();
        if (freshJob?.status === 'cancelled') {
          console.log(`Job ${jobId} cancelled mid-batch at lead ${counters.processed}`);
          await saveCheckpoint(supabase, jobId, job, counters, batchLogs, currentProcessed, 'cancelled');
          return new Response(JSON.stringify({ success: true, cancelled: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Check limit
      if (userLimit > 0 && (currentProcessed + counters.processed) >= userLimit) break;

      counters.processed++;
      let leadUpdates: Record<string, any> = {};
      let leadFoundAnything = false;

      // ── CNPJá enrichment ──
      if (runCnpja) {
        const cnpjaResult = await enrichViaCnpja(lead, cnpjaKey!, preserveExisting, cacheDays, ignoreCnpjaCache);
        batchLogs.push(cnpjaResult.logEntry);
        if (cnpjaResult.found) { counters.cnpjaFound++; leadFoundAnything = true; }
        if (cnpjaResult.error) counters.errors++;
        if (cnpjaResult.skipped) counters.skipped++;
        if (!cnpjaResult.found && !cnpjaResult.error && !cnpjaResult.skipped) counters.notFound++;
        if (cnpjaResult.updates) Object.assign(leadUpdates, cnpjaResult.updates);

        // Delay between CNPJá API calls
        await new Promise(r => setTimeout(r, 3000));
      }

      // ── Perplexity enrichment ──
      if (runPerplexity) {
        // Merge any CNPJá updates into lead for Perplexity to see fresh data
        const leadForPerplexity = { ...lead, ...leadUpdates };
        const perplexityResult = await enrichViaPerplexity(leadForPerplexity, perplexityKey!, preserveExisting);
        batchLogs.push(perplexityResult.logEntry);
        if (perplexityResult.found) { counters.perplexityFound++; leadFoundAnything = true; }
        if (perplexityResult.error) counters.errors++;
        if (perplexityResult.skipped) counters.skipped++;
        // FIX: Perplexity not_found now increments the counter
        if (!perplexityResult.found && !perplexityResult.error && !perplexityResult.skipped) counters.notFound++;
        if (perplexityResult.updates) Object.assign(leadUpdates, perplexityResult.updates);

        // Delay between Perplexity calls
        await new Promise(r => setTimeout(r, 1500));
      }

      // Save combined updates
      if (Object.keys(leadUpdates).length > 0) {
        const { data: updatedRows, error: updateError } = await supabase
          .from('leads')
          .update(leadUpdates)
          .eq('id', lead.id)
          .select('id');

        if (updateError) {
          batchLogs.push({
            leadId: lead.id, company: lead.company || '', searchName: '',
            status: 'error', fieldsUpdated: [], errorMsg: `Erro ao salvar: ${updateError.message}`,
          });
        } else if (updatedRows && updatedRows.length > 0) {
          counters.updated++;
        }
      }

      // ── Frequent checkpoint: save progress every CHECKPOINT_INTERVAL leads ──
      if (counters.processed % CHECKPOINT_INTERVAL === 0) {
        await saveCheckpoint(supabase, jobId, job, counters, batchLogs, currentProcessed);
        // Reset counters/logs for next checkpoint window - update job snapshot
        job.processed = (job.processed || 0) + counters.updated;
        job.cnpja_success = (job.cnpja_success || 0) + counters.cnpjaFound;
        job.perplexity_success = (job.perplexity_success || 0) + counters.perplexityFound;
        job.not_found_count = (job.not_found_count || 0) + counters.notFound;
        job.skipped_count = (job.skipped_count || 0) + counters.skipped;
        job.error_count = (job.error_count || 0) + counters.errors;
        job.total_processed = currentProcessed + counters.processed;
        job.logs = [...(Array.isArray(job.logs) ? job.logs : []), ...batchLogs];
        // Reset batch-local counters (processed stays for offset calculation)
        const savedProcessed = counters.processed;
        counters.cnpjaFound = 0;
        counters.perplexityFound = 0;
        counters.notFound = 0;
        counters.skipped = 0;
        counters.errors = 0;
        counters.updated = 0;
        counters.processed = savedProcessed;
        batchLogs.length = 0;
        lastCheckpointAt = savedProcessed;
        console.log(`Job ${jobId} checkpoint at lead ${savedProcessed}`);
      }
    }

    // Final update for remaining leads after last checkpoint
    const newTotalProcessed = currentProcessed + counters.processed;
    const hasMore = leads.length === BATCH_SIZE && (userLimit === 0 || newTotalProcessed < userLimit);

    await saveCheckpoint(supabase, jobId, job, counters, batchLogs, currentProcessed, hasMore ? 'running' : 'completed');

    console.log(`Job ${jobId} batch at offset ${offset}: processed=${counters.processed}, cnpja=${counters.cnpjaFound}, perplexity=${counters.perplexityFound}, notFound=${counters.notFound}, skipped=${counters.skipped}, errors=${counters.errors}`);

    // Self-reinvoke for next batch
    if (hasMore) {
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
      const functionUrl = `${supabaseUrl}/functions/v1/bulk-cnpja-search`;

      fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          job_id: jobId,
          offset: offset + BATCH_SIZE,
        }),
      }).catch(err => console.error('Self-reinvocation failed:', err));
    }

    return new Response(JSON.stringify({ success: true, processed: counters.processed, cnpjaFound: counters.cnpjaFound, perplexityFound: counters.perplexityFound, hasMore }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("bulk-cnpja-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
