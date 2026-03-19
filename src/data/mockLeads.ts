import { Lead, Interaction, CadenceStep, LeadNote } from '@/types/lead';

// Helper to create dates relative to now
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

export const mockLeads: Lead[] = [
  // INBOUND - Atrasados (highest priority)
  {
    id: '1',
    lead_type: 'INBOUND',
    name: 'Carlos Silva',
    company: 'TechStart Ltda',
    whatsapp: '+5511999887766',
    phone: '+551132345678',
    email: 'carlos@techstart.com.br',
    source: 'Site - Formulário de contato',
    status: 'Novo',
    owner_user_id: 'user1',
    priority_score: 95,
    last_contact_at: null,
    next_action_at: hoursAgo(2), // ATRASADO!
    attempts_count: 0,
    created_at: hoursAgo(3),
    updated_at: hoursAgo(3),
    initial_message: 'Olá, estou interessado em conhecer mais sobre a solução de vocês. Temos 50 vendedores e precisamos de um CRM urgente.',
    entry_channel: 'whatsapp',
  },
  {
    id: '2',
    lead_type: 'INBOUND',
    name: 'Marina Costa',
    company: 'Loja Virtual Express',
    whatsapp: '+5521988776655',
    phone: '+552132109876',
    email: 'marina@lojavirtual.com',
    source: 'LinkedIn',
    status: 'Em contato',
    owner_user_id: 'user1',
    priority_score: 88,
    last_contact_at: hoursAgo(48),
    next_action_at: hoursAgo(1), // ATRASADO!
    attempts_count: 1,
    created_at: hoursAgo(72),
    updated_at: hoursAgo(48),
    initial_message: 'Vi o post de vocês sobre automação de vendas. Podemos conversar?',
    entry_channel: 'email',
  },
  // OUTBOUND - Atrasados
  {
    id: '3',
    lead_type: 'OUTBOUND',
    name: 'Roberto Mendes',
    company: 'Industria ABC',
    whatsapp: '+5531977665544',
    phone: '+553133442211',
    email: 'roberto@industriaabc.com.br',
    source: 'Lista - Indústrias MG',
    status: 'Em contato',
    owner_user_id: 'user1',
    priority_score: 85,
    last_contact_at: hoursAgo(72),
    next_action_at: hoursAgo(4), // ATRASADO!
    attempts_count: 2,
    created_at: hoursAgo(168),
    updated_at: hoursAgo(72),
    icp_fit: 'Alto - 200+ funcionários, setor industrial',
    list_reason: 'Empresas industriais com faturamento >10M',
    cadence_id: 'cadence1',
    current_cadence_step: 3,
  },
  // INBOUND - Ações de hoje
  {
    id: '4',
    lead_type: 'INBOUND',
    name: 'Fernanda Lima',
    company: 'Consultoria FLima',
    whatsapp: '+5541966554433',
    phone: '+554133221100',
    email: 'fernanda@flima.com.br',
    source: 'Indicação',
    status: 'Interesse/Agendar Retorno',
    owner_user_id: 'user1',
    priority_score: 75,
    last_contact_at: hoursAgo(24),
    next_action_at: hoursFromNow(2), // HOJE
    attempts_count: 2,
    created_at: hoursAgo(96),
    updated_at: hoursAgo(24),
    initial_message: 'O João da empresa X me indicou vocês. Gostaria de saber mais.',
    entry_channel: 'whatsapp',
  },
  {
    id: '5',
    lead_type: 'INBOUND',
    name: 'André Souza',
    company: 'Startup XYZ',
    whatsapp: '+5551955443322',
    phone: '+555133445566',
    email: 'andre@startupxyz.io',
    source: 'Site - Demo Request',
    status: 'Novo',
    owner_user_id: 'user1',
    priority_score: 82,
    last_contact_at: null,
    next_action_at: hoursFromNow(1), // HOJE
    attempts_count: 0,
    created_at: hoursAgo(1),
    updated_at: hoursAgo(1),
    initial_message: 'Preciso de uma demo urgente. Estamos avaliando ferramentas esta semana.',
    entry_channel: 'email',
  },
  // OUTBOUND - Ações de hoje
  {
    id: '6',
    lead_type: 'OUTBOUND',
    name: 'Patrícia Oliveira',
    company: 'Grupo Oliveira',
    whatsapp: '+5548944332211',
    phone: '+554833667788',
    email: 'patricia@grupooliveira.com.br',
    source: 'Lista - Varejo SC',
    status: 'Em contato',
    owner_user_id: 'user1',
    priority_score: 70,
    last_contact_at: hoursAgo(48),
    next_action_at: hoursFromNow(3), // HOJE
    attempts_count: 1,
    created_at: hoursAgo(72),
    updated_at: hoursAgo(48),
    icp_fit: 'Médio - 50 funcionários, varejo',
    list_reason: 'Varejistas com expansão recente',
    cadence_id: 'cadence1',
    current_cadence_step: 2,
  },
  // OUTBOUND - Novos
  {
    id: '7',
    lead_type: 'OUTBOUND',
    name: 'Marcelo Santos',
    company: 'Construtora MS',
    whatsapp: '+5585933221100',
    phone: '+558533998877',
    email: 'marcelo@construtorams.com.br',
    source: 'Lista - Construção Civil NE',
    status: 'Novo',
    owner_user_id: 'user1',
    priority_score: 60,
    last_contact_at: null,
    next_action_at: hoursFromNow(6),
    attempts_count: 0,
    created_at: hoursAgo(2),
    updated_at: hoursAgo(2),
    icp_fit: 'Alto - 300 funcionários, obras grandes',
    list_reason: 'Construtoras com projetos em andamento',
    cadence_id: 'cadence2',
    current_cadence_step: 1,
  },
  {
    id: '8',
    lead_type: 'OUTBOUND',
    name: 'Juliana Ferreira',
    company: 'Logística JF',
    whatsapp: '+5547922110099',
    phone: '+554733889977',
    email: 'juliana@logisticajf.com.br',
    source: 'Lista - Logística Sul',
    status: 'Novo',
    owner_user_id: 'user1',
    priority_score: 55,
    last_contact_at: null,
    next_action_at: hoursFromNow(8),
    attempts_count: 0,
    created_at: hoursAgo(1),
    updated_at: hoursAgo(1),
    icp_fit: 'Alto - Frota de 100 veículos',
    list_reason: 'Empresas de logística em crescimento',
    cadence_id: 'cadence1',
    current_cadence_step: 1,
  },
  // Leads com oportunidade
  {
    id: '9',
    lead_type: 'INBOUND',
    name: 'Ricardo Almeida',
    company: 'Holding RA',
    whatsapp: '+5511922334455',
    phone: '+551133445566',
    email: 'ricardo@holdingra.com.br',
    source: 'Site - Plano Enterprise',
    status: 'Oportunidade criada',
    owner_user_id: 'user1',
    priority_score: 40,
    last_contact_at: hoursAgo(24),
    next_action_at: hoursFromNow(48),
    attempts_count: 3,
    created_at: hoursAgo(168),
    updated_at: hoursAgo(24),
    initial_message: 'Precisamos de uma solução enterprise para 500 usuários.',
    entry_channel: 'email',
  },
  // Lead descartado
  {
    id: '10',
    lead_type: 'OUTBOUND',
    name: 'Empresa Teste',
    company: 'Teste LTDA',
    whatsapp: '+5511900000000',
    phone: '+551100000000',
    email: 'teste@teste.com',
    source: 'Lista - Teste',
    status: 'Descartado',
    owner_user_id: 'user1',
    priority_score: 0,
    last_contact_at: hoursAgo(48),
    next_action_at: hoursAgo(24),
    attempts_count: 5,
    created_at: hoursAgo(336),
    updated_at: hoursAgo(48),
    icp_fit: 'Baixo',
    list_reason: 'Teste de lista',
    cadence_id: 'cadence1',
    current_cadence_step: 5,
  },
];

