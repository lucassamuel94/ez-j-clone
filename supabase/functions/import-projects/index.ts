import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ---------- constants ----------
const VALID_PROJECT_TYPES = ["venda", "evolucao", "api_oficial", "migracao"] as const;
const VALID_PRIORITIES = ["baixa", "media", "alta", "urgente"] as const;
const VALID_OVERALL_STATUSES = ["ativo", "pausado", "cancelado", "concluido"] as const;

const PHASES_BY_TYPE: Record<string, string[]> = {
  venda: [
    "validacao", "ux_po", "dev_chatbot", "treinamento",
    "ativacao", "automacao", "curadoria_ia", "go_live_assistido",
  ],
  migracao: [
    "validacao", "ux_po", "dev_chatbot", "treinamento",
    "ativacao", "automacao", "curadoria_ia", "go_live_assistido",
  ],
  evolucao: ["validacao", "ux_po", "dev_chatbot"],
  api_oficial: ["verificacao_bm"],
};

const PHASE_STATUSES_FALLBACK: Record<string, string[]> = {
  validacao: ["BACKLOG", "EM ANÁLISE", "DADOS INCOMPLETOS", "VALIDADO", "CONCLUÍDO"],
  ux_po: ["BACKLOG", "MAPEAMENTO DE PROCESSOS", "MONTAGEM DE FLUXO", "REVISÃO INTERNA", "APROVAÇÃO DO CLIENTE", "AJUSTES", "CONCLUÍDO"],
  dev_chatbot: ["BACKLOG", "DESENVOLVIMENTO", "QA", "REVISÃO", "CONCLUÍDO"],
  treinamento: ["BACKLOG", "AGENDAMENTO", "MATERIAL PREPARADO", "TREINAMENTO REALIZADO", "CONCLUÍDO"],
  ativacao: ["BACKLOG", "EM ANDAMENTO", "COM PENDÊNCIA", "CONCLUÍDO"],
  verificacao_bm: ["BACKLOG", "EM CONTATO", "REUNIÃO AGENDADA", "AGUARDANDO CLIENTE", "AGUARDANDO META", "PAUSADO", "CANCELADO", "CONCLUÍDO"],
  automacao: ["BACKLOG", "EM DESENVOLVIMENTO", "EM TESTE", "CONCLUÍDO"],
  curadoria_ia: ["BACKLOG", "EM PROCESSO DE CURADORIA", "EM PAUSA", "GESTÃO DE PENDÊNCIAS", "CONCLUÍDO"],
  go_live_assistido: ["BACKLOG", "EM ACOMPANHAMENTO", "CONCLUÍDO"],
};

const MAX_PROJECTS = 100;

const PHASE_ASSIGNEE_FIELD: Record<string, string> = {
  ux_po: "ux_po_user_id",
  dev_chatbot: "dev_user_id",
  treinamento: "treinamento_user_id",
  ativacao: "ativacao_user_id",
  automacao: "dev_user_id",
};

