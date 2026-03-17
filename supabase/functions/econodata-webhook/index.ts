import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-econodata-token',
}

interface BrasilApiCnpj {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  ddd_telefone_1: string;
  ddd_telefone_2: string;
  email: string;
  descricao_situacao_cadastral: string;
  uf: string;
  municipio: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cnae_fiscal_descricao: string;
  porte: string;
  natureza_juridica: string;
  capital_social: number;
  data_inicio_atividade: string;
  qsa: Array<{
    nome_socio: string;
    cnpj_cpf_do_socio: string;
    qualificacao_socio: string;
  }>;
}

interface EconodataLead {
  // Campos genéricos para capturar qualquer estrutura
  [key: string]: string | undefined;
}

// Função para normalizar CNPJ (remover caracteres especiais)
function normalizeCnpj(cnpj: string): string {
  return cnpj.replace(/[^\d]/g, '');
}

// Função para formatar telefone
function formatPhone(ddd: string): string | null {
  if (!ddd) return null;
  // O campo da BrasilAPI vem como "DDD + número" sem separação
  // Exemplo: "1132345678" ou "11987654321"
  const clean = ddd.replace(/[^\d]/g, '');
  if (clean.length >= 10) {
    const dddPart = clean.substring(0, 2);
    const number = clean.substring(2);
    return `(${dddPart}) ${number}`;
  }
  return ddd;
}

// Função para consultar CNPJ na BrasilAPI (gratuita)
async function fetchCnpjData(cnpj: string): Promise<BrasilApiCnpj | null> {
  try {
    const cleanCnpj = normalizeCnpj(cnpj);
    console.log(`Fetching CNPJ data from BrasilAPI: ${cleanCnpj}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`BrasilAPI error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    console.log('BrasilAPI response:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Error fetching CNPJ data:', error);
    return null;
  }
}

// Função para normalizar campos do payload
function normalizeLeadData(raw: any): { cnpj?: string } {
  // Se for um array, pegar o primeiro elemento
  if (Array.isArray(raw)) {
    if (raw.length === 1 && typeof raw[0] === 'string') {
      // Pode ser apenas um CNPJ
      return { cnpj: raw[0] };
    }
    // Se for array de objetos, pegar o primeiro
    if (raw.length > 0 && typeof raw[0] === 'object') {
      return raw[0];
    }
    return {};
  }
  return raw || {};
}

// Função para extrair valor de múltiplas possíveis chaves
function getValue(data: EconodataLead, ...keys: string[]): string | undefined {
  for (const key of keys) {
    if (data[key]) return data[key];
  }
  return undefined;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate webhook token (accepts via header OR query parameter)
    const webhookToken = Deno.env.get('ECONODATA_WEBHOOK_TOKEN');
    const url = new URL(req.url);
    const queryToken = url.searchParams.get('token');
    const headerToken = req.headers.get('x-econodata-token');
    const requestToken = queryToken || headerToken;
    
    if (webhookToken && requestToken !== webhookToken) {
      console.error('Invalid webhook token');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body and normalize
    const rawBody = await req.json();
    console.log('Raw payload from Econodata:', JSON.stringify(rawBody, null, 2));
    
    const body = normalizeLeadData(rawBody);
    console.log('Normalized lead data:', JSON.stringify(body, null, 2));

    // Extract CNPJ from payload
    const cnpj = getValue(body as EconodataLead, 'cnpj', 'CNPJ') || body.cnpj;
    
    if (!cnpj) {
      console.log('Validation failed - no CNPJ found');
      return new Response(
        JSON.stringify({ error: 'Missing required field: cnpj' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch company data from BrasilAPI
    const cnpjData = await fetchCnpjData(cnpj);
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build lead data from CNPJ lookup or use minimal data
    const leadData = {
      name: cnpjData?.qsa?.[0]?.nome_socio || cnpjData?.razao_social || `Lead CNPJ: ${cnpj}`,
      company: cnpjData?.nome_fantasia || cnpjData?.razao_social || 'Empresa não informada',
      email: cnpjData?.email || null,
      phone: formatPhone(cnpjData?.ddd_telefone_1 || ''),
      phone_2: formatPhone(cnpjData?.ddd_telefone_2 || ''),
      whatsapp: null, // BrasilAPI não fornece WhatsApp
      cnpj: cnpj,
      razao_social: cnpjData?.razao_social || null,
      nome_fantasia: cnpjData?.nome_fantasia || null,
      company_segment: cnpjData?.cnae_fiscal_descricao || null,
      employee_count: cnpjData?.porte || null,
      revenue_range: cnpjData?.capital_social ? `R$ ${cnpjData.capital_social.toLocaleString('pt-BR')}` : null,
      website: null,
      cep: cnpjData?.cep || null,
      city: cnpjData?.municipio || null,
      state: cnpjData?.uf || null,
      country: 'Brasil',
      lead_type: 'OUTBOUND' as const,
      source: 'Econodata',
      icp_fit: null,
      initial_message: cnpjData ? `Endereço: ${cnpjData.logradouro || ''} ${cnpjData.numero || ''}, ${cnpjData.bairro || ''} - ${cnpjData.municipio || ''}/${cnpjData.uf || ''}` : null,
      status: 'Novo' as const,
      priority_score: 50,
      attempts_count: 0,
      next_action_at: new Date().toISOString(),
      // UTM tracking from webhook payload
      utm_source: getValue(body as EconodataLead, 'utm_source') || null,
      utm_medium: getValue(body as EconodataLead, 'utm_medium') || null,
      utm_campaign: getValue(body as EconodataLead, 'utm_campaign') || null,
      utm_term: getValue(body as EconodataLead, 'utm_term') || null,
      utm_content: getValue(body as EconodataLead, 'utm_content') || null,
    };
    
    console.log('Lead data to insert:', JSON.stringify(leadData, null, 2));

    // Check if lead already exists by CNPJ
    const normalizedCnpj = normalizeCnpj(cnpj);
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .or(`cnpj.eq.${cnpj},cnpj.eq.${normalizedCnpj}`)
      .maybeSingle();

    if (existingLead) {
      // Update existing lead
      const { error } = await supabase
        .from('leads')
        .update({
          ...leadData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingLead.id);

      if (error) {
        console.error('Error updating lead:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to update lead', details: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Lead updated:', existingLead.id);
      return new Response(
        JSON.stringify({ success: true, action: 'updated', lead_id: existingLead.id, enriched: !!cnpjData }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Insert new lead
      const { data, error } = await supabase
        .from('leads')
        .insert(leadData)
        .select('id')
        .single();

      if (error) {
        console.error('Error creating lead:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to create lead', details: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Lead created:', data.id);
      return new Response(
        JSON.stringify({ success: true, action: 'created', lead_id: data.id, enriched: !!cnpjData }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