export const mockCadenceSteps: CadenceStep[] = [
  // Cadence 1 - Padrão B2B
  {
    id: 'step1-1',
    cadence_id: 'cadence1',
    step_number: 1,
    wait_hours: 0,
    channel: 'email',
    script_template: `Olá [NOME],

Notei que a [EMPRESA] está crescendo e gostaria de apresentar como podemos ajudar a escalar suas vendas.

Temos ajudado empresas similares a aumentar a conversão em 40%.

Podemos conversar 15 minutos esta semana?`,
    objective: 'Abrir conversa e gerar curiosidade',
  },
  {
    id: 'step1-2',
    cadence_id: 'cadence1',
    step_number: 2,
    wait_hours: 48,
    channel: 'whatsapp',
    script_template: `Oi [NOME], tudo bem?

Sou da [SUA EMPRESA] e enviei um e-mail na segunda. Você chegou a ver?

Queria entender se faz sentido conversar sobre [DOR ESPECÍFICA].`,
    objective: 'Follow-up leve e confirmar interesse',
  },
  {
    id: 'step1-3',
    cadence_id: 'cadence1',
    step_number: 3,
    wait_hours: 72,
    channel: 'call',
    script_template: `OBJETIVO: Ligação de qualificação

ABERTURA:
"Oi [NOME], aqui é [SEU NOME] da [EMPRESA]. Tudo bem? Estou ligando porque enviei algumas mensagens e queria saber se faz sentido conversarmos."

QUALIFICAÇÃO:
1. Vocês usam alguma ferramenta de CRM hoje?
2. Qual o maior desafio do time de vendas atualmente?
3. Quantas pessoas no time comercial?

PRÓXIMOS PASSOS:
- Se interesse: agendar demo
- Se não: marcar follow-up em 30 dias`,
    objective: 'Qualificar e agendar demo',
  },
  {
    id: 'step1-4',
    cadence_id: 'cadence1',
    step_number: 4,
    wait_hours: 120,
    channel: 'email',
    script_template: `[NOME],

Tentei contato algumas vezes sem sucesso.

Entendo que talvez não seja o momento, mas caso a situação mude, aqui está um case de uma empresa do seu setor que aumentou as vendas em 60%:

[LINK DO CASE]

Fico à disposição.`,
    objective: 'Última tentativa com prova social',
  },
  {
    id: 'step1-5',
    cadence_id: 'cadence1',
    step_number: 5,
    wait_hours: 168,
    channel: 'email',
    script_template: `[NOME],

Esta é minha última tentativa de contato.

Se não for o momento, sem problemas. Vou encerrar a cadência.

Caso queira conversar futuramente, é só responder este e-mail.

Abraço!`,
    objective: 'Break-up email',
  },
];