function extractDescriptionData(description: string): Record<string, string> {
  const extracted: Record<string, string> = {};
  const patterns: [RegExp, string][] = [
    [/cnpj\s*[:\-]\s*([\d.\/\-]+)/i, "cnpj"],
    [/telefone\s*[:\-]\s*([^\n]+)/i, "contact_phone"],
    [/(?:e-?mail|email)\s*[:\-]\s*([^\s\n]+)/i, "contact_email"],
    [/(?:integra[çc][ãa]o|integrations?)\s*[:\-]\s*([^\n]+)/i, "integrations_description"],
    [/vers[ãa]o\s*[:\-]\s*([^\n]+)/i, "version"],
    [/plano\s*[:\-]\s*([^\n]+)/i, "plan_name"],
    [/complexidade\s*[:\-]\s*([^\n]+)/i, "complexity_level"],
    [/broker\s*[:\-]\s*([^\n]+)/i, "broker"],
    [/contato\s*[:\-]\s*([^\n]+)/i, "contact_name"],
    [/website\s*[:\-]\s*([^\n]+)/i, "website"],
    [/telefone\s*ativa[çc][ãa]o\s*[:\-]\s*([^\n]+)/i, "activation_phone"],
  ];
  for (const [regex, field] of patterns) {
    const match = description.match(regex);
    if (match) extracted[field] = match[1].trim();
  }
  return extracted;
}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResp({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const importApiKey = Deno.env.get("IMPORT_PROJECTS_API_KEY");

  // --- Auth ---
  let callerId: string | null = null;

  const apiKey = req.headers.get("x-api-key");
  const authHeader = req.headers.get("authorization");

  if (apiKey && importApiKey && apiKey === importApiKey) {
    callerId = "api-import";
  } else if (authHeader?.startsWith("Bearer ")) {
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return jsonResp({ error: "Token inválido ou expirado" }, 401);
    }
    callerId = claimsData.claims.sub as string;
  } else {
    return jsonResp({ error: "Autenticação necessária. Envie x-api-key ou Authorization Bearer." }, 401);
  }

  let body: { projects?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return jsonResp({ error: "JSON inválido" }, 400);
  }

  const projects = body.projects;
  if (!Array.isArray(projects) || projects.length === 0) {
    return jsonResp({ error: "Campo 'projects' deve ser um array não vazio." }, 400);
  }
  if (projects.length > MAX_PROJECTS) {
    return jsonResp({ error: `Limite de ${MAX_PROJECTS} projetos por requisição.` }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Pre-fetch dynamic statuses from DB (single query)
  const { data: dbStatuses } = await admin
    .from("project_phase_statuses")
    .select("phase_name, status_name")
    .order("sort_order");

  const dbStatusMap: Record<string, string[]> = {};
  if (dbStatuses && dbStatuses.length > 0) {
    for (const s of dbStatuses) {
      if (!dbStatusMap[s.phase_name]) dbStatusMap[s.phase_name] = [];
      dbStatusMap[s.phase_name].push(s.status_name);
    }
  }

  function getValidStatuses(phaseName: string): string[] {
    return dbStatusMap[phaseName]?.length
      ? dbStatusMap[phaseName]
      : PHASE_STATUSES_FALLBACK[phaseName] || [];
  }

  // Pre-fetch all profiles for email resolution in a single query
  const allEmails = new Set<string>();
  for (const p of projects) {
    const proj = p as Record<string, unknown>;
    for (const field of ["assigned_user_email", "closer_email", "sdr_email", "head_email", "ux_po_email", "dev_email"]) {
      const email = proj[field] as string;
      if (email) allEmails.add(email.toLowerCase().trim());
    }
  }

  const emailCache: Record<string, string | null> = {};
  if (allEmails.size > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email")
      .in("email", Array.from(allEmails));
    for (const profile of profiles || []) {
      if (profile.email) emailCache[profile.email.toLowerCase()] = profile.id;
    }
  }

  function resolveEmail(email?: string): string | null {
    if (!email) return null;
    return emailCache[email.toLowerCase().trim()] ?? null;
  }

  // --- Fetch default head from system_config ---
  let FIXED_HEAD_ID: string | null = null;
  {
    const { data: headConfig } = await admin
      .from("system_config")
      .select("value")
      .eq("key", "default_head_user_id")
      .maybeSingle();
    FIXED_HEAD_ID = (headConfig?.value as string) || null;
  }

  interface PreparedProject {
    projectInsert: Record<string, unknown>;
    phaseName: string;
    status: string;
    assignedUserId: string | null;
    phaseIndex: number;
  }

  const prepared: PreparedProject[] = [];
  const errors: { index: number; error: string }[] = [];

  for (let i = 0; i < projects.length; i++) {
    const p = projects[i] as Record<string, unknown>;
    try {
      const companyName = (p.company_name as string)?.trim();
      const projectType = (p.project_type as string)?.trim();
      const phaseName = (p.phase_name as string)?.trim();
      const status = (p.status as string)?.trim();

      if (!companyName) throw new Error("company_name é obrigatório");
      if (!projectType) throw new Error("project_type é obrigatório");
      if (!phaseName) throw new Error("phase_name é obrigatório");
      if (!status) throw new Error("status é obrigatório");

      if (!(VALID_PROJECT_TYPES as readonly string[]).includes(projectType)) {
        throw new Error(`project_type '${projectType}' inválido`);
      }

      const validPhases = PHASES_BY_TYPE[projectType];
      if (!validPhases.includes(phaseName)) {
        throw new Error(`Fase '${phaseName}' inválida para tipo '${projectType}'`);
      }

      const validStatuses = getValidStatuses(phaseName);
      if (validStatuses.length > 0 && !validStatuses.includes(status)) {
        throw new Error(`Status '${status}' inválido para fase '${phaseName}'`);
      }

      const priority = ((p.priority as string) || "media").trim();
      if (!(VALID_PRIORITIES as readonly string[]).includes(priority)) {
        throw new Error(`priority '${priority}' inválido`);
      }

      const overallStatus = ((p.overall_status as string) || "ativo").trim();
      if (!(VALID_OVERALL_STATUSES as readonly string[]).includes(overallStatus)) {
        throw new Error(`overall_status '${overallStatus}' inválido`);
      }

      const skipAutoAssign = p.skip_auto_assign === true;

      let assignedUserId = (p.assigned_user_id as string) || null;
      if (!skipAutoAssign && !assignedUserId && p.assigned_user_email) {
        assignedUserId = resolveEmail(p.assigned_user_email as string);
        if (!assignedUserId) throw new Error(`Usuário '${p.assigned_user_email}' não encontrado`);
      }

      let closerUserId = (p.closer_user_id as string) || null;
      if (!skipAutoAssign && !closerUserId && p.closer_email) closerUserId = resolveEmail(p.closer_email as string);

      let sdrUserId = (p.sdr_user_id as string) || null;
      if (!skipAutoAssign && !sdrUserId && p.sdr_email) sdrUserId = resolveEmail(p.sdr_email as string);

      let headUserId = (p.head_user_id as string) || null;
      if (!skipAutoAssign && !headUserId && p.head_email) headUserId = resolveEmail(p.head_email as string);
      if (!skipAutoAssign && !headUserId) headUserId = FIXED_HEAD_ID;

      let uxPoUserId = (p.ux_po_user_id as string) || null;
      if (!skipAutoAssign && !uxPoUserId && p.ux_po_email) uxPoUserId = resolveEmail(p.ux_po_email as string);

      let devUserId = (p.dev_user_id as string) || null;
      if (!skipAutoAssign && !devUserId && p.dev_email) devUserId = resolveEmail(p.dev_email as string);

      let tags: string[] | null = null;
      if (Array.isArray(p.tags)) {
        tags = (p.tags as string[]).map(t => String(t).trim()).filter(Boolean);
      } else if (typeof p.tags === "string") {
        tags = (p.tags as string).split(",").map(t => t.trim()).filter(Boolean);
      }

      const startDate = (p.start_date as string) || new Date().toISOString().split("T")[0];
      const computedDueDate = (p.due_date as string) || (() => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + 15);
        return d.toISOString().split("T")[0];
      })();

      const phaseField = PHASE_ASSIGNEE_FIELD[phaseName];
      if (assignedUserId && phaseField) {
        if (phaseField === "ux_po_user_id" && !uxPoUserId) uxPoUserId = assignedUserId;
        if (phaseField === "dev_user_id" && !devUserId) devUserId = assignedUserId;
      }

      let treinamentoUserId = (p.treinamento_user_id as string) || null;
      let ativacaoUserId = (p.ativacao_user_id as string) || null;
      if (assignedUserId && phaseField === "treinamento_user_id" && !treinamentoUserId) treinamentoUserId = assignedUserId;
      if (assignedUserId && phaseField === "ativacao_user_id" && !ativacaoUserId) ativacaoUserId = assignedUserId;

      const descriptionText = (p.project_description as string) || "";
      const descExtracted = descriptionText ? extractDescriptionData(descriptionText) : {};

      const phaseIndex = validPhases.indexOf(phaseName);

      prepared.push({
        projectInsert: {
          company_name: companyName,
          cnpj: (p.cnpj as string) || descExtracted.cnpj || null,
          project_type: projectType,
          current_phase: phaseName,
          overall_status: overallStatus,
          priority,
          contact_name: (p.contact_name as string) || descExtracted.contact_name || null,
          contact_phone: (p.contact_phone as string) || descExtracted.contact_phone || null,
          contact_email: (p.contact_email as string) || descExtracted.contact_email || null,
          website: (p.website as string) || descExtracted.website || null,
          project_description: descriptionText || null,
          notes: (p.notes as string) || null,
          due_date: computedDueDate,
          start_date: startDate,
          tags,
          estimated_hours: p.estimated_hours ? Number(p.estimated_hours) : null,
          version: (p.version as string) || descExtracted.version || 'VP',
          api_type: (p.api_type as string) || 'Oficial',
          plan_name: (p.plan_name as string) || descExtracted.plan_name || null,
          broker: (p.broker as string) || descExtracted.broker || 'EZ',
          complexity_level: (p.complexity_level as string) || descExtracted.complexity_level || null,
          closer_name: (p.closer_name as string) || null,
          closer_user_id: closerUserId,
          sdr_name: (p.sdr_name as string) || null,
          sdr_user_id: sdrUserId,
          head_user_id: headUserId,
          ux_po_user_id: uxPoUserId,
          dev_user_id: devUserId,
          treinamento_user_id: treinamentoUserId,
          ativacao_user_id: ativacaoUserId,
          has_integration: p.has_integration === true || p.has_integration === "true",
          integrations_description: (p.integrations_description as string) || descExtracted.integrations_description || null,
          has_ai: p.has_ai === true || p.has_ai === "true",
          storage_time: (p.storage_time as string) || "1 ano",
          activation_phone: (p.activation_phone as string) || descExtracted.activation_phone || null,
          created_by_user_id: callerId === "api-import" ? null : callerId,
        },
        phaseName,
        status,
        assignedUserId,
        phaseIndex,
      });
    } catch (err) {
      errors.push({ index: i, error: (err as Error).message });
    }
  }

  if (prepared.length === 0) {
    return jsonResp({ success: errors.length === 0, imported: 0, errors, projects: [] });
  }

  // --- Batch insert projects ---
  const { data: insertedProjects, error: projBatchErr } = await admin
    .from("projects")
    .insert(prepared.map(p => p.projectInsert))
    .select("id");

  if (projBatchErr || !insertedProjects) {
    return jsonResp({ error: `Erro ao inserir projetos em lote: ${projBatchErr?.message}` }, 500);
  }

  const now = new Date().toISOString();
  const userId = callerId === "api-import" ? null : callerId;

  // Build batch arrays for phases, transitions, and logs
  const phaseInserts = insertedProjects.map((proj, i) => ({
    project_id: proj.id,
    phase_name: prepared[i].phaseName,
    status: prepared[i].status,
    assigned_user_id: prepared[i].assignedUserId,
    is_active: true,
    sort_order: prepared[i].phaseIndex >= 0 ? prepared[i].phaseIndex : 0,
    started_at: now,
  }));

  const transitionInserts = insertedProjects.map((proj, i) => ({
    project_id: proj.id,
    phase_name: prepared[i].phaseName,
    status: prepared[i].status,
    entered_at: now,
    changed_by_user_id: userId,
  }));

  const logInserts = insertedProjects.map((proj, i) => ({
    project_id: proj.id,
    user_id: userId,
    action_type: "project_created",
    phase_name: prepared[i].phaseName,
    new_value: prepared[i].status,
    description: `Projeto importado via API na fase '${prepared[i].phaseName}' com status '${prepared[i].status}'`,
  }));

  // Execute all 3 batch inserts in parallel
  const [phaseRes, transRes, logRes] = await Promise.all([
    admin.from("project_phases").insert(phaseInserts).select("id"),
    admin.from("project_status_transitions").insert(transitionInserts),
    admin.from("project_activity_logs").insert(logInserts),
  ]);

  if (phaseRes.error) {
    console.error("Phase batch insert error:", phaseRes.error);
  }

  // --- Batch auto-assignment for projects that need it ---
  const needsAssignment = prepared.filter(p => !p.projectInsert.skip_auto_assign);
  if (needsAssignment.length > 0) {
    // Check if any project is missing role assignments
    const missingAssignment = insertedProjects.some((_, i) => {
      const ins = prepared[i].projectInsert;
      return !ins.skip_auto_assign && (!ins.ux_po_user_id || !ins.dev_user_id || !ins.treinamento_user_id);
    });

    if (missingAssignment) {
      try {
        const { data: assignments } = await admin.rpc("get_least_loaded_users");
        if (assignments) {
          const a = assignments as Record<string, string | null>;
          const updatePromises = insertedProjects
            .map((proj, i) => ({ proj, i }))
            .filter(({ i }) => {
              const ins = prepared[i].projectInsert;
              return !ins.skip_auto_assign && (!ins.ux_po_user_id || !ins.dev_user_id || !ins.treinamento_user_id);
            })
            .map(({ proj, i }) => {
              const ins = prepared[i].projectInsert;
              const patch: Record<string, string | null> = {};
              if (!ins.ux_po_user_id && a.ux_po_user_id) patch.ux_po_user_id = a.ux_po_user_id;
              if (!ins.dev_user_id && a.dev_user_id) patch.dev_user_id = a.dev_user_id;
              if (!ins.treinamento_user_id && a.treinamento_user_id) patch.treinamento_user_id = a.treinamento_user_id;
              if (!ins.ativacao_user_id && a.treinamento_user_id) patch.ativacao_user_id = a.treinamento_user_id;
              if (!ins.head_user_id && a.head_user_id) patch.head_user_id = a.head_user_id;
              if (Object.keys(patch).length === 0) return null;
              return admin.from("projects").update(patch).eq("id", proj.id);
            })
            .filter(Boolean);

          if (updatePromises.length > 0) {
            await Promise.all(updatePromises);
            console.log(`Auto-assigned ${updatePromises.length} projects via batch RPC`);
          }
        }
      } catch (err) {
        console.error("Batch auto-assignment error:", (err as Error).message);
      }
    }
  }

  const results = insertedProjects.map((proj, i) => ({
    index: i,
    project_id: proj.id,
    phase_id: phaseRes.data?.[i]?.id || null,
  }));

  return jsonResp({
    success: errors.length === 0,
    imported: results.length,
    errors,
    projects: results,
  });
});
