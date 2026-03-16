export interface SimulatorInput {
  contacts: number;
  messages: number;
  attendants: number;
  growthPercent: number;
}

export interface PlanData {
  id: string;
  name: string;
  price: number;
  messagesIncluded: number;
  contactsIncluded: number;
  excessMessagePrice: number;
  excessContactPrice: number;
}

export interface MetaCostEntry {
  name: string;
  priceUsd: number;
  percentage: number; // 0-100
}

export interface MetaCostConfig {
  entries: MetaCostEntry[];
  usdToBrl: number;
  conversationsPerContact: number;
}

export const DEFAULT_META_CONFIG: MetaCostConfig = {
  entries: [
    { name: 'Serviço', priceUsd: 0, percentage: 70 },
    { name: 'Utilidade', priceUsd: 0.0068, percentage: 15 },
    { name: 'Marketing', priceUsd: 0.0625, percentage: 10 },
    { name: 'Autenticação', priceUsd: 0.0068, percentage: 5 },
  ],
  usdToBrl: 5.70,
  conversationsPerContact: 1,
};

export interface MetaCostBreakdown {
  entries: { name: string; conversations: number; costBrl: number }[];
  totalBrl: number;
}

export function calculateMetaCost(
  contacts: number,
  config: MetaCostConfig
): MetaCostBreakdown {
  const multiplier = config.conversationsPerContact ?? 1;
  const entries = config.entries.map(e => {
    const conversations = Math.ceil(contacts * multiplier * (e.percentage / 100));
    const costBrl = conversations * e.priceUsd * config.usdToBrl;
    return { name: e.name, conversations, costBrl };
  });
  const totalBrl = entries.reduce((sum, e) => sum + e.costBrl, 0);
  return { entries, totalBrl };
}

export interface SimulationResult {
  plan: PlanData;
  basePrice: number;
  metaCost: number;
  metaBreakdown: MetaCostBreakdown;
  aiCost: number;
  aiBreakdown: AICostBreakdown | null;
  totalMonthly: number;
  excessMessages: number;
  excessContacts: number;
  excessMessageCost: number;
  excessContactCost: number;
  appliedExcessCost: number;
  costPerContact: number;
  costPerAttendance: number;
}

export function calculateSimulation(
  input: SimulatorInput,
  plan: PlanData,
  metaConfig: MetaCostConfig = DEFAULT_META_CONFIG,
  aiConfig?: AICostConfig
): SimulationResult {
  const { contacts, messages } = input;

  const excessMessages = Math.max(0, messages - plan.messagesIncluded);
  const excessContacts = Math.max(0, contacts - plan.contactsIncluded);

  const excessMessageCost = excessMessages * plan.excessMessagePrice;
  const excessContactCost = excessContacts * plan.excessContactPrice;

  // Regra de cobrança inteligente:
  // 1. Só paga excedente se ultrapassar AMBOS os limites (contatos E mensagens)
  // 2. Se ultrapassou ambos, cobra o MENOR excedente
  let appliedExcessCost = 0;
  if (excessMessages > 0 && excessContacts > 0) {
    appliedExcessCost = Math.min(excessMessageCost, excessContactCost);
  }

  const metaBreakdown = calculateMetaCost(contacts, metaConfig);
  const metaCost = metaBreakdown.totalBrl;

  let aiCost = 0;
  let aiBreakdown: AICostBreakdown | null = null;
  if (aiConfig?.enabled) {
    aiBreakdown = calculateAICost(contacts, aiConfig, metaConfig.usdToBrl);
    aiCost = aiBreakdown.costBrl;
  }

  const totalMonthly = plan.price + appliedExcessCost + metaCost + aiCost;

  const costPerContact = contacts > 0 ? totalMonthly / contacts : 0;
  const costPerAttendance = input.attendants > 0 ? totalMonthly / input.attendants : 0;

  return {
    plan,
    basePrice: plan.price,
    metaCost,
    metaBreakdown,
    aiCost,
    aiBreakdown,
    totalMonthly,
    excessMessages,
    excessContacts,
    excessMessageCost,
    excessContactCost,
    appliedExcessCost,
    costPerContact,
    costPerAttendance,
  };
}

export const MESSAGES_PER_CONVERSATION = 18;

// ─── AI Cost ────────────────────────────────────────────────

export interface AIModel {
  id: string;
  label: string;
  inputPricePer1M: number;  // USD
  outputPricePer1M: number; // USD
}

export const AI_MODELS: AIModel[] = [
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini (econômico)', inputPricePer1M: 0.15, outputPricePer1M: 0.60 },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini (balanceado)', inputPricePer1M: 0.40, outputPricePer1M: 1.60 },
  { id: 'gpt-4o', label: 'GPT-4o (premium)', inputPricePer1M: 2.50, outputPricePer1M: 10.00 },
];

export interface AICostConfig {
  enabled: boolean;
  percentContacts: number;      // 0-100
  msgsPerConversation: number;
  modelId: string;
  avgInputTokens: number;
  avgOutputTokens: number;
  markup: number;               // e.g. 1.3 = 30%
}

export const DEFAULT_AI_CONFIG: AICostConfig = {
  enabled: false,
  percentContacts: 30,
  msgsPerConversation: 8,
  modelId: 'gpt-4o-mini',
  avgInputTokens: 300,
  avgOutputTokens: 200,
  markup: 1.3,
};

export interface AICostBreakdown {
  model: AIModel;
  contactsWithAI: number;
  totalMessages: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  costUsd: number;
  markup: number;
  costBrl: number;
}

export function calculateAICost(
  contacts: number,
  config: AICostConfig,
  usdToBrl: number
): AICostBreakdown {
  const model = AI_MODELS.find(m => m.id === config.modelId) || AI_MODELS[0];
  const contactsWithAI = Math.ceil(contacts * (config.percentContacts / 100));
  const totalMessages = contactsWithAI * config.msgsPerConversation;
  const totalInputTokens = totalMessages * config.avgInputTokens;
  const totalOutputTokens = totalMessages * config.avgOutputTokens;

  const costUsd =
    (totalInputTokens * model.inputPricePer1M + totalOutputTokens * model.outputPricePer1M) / 1_000_000;

  const costBrl = costUsd * usdToBrl * config.markup;

  return {
    model,
    contactsWithAI,
    totalMessages,
    totalInputTokens,
    totalOutputTokens,
    costUsd,
    markup: config.markup,
    costBrl,
  };
}

export function recommendPlan(
  input: SimulatorInput,
  plans: PlanData[],
  metaConfig: MetaCostConfig = DEFAULT_META_CONFIG,
  aiConfig: AICostConfig = DEFAULT_AI_CONFIG
): PlanData {
  const sorted = [...plans].sort((a, b) => a.price - b.price);

  let best = sorted[0];
  let bestTotal = Infinity;
  for (const p of sorted) {
    const sim = calculateSimulation(input, p, metaConfig, aiConfig);
    if (sim.totalMonthly < bestTotal) {
      bestTotal = sim.totalMonthly;
      best = p;
    }
  }
  return best;
}

export function simulateGrowth(
  input: SimulatorInput,
  plan: PlanData,
  growthPercent: number,
  metaConfig: MetaCostConfig = DEFAULT_META_CONFIG,
  aiConfig: AICostConfig = DEFAULT_AI_CONFIG
): SimulationResult {
  const grown: SimulatorInput = {
    ...input,
    contacts: Math.ceil(input.contacts * (1 + growthPercent / 100)),
    messages: Math.ceil(input.messages * (1 + growthPercent / 100)),
  };
  return calculateSimulation(grown, plan, metaConfig, aiConfig);
}
