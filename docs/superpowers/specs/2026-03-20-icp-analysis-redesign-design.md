---
title: Redesign da Página de Análise de Perfil ICP
date: 2026-03-20
status: approved
---

# Redesign da Página de Análise de Perfil ICP

## Problema

A página atual de Análise de Perfil ICP apresenta 6 gráficos + texto AI + chat de uma só vez, sem contexto para o usuário entender o que está vendo e sem conexão entre dados e ações práticas. Usuários de todos os papéis (SDR, Closer, Gestor) precisam de uma experiência mais guiada.

## Design Aprovado

### Formato: Relatório Guiado com Accordion

A página muda de "tudo visível" para um **accordion colapsável** com 4 seções. Cada seção fechada mostra título + resumo de 1 linha. A seção ① começa expandida por padrão.

### Estrutura da Página

#### Topo
- Título: "Análise de Perfil ICP"
- Subtítulo: "Entenda quem é seu cliente ideal e como direcionar sua estratégia."
- Botão "Gerar Nova Análise" (canto superior direito)
- Indicador da última análise: data + quantidade de clientes
- Durante geração: barra de progresso com mensagens contextuais (ex: "Analisando 342 clientes enriquecidos...", "Gerando insights com IA...")

#### ① Perfil ICP — Quem é seu cliente ideal (expandido por padrão)
- **Ficha visual tipo persona** com grid 3x2 de badges/chips:
  - Porte típico
  - CNAE Principal
  - Região
  - Faturamento
  - Nº Funcionários
  - Base Analisada (quantidade)
- **Texto narrativo** abaixo da ficha: 2-3 frases geradas pela IA resumindo o perfil ideal com destaque em negrito nos valores-chave
- Background com gradiente sutil (purple tones) para destacar como seção principal

#### ② Dados da Base (colapsado)
- Resumo quando fechado: "Gráficos detalhados de CNAE, porte, região, faturamento e funcionários"
- Quando expandido: grid 2x3 com os 6 gráficos existentes (Recharts):
  1. Top CNAEs Primários (bar chart horizontal)
  2. Top Sub-CNAEs (bar chart horizontal)
  3. Porte das Empresas (bar chart ou pie chart)
  4. Top Cidades/Estados (bar chart horizontal)
  5. Faixa de Faturamento (bar chart horizontal)
  6. Nº de Funcionários (bar chart horizontal)
- Texto introdutório: "Distribuição detalhada dos seus clientes ativos enriquecidos."

#### ③ Estratégias Recomendadas (colapsado)
- Resumo quando fechado: "N ações priorizadas por impacto"
- Quando expandido: **lista priorizada por impacto** (não separada por papel)
  - Cada ação é um card com:
    - Número de prioridade (círculo numerado)
    - Título da ação (bold)
    - Descrição de 1-2 linhas explicando o porquê
    - Badge de impacto: ALTO IMPACTO (purple) ou MÉDIO IMPACTO (yellow)
  - Ação #1 tem background destacado (purple tint)
  - Conteúdo gerado pela IA baseado nos dados da análise

#### ④ Chat IA (colapsado)
- Resumo quando fechado: "Pergunte qualquer coisa sobre o perfil da sua base"
- Quando expandido: mesma interface de chat existente (ICPChatSection) sem alterações

#### Histórico de Análises
- Abaixo do accordion
- Badges horizontais com data + quantidade de clientes
- Análise ativa em destaque (primary color), anteriores em cinza
- Clicar em uma análise anterior carrega seus dados

### Geração de Análise — Feedback Melhorado

Manter geração manual sob demanda, mas com feedback mais claro:
- Barra de progresso visual dentro de um card highlight
- Mensagens contextuais durante geração (não apenas spinner)
- Indicador de "Analisando X clientes... Gerando insights..."

### Mudanças no Edge Function (analyze-client-profile)

O prompt da IA precisa ser atualizado para gerar conteúdo estruturado que alimente as novas seções:

1. **Perfil ICP** — retornar campos estruturados: `porte_tipico`, `cnae_principal`, `regiao_principal`, `faturamento_tipico`, `funcionarios_tipico`, `resumo_narrativo`
2. **Estratégias** — retornar array de ações: `{ titulo, descricao, impacto: "alto"|"medio" }` ordenado por impacto

O campo `ai_analysis` atual (markdown livre) será substituído por um JSON estruturado em `statistics` ou novo campo.

### Componentes a Criar/Modificar

- **Modificar:** `ICPAnalysisSection.tsx` — refatorar layout inteiro para accordion
- **Criar:** `ICPProfileCard.tsx` — ficha visual do perfil ICP (persona card)
- **Criar:** `ICPStrategyList.tsx` — lista priorizada de estratégias
- **Criar:** `ICPDataCharts.tsx` — extrair os 6 gráficos para componente próprio
- **Criar:** `ICPProgressBar.tsx` — feedback visual durante geração
- **Manter:** `ICPChatSection.tsx` — sem alterações
- **Modificar:** `analyze-client-profile/index.ts` — atualizar prompt AI para retornar JSON estruturado

### Accordion Behavior
- Usar componente `Collapsible` do shadcn/ui (já importado no projeto)
- Apenas uma seção aberta por vez (auto-close ao abrir outra)
- Animação suave de expand/collapse via Framer Motion ou CSS transition
- Seção ① aberta por padrão ao carregar

### Público-Alvo
- SDRs, Closers e Gestores/Admins — todos acessam a mesma página
- Estratégias são genéricas e priorizadas por impacto (não separadas por papel)
