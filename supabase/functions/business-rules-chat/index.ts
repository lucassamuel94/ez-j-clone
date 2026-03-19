import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Knowledge base: business rules extracted from CLAUDE.md + knowledge.md ──
// Update this constant whenever business rules change in the codebase.
const KNOWLEDGE_BASE = `
# EZ Journey — Regras de Negócio

## 1. Visão Geral do Produto

EZ Journey é uma plataforma corporativa de CRM + Pipeline de Vendas + Gestão de Projetos da EZSoft. Combina gerenciamento de leads, oportunidades, propostas, projetos e comunicação em uma única plataforma.

### Público-alvo
- **Equipes de vendas** (SDRs e Closers): leads, oportunidades, propostas, evolução de clientes
- **Equipes de pós-venda** (Head, UX/PO, Dev Chatbot, Treinamento, Suporte, Verificação BM): entrega de projetos
- **Gestores e Admins**: operação, relatórios e configuração

---

## 2. Papéis e Permissões

| Papel | Escopo de Acesso |
|-------|-----------------|
| **Admin** | Acesso total a todos os módulos, configurações, relatórios, gestão de usuários |
| **Manager** | Igual ao Admin funcionalmente |
| **SDR** | Lead Inbox, cadências, indicadores SDR, análise ICP |
| **Closer** | Pipeline closer (negócio novo + evolução), propostas, simulador, contas |
| **Head Pós-Venda** | Tratado como Admin; dono padrão de projetos; gerencia todas as fases |
| **UX/PO** | Projetos atribuídos |
| **Dev Chatbot** | Projetos atribuídos, análise de API |
| **Treinamento** | Projetos atribuídos |
| **Suporte** | Visualização de projetos |
| **Verificação BM** | Visualização de projetos |

### Sistema de Permissões
- **Sistema dual**: role-based (allowedRoles nas rotas) + permissão granular (tabela permissions)
- Permissões buscadas via RPC get_user_permissions() (SECURITY DEFINER)
- Simulação de papel disponível para admins via useRoleSimulation
- ProtectedRoute protege todas as rotas

### Acessos por Rota
- /leads → sdr, admin, manager
- /closer, /closer/evolucao → closer, admin, manager
- /projects → admin, manager, closer, head_pos_venda, ux_po, dev_chatbot, treinamento
- /settings/* → requer permissão access_admin
- /tasks → todos os papéis autenticados

---

## 3. Gestão de Leads (Módulo SDR)

- **Lead Inbox** com busca paginada server-side (RPC search_leads_paginated)
- Filtragem por abas: Hoje, Atrasados, Novos, Em Contato, Agendados, etc.
- **Lead Modal** (layout 2 colunas): coluna de operação (notas, timeline) + coluna de contexto (dados empresa, contatos, qualificação)
- Geração de resumo por IA
- Enriquecimento de CNPJ via API CNPJA
- Cadências (sequências multi-etapa: ligação, e-mail, WhatsApp)
- Ações em massa: reatribuir, excluir, exportar
- **Validação SQO**: score de qualificação + score comportamental antes de confirmar reunião
- Reunião confirmada → cria Oportunidade automaticamente no pipeline do Closer

### Fluxo de Status do Lead
Novo → Em contato → Reunião agendada → Reunião confirmada → Oportunidade criada → Descartado (saída)

---

## 4. Pipeline do Closer (Módulo de Vendas)

- **Pipeline dual**: Negócio Novo (/closer) e Evolução (/closer/evolucao)
- Visualização Kanban e Tabela com paginação server-side
- **Estágios**: Demonstração → Proposta Enviada → Negociação → Ganho / Perdido
- Filtro por closer atribuído
- Abas: Oportunidades, Reuniões, Vendas
- Rastreamento de motivo de perda

### Pipeline de Evolução
- Oportunidades de clientes ativos: opportunity_type = 'evolution'
- **Regra CNPJ**: um CNPJ pode ter MÚLTIPLAS evoluções ativas simultaneamente
- Fonte sempre "Base de Clientes"

---

## 5. Regras Críticas de Negócio

### 5.1 Unicidade de CNPJ
- **Negócio Novo**: Bloqueia CNPJ duplicado quando existe oportunidade ativa
- **Evolução**: Permite múltiplas evoluções ativas para o mesmo CNPJ

### 5.2 Auto-vinculação de Conta
- Trigger cria/vincula Account na inserção de Lead via CNPJ
- Trigger auto_link_account_on_lead e auto_set_opportunity_account

### 5.3 Progressão de Lifecycle
- Lifecycle da conta só avança: lead → opportunity → client (nunca regride)

### 5.4 Atribuição de Head
- Lucas Oliveira é SEMPRE o Head de todos os projetos (manual + importação)
- ID fixo: f9e18ed3-...

### 5.5 Round-Robin de Papéis
- UX/PO, Dev, Treinamento são atribuídos pelo algoritmo de menor carga

### 5.6 Validação SQO
- Score de qualificação + score comportamental obrigatórios antes de confirmar reunião
- Critérios: Dor, Urgência, Orçamento, Decisor, ICP Fit

### 5.7 Ganho → Cliente Ativo
- Trigger insere na tabela active_clients quando stage = "Ganho"

### 5.8 Conclusão de Evolução
- Dev Chatbot concluído → pergunta se precisa IA → Curadoria IA ou → Entregue

### 5.9 Status Canônico
- Usar 'CONCLUÍDO' (com acento) para estados completados

---

## 6. Propostas

- Simulador gera propostas com planos de produto, custos de setup, integrações
- Preview estilo PDF com branding do cliente
- Fluxo checkout para aceite do cliente (CNPJ, representante legal, contato financeiro)
- Rastreamento de visualização (increment_proposal_views)
- Status: rascunho → enviada → visualizada → aceita/rejeitada

---

## 7. Gestão de Projetos

### Fases
Validação → UX/PO → Verificação BM → Dev Chatbot → Treinamento → Ativação → Curadoria IA

### Regras
- Auto-atribuição via round-robin (usuário com menor carga por papel)
- Head é SEMPRE Lucas Oliveira para todos os projetos
- Tipos: Standard, Evolução, Migração
- Dashboard com KPIs, carga de trabalho, board de aging, SLA, funil, lista de riscos

---

## 8. Gestão de Contas (Accounts)

- **Modelo Hub-and-Spoke**: Account (empresa) centraliza contatos, notas, timeline e oportunidades vinculadas
- Visão 360° via ClientDetailModal
- Auto-vinculação via triggers
- Progressão de lifecycle: lead → opportunity → client (irreversível)
- Importação com detecção de duplicatas

---

## 9. Comunicação

- **E-mail**: Integração Gmail (OAuth2), diálogo de composição, automação de sequências
- **WhatsApp**: Integração por link direto, gerenciamento de grupos
- **VoIP**: Widget WebPhone (integração EZCall), histórico de chamadas
- **Notificações**: Push + in-app, central de notificações

---

## 10. Relatórios e Analytics

- Dashboard de Performance SDR: ligações, reuniões, taxas de conversão
- Dashboard de Receita Closer: valores de deals, win rates, velocidade do pipeline
- Relatórios Admin: SDR vs Closer breakdowns, custos de meta
- Call Intelligence: upload de áudio → transcrição → análise IA → scoring

---

## 11. Formulários

- Builder visual com campos e estilos customizáveis
- Formulários incorporáveis para captura de leads
- Suporte a webhooks
- Auto-atribuição a SDR/Closer

---

## 12. Calendário

- Integração Google Calendar (OAuth2 com refresh tokens)
- Visualizações Semana e Mês
- Criação, edição e exclusão de eventos
`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Role check (server-side) ──
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const allowedRoles = ["admin", "manager", "head_pos_venda"];
    const hasAccess = roles?.some((r: any) => allowedRoles.includes(r.role));
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Acesso restrito a gestores" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse request ──
    const { question, history } = await req.json();
    if (!question) {
      return new Response(JSON.stringify({ error: "Pergunta é obrigatória" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Build messages ──
    const systemPrompt = `Você é o assistente de regras de negócio do EZ Journey CRM. Seu papel é ajudar gestores a entender como o sistema funciona.

FORMATO DAS RESPOSTAS:
- Responda de forma direta e objetiva, sem introduções desnecessárias
- Use listas e bullets para organizar informações
- Cite a regra ou seção específica quando aplicável
- Máximo 400 palavras por resposta
- Responda SEMPRE em português brasileiro
- Se não souber a resposta com certeza, diga que não tem essa informação
- NÃO invente regras que não estejam na base de conhecimento

${KNOWLEDGE_BASE}`;

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    // Include last 20 messages of history to avoid token overflow
    if (history && Array.isArray(history)) {
      const recent = history.slice(-20);
      for (const msg of recent) {
        if (msg.role === "error") continue;
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: "user", content: question });

    // ── Call AI gateway ──
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("business-rules-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
