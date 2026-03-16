import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let cachedRate: { rate: number; source: string; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

async function fetchFromAwesomeApi(): Promise<number | null> {
  try {
    const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
    if (!res.ok) {
      console.log(`AwesomeAPI returned ${res.status}`);
      return null;
    }
    const data = await res.json();
    return data?.USDBRL?.bid ? parseFloat(data.USDBRL.bid) : null;
  } catch (e) {
    console.log("AwesomeAPI fetch error:", e);
    return null;
  }
}

async function fetchFromOpenExchangeRates(): Promise<number | null> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!res.ok) {
      console.log(`ExchangeRate-API returned ${res.status}`);
      return null;
    }
    const data = await res.json();
    return data?.rates?.BRL ?? null;
  } catch (e) {
    console.log("ExchangeRate-API fetch error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  // Return cached value if fresh
  if (cachedRate && Date.now() - cachedRate.fetchedAt < CACHE_TTL_MS) {
    return new Response(JSON.stringify({ rate: cachedRate.rate, source: cachedRate.source + " (cached)" }), { status: 200, headers });
  }

  try {
    let rate = await fetchFromAwesomeApi();
    let source = "AwesomeAPI";

    if (!rate) {
      // Add small delay before fallback to avoid cascading rate limits
      await new Promise((r) => setTimeout(r, 200));
      rate = await fetchFromOpenExchangeRates();
      source = "ExchangeRate-API";
    }

    if (!rate) {
      return new Response(JSON.stringify({ rate: 5.70, source: "fallback" }), { status: 200, headers });
    }

    // Cache the result
    cachedRate = { rate, source, fetchedAt: Date.now() };

    return new Response(JSON.stringify({ rate, source }), { status: 200, headers });
  } catch (error) {
    console.error("Error fetching exchange rate:", error);
    return new Response(JSON.stringify({ rate: 5.70, source: "fallback" }), { status: 200, headers });
  }
});
