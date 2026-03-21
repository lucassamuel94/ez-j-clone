# Ghost Closer — Guia Completo

## O que é o Ghost Closer?

O Ghost Closer é um **agente autônomo de follow-up** que monitora o pipeline de vendas 24/7 e envia mensagens personalizadas via WhatsApp e email **como se fosse o próprio closer**. Ele aprende com o comportamento dos melhores vendedores do time e aplica esses padrões em todos os follow-ups.

**O closer não precisa fazer nada.** O Ghost Closer cuida de todo o follow-up automático. O closer só entra em ação quando o cliente responde.

---

## Como funciona

### O ciclo do Ghost Closer

```
1. MONITORAR → Escaneia o pipeline a cada hora (horário comercial 8h-19h)
2. DECIDIR   → Identifica deals que precisam de follow-up baseado em regras
3. CONTEXTUALIZAR → Busca demos, interações, propostas, objeções do deal
4. CLONAR    → Usa o estilo de escrita do closer (ou do top performer)
5. GERAR     → IA cria mensagem personalizada para o segmento do cliente
6. ENVIAR    → Dispara via WhatsApp (EZ Chat) ou email (Resend)
7. RASTREAR  → Registra resultado (respondeu? agendou? fechou?)
8. APRENDER  → Atualiza padrões do que funciona melhor
```

### Envio por WhatsApp (EZ Chat)

O Ghost Closer usa a integração com o EZ Chat (coexistência) para enviar mensagens:

- A mensagem é enviada **pelo número corporativo do closer**
- Aparece no celular do closer como se ele tivesse enviado
- Se o cliente responde, chega no celular E na plataforma
- O sistema detecta a resposta e **pausa o follow-up automático**
- O closer assume a conversa naturalmente

### Envio por Email

- Enviado via Resend com o nome do closer como remetente
- Reply-to configurado para o email do closer
- Template limpo e profissional

---

## Onde acessar

### Dashboard do Ghost Closer

**Caminho:** Configurações → Inteligência → Ghost Closer

O dashboard tem 4 abas:

#### 1. Atividade

Feed em tempo real de todos os follow-ups enviados:
- Canal utilizado (WhatsApp ou Email)
- Status (Enviado / Respondeu / Falhou)
- Número do step no fluxo
- Conteúdo da mensagem
- Se gerou reunião ou venda

#### 2. Regras

Regras de follow-up configuráveis por estágio do pipeline:

| Campo | Descrição |
|-------|-----------|
| **Estágio** | Em qual estágio do pipeline a regra se aplica |
| **Step** | Número sequencial do follow-up (1º, 2º, 3º...) |
| **Delay** | Quantos dias esperar antes de enviar |
| **Canal** | WhatsApp, Email ou Ambos |
| **Tom** | Profissional, Amigável, Urgente ou Consultivo |
| **Estratégia** | Check-in, Case Study, ROI, Urgência |
| **Max tentativas** | Limite de follow-ups por deal |

**Regras pré-configuradas por estágio:**

| Estágio | Steps | Cadência |
|---------|-------|----------|
| Demonstração | 3 | WhatsApp (1d) → Email (3d) → WhatsApp urgente (5d) |
| Apresentar proposta | 2 | WhatsApp (2d) → Email ROI (4d) |
| Proposta enviada | 4 | WhatsApp (2d) → Email case (5d) → WhatsApp urgente (8d) → Email ROI (12d) |
| Negociação | 3 | WhatsApp (3d) → Email ROI (7d) → WhatsApp urgente (10d) |
| Opp Quente | 2 | WhatsApp (3d) → Email case (7d) |
| Opp Futura | 2 | Email (7d) → WhatsApp (14d) |
| Opp Fria | 2 | Email (14d) → WhatsApp (30d) |
| Contrato enviado | 2 | WhatsApp (2d) → WhatsApp urgente (4d) |
| Aguardando pagamento | 2 | WhatsApp (3d) → WhatsApp urgente (5d) |

#### 3. Closers

Perfis de cada closer analisados pela IA:

- **Estilo de escrita**: descrição de como o closer se comunica
- **Frases típicas**: expressões que ele usa com frequência
- **Tom preferido**: profissional, amigável, etc.
- **Handling de objeções**: como ele lida com resistência
- **Métricas**: Win rate, ticket médio, ciclo de venda
- **Top Performer**: badge indicando quem é o melhor (modelo clonado)

#### 4. Aprendizado

Explicação visual de como o Ghost Closer evolui ao longo do tempo.

---

## Como o Ghost Closer aprende

### Sem retreinamento de modelo

O Ghost Closer **não precisa de treinamento manual**. Ele usa o mesmo modelo de IA (Gemini), mas alimenta o prompt com dados cada vez mais ricos.

### Fontes de aprendizado

#### 1. Demos e Calls (Transcrições)

Toda semana, quando você faz upload dos vídeos de demonstração:
- O sistema transcreve e analisa cada demo
- Extrai: tom usado, argumentos de venda, como lidou com objeções, score de qualidade
- O Ghost Closer usa essas informações para gerar follow-ups que **continuam a conversa da demo**

**Exemplo:** Se na demo o cliente mencionou preocupação com "integração com ERP", o follow-up vai dizer: *"Oi João, lembrei da sua dúvida sobre integração com ERP — montei um material mostrando como funciona com o [ERP do segmento]. Posso te mandar?"*

