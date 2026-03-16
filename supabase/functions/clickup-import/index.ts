import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRIORITY_MAP: Record<string, string> = {
  urgent: "urgente",
  high: "alta",
  normal: "media",
  low: "baixa",
};

const STATUS_PHASE_MAP: Record<string, { phase_name: string; status: string }> = {
  "backlog": { phase_name: "validacao", status: "BACKLOG" },
  "em análise": { phase_name: "validacao", status: "EM ANÁLISE" },
  "dados incompletos": { phase_name: "validacao", status: "DADOS INCOMPLETOS" },
  "validado": { phase_name: "validacao", status: "VALIDADO" },
  "mapeamento de processos": { phase_name: "ux_po", status: "MAPEAMENTO DE PROCESSOS" },
  "montagem de fluxo": { phase_name: "ux_po", status: "MONTAGEM DE FLUXO" },
  "revisão interna": { phase_name: "ux_po", status: "REVISÃO INTERNA" },
  "aprovação do cliente": { phase_name: "ux_po", status: "APROVAÇÃO DO CLIENTE" },
  "ajustes": { phase_name: "ux_po", status: "AJUSTES" },
  "desenvolvimento": { phase_name: "dev_chatbot", status: "DESENVOLVIMENTO" },
  "qa": { phase_name: "dev_chatbot", status: "QA" },
  "revisão": { phase_name: "dev_chatbot", status: "REVISÃO" },
  "agendamento": { phase_name: "treinamento", status: "AGENDAMENTO" },
  "material preparado": { phase_name: "treinamento", status: "MATERIAL PREPARADO" },
  "treinamento realizado": { phase_name: "treinamento", status: "TREINAMENTO REALIZADO" },
  "em andamento": { phase_name: "ativacao", status: "EM ANDAMENTO" },
  "com pendência": { phase_name: "ativacao", status: "COM PENDÊNCIA" },
  "em contato": { phase_name: "verificacao_bm", status: "EM CONTATO" },
  "reunião agendada": { phase_name: "verificacao_bm", status: "REUNIÃO AGENDADA" },
  "aguardando cliente": { phase_name: "verificacao_bm", status: "AGUARDANDO CLIENTE" },
  "aguardando meta": { phase_name: "verificacao_bm", status: "AGUARDANDO META" },
  "pausado": { phase_name: "verificacao_bm", status: "PAUSADO" },
  "cancelado": { phase_name: "verificacao_bm", status: "CANCELADO" },
  "em desenvolvimento": { phase_name: "automacao", status: "EM DESENVOLVIMENTO" },
  "em teste": { phase_name: "automacao", status: "EM TESTE" },
  "em processo de curadoria": { phase_name: "curadoria_ia", status: "EM PROCESSO DE CURADORIA" },
  "em pausa": { phase_name: "curadoria_ia", status: "EM PAUSA" },
  "gestão de pendências": { phase_name: "curadoria_ia", status: "GESTÃO DE PENDÊNCIAS" },
  "em acompanhamento": { phase_name: "go_live_assistido", status: "EM ACOMPANHAMENTO" },
  "concluído": { phase_name: "validacao", status: "CONCLUÍDO" },
  "concluido": { phase_name: "validacao", status: "CONCLUÍDO" },
  "complete": { phase_name: "validacao", status: "CONCLUÍDO" },
  "closed": { phase_name: "validacao", status: "CONCLUÍDO" },
};

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface ClickUpTask {
  id: string;
  name: string;
  status: { status: string };
  priority: { priority: string } | null;
  assignees: Array<{ email: string; username: string }>;
  due_date: string | null;
  start_date: string | null;
  tags: Array<{ name: string }>;
  description: string | null;
  custom_fields: Array<{
    id: string;
    name: string;
    value: unknown;
    type: string;
    type_config?: { options?: Array<{ name: string; orderindex: number }> };
  }>;
}

function resolvePhaseAndStatus(
  clickupStatus: string,
  fallbackPhase: string,
  fallbackStatus: string
): { phase_name: string; status: string } {
  const normalized = clickupStatus.toLowerCase().trim();
  return STATUS_PHASE_MAP[normalized] || { phase_name: fallbackPhase, status: fallbackStatus };
}

function mapTaskToProject(
  task: ClickUpTask,
  projectType: string,
  defaultPhase: string,
  defaultStatus: string,
  customFieldMap: Record<string, string>,
  autoMapStatus: boolean
): Record<string, unknown> {
  const priority = task.priority
    ? PRIORITY_MAP[task.priority.priority] || "media"
    : "media";

  const tags = task.tags?.map((t) => t.name) || [];

  let phaseName = defaultPhase;
  let status = defaultStatus;
  if (autoMapStatus && task.status?.status) {
    const resolved = resolvePhaseAndStatus(task.status.status, defaultPhase, defaultStatus);
    phaseName = resolved.phase_name;
    status = resolved.status;
  }

  const mapped: Record<string, unknown> = {
    company_name: task.name,
    project_type: projectType,
    phase_name: phaseName,
    status,
    priority,
    skip_auto_assign: true,
    due_date: task.due_date ? new Date(Number(task.due_date)).toISOString().split("T")[0] : null,
    start_date: task.start_date ? new Date(Number(task.start_date)).toISOString().split("T")[0] : null,
    tags,
    project_description: task.description || null,
    notes: `ClickUp Task ID: ${task.id}`,
  };

  const fieldMap: Record<string, string> = {
    cnpj: "cnpj",
    "versão": "version",
    versao: "version",
    version: "version",
    broker: "broker",
    "closer name": "closer_name",
    closer: "closer_name",
    "sdr name": "sdr_name",
    sdr: "sdr_name",
    "tipo api": "api_type",
    api_type: "api_type",
    plano: "plan_name",
    plan: "plan_name",
    complexidade: "complexity_level",
    complexity: "complexity_level",
    "usa ia": "has_ai",
    ...customFieldMap,
  };

  for (const cf of task.custom_fields || []) {
    const targetField = fieldMap[cf.name.toLowerCase()];
    if (targetField && cf.value !== null && cf.value !== undefined) {
      let val: string;
      if (cf.type === "drop_down" && typeof cf.value === "number" && cf.type_config?.options) {
        const opt = cf.type_config.options.find((o) => o.orderindex === cf.value);
        val = opt?.name || String(cf.value);
      } else {
        val = String(cf.value);
      }
      // Handle boolean field for has_ai
      if (targetField === "has_ai") {
        mapped[targetField] = val.toLowerCase() === "sim" || val.toLowerCase() === "true" || val === "1";
      } else {
        mapped[targetField] = val;
      }
    }
  }

  return mapped;
}