export const mockInteractions: Interaction[] = [
  {
    id: 'int1',
    lead_id: '2',
    user_id: 'user1',
    channel: 'whatsapp',
    direction: 'outbound',
    outcome: 'sem_resposta',
    message_summary: 'Enviado mensagem de apresentação, aguardando retorno',
    occurred_at: hoursAgo(48),
    created_at: hoursAgo(48),
  },
  {
    id: 'int2',
    lead_id: '3',
    user_id: 'user1',
    channel: 'email',
    direction: 'outbound',
    outcome: 'respondeu',
    message_summary: 'Lead respondeu pedindo mais informações sobre preços',
    occurred_at: hoursAgo(72),
    created_at: hoursAgo(72),
  },
  {
    id: 'int3',
    lead_id: '3',
    user_id: 'user1',
    channel: 'call',
    direction: 'outbound',
    outcome: 'sem_resposta',
    message_summary: 'Tentativa de ligação - não atendeu',
    occurred_at: hoursAgo(48),
    created_at: hoursAgo(48),
  },
  {
    id: 'int4',
    lead_id: '4',
    user_id: 'user1',
    channel: 'whatsapp',
    direction: 'inbound',
    outcome: 'respondeu',
    message_summary: 'Lead demonstrou interesse em agendar demo',
    occurred_at: hoursAgo(24),
    created_at: hoursAgo(24),
  },
  {
    id: 'int5',
    lead_id: '6',
    user_id: 'user1',
    channel: 'email',
    direction: 'outbound',
    outcome: 'sem_resposta',
    message_summary: 'Primeiro e-mail da cadência enviado',
    occurred_at: hoursAgo(48),
    created_at: hoursAgo(48),
  },
];

export const mockNotes: LeadNote[] = [
  {
    id: 'note1',
    lead_id: '2',
    user_id: 'user1',
    note: 'Empresa parece ter budget. Verificar se há decisor direto.',
    created_at: hoursAgo(48),
  },
  {
    id: 'note2',
    lead_id: '3',
    user_id: 'user1',
    note: 'Roberto é o diretor comercial. Empresa usa Excel hoje.',
    created_at: hoursAgo(72),
  },
  {
    id: 'note3',
    lead_id: '4',
    user_id: 'user1',
    note: 'Indicação do João (cliente). Tratar com prioridade.',
    created_at: hoursAgo(96),
  },
];

// Function to get cadence step for a lead
export const getCadenceStep = (cadenceId: string, stepNumber: number): CadenceStep | undefined => {
  return mockCadenceSteps.find(
    step => step.cadence_id === cadenceId && step.step_number === stepNumber
  );
};

// Function to get interactions for a lead
export const getLeadInteractions = (leadId: string): Interaction[] => {
  return mockInteractions.filter(int => int.lead_id === leadId);
};

// Function to get notes for a lead
export const getLeadNotes = (leadId: string): LeadNote[] => {
  return mockNotes.filter(note => note.lead_id === leadId);
};
