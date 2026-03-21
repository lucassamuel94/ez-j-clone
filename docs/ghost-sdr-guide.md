# Ghost SDR — Guia Completo

## O que é o Ghost SDR?

O Ghost SDR é um **agente autônomo de prospecção** que faz cold outreach e follow-up com leads automaticamente, escrevendo como se fosse o próprio SDR. Ele aprende com as calls, emails e comportamento dos melhores SDRs do time para replicar o que funciona.

**Foco principal:** gerar **SQOs que convertem em venda**, não apenas reuniões agendadas.

---

## Métricas que importam

O Ghost SDR é medido pelo que realmente gera resultado:

| Métrica | Prioridade | Por quê |
|---------|-----------|---------|
| **SQO (Sales Qualified Opportunity)** | Principal | Lead bem qualificado entregue ao Closer |
| **SQO → Venda** | Ouro | Prova que a qualificação foi boa — o Closer fechou |
| **Reunião Confirmada** | Secundária | Importante, mas só se virar SQO |
| **Taxa de Resposta** | Indicador | Mostra se a mensagem está funcionando |

**O Ghost SDR NÃO mede vanidade** (ex: "quantos emails mandei"). Mede resultado real.

---

## Como funciona

```
1. ESCANEAR    → Busca leads ativos (Novo, Em contato, Interesse, Lead Quente)
2. PRIORIZAR   → Leads quentes primeiro, depois interesse, depois novos
3. CONTEXTUALIZAR → Busca calls, enrichment, dor, segmento, ICP fit
4. CLONAR      → Usa o estilo do SDR dono do lead (ou do top performer)
5. ESTRATÉGIA  → Escolhe a melhor abordagem por status do lead
6. GERAR       → IA cria mensagem personalizada para o segmento
7. ENVIAR      → WhatsApp (EZ Chat) ou Email (Resend)
8. RASTREAR    → Monitora resposta → reunião → SQO → venda
9. APRENDER    → O que funcionou vira padrão para próximos leads
```

---

## Onde acessar

**Caminho:** Configurações → Inteligência → Ghost SDR

---

## Dashboard — KPIs

| KPI | Descrição |
|-----|-----------|
| **Enviados** | Total de outreach/follow-ups disparados |
| **Respostas** | Leads que responderam |
| **Taxa Resp.** | % de mensagens que geraram resposta |
| **Reuniões Conf.** | Reuniões confirmadas (não só agendadas) |
| **SQOs** | Oportunidades qualificadas criadas |
| **Vendas** | Deals que o Closer fechou a partir dos SQOs |
| **SQO→Venda** | Taxa de conversão do SQO em venda fechada |

---

## Estratégias por status do lead

### Lead Novo (Cold Outreach)

O lead **não conhece** a empresa. Cadência de 6 steps:

| Step | Delay | Canal | Estratégia |
|------|-------|-------|-----------|
| 1 | Imediato | WhatsApp | **Cold Intro** — apresentação curta, gera curiosidade |
| 2 | 1 dia | Email | **Value Prop** — mostra o valor da solução |
| 3 | 3 dias | WhatsApp | **Pain Point** — pergunta sobre dor do segmento |
| 4 | 5 dias | Email | **Social Proof** — case de empresa similar |
| 5 | 8 dias | WhatsApp | **Meeting Ask** — pede reunião diretamente |
| 6 | 12 dias | Email | **Reengagement** — última tentativa, tom leve |

### Lead Em Contato (já respondeu)

| Step | Delay | Canal | Estratégia |
|------|-------|-------|-----------|
| 1 | 2 dias | WhatsApp | Pain Point |
| 2 | 4 dias | Email | Value Prop |
| 3 | 7 dias | WhatsApp | Meeting Ask |

### Lead com Interesse

| Step | Delay | Canal | Estratégia |
|------|-------|-------|-----------|
| 1 | 1 dia | WhatsApp | Meeting Ask |
| 2 | 3 dias | Email | Social Proof |
| 3 | 5 dias | WhatsApp | Urgência |

### Lead Quente (prioridade máxima)

| Step | Delay | Canal | Estratégia |
|------|-------|-------|-----------|
| 1 | Imediato | WhatsApp | Meeting Ask |
| 2 | 1 dia | WhatsApp | Pain Point |
| 3 | 2 dias | Email | Social Proof |

### Agendar Retorno

| Step | Delay | Canal | Estratégia |
|------|-------|-------|-----------|
| 1 | 1 dia | WhatsApp | Meeting Ask |
| 2 | 3 dias | WhatsApp | Value Prop |
| 3 | 7 dias | Email | Urgência |