async function fetchTaskById(clickupToken: string, taskId: string): Promise<ClickUpTask> {
  const res = await fetch(`https://api.clickup.com/api/v2/task/${taskId}?include_subtasks=false`, {
    headers: { Authorization: clickupToken },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro ao buscar task ${taskId}: ${res.status} - ${errText}`);
  }
  return await res.json();
}

async function fetchTasksByList(clickupToken: string, listId: string): Promise<ClickUpTask[]> {
  const url = `https://api.clickup.com/api/v2/list/${listId}/task?include_closed=true&subtasks=false&page=0`;
  const res = await fetch(url, { headers: { Authorization: clickupToken } });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro na API ClickUp: ${res.status} - ${errText}`);
  }
  const data = await res.json();
  return data.tasks || [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResp({ error: "Method not allowed" }, 405);
  }

  const clickupToken = Deno.env.get("CLICKUP_API_TOKEN");
  if (!clickupToken) {
    return jsonResp({ error: "CLICKUP_API_TOKEN não configurado" }, 500);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const apiKey = req.headers.get("x-api-key");
  const importApiKey = Deno.env.get("IMPORT_PROJECTS_API_KEY");
  const authHeader = req.headers.get("authorization");
  let callerId: string | null = null;

  if (apiKey && importApiKey && apiKey === importApiKey) {
    callerId = "api-import";
  } else if (authHeader?.startsWith("Bearer ")) {
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
    return jsonResp({ error: "Autenticação necessária." }, 401);
  }

  let body: {
    list_id?: string;
    task_id?: string;
    mode?: "preview" | "import";
    task_ids?: string[];
    project_type?: string;
    phase_name?: string;
    status?: string;
    auto_map_status?: boolean;
    custom_field_map?: Record<string, string>;
  };

  try {
    body = await req.json();
  } catch {
    return jsonResp({ error: "JSON inválido" }, 400);
  }

  const {
    list_id,
    task_id,
    mode = "preview",
    task_ids,
    project_type = "venda",
    phase_name = "validacao",
    status = "BACKLOG",
    auto_map_status = true,
    custom_field_map = {},
  } = body;

  if (!list_id && !task_id) {
    return jsonResp({ error: "list_id ou task_id é obrigatório" }, 400);
  }

  try {
    let tasks: ClickUpTask[];

    if (task_id) {
      const task = await fetchTaskById(clickupToken, task_id);
      tasks = [task];
    } else {
      tasks = await fetchTasksByList(clickupToken, list_id!);
      if (task_ids && task_ids.length > 0) {
        const idSet = new Set(task_ids);
        tasks = tasks.filter((t) => idSet.has(t.id));
      }
    }

    const mappedProjects = tasks.map((task) => {
      const mapped = mapTaskToProject(task, project_type, phase_name, status, custom_field_map, auto_map_status);
      return {
        clickup_task_id: task.id,
        clickup_task_name: task.name,
        clickup_status: task.status?.status,
        mapped_phase: (mapped as Record<string, unknown>).phase_name,
        mapped_status: (mapped as Record<string, unknown>).status,
        clickup_assignees: task.assignees?.map((a) => a.email) || [],
        mapped_project: mapped,
      };
    });

    if (mode === "preview") {
      return jsonResp({
        success: true,
        total_tasks: tasks.length,
        tasks: mappedProjects,
      });
    }

    // Import mode - call import-projects with the same auth
    const projectPayloads = mappedProjects.map((mp) => mp.mapped_project);

    const importHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: anonKey,
    };
    if (callerId === "api-import") {
      importHeaders["x-api-key"] = apiKey!;
    } else {
      importHeaders["Authorization"] = authHeader!;
    }

    const importUrl = `${supabaseUrl}/functions/v1/import-projects`;
    const importRes = await fetch(importUrl, {
      method: "POST",
      headers: importHeaders,
      body: JSON.stringify({ projects: projectPayloads }),
    });

    const importResult = await importRes.json();

    return jsonResp({
      success: importResult.success,
      clickup_tasks_found: tasks.length,
      imported: importResult.imported,
      errors: importResult.errors,
      projects: importResult.projects,
    });
  } catch (err) {
    return jsonResp({ error: `Erro ao processar: ${(err as Error).message}` }, 500);
  }
});