#### 2. Emails Enviados

O sistema analisa os emails que cada closer envia manualmente:
- Identifica o estilo de escrita (formal vs casual, curto vs detalhado)
- Extrai frases recorrentes que o closer usa
- Detecta o tom preferido

**Resultado:** O follow-up automático soa como se o closer tivesse escrito pessoalmente.

#### 3. Histórico de Atividades

Todas as interações no CRM são analisadas:
- Frequência de contato com cada deal
- Quais ações precedem fechamentos
- Timing entre interações em deals que converteram

#### 4. Resultados de Follow-ups

Cada follow-up enviado pelo Ghost Closer é rastreado:
- O cliente respondeu? Em quanto tempo?
- Qual canal funcionou melhor?
- Qual tom gerou mais resposta?
- Qual horário tem mais abertura?

Esses dados são agregados por **segmento** e **porte** da empresa:

| Segmento | Canal | Tom | Taxa de Resposta |
|----------|-------|-----|-----------------|
| Saúde | WhatsApp | Direto | 34% |
| Varejo | Email | Case study | 22% |
| Tecnologia | WhatsApp | Técnico | 41% |

#### 5. Top Performer

O sistema identifica automaticamente o closer com:
- Maior win rate (mínimo 3 deals para qualificar)
- Maior ticket médio

E clona o estilo de comunicação dele para aplicar nos follow-ups de todos os closers.

---

## Botões de ação

### "Executar Agora"

Roda o Ghost Closer manualmente (fora do cron automático). Útil para:
- Testar o sistema pela primeira vez
- Forçar envio imediato de follow-ups pendentes
- Verificar se tudo está funcionando

**Limite:** Máximo 10 follow-ups por execução.

### "Aprender"

Roda o motor de aprendizado manualmente:
- Analisa emails e demos de cada closer
- Gera/atualiza perfis de comunicação
- Recalcula métricas e identifica top performer
- Atualiza padrões de resposta por segmento

**Recomendação:** Rodar 1x por semana, preferencialmente após upload de novas demos.

---

## Pausa automática

O Ghost Closer **para automaticamente** quando:

1. **Cliente respondeu** — status muda para "responded", nenhum novo follow-up é enviado
2. **Todos os steps foram executados** — respeita o max_attempts configurado
3. **Deal mudou de estágio** — se o closer moveu o deal, o contador de steps reinicia
4. **Deal foi ganho ou perdido** — estágios finais são excluídos

---

## Métricas do Dashboard

| Métrica | O que significa |
|---------|----------------|
| **Enviados** | Total de follow-ups disparados pelo Ghost Closer |
| **Respostas** | Quantos clientes responderam após o follow-up |
| **Taxa Resp.** | Percentual de follow-ups que geraram resposta |
| **Reuniões** | Follow-ups que resultaram em reunião agendada |
| **Ganhos** | Deals fechados que tiveram follow-up do Ghost Closer |
| **Receita** | Valor total dos deals influenciados pelo Ghost Closer |

---

## Segurança e controle

- **Horário comercial:** Só envia entre 8h e 19h (horário de São Paulo)
- **Rate limiting:** Máximo 10 follow-ups por execução do cron
- **Lock de concorrência:** Usa `cron_locks` para evitar envios duplicados
- **Rastreamento completo:** Cada follow-up é logado com contexto IA completo
- **Custo controlado:** Usa Gemini Flash (~$0.15/1M tokens) — custo muito baixo
- **Logs de uso IA:** Todo gasto é rastreado em `ai_usage_logs`

---

## Tabelas do banco de dados

| Tabela | Função |
|--------|--------|
| `follow_up_rules` | Regras configuráveis por estágio |
| `follow_up_logs` | Registro de cada follow-up enviado |
| `follow_up_patterns` | Padrões aprendidos (taxa resposta por segmento/canal) |
| `closer_profiles` | Perfil de comunicação de cada closer |

---

## Perguntas frequentes

### O closer vai saber que o Ghost Closer mandou a mensagem?

Sim. Toda mensagem fica registrada no histórico de atividades do lead com a tag `[Ghost Closer]`. O closer pode ver o que foi enviado.

### E se o cliente responder algo negativo?

O sistema marca como "responded" e para o follow-up. O closer recebe a resposta no celular (coexistência WhatsApp) e pode lidar pessoalmente.

### Posso desativar o Ghost Closer para um deal específico?

Atualmente o controle é por regra (ativar/desativar por estágio). Para desativar um deal específico, mova ele para o estágio correto ou o closer pode registrar uma interação que reseta o timer.

### Quanto custa?

Cada follow-up custa aproximadamente **R$ 0,001** em tokens de IA. Para 100 follow-ups/dia = ~R$ 3/mês. O custo de WhatsApp depende do seu plano EZ Chat.

### O Ghost Closer substitui o closer?

Não. Ele cuida apenas do follow-up — a parte que os closers não fazem. Demos, negociações e fechamentos continuam sendo feitos pelos closers. O Ghost Closer é o assistente que "nunca esquece de mandar aquela mensagem".

---

*Documento gerado em 21/03/2026*
*EZ Journey CRM — EZSoft*