---

## Como o Ghost SDR aprende

### Fontes de dados

#### 1. Transcrições de Calls (SDR)

Semanalmente, as calls gravadas dos SDRs são transcritas e analisadas:
- **Score da call** (0-100)
- **Nível de interesse** do lead
- **Objeções** levantadas
- **Resumo executivo** da conversa

O Ghost SDR usa essas informações para:
- Continuar a conversa de onde parou
- Usar os mesmos argumentos que funcionaram na call
- Antecipar objeções que o lead costuma levantar

#### 2. Emails Enviados

Analisa o histórico de emails de cada SDR:
- Qual assunto gera abertura
- Qual tom converte
- Qual tamanho de mensagem funciona

#### 3. Resultados de Outreach

Cada mensagem enviada pelo Ghost SDR é rastreada até o final do funil:

```
Mensagem enviada
  ↓ Respondeu? (em quanto tempo?)
  ↓ Agendou reunião? (confirmou?)
  ↓ Virou SQO?
  ↓ Closer fechou a venda?
```

Esses dados são agregados por **segmento** e **porte**:

| Segmento | Canal | Tom | Resposta | SQO Rate |
|----------|-------|-----|----------|----------|
| Saúde | WhatsApp | Curioso | 34% | 12% |
| Varejo | Email | Social Proof | 22% | 8% |
| Tech | WhatsApp | Direto | 41% | 18% |

---

## Identificação do Top Performer

O Ghost SDR identifica o melhor SDR usando um **score composto**:

```
Performer Score = (SQO→Venda × 50%) + (SQO Rate × 30%) + (Avg Call Score × 20%)
```

- **50% SQO→Venda**: qualidade da qualificação — os leads que esse SDR manda pro Closer FECHAM?
- **30% SQO Rate**: produtividade — quantos SQOs gera dos leads que trabalha?
- **20% Call Score**: execução — qualidade das ligações?

**Mínimo 3 SQOs para qualificar.** Evita premiar quem teve sorte com 1 deal.

O estilo do Top Performer é **clonado** para todos os SDRs:
- Como ele abre conversas frias
- Como qualifica leads
- Frases que usa com frequência
- Tom de comunicação

---

## Perfil de cada SDR (aba "SDRs")

A IA analisa cada SDR e gera:

| Campo | Descrição |
|-------|-----------|
| **Estilo de escrita** | Como o SDR se comunica (formal, casual, técnico) |
| **Frases típicas** | Expressões recorrentes |
| **Tom preferido** | Profissional, amigável, curioso, etc. |
| **Abertura** | Como abre conversas frias |
| **Qualificação** | Como qualifica leads |
| **SQO Rate** | % de leads que viram SQO |
| **SQO→Venda** | % dos SQOs que o Closer fechou |
| **Score médio** | Qualidade das calls |
| **Top Performer** | Badge se for o melhor |

---

## Diferenças Ghost SDR vs Ghost Closer

| Aspecto | Ghost SDR | Ghost Closer |
|---------|-----------|-------------|
| **Alvo** | Leads (prospecção) | Oportunidades (negociação) |
| **Objetivo** | Gerar SQO que vira venda | Fechar deal |
| **Tipo de contato** | Cold → Warm | Warm → Hot |
| **Métrica principal** | SQO → Venda | Deal Ganho |
| **Top performer** | Maior SQO→Venda + SQO Rate | Maior Win Rate |
| **Strategies** | cold_intro, pain_point, meeting_ask | check_in, case_study, roi, urgency |
| **Max steps** | 6 (cold outreach) | 5 (follow-up) |

---

## Botões de ação

### "Executar Agora"
Roda o Ghost SDR manualmente. Limite: 15 outreaches por execução.

### "Aprender"
Analisa calls, emails e resultados de cada SDR. Atualiza perfis e identifica top performer.

**Recomendação:** Rodar 1x por semana, após upload de novas calls.

---

## Pausa automática

O Ghost SDR **para** quando:
1. Lead respondeu → SDR assume
2. Todos os steps foram executados
3. Lead mudou de status → contador reinicia
4. Lead foi descartado ou virou oportunidade

---

## Custo

- ~R$ 0,001 por mensagem gerada pela IA
- 15 outreaches/execução × 8 execuções/dia = ~120 mensagens/dia
- **~R$ 3,60/mês** em tokens de IA
- Custo de WhatsApp: conforme plano EZ Chat

---

*Documento gerado em 21/03/2026*
*EZ Journey CRM — EZSoft*
