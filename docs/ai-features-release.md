# EZ Journey — Release de Features de IA

## Visão Geral

**Data:** 21 de março de 2026
**Versão:** 9 features de IA implementadas em uma única release
**Commit:** `180c9597`
**Arquivos alterados:** 32 (2.515 linhas adicionadas)

---

## Resumo Executivo

Foram implementadas **9 novas features de Inteligência Artificial** no EZ Journey CRM, cobrindo todo o ciclo de vendas — desde a prospecção (SDR) até o pós-venda (Customer Success). Cada feature segue a arquitetura existente: **Edge Function (Supabase) → Hook (TanStack React Query) → Componente (shadcn/ui)**, com rastreamento de custos via `ai_usage_logs` e integração com o Lovable AI Gateway (Gemini 3 Flash).

---

## Features Implementadas

### 1. Briefing Pré-Call (SDR)

**O que faz:** Gera um "game plan" com IA antes de cada ligação, baseado no perfil do lead, histórico de interações e análises de calls anteriores.

**Onde aparece:** LeadModal → aba Insights

**O que entrega:**
- Contexto da empresa (2-3 frases)
- Resumo do histórico de interações
- Pontos fortes de venda específicos para o segmento
- Objeções previstas
- Estratégia de abertura sugerida
- 3 perguntas-chave para o SDR fazer
- Nível de prioridade e tempo estimado

**Arquivos:**
- `supabase/functions/generate-call-briefing/index.ts`
- `src/hooks/useCallBriefing.ts`
- `src/components/CallBriefingCard.tsx`

---

### 2. Lead Scoring Preditivo

**O que faz:** Calcula um score de qualificação de 0-100 com breakdown por fatores, usando IA para avaliar a probabilidade de conversão.

**Onde aparece:** LeadModal → aba Insights

**Fatores avaliados (com pesos):**
- Completude de dados (15 pts)
- ICP Fit — segmento, porte, funcionários (25 pts)
- Engajamento — temperatura, score comportamental (25 pts)
- Sinais de compra — orçamento, urgência (20 pts)
- Qualidade de enriquecimento (15 pts)

**O que entrega:**
- Score total (0-100) com grade (A/B/C/D)
- Gauge visual SVG com barras de progresso por fator
- Probabilidade de conversão (%)
- Recomendação e próxima ação ideal

**Arquivos:**
- `supabase/functions/predict-lead-score/index.ts`
- `src/hooks/usePredictiveScore.ts`
- `src/components/LeadScoreBreakdown.tsx`

---

### 3. Deals At-Risk + Sugestões de Recuperação

**O que faz:** Detecta automaticamente deals travados no pipeline (baseado em thresholds por estágio) e usa IA para sugerir ações de recuperação.

**Onde aparece:** Closer → Indicadores (painel lateral)

**Thresholds por estágio:**
| Estágio | Dias para considerar travado |
|---------|------------------------------|
| Demonstração | 7 dias |
| Apresentar proposta | 5 dias |
| Proposta enviada | 10 dias |
| Negociação | 14 dias |
| Opp Quente | 21 dias |
| Contrato | 7 dias |

**O que entrega:**
- Lista de deals travados com severity (critical/high/medium)
- Análise IA com: razão do risco, probabilidade de fechamento, ações sugeridas, próximo passo recomendado
- Cards expansíveis com detalhes

**Arquivos:**
- `supabase/functions/analyze-deal-risk/index.ts`
- `src/hooks/useDealsAtRisk.ts`
- `src/components/closer/DealsAtRiskPanel.tsx`

---

### 4. Forecast de Receita

**O que faz:** Projeta receita futura com ponderação por probabilidade de fechamento em cada estágio do pipeline.

**Onde aparece:** Closer → Indicadores (painel lateral)

**Probabilidades por estágio:**
| Estágio | Probabilidade |
|---------|--------------|
| Demonstração | 10% |
| Proposta enviada | 35% |
| Negociação | 50% |
| Opp Quente | 65% |
| Contrato | 80% |
| Pagamento | 90% |

**O que entrega:**
- 3 cenários: Conservador (0.7x), Realista (1.0x), Otimista (1.3x)
- Funnel visual do pipeline com barras de probabilidade
- Gráfico de área (Recharts) com projeção mensal para 3 meses
- Comparação com média histórica (últimos 3 meses)
- Pipeline total vs. ponderado

**Arquivos:**
- `src/hooks/useRevenueForecast.ts`
- `src/components/closer/RevenueForecastPanel.tsx`

---

### 5. Briefing Diário com IA

**O que faz:** Gera um resumo executivo diário personalizado por role (SDR, Closer, Manager) com prioridades e alertas.

**Onde aparece:** Dashboard (página inicial)

**O que entrega:**
- Saudação personalizada (bom dia/boa tarde/boa noite)
- 3-5 prioridades do dia
- Alertas importantes (deals em risco, metas atrasadas)
- Dica de vendas/produtividade
- Score de saúde do dia (0-100)
- Cache local (gera 1x por dia, não repete chamadas)

**Arquivos:**
- `supabase/functions/generate-daily-briefing/index.ts`
- `src/hooks/useDailyBriefing.ts`
- `src/components/DailyBriefingCard.tsx`

---

### 6. Análise Win/Loss

**O que faz:** Analisa padrões de vitória e derrota nos deals para identificar o que funciona e o que não funciona nas vendas.

**Onde aparece:** Configurações → Inteligência → Análise Win/Loss

