import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Segment {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

interface AIDialogueSegment {
  speaker: "sdr" | "client";
  text: string;
}

/**
 * Send the full raw transcript to AI and let it organize the conversation
 * into SDR vs Client segments based on conversational context.
 */
async function organizeTranscriptWithAI(fullText: string): Promise<AIDialogueSegment[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY || fullText.trim().length < 20) return [];

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em análise de ligações comerciais B2B.
Você receberá a transcrição bruta (texto corrido) de uma ligação entre um SDR (vendedor) e um Cliente (lead/prospect).

Sua tarefa é organizar o texto em um diálogo estruturado, identificando onde cada interlocutor começa e termina de falar.

Pistas para identificar o SDR:
- Se apresenta, menciona nome da empresa que representa
- Faz perguntas de qualificação (BANT, SPIN)
- Apresenta soluções/produtos
- Tenta agendar reuniões
- Usa linguagem de vendas
- Geralmente é quem inicia a conversa

Pistas para identificar o Cliente:
- Responde perguntas sobre sua empresa
- Faz perguntas sobre preço/produto
- Levanta objeções
- Fala sobre seus problemas/necessidades
- Responde "alô" no início

REGRAS IMPORTANTES:
1. Mantenha TODO o texto original, não omita nenhuma palavra
2. Divida nos pontos naturais de troca de turno na conversa
3. Cada segmento deve conter a fala completa de um interlocutor antes da troca

Responda APENAS com um JSON array no formato:
[{"speaker": "sdr", "text": "..."}, {"speaker": "client", "text": "..."}, ...]

Não inclua explicações, apenas o JSON array.`,
          },
          {
            role: "user",
            content: fullText,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error("AI transcript organization failed:", response.status, await response.text());
      return [];
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content?.trim() || "";

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("AI returned non-JSON response:", content.slice(0, 200));
      return [];
    }

    const parsed: AIDialogueSegment[] = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.error("AI returned empty or invalid array");
      return [];
    }

    const valid = parsed.every(
      (s) => (s.speaker === "sdr" || s.speaker === "client") && typeof s.text === "string" && s.text.trim().length > 0
    );
    if (!valid) {
      console.error("AI returned segments with invalid structure");
      return [];
    }

    return parsed;
  } catch (e) {
    console.error("AI transcript organization error:", e);
    return [];
  }
}

/**
 * Match AI-organized dialogue segments back to word-level timestamps
 * from the Deepgram transcription.
 */
function mapTimestampsToSegments(
  aiSegments: AIDialogueSegment[],
  words: Array<{ word?: string; start?: number; end?: number }>
): Segment[] {
  if (words.length === 0 || aiSegments.length === 0) return [];

  const segments: Segment[] = [];
  let wordIdx = 0;

  for (const aiSeg of aiSegments) {
    const segWords = aiSeg.text.trim().split(/\s+/);
    const speakerLabel = aiSeg.speaker === "client" ? "speaker_1" : "speaker_0";

    const startWordIdx = wordIdx;
    const targetCount = segWords.length;
    let matchedCount = 0;

    while (wordIdx < words.length && matchedCount < targetCount) {
      wordIdx++;
      matchedCount++;
    }

    if (matchedCount < targetCount && wordIdx < words.length) {
      const remaining = Math.min(targetCount - matchedCount, words.length - wordIdx);
      wordIdx += remaining;
    }

    const endWordIdx = Math.max(startWordIdx, wordIdx - 1);

    segments.push({
      speaker: speakerLabel,
      text: aiSeg.text.trim(),
      start: words[startWordIdx]?.start || 0,
      end: words[endWordIdx]?.end || words[startWordIdx]?.start || 0,
    });
  }

  return segments;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let analysisId: string | null = null;

  try {
    const { analysis_id, audio_path } = await req.json();
    analysisId = analysis_id ?? null;
    if (!analysis_id || !audio_path) {
      return new Response(JSON.stringify({ error: "analysis_id e audio_path são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const DEEPGRAM_API_KEY = Deno.env.get("DEEPGRAM_API_KEY");
    if (!DEEPGRAM_API_KEY) throw new Error("DEEPGRAM_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate signed URL
    const { data: signedData, error: signedError } = await supabase.storage
      .from("call-recordings")
      .createSignedUrl(audio_path, 3600);

    if (signedError || !signedData?.signedUrl) {
      const errMsg = `Erro ao gerar URL do áudio: ${signedError?.message || "signed URL vazia"}`;
      await supabase.from("call_analyses").update({ status: "error", feedback: errMsg }).eq("id", analysis_id);
      throw new Error(errMsg);
    }

    // Send to Deepgram Nova-2
    // words=true needed for timestamp mapping in AI fallback path
    const deepgramParams = new URLSearchParams({
      model: "nova-2",
      language: "pt-BR",
      diarize: "true",
      punctuate: "true",
      utterances: "true",
      words: "true",
      smart_format: "true",
    });

    const sttResponse = await fetch(`https://api.deepgram.com/v1/listen?${deepgramParams}`, {
      method: "POST",
      headers: {
        "Authorization": `Token ${DEEPGRAM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: signedData.signedUrl }),
    });

    if (!sttResponse.ok) {
      const errText = await sttResponse.text();
      console.error("Deepgram STT error:", sttResponse.status, errText.slice(0, 300));
      await supabase.from("call_analyses").update({ status: "error" }).eq("id", analysis_id);
      throw new Error(`Deepgram STT failed (${sttResponse.status}): ${errText.slice(0, 200)}`);
    }

    const sttResult = await sttResponse.json() as {
      results?: {
        channels?: Array<{
          alternatives?: Array<{
            transcript?: string;
            words?: Array<{ word?: string; start?: number; end?: number; speaker?: number }>;
          }>;
        }>;
        utterances?: Array<{
          speaker: number;
          transcript: string;
          start: number;
          end: number;
        }>;
      };
      metadata?: { duration?: number };
    };

    const fullText = (
      sttResult.results?.channels?.[0]?.alternatives?.[0]?.transcript || ""
    ).replace(/\s+/g, " ").trim();

    const words = sttResult.results?.channels?.[0]?.alternatives?.[0]?.words || [];
    const utterances = sttResult.results?.utterances || [];
    const durationSeconds = Math.round(sttResult.metadata?.duration || 0);

    const rawSpeakers = new Set<number>(utterances.map((u) => u.speaker));
    console.log(`[transcribe-call] analysis_id=${analysis_id}`);
    console.log(`[transcribe-call] Total words: ${words.length}, utterances: ${utterances.length}`);
    console.log(`[transcribe-call] Speakers: ${[...rawSpeakers].join(",")} (${rawSpeakers.size} unique)`);

    let segments: Segment[] = [];
    let usedAIOrganization = false;

    if (rawSpeakers.size >= 2) {
      // Deepgram diarization worked — use utterances directly
      console.log(`[transcribe-call] Deepgram diarization succeeded with ${rawSpeakers.size} speakers`);
      segments = utterances.map((u) => ({
        speaker: `speaker_${u.speaker}`,
        text: u.transcript.trim(),
        start: u.start,
        end: u.end,
      }));
    } else {
      // Diarization failed — send full text to AI for dialogue organization
      console.log(`[transcribe-call] Diarization failed (${rawSpeakers.size} speaker). Sending to AI for organization.`);

      const aiSegments = await organizeTranscriptWithAI(fullText);

      if (aiSegments.length >= 2) {
        // Map AI segments back to word-level timestamps from Deepgram
        const wordList = words.map((w) => ({ word: w.word, start: w.start, end: w.end }));
        segments = mapTimestampsToSegments(aiSegments, wordList);
        usedAIOrganization = true;
        console.log(`[transcribe-call] AI organized into ${segments.length} segments`);
      } else {
        console.log(`[transcribe-call] AI organization failed, using single segment fallback`);
        segments = [{
          speaker: "speaker_0",
          text: fullText,
          start: 0,
          end: durationSeconds,
        }];
      }
    }

    // Save transcription
    await supabase.from("call_analyses").update({
      transcription: fullText,
      speaker_segments: segments,
      duration_seconds: durationSeconds,
      status: "transcribed",
      transcribed_at: new Date().toISOString(),
    }).eq("id", analysis_id);

    // Trigger analysis with retry
    const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-call`;
    const MAX_ANALYZE_TRIGGER_RETRIES = 2;
    let analyzeTriggered = false;
    let lastAnalyzeError = "";

    for (let attempt = 0; attempt <= MAX_ANALYZE_TRIGGER_RETRIES; attempt++) {
      const analyzeResponse = await fetch(analyzeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ analysis_id }),
      });

      if (analyzeResponse.ok) {
        analyzeTriggered = true;
        break;
      }

      const errText = await analyzeResponse.text();
      lastAnalyzeError = `status ${analyzeResponse.status}: ${errText.slice(0, 220)}`;
      console.error(`analyze-call trigger failed (attempt ${attempt + 1}/${MAX_ANALYZE_TRIGGER_RETRIES + 1}):`, lastAnalyzeError);

      const shouldRetry = (analyzeResponse.status >= 500 || analyzeResponse.status === 429) && attempt < MAX_ANALYZE_TRIGGER_RETRIES;
      if (shouldRetry) {
        await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1500));
        continue;
      }
      break;
    }

    if (!analyzeTriggered) {
      const feedback = `Transcrição concluída, mas falhou ao iniciar a análise automática (${lastAnalyzeError || "erro desconhecido"}).`;
      await supabase.from("call_analyses").update({ status: "error", feedback }).eq("id", analysis_id);

      return new Response(JSON.stringify({
        success: false,
        segments_count: segments.length,
        used_ai_organization: usedAIOrganization,
        error: feedback,
      }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      segments_count: segments.length,
      used_ai_organization: usedAIOrganization,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("transcribe-call error:", e);

    if (analysisId) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        const errorMessage = e instanceof Error ? e.message : "Erro desconhecido";
        await supabase.from("call_analyses").update({ status: "error", feedback: errorMessage }).eq("id", analysisId);
      } catch (persistErr) {
        console.error("Failed to persist transcribe-call error feedback:", persistErr);
      }
    }

    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
