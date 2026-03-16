import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 15000;

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok || !RETRYABLE_STATUSES.has(response.status)) {
        return response;
      }

      // Retryable status — consume body to avoid leak
      await response.text();
      console.warn(
        `CNPJá API returned ${response.status}, attempt ${attempt + 1}/${retries}`
      );
      lastError = new Error(`CNPJá API error: ${response.status}`);
    } catch (e) {
      clearTimeout(timeoutId);

      if (e instanceof DOMException && e.name === "AbortError") {
        console.warn(
          `CNPJá API timeout (${REQUEST_TIMEOUT_MS}ms), attempt ${attempt + 1}/${retries}`
        );
        lastError = new Error("TIMEOUT");
      } else {
        lastError = e instanceof Error ? e : new Error(String(e));
        console.warn(
          `CNPJá fetch error: ${lastError.message}, attempt ${attempt + 1}/${retries}`
        );
      }
    }

    // Wait before retrying (exponential backoff)
    if (attempt < retries - 1) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError || new Error("CNPJá API unavailable after retries");
}

function formatPhone(phone: unknown): string {
  if (!phone) return "";
  if (typeof phone === "string") {
    const digits = phone.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 11) return `+55${digits}`;
    if (digits.length >= 12 && digits.startsWith("55")) return `+${digits}`;
    return phone;
  }
  const p = phone as Record<string, string>;
  const area = p.area || "";
  const number = p.number || "";
  if (!area && !number) return "";
  return `+55${area}${number}`;
}

function mapOfficeToResult(item: Record<string, unknown>, fallbackCnpj?: string) {
  const company = (item.company || {}) as Record<string, unknown>;
  const address = (item.address || {}) as Record<string, unknown>;
  const mainActivity = (item.mainActivity || item.primary_activity || {}) as Record<string, unknown>;
  const status = (item.status || {}) as Record<string, unknown>;
  const size = (company.size || {}) as Record<string, string>;
  const sideActivities = item.sideActivities as Array<Record<string, unknown>> | undefined;
  const phones = item.phones as unknown[] | undefined;
  const emails = item.emails as Array<Record<string, string>> | undefined;

  return {
    cnpj: (item.taxId as string) || (item.cnpj as string) || fallbackCnpj || "",
    razao_social: (company.name as string) || (item.name as string) || (item.razao_social as string) || "",
    nome_fantasia: (item.alias as string) || (item.nome_fantasia as string) || "",
    porte: size?.text || (item.porte as string) || "",
    capital_social: (company.equity as number) || (item.capital_social as number) || null,
    situacao_cadastral: (status.text as string) || (item.situacao_cadastral as string) || "",
    cnae_fiscal: (mainActivity.id as number) || (item.cnae_fiscal as number) || null,
    cnae_fiscal_descricao: (mainActivity.text as string) || (item.cnae_fiscal_descricao as string) || "",
    cnaes_secundarios:
      sideActivities && sideActivities.length > 0
        ? sideActivities.map((a) => `${a.id} - ${a.text}`).join("; ")
        : "",
    data_inicio_atividade: (item.founded as string) || (item.data_inicio_atividade as string) || "",
    logradouro: (address.street as string) || (item.logradouro as string) || "",
    numero: (address.number as string) || (item.numero as string) || "",
    complemento: (address.details as string) || (item.complemento as string) || "",
    bairro: (address.district as string) || (item.bairro as string) || "",
    city: (address.city as string) || (item.city as string) || "",
    state: (address.state as string) || (item.state as string) || "",
    cep: (address.zip as string) || (item.cep as string) || "",
    phone: phones?.[0] ? formatPhone(phones[0]) : "",
    phone_2: phones?.[1] ? formatPhone(phones[1]) : "",
    email: emails?.[0]?.address || (item.email as string) || "",
    website: "",
  };
}

function friendlyError(e: Error): string {
  if (e.message === "TIMEOUT") {
    return "A API CNPJá não respondeu em 15 segundos. Tente novamente.";
  }
  if (e.message.includes("after retries")) {
    return "A API CNPJá está temporariamente indisponível. Tente novamente em alguns minutos.";
  }
  return e.message || "Erro desconhecido";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cnpjaKey = Deno.env.get("CNPJA_API_KEY");
    if (!cnpjaKey) {
      return new Response(
        JSON.stringify({ error: "CNPJA_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { name, cnpj, limit } = body;

    // ── Search by CNPJ ──
    if (cnpj && typeof cnpj === "string") {
      const cleanCnpj = cnpj.replace(/\D/g, "");
      if (cleanCnpj.length !== 14) {
        return new Response(
          JSON.stringify({ error: "CNPJ deve ter 14 dígitos" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`CNPJá lookup: cnpj="${cleanCnpj}"`);

      try {
        const response = await fetchWithRetry(
          `https://api.cnpja.com/office/${cleanCnpj}`,
          { method: "GET", headers: { Authorization: cnpjaKey } }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`CNPJá API error [${response.status}]:`, errorText);
          if (response.status === 404) {
            return new Response(
              JSON.stringify({ success: true, results: [], total: 0 }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (response.status === 401) {
            return new Response(
              JSON.stringify({ error: "Chave de API CNPJá inválida" }),
              { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          return new Response(
            JSON.stringify({ error: `Erro na API CNPJá: ${response.status}` }),
            { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const item = await response.json();
        const mapped = [mapOfficeToResult(item, cleanCnpj)];

        return new Response(
          JSON.stringify({ success: true, results: mapped, total: 1 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        const msg = friendlyError(e instanceof Error ? e : new Error(String(e)));
        console.error("CNPJá CNPJ lookup failed after retries:", msg);
        return new Response(
          JSON.stringify({ error: msg }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── Search by name ──
    if (!name || typeof name !== "string" || name.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: "Nome deve ter pelo menos 3 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const searchName = name.trim().substring(0, 100);
    const resultLimit = Math.min(Math.max(limit || 10, 1), 20);

    const url = new URL("https://api.cnpja.com/office");
    url.searchParams.set("names.in", searchName);
    url.searchParams.set("limit", String(resultLimit));

    console.log(`CNPJá search: name="${searchName}", limit=${resultLimit}`);

    try {
      const response = await fetchWithRetry(url.toString(), {
        method: "GET",
        headers: { Authorization: cnpjaKey },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`CNPJá API error [${response.status}]:`, errorText);
        if (response.status === 401) {
          return new Response(
            JSON.stringify({ error: "Chave de API CNPJá inválida" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ error: `Erro na API CNPJá: ${response.status}` }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();

      let results: Record<string, unknown>[] = [];
      if (Array.isArray(data)) {
        results = data;
      } else if (data?.data && Array.isArray(data.data)) {
        results = data.data;
      } else if (data?.records && Array.isArray(data.records)) {
        results = data.records;
      } else if (data?.count !== undefined) {
        results = data.data || data.records || data.items || [];
      }

      const mapped = results.map((item) => mapOfficeToResult(item));

      console.log(`CNPJá search returned ${mapped.length} results`);

      return new Response(
        JSON.stringify({ success: true, results: mapped, total: mapped.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (e) {
      const msg = friendlyError(e instanceof Error ? e : new Error(String(e)));
      console.error("CNPJá name search failed after retries:", msg);
      return new Response(
        JSON.stringify({ error: msg }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (e) {
    console.error("cnpja-search error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