**O que entrega:**
- KPIs: Win Rate, Total Ganhos/Perdidos, Ticket Médio, Ciclo Médio
- Padrões de vitória com nível de confiança (alta/média/baixa)
- Padrões de perda com nível de confiança
- Insights por segmento
- Recomendações acionáveis (3-5 itens)
- Fatores de risco como badges

**Arquivos:**
- `supabase/functions/analyze-win-loss/index.ts`
- `src/hooks/useWinLossAnalysis.ts`
- `src/components/admin/WinLossAnalysisSection.tsx`

---

### 7. Customer Health Score

**O que faz:** Avalia a saúde pós-venda de cada cliente ativo com score de churn risk e upsell readiness.

**Onde aparece:** Configurações → Inteligência → Saúde dos Clientes

**O que entrega:**
- Health score (0-100) por cliente
- Status: Saudável / Atenção / Em risco / Crítico
- Risco de churn: Baixo / Médio / Alto
- Prontidão para upsell: Pronto / Nurturing / Não pronto
- Sinais-chave e ação recomendada por cliente
- Cards de resumo com contagens por status

**Arquivos:**
- `supabase/functions/calculate-health-score/index.ts`
- `src/hooks/useCustomerHealth.ts`
- `src/components/clients/CustomerHealthPanel.tsx`

---

### 8. Detecção Inteligente de Duplicatas

**O que faz:** Escaneia a base de leads usando fuzzy matching (Jaro-Winkler) para detectar duplicatas por CNPJ, email, telefone, WhatsApp ou nome similar.

**Onde aparece:** Configurações → Inteligência → Detecção de Duplicatas

**Critérios de match:**
| Tipo | Confiança |
|------|-----------|
| CNPJ idêntico | 95% |
| Email idêntico | 90% |
| Telefone/WhatsApp idêntico | 85% |
| Razão social similar (≥85%) | ~70% |

**O que entrega:**
- Escaneamento de até 1.000 leads
- Grupos de duplicatas ordenados por confiança
- Comparação lado a lado dos leads duplicados
- Badges de confiança (Alta/Média/Baixa)
- Destaque dos campos que causaram o match

**Arquivos:**
- `supabase/functions/detect-duplicates/index.ts`
- `src/hooks/useDuplicateDetection.ts`
- `src/components/DuplicateDetectionPanel.tsx`

---

### 9. Smart Search (RAG)

**O que faz:** Busca semântica com linguagem natural que interpreta a intenção do usuário e busca em leads, oportunidades e projetos simultaneamente. Responde perguntas analíticas.

**Onde aparece:** Qualquer página via `Ctrl+Shift+K` (ou `Cmd+Shift+K` no Mac)

**Exemplos de uso:**
- "Leads do segmento de saúde"
- "Oportunidades acima de R$10.000"
- "Qual o ticket médio dos deals ganhos?"
- "Projetos em andamento"

**O que entrega:**
- Interpretação automática da intenção (search_leads, search_opportunities, analytics, etc.)
- Resultados cross-entity (leads + oportunidades + projetos)
- Respostas de IA para perguntas analíticas
- Sugestões de queries de exemplo

**Arquivos:**
- `supabase/functions/smart-search/index.ts`
- `src/hooks/useSmartSearch.ts`
- `src/components/SmartSearchDialog.tsx`

---

## Arquitetura Técnica

### Padrão de cada feature

```
Edge Function (Deno/Supabase)
  ↓ Lovable AI Gateway (Gemini 3 Flash)
  ↓ Logging → ai_usage_logs
  ↓
Hook (TanStack React Query v5)
  ↓ useMutation / useQuery
  ↓
Componente (React + shadcn/ui)
  ↓ cn() + HSL tokens + dark mode
```

### Rastreamento de custos

Toda chamada de IA é logada em `ai_usage_logs` com:
- `prompt_id` (identificador da feature)
- `model` (gemini-3-flash-preview)
- `tokens_input` / `tokens_output`
- `estimated_cost_usd`
- `lead_id` (quando aplicável)

### Modelo de IA utilizado

- **Provider:** Lovable AI Gateway
- **Modelo:** `google/gemini-3-flash-preview`
- **Custo estimado:** $0.15/1M input tokens + $0.60/1M output tokens
- **Retry:** 3 tentativas com backoff exponencial
- **Rate limiting:** Tratamento de HTTP 429 e 402

---

## Integrações nos Arquivos Existentes

| Arquivo modificado | Feature integrada |
|-------------------|-------------------|
| `src/pages/DashboardPage.tsx` | Daily Briefing Card |
| `src/pages/CloserIndicadoresPage.tsx` | Deals At-Risk + Revenue Forecast |
| `src/components/LeadModal.tsx` | Lead Score + Call Briefing |
| `src/components/AppLayout.tsx` | Smart Search (Ctrl+Shift+K) |
| `src/components/settings/SettingsLayout.tsx` | 3 novos itens no menu |
| `src/pages/SettingsPage.tsx` | 3 novas rotas |

---

## Contagem Final

| Métrica | Valor |
|---------|-------|
| Features de IA | 9 |
| Edge Functions criadas | 8 |
| Hooks criados | 9 |
| Componentes criados | 9 |
| Arquivos existentes modificados | 6 |
| **Total de arquivos alterados** | **32** |
| **Linhas adicionadas** | **2.515** |

---

*Documento gerado automaticamente em 21/03/2026*
*EZ Journey CRM — EZSoft*
