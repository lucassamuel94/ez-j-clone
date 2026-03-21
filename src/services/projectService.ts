import { supabase } from '@/integrations/supabase/client';
import { ChecklistData, PHASES_BY_TYPE, ALL_PHASES, PHASE_LABELS, PROJECT_TYPE_LABELS, ProjectType, PHASE_DEADLINES_BY_COMPLEXITY } from '@/types/project';
import { addBusinessDays, countBusinessDays } from '@/utils/businessDays';

import { resolveAutoAssignments } from '@/services/projectAssignmentService';

export interface CreateProjectInput {
  opportunity_id: string;
  lead_id: string;
  project_type: ProjectType;
  checklist_data: ChecklistData;
  closer_user_id?: string;
  sdr_user_id?: string;
  closer_name?: string;
  sdr_name?: string;
  complexity_level?: string;
}

// Re-export addBusinessDays for backward compatibility
export { addBusinessDays } from '@/utils/businessDays';

/** Auto-create a companion api_oficial project with verificacao_bm phase */
const createCompanionBMProject = async (params: {
  cnpj: string;
  companyName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  website: string;
  version: string;
  broker: string;
  userId: string;
  parentProjectId: string;
}): Promise<string> => {
  const now = new Date();
  const dueDate = addBusinessDays(now, 10);

  // Auto-assign roles for the companion project
  const assignments = await resolveAutoAssignments();

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      project_type: 'api_oficial',
      created_by_user_id: params.userId,
      overall_status: 'ativo',
      priority: 'media',
      company_name: params.companyName,
      cnpj: params.cnpj,
      contact_name: params.contactName,
      contact_phone: params.contactPhone,
      contact_email: params.contactEmail,
      website: params.website || null,
      version: params.version,
      broker: params.broker,
      api_type: 'Oficial',
      head_user_id: assignments.head_user_id || params.userId,
      ux_po_user_id: assignments.ux_po_user_id,
      dev_user_id: assignments.dev_user_id,
      treinamento_user_id: assignments.treinamento_user_id,
      verificacao_bm_user_id: assignments.verificacao_bm_user_id,
      go_live_user_id: assignments.go_live_user_id,
      current_phase: 'verificacao_bm',
      start_date: now.toISOString().split('T')[0],
      due_date: dueDate.toISOString().split('T')[0],
      checklist_data: {
        type: 'api_oficial',
        cnpj: params.cnpj,
        versao: params.version,
        responsavel_nome: params.contactName,
        responsavel_telefone: params.contactPhone,
        responsavel_email: params.contactEmail,
        broker: params.broker,
        tera_coexistencia: false,
        numero_api_oficial: '',
        auto_created_from: params.parentProjectId,
      },
    } as any)
    .select('id')
    .single();

  if (projectError) throw projectError;
  const bmProjectId = project.id;

  // Create verificacao_bm phase + transition + activity log in parallel
  await Promise.all([
    supabase.from('project_phases').insert({
      project_id: bmProjectId,
      phase_name: 'verificacao_bm',
      status: 'BACKLOG',
      sort_order: 0,
      is_active: true,
      assigned_user_id: assignments.verificacao_bm_user_id || assignments.head_user_id || params.userId,
      bm_data: {
        cnpj: params.cnpj,
        razao_social: params.companyName,
        responsavel: params.contactName,
        telefone: params.contactPhone,
        email: params.contactEmail,
        site: params.website,
        versao_plataforma: params.version,
        auto_created_from: params.parentProjectId,
      },
    } as any),
    supabase.from('project_status_transitions').insert({
      project_id: bmProjectId,
      phase_name: 'verificacao_bm',
      status: 'BACKLOG',
      entered_at: new Date().toISOString(),
      changed_by_user_id: params.userId,
    } as any),
    supabase.from('project_activity_logs').insert({
      project_id: bmProjectId,
      user_id: params.userId,
      action_type: 'project_created',
      description: `Verificação de BM criada automaticamente (projeto de venda #${params.parentProjectId.slice(0, 8)})`,
    } as any),
  ]);

  // Trigger automatic messages (fire-and-forget)
  supabase.functions.invoke('trigger-automatic-message', {
    body: { trigger_key: 'bm_created', project_id: bmProjectId },
  }).catch(console.error);

  return bmProjectId;
};

export const createProjectFromChecklist = async (input: CreateProjectInput): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const checklist = input.checklist_data;
  const now = new Date();
  const dueDate = addBusinessDays(now, 15);

  // Auto-assign roles
  const assignments = await resolveAutoAssignments();

  // Build project data from checklist
  const projectData: Record<string, unknown> = {
    opportunity_id: input.opportunity_id,
    lead_id: input.lead_id,
    project_type: input.project_type,
    created_by_user_id: user.id,
    closer_user_id: input.closer_user_id || (checklist.type !== 'api_oficial' && 'closer_responsavel_user_id' in checklist ? checklist.closer_responsavel_user_id : null) || null,
    sdr_user_id: input.sdr_user_id || null,
    checklist_data: checklist,
    overall_status: 'ativo',
    priority: 'media',
    head_user_id: assignments.head_user_id || user.id,
    ux_po_user_id: assignments.ux_po_user_id,
    dev_user_id: assignments.dev_user_id,
    treinamento_user_id: assignments.treinamento_user_id,
    verificacao_bm_user_id: assignments.verificacao_bm_user_id,
    go_live_user_id: assignments.go_live_user_id,
    closer_name: input.closer_name || null,
    sdr_name: input.sdr_name || null,
    start_date: now.toISOString().split('T')[0],
    due_date: dueDate.toISOString().split('T')[0],
    complexity_level: input.complexity_level || null,
  };

  if (checklist.type === 'venda' || checklist.type === 'migracao') {
    // Projetos usam nome fantasia como nome principal (mais reconhecível)
    projectData.company_name = checklist.nome_fantasia || checklist.razao_social;
    projectData.cnpj = checklist.cnpj;
    projectData.version = checklist.versao || 'VP';
    projectData.contact_name = checklist.responsavel_nome;
    projectData.contact_phone = checklist.responsavel_telefone;
    projectData.contact_email = checklist.responsavel_email;
    projectData.api_type = checklist.api_type || 'Oficial';
    projectData.plan_name = checklist.plano;
    projectData.has_integration = checklist.possui_integracao;
    projectData.integrations_description = checklist.quais_integracoes || null;
    projectData.storage_time = checklist.tempo_armazenamento || '1 ano';
    projectData.project_description = checklist.descricao_projeto || null;
    projectData.website = checklist.website || null;
    projectData.has_ai = checklist.usa_ia ?? false;
    projectData.broker = 'EZ';
  } else if (checklist.type === 'evolucao') {
    projectData.company_name = checklist.nome_fantasia || checklist.razao_social;
    projectData.cnpj = checklist.cnpj;
    projectData.version = checklist.versao_atual || 'VP';
    projectData.contact_name = checklist.responsavel_nome;
    projectData.contact_phone = checklist.responsavel_telefone;
    projectData.contact_email = checklist.responsavel_email;
    projectData.api_type = checklist.api_type || 'Oficial';
    projectData.has_integration = checklist.possui_integracao;
    projectData.integrations_description = checklist.quais_integracoes || null;
    projectData.project_description = checklist.descricao_projeto || null;
    projectData.website = checklist.website || null;
    projectData.has_ai = checklist.usa_ia ?? false;
    projectData.broker = 'EZ';
    // Evolução: não sobrescrever storage_time — manter o armazenamento existente do cliente
  } else if (checklist.type === 'api_oficial') {
    projectData.company_name = checklist.nome_fantasia || checklist.razao_social || checklist.cnpj || '';
    projectData.cnpj = checklist.cnpj;
    projectData.version = checklist.versao || 'VP';
    projectData.contact_name = checklist.responsavel_nome;
    projectData.contact_phone = checklist.responsavel_telefone;
    projectData.contact_email = checklist.responsavel_email;
    projectData.broker = checklist.broker || 'EZ';
    projectData.has_coexistence = checklist.tera_coexistencia;
    projectData.activation_phone = checklist.numero_api_oficial;
    projectData.website = checklist.website || null;
    projectData.api_type = 'Oficial';
    projectData.storage_time = '1 ano';
  }

  // Determine first phase and current_phase before INSERT to avoid extra UPDATE
  const phases = PHASES_BY_TYPE[input.project_type];
  const firstPhaseAssigneeMap: Record<string, string | null> = {
    validacao: assignments.head_user_id,
    ux_po: assignments.ux_po_user_id,
    dev_chatbot: assignments.dev_user_id,
    treinamento: assignments.treinamento_user_id,
    verificacao_bm: assignments.verificacao_bm_user_id || assignments.head_user_id,
    go_live_assistido: assignments.go_live_user_id || assignments.head_user_id,
  };
  const firstPhaseAssignee = firstPhaseAssigneeMap[phases[0]] || assignments.head_user_id || user.id;

  // Phase 1: Set current_phase directly in the INSERT (eliminates separate UPDATE)
  projectData.current_phase = phases[0];

  // Insert project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert(projectData as any)
    .select('id')
    .single();

  if (projectError) throw projectError;
  const projectId = project.id;

  // Trigger automatic messages (fire-and-forget, no await needed)
  supabase.functions.invoke('trigger-automatic-message', {
    body: { trigger_key: 'project_created', project_id: projectId },
  }).catch(console.error);

  // Phase 2: Parallelize all independent operations after project creation
  const [phaseResult, transResult, , headUsersResult] = await Promise.all([
    // Insert first phase
    supabase.from('project_phases').insert({
      project_id: projectId,
      phase_name: phases[0],
      status: 'BACKLOG',
      sort_order: 0,
      is_active: true,
      assigned_user_id: firstPhaseAssignee,
    } as any),
    // Insert first phase transition
    supabase.from('project_status_transitions').insert({
      project_id: projectId,
      phase_name: phases[0],
      status: 'BACKLOG',
      entered_at: new Date().toISOString(),
      changed_by_user_id: user.id,
    } as any),
    // Activity log
    supabase.from('project_activity_logs').insert({
      project_id: projectId,
      user_id: user.id,
      action_type: 'project_created',
      description: `Projeto criado a partir de oportunidade ganha (${input.project_type})`,
    } as any),
    // Fetch head users for notification
    supabase.from('user_roles').select('user_id').eq('role', 'head_pos_venda' as any),
  ]);

  if (phaseResult.error) throw phaseResult.error;
  if (transResult.error) throw transResult.error;

  // Notify head_pos_venda users (depends on headUsersResult)
  const headUsers = headUsersResult.data;
  if (headUsers && headUsers.length > 0) {
    const notifications = headUsers.map((u: any) => ({
      user_id: u.user_id,
      title: 'Novo projeto criado',
      message: `Novo projeto ${PROJECT_TYPE_LABELS[input.project_type] || input.project_type} - ${projectData.company_name || 'Sem nome'}`,
      type: 'info',
      link: '/projects',
    }));
    await supabase.from('notifications').insert(notifications);
  }

  // Auto-create BM verification project when venda has API Oficial
  if (
    input.project_type === 'venda' &&
    checklist.type !== 'api_oficial'
  ) {
    const apiType = (projectData.api_type as string || '').toLowerCase();
    const needsBM = apiType === 'oficial' || apiType === 'extra e oficial' || apiType === 'oficial_e_extra';
    if (needsBM) {
      try {
        await createCompanionBMProject({
          cnpj: (projectData.cnpj as string) || '',
          companyName: (projectData.company_name as string) || '',
          contactName: (projectData.contact_name as string) || '',
          contactPhone: (projectData.contact_phone as string) || '',
          contactEmail: (projectData.contact_email as string) || '',
          website: (projectData.website as string) || '',
          version: (projectData.version as string) || 'VP',
          broker: (projectData.broker as string) || 'EZ',
          userId: user.id,
          parentProjectId: projectId,
        });
      } catch (bmErr) {
        console.error('Erro ao criar verificação de BM automática:', bmErr);
        // Non-blocking: the main project was already created successfully
      }
    }
  }

  return projectId;
};

export const fetchProjects = async () => {
  const { data, error } = await supabase
    .from('projects')
    .select('id, project_number, company_name, cnpj, project_type, current_phase, overall_status, priority, created_at, updated_at, contact_name, tags, archived, due_date, closer_user_id, created_by_user_id, ux_po_user_id, dev_user_id, treinamento_user_id, head_user_id, sdr_user_id')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

export const fetchDeletedProjects = async () => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (error) throw error;
  return data;
};

export const softDeleteProject = async (projectId: string, currentStatus: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { error } = await supabase
    .from('projects')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_from_status: currentStatus,
      deleted_by_user_id: user.id,
    } as any)
    .eq('id', projectId);

  if (error) throw error;
};

export const restoreProject = async (projectId: string) => {
  const { data: project, error: fetchError } = await supabase
    .from('projects')
    .select('deleted_from_status')
    .eq('id', projectId)
    .single();

  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from('projects')
    .update({
      deleted_at: null,
      deleted_from_status: null,
      deleted_by_user_id: null,
      overall_status: (project as any).deleted_from_status || 'ativo',
    } as any)
    .eq('id', projectId);

  if (error) throw error;
};

export const permanentDeleteProject = async (projectId: string) => {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);

  if (error) throw error;
};

export const fetchUserAssignedProjectIds = async (userId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from('project_phases')
    .select('project_id')
    .eq('assigned_user_id', userId);

  if (error) return [];
  return [...new Set((data || []).map((d: any) => d.project_id))];
};

export const fetchUserPhaseAssignments = async (userId: string) => {
  const { data, error } = await supabase
    .from('project_phases')
    .select('project_id, phase_name')
    .eq('assigned_user_id', userId);

  if (error) return [];
  return data || [];
};

export const fetchProjectPhases = async (projectId: string) => {
  const { data, error } = await supabase
    .from('project_phases')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order');

  if (error) throw error;
  return data;
};

export const fetchProjectTransitions = async (projectId: string) => {
  const { data, error } = await supabase
    .from('project_status_transitions')
    .select('*, changed_by_profile:profiles!project_status_transitions_changed_by_user_id_fkey(name)')
    .eq('project_id', projectId)
    .order('entered_at', { ascending: false });

  if (error) throw error;
  return data;
};

// --- Calculate and apply deadlines based on complexity ---
export const calculateAndApplyDeadlines = async (
  projectId: string,
  complexityLevel: string,
  startDate: Date,
): Promise<void> => {
  const normalized = complexityLevel.toLowerCase();
  const deadlines = PHASE_DEADLINES_BY_COMPLEXITY[normalized];
  if (!deadlines) return;

  const { data: phases } = await supabase
    .from('project_phases')
    .select('id, phase_name')
    .eq('project_id', projectId)
    .order('sort_order');

  if (!phases || phases.length === 0) return;

  // Get project to know which phases are in its type
  const { data: proj } = await supabase
    .from('projects')
    .select('project_type')
    .eq('id', projectId)
    .single();

  const projectType = proj?.project_type as ProjectType | undefined;
  const typePhases = projectType ? PHASES_BY_TYPE[projectType] : [];

  // Delivery phases for project due_date calculation
  const deliveryPhases = ['validacao', 'ux_po', 'dev_chatbot', 'treinamento', 'ativacao'];

  let cursor = new Date(startDate);
  let totalDeliveryDays = 0;

  for (const phaseName of typePhases) {
    const days = deadlines[phaseName];
    if (!days) continue;

    const phaseDueDate = addBusinessDays(cursor, days);
    const matchingPhase = phases.find((p: { phase_name: string }) => p.phase_name === phaseName);

    if (matchingPhase) {
      await supabase
        .from('project_phases')
        .update({ due_date: phaseDueDate.toISOString().split('T')[0] } as any)
        .eq('id', matchingPhase.id);
    }

    if (deliveryPhases.includes(phaseName)) {
      totalDeliveryDays += days;
    }

    cursor = phaseDueDate;
  }

  // Project due_date = sum of delivery phases from start
  const projectDueDate = addBusinessDays(startDate, totalDeliveryDays);
  const dueDateStr = projectDueDate.toISOString().split('T')[0];

  await supabase
    .from('projects')
    .update({ due_date: dueDateStr } as any)
    .eq('id', projectId);

  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from('project_activity_logs').insert({
    project_id: projectId,
    user_id: user?.id || null,
    action_type: 'deadlines_calculated',
    description: `Prazos calculados automaticamente — complexidade ${normalized} — entrega prevista: ${dueDateStr}`,
  } as any);
};

export const updatePhaseStatus = async (
  phaseId: string,
  projectId: string,
  phaseName: string,
  newStatus: string,
  oldStatus: string,
  reason?: string
): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  // --- BLOQUEIO: validação sem complexidade ---
  if (phaseName === 'validacao' && newStatus === 'CONCLUÍDO') {
    const { data: proj } = await supabase
      .from('projects')
      .select('complexity_level')
      .eq('id', projectId)
      .single();
    if (!proj?.complexity_level) {
      throw new Error('Defina o nível de complexidade antes de concluir a validação.');
    }
  }

  // --- PAUSADO: registrar paused_at ao entrar ---
  const PAUSE_ENTRY = ['PAUSADO', 'EM PAUSA'];
  const newUpper = newStatus.toUpperCase();
  const oldUpper = oldStatus.toUpperCase();

  if (PAUSE_ENTRY.includes(newUpper) && !PAUSE_ENTRY.includes(oldUpper)) {
    await supabase
      .from('project_phases')
      .update({ paused_at: new Date().toISOString() } as any)
      .eq('id', phaseId);
  }

  // --- PAUSADO: estender prazo ao sair ---
  if (PAUSE_ENTRY.includes(oldUpper) && !PAUSE_ENTRY.includes(newUpper)) {
    const { data: phaseRow } = await supabase
      .from('project_phases')
      .select('paused_at, due_date')
      .eq('id', phaseId)
      .single();

    if ((phaseRow as any)?.paused_at && (phaseRow as any)?.due_date) {
      const pausedAt = new Date((phaseRow as any).paused_at);
      const now = new Date();
      const pausedDays = countBusinessDays(pausedAt, now);

      if (pausedDays > 0) {
        const oldDueDate = new Date((phaseRow as any).due_date);
        const newDueDate = addBusinessDays(oldDueDate, pausedDays);
        const newDueDateStr = newDueDate.toISOString().split('T')[0];

        await supabase
          .from('project_phases')
          .update({ paused_at: null, due_date: newDueDateStr } as any)
          .eq('id', phaseId);

        await supabase.from('project_activity_logs').insert({
          project_id: projectId,
          user_id: user.id,
          action_type: 'deadline_extended',
          phase_name: phaseName,
          description: `Fase pausada por ${pausedDays} dias úteis — prazo estendido para ${newDueDateStr}`,
        } as any);
      } else {
        await supabase
          .from('project_phases')
          .update({ paused_at: null } as any)
          .eq('id', phaseId);
      }
    } else {
      await supabase
        .from('project_phases')
        .update({ paused_at: null } as any)
        .eq('id', phaseId);
    }
  }

  const { data: currentTransition } = await supabase
    .from('project_status_transitions')
    .select('id, entered_at')
    .eq('project_id', projectId)
    .eq('phase_name', phaseName)
    .is('exited_at', null)
    .single();

  if (currentTransition) {
    const enteredAt = new Date(currentTransition.entered_at);
    const now = new Date();
    const durationMinutes = Math.round((now.getTime() - enteredAt.getTime()) / 60000);

    await supabase
      .from('project_status_transitions')
      .update({
        exited_at: now.toISOString(),
        duration_minutes: durationMinutes,
      } as any)
      .eq('id', currentTransition.id);
  }

  // Open new transition
  await supabase.from('project_status_transitions').insert({
    project_id: projectId,
    phase_name: phaseName,
    status: newStatus,
    entered_at: new Date().toISOString(),
    changed_by_user_id: user.id,
  } as any);

  // Update phase status
  const updateData: Record<string, unknown> = { status: newStatus };
  if (newStatus === 'CONCLUÍDO') {
    updateData.completed_at = new Date().toISOString();
    updateData.is_active = false;
  }
  if (oldStatus === 'BACKLOG' && newStatus !== 'BACKLOG') {
    updateData.started_at = new Date().toISOString();
  }

  const { error: phaseUpdateError } = await supabase
    .from('project_phases')
    .update(updateData as any)
    .eq('id', phaseId);

  if (phaseUpdateError) throw phaseUpdateError;

  // --- Sync overall_status based on phase status semantic mapping ---
  // PAUSADO / EM PAUSA → project pausado
  // CANCELADO → project cancelado
  // Exiting pause/cancel to active status → project ativo
  const PAUSE_STATUSES = ['PAUSADO', 'EM PAUSA'];
  const CANCEL_STATUSES = ['CANCELADO'];
  const TERMINAL_STATUSES = [...PAUSE_STATUSES, ...CANCEL_STATUSES, 'CONCLUÍDO'];

  const newStatusUpper = newStatus.toUpperCase();
  const oldStatusUpper = oldStatus.toUpperCase();

  if (PAUSE_STATUSES.includes(newStatusUpper)) {
    const { error: pauseErr } = await supabase
      .from('projects')
      .update({ overall_status: 'em_pausa' } as any)
      .eq('id', projectId);
    if (pauseErr) console.error('Failed to update project to em_pausa:', pauseErr);
  } else if (CANCEL_STATUSES.includes(newStatusUpper)) {
    const { error: cancelErr } = await supabase
      .from('projects')
      .update({ overall_status: 'cancelado' } as any)
      .eq('id', projectId);
    if (cancelErr) console.error('Failed to update project to cancelado:', cancelErr);
  } else if (
    (PAUSE_STATUSES.includes(oldStatusUpper) || CANCEL_STATUSES.includes(oldStatusUpper)) &&
    !TERMINAL_STATUSES.includes(newStatusUpper)
  ) {
    // Returning from pause/cancel to an active status → reactivate project
    const { error: reactivateErr } = await supabase
      .from('projects')
      .update({ overall_status: 'ativo' } as any)
      .eq('id', projectId);
    if (reactivateErr) console.error('Failed to reactivate project:', reactivateErr);
  }

  // Save reason to the most recent project_status_history record (created by trigger)
  if (reason && (PAUSE_STATUSES.includes(newStatusUpper) || CANCEL_STATUSES.includes(newStatusUpper))) {
    // Small delay to ensure the trigger has fired
    const { data: latestHistory } = await supabase
      .from('project_status_history')
      .select('id')
      .eq('project_id', projectId)
      .order('changed_at', { ascending: false })
      .limit(1)
      .single();

    if (latestHistory) {
      await supabase
        .from('project_status_history')
        .update({ reason } as any)
        .eq('id', latestHistory.id);
    }
  }

  // Log activity
  await supabase.from('project_activity_logs').insert({
    project_id: projectId,
    user_id: user.id,
    action_type: 'status_changed',
    phase_name: phaseName,
    old_value: oldStatus,
    new_value: newStatus,
    description: `alterou status de ${phaseName} de ${oldStatus} para ${newStatus}`,
  } as any);

  // Trigger automatic messages for phase status change
  supabase.functions.invoke('trigger-automatic-message', {
    body: { trigger_key: `phase_status_changed:${phaseName}:${newStatus}`, project_id: projectId },
  }).catch(console.error);


  // Auto-advance: if phase completed, create and activate next phase
  if (newStatus === 'CONCLUÍDO') {
    // Trigger automatic messages for phase completion
    supabase.functions.invoke('trigger-automatic-message', {
      body: { trigger_key: `phase_completed:${phaseName}`, project_id: projectId },
    }).catch(console.error);
    // Get current phase's sort_order
    const { data: currentPhaseData } = await supabase
      .from('project_phases')
      .select('sort_order')
      .eq('id', phaseId)
      .single();

    const currentSortOrder = currentPhaseData?.sort_order ?? 0;

    // Get the project type to determine the full phase sequence
    const { data: projectData } = await supabase
      .from('projects')
      .select('project_type, ux_po_user_id, dev_user_id, treinamento_user_id, head_user_id, ativacao_user_id, has_ai, complexity_level')
      .eq('id', projectId)
      .single();

    const projectType = projectData?.project_type as ProjectType | undefined;
    const allPhasesForType = projectType ? PHASES_BY_TYPE[projectType] : null;

    // --- CALCULAR PRAZOS ao concluir validação ---
    if (phaseName === 'validacao' && (projectData as any)?.complexity_level) {
      const completedPhase = await supabase
        .from('project_phases')
        .select('completed_at')
        .eq('id', phaseId)
        .single();
      const startForDeadlines = (completedPhase.data as any)?.completed_at
        ? new Date((completedPhase.data as any).completed_at)
        : new Date();
      try {
        await calculateAndApplyDeadlines(projectId, (projectData as any).complexity_level, startForDeadlines);
      } catch (e) {
        console.error('Erro ao calcular prazos:', e);
      }
    }

    // --- REGRA ESPECIAL: curadoria_ia concluída para Evolução/Venda/Migração — finaliza projeto ---
    if ((projectType === 'evolucao' || projectType === 'venda' || projectType === 'migracao') && phaseName === 'curadoria_ia') {
      await finalizeProjectAsDelivered(projectId, user.id, 'curadoria_ia', projectType);
      return;
    }

    // --- REGRA ESPECIAL: go_live_assistido concluído para Venda — finaliza projeto ---
    if (projectType === 'venda' && phaseName === 'go_live_assistido') {
      await finalizeProjectAsDelivered(projectId, user.id, 'go_live_assistido', projectType);
      return;
    }

    // --- REGRA ESPECIAL: dev_chatbot concluído para Evolução — decisão baseada em has_ai ---
    if (projectType === 'evolucao' && phaseName === 'dev_chatbot') {
      const hasAI = (projectData as Record<string, unknown>)?.has_ai === true;
      if (hasAI) {
        // Com IA → avançar para curadoria_ia via função dedicada
        await advanceToAICuration(projectId, currentSortOrder);
        return;
      } else {
        // Sem IA → finalizar projeto como concluído direto do dev_chatbot
        await finalizeProjectAsDelivered(projectId, user.id, 'dev_chatbot', 'evolucao');
        return;
      }
    }

    // --- REGRA ESPECIAL: ativação concluída para API Oficial — finaliza projeto como concluído ---
    if (projectType === 'api_oficial' && phaseName === 'ativacao') {
      await finalizeApiOficialProject(projectId, user.id);
      return;
    }

    // --- REGRA ESPECIAL: automação concluída (Venda/Migração) — decisão baseada em has_ai ---
    if (phaseName === 'automacao' && (projectType === 'venda' || projectType === 'migracao')) {
      const hasAI = (projectData as Record<string, unknown>)?.has_ai === true;
      if (hasAI) {
        // Com IA → avançar para curadoria_ia
        await advanceToAICuration(projectId, currentSortOrder);
        return;
      } else if (projectType === 'venda') {
        // Venda sem IA → pular curadoria_ia, ir para go_live_assistido
        const headFallback = (projectData as Record<string, unknown>)?.head_user_id as string | null;

        const { error: phaseInsertError } = await supabase.from('project_phases').insert({
          project_id: projectId,
          phase_name: 'go_live_assistido',
          status: 'BACKLOG',
          sort_order: currentSortOrder + 2,
          is_active: true,
          assigned_user_id: headFallback,
        } as any);
        if (phaseInsertError) {
          throw new Error(`Falha ao criar fase go_live_assistido: ${phaseInsertError.message}`);
        }

        await supabase.from('projects')
          .update({ current_phase: 'go_live_assistido' } as any)
          .eq('id', projectId);

        await supabase.from('project_status_transitions').insert({
          project_id: projectId,
          phase_name: 'go_live_assistido',
          status: 'BACKLOG',
          entered_at: new Date().toISOString(),
          changed_by_user_id: user.id,
        } as any);

        await supabase.from('project_activity_logs').insert({
          project_id: projectId,
          user_id: user.id,
          action_type: 'phase_advanced',
          phase_name: 'go_live_assistido',
          old_value: 'automacao',
          new_value: 'go_live_assistido',
          description: 'Projeto de Venda sem IA — avançou de Automação para Go-Live Assistido (Curadoria de IA pulada)',
        } as any);

        return;
      } else {
        // Migração sem IA → finaliza projeto direto
        await finalizeProjectAsDelivered(projectId, user.id, 'automacao', 'migracao');
        return;
      }
    }

    // --- REGRA ESPECIAL: ativação concluída (Venda/Migração) — decisão baseada em has_ai ---
    if (phaseName === 'ativacao' && (projectType === 'venda' || projectType === 'migracao')) {
      const hasAI = (projectData as Record<string, unknown>)?.has_ai === true;
      if (hasAI) {
        // Com IA → avançar para curadoria_ia
        await advanceToAICuration(projectId, currentSortOrder);
        return;
      } else {
        // Sem IA → avançar para go_live_assistido
        const headFallback = (projectData as Record<string, unknown>)?.head_user_id as string | null;

        const { error: phaseInsertError } = await supabase.from('project_phases').insert({
          project_id: projectId,
          phase_name: 'go_live_assistido',
          status: 'BACKLOG',
          sort_order: currentSortOrder + 2,
          is_active: true,
          assigned_user_id: (projectData as any)?.go_live_user_id || headFallback,
        } as any);
        if (phaseInsertError) {
          throw new Error(`Falha ao criar fase go_live_assistido: ${phaseInsertError.message}`);
        }

        await supabase.from('projects')
          .update({ current_phase: 'go_live_assistido' } as any)
          .eq('id', projectId);

        await supabase.from('project_status_transitions').insert({
          project_id: projectId,
          phase_name: 'go_live_assistido',
          status: 'BACKLOG',
          entered_at: new Date().toISOString(),
          changed_by_user_id: user.id,
        } as any);

        await supabase.from('project_activity_logs').insert({
          project_id: projectId,
          user_id: user.id,
          action_type: 'phase_advanced',
          phase_name: 'go_live_assistido',
          old_value: 'ativacao',
          new_value: 'go_live_assistido',
          description: `Projeto sem IA — avançou de Ativação para Go-Live Assistido`,
        } as any);

        return;
      }
    }

    if (allPhasesForType) {
      const currentPhaseIndex = allPhasesForType.indexOf(phaseName);
      const nextPhaseName = currentPhaseIndex >= 0 ? allPhasesForType[currentPhaseIndex + 1] : null;

      if (nextPhaseName) {
        // Map phase name to project user field for auto-assignment
        const headFallback = (projectData as any)?.head_user_id || null;
        const phaseUserMap: Record<string, string | null> = {
          validacao: headFallback,
          ux_po: projectData?.ux_po_user_id || headFallback,
          dev_chatbot: projectData?.dev_user_id || headFallback,
          treinamento: projectData?.treinamento_user_id || headFallback,
          ativacao: projectData?.ativacao_user_id || headFallback,
          automacao: projectData?.dev_user_id || headFallback,
          curadoria_ia: projectData?.dev_user_id || headFallback,
          go_live_assistido: (projectData as any)?.go_live_user_id || headFallback,
          verificacao_bm: (projectData as any)?.verificacao_bm_user_id || headFallback,
        };
        const autoAssignUserId = phaseUserMap[nextPhaseName] ?? null;

        // Create the next phase row
        const { error: createNextError } = await supabase
          .from('project_phases')
          .insert({
            project_id: projectId,
            phase_name: nextPhaseName,
            status: 'BACKLOG',
            sort_order: currentSortOrder + 1,
            is_active: true,
            assigned_user_id: autoAssignUserId,
          } as any);

        // Always update current_phase — even if phase row already existed (insert may have conflicted)
        await supabase
          .from('projects')
          .update({ current_phase: nextPhaseName } as any)
          .eq('id', projectId);

        if (!createNextError) {
          // Create initial transition for next phase
          await supabase.from('project_status_transitions').insert({
            project_id: projectId,
            phase_name: nextPhaseName,
            status: 'BACKLOG',
            entered_at: new Date().toISOString(),
            changed_by_user_id: user.id,
          } as any);

          // Log auto-advance
          await supabase.from('project_activity_logs').insert({
            project_id: projectId,
            user_id: user.id,
            action_type: 'phase_advanced',
            phase_name: nextPhaseName,
            old_value: phaseName,
            new_value: nextPhaseName,
            description: `Etapa avançou automaticamente de ${phaseName} para ${nextPhaseName}`,
          } as any);


          // Auto-comment for ativação phase
          if (nextPhaseName === 'ativacao') {
            await supabase.from('project_activity_logs').insert({
              project_id: projectId,
              user_id: user.id,
              action_type: 'observation',
              phase_name: 'ativacao',
              description: '📋 Encaminhado automaticamente para o setor de Ativação Chatbot. Aguardando configuração e testes para go-live.',
            } as any);
          }

          // Auto-comment + notification for automação phase
          if (nextPhaseName === 'automacao') {
            const automacaoUserId = projectData?.dev_user_id || null;
            await supabase.from('project_activity_logs').insert({
              project_id: projectId,
              user_id: user.id,
              action_type: 'observation',
              phase_name: 'automacao',
              description: '🤖 Encaminhado automaticamente para a fase de Automação. Dev Chatbot é o responsável.',
            } as any);

            // Notify the assigned dev_chatbot user
            if (automacaoUserId) {
              const { data: projInfo } = await supabase
                .from('projects')
                .select('company_name, project_number')
                .eq('id', projectId)
                .single();

              await supabase.from('notifications').insert({
                user_id: automacaoUserId,
                title: 'Projeto avançou para Automação',
                message: `O projeto ${projInfo?.project_number ? '#' + projInfo.project_number + ' — ' : ''}${projInfo?.company_name || ''} avançou para a fase de Automação e foi atribuído a você.`,
                type: 'project_phase',
                link: `/projects?project=${projectId}`,
              } as any);
            }
          }
        }
      } else {
        // No next phase — project is fully completed and archived
        await supabase
          .from('projects')
          .update({ overall_status: 'concluido', archived: true } as any)
          .eq('id', projectId);

        // Trigger automatic messages for project delivery
        supabase.functions.invoke('trigger-automatic-message', {
          body: { trigger_key: 'project_delivered', project_id: projectId },
        }).catch(console.error);
      }
    }

  }
};

/**
 * Force-move a project to a specific phase (admin/head only).
 * Creates the target phase if it doesn't exist, updates current_phase,
 * and logs the forced move.
 */
export const forceMovePhaseTo = async (
  projectId: string,
  targetPhaseName: string,
): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  // Get project type to validate target phase
  const { data: projectData, error: projErr } = await supabase
    .from('projects')
    .select('project_type, current_phase, ux_po_user_id, dev_user_id, treinamento_user_id, head_user_id, ativacao_user_id')
    .eq('id', projectId)
    .single();

  if (projErr || !projectData) throw new Error('Projeto não encontrado');

  const projectType = projectData.project_type as ProjectType;
  const typePhases = PHASES_BY_TYPE[projectType] || [];
  // Admin force-move accepts any known phase, not just the type's default phases
  if (!typePhases.includes(targetPhaseName) && !(ALL_PHASES as readonly string[]).includes(targetPhaseName)) {
    throw new Error('Fase inválida para este tipo de projeto');
  }
  const allPhases = [...typePhases, ...(ALL_PHASES as readonly string[]).filter(p => !typePhases.includes(p))];

  const oldPhase = projectData.current_phase || '(nenhuma)';

  // Check if the target phase already exists
  const { data: existingPhase } = await supabase
    .from('project_phases')
    .select('id, status')
    .eq('project_id', projectId)
    .eq('phase_name', targetPhaseName)
    .maybeSingle();

  const targetPhaseIndex = allPhases.indexOf(targetPhaseName);

  if (existingPhase) {
    // Reactivate existing phase if it was completed
    await supabase
      .from('project_phases')
      .update({ is_active: true, status: existingPhase.status === 'CONCLUÍDO' ? 'BACKLOG' : existingPhase.status, completed_at: null } as any)
      .eq('id', existingPhase.id);
  } else {
    // Create the target phase
    const headFallback = (projectData as any)?.head_user_id || null;
    const phaseUserMap: Record<string, string | null> = {
      validacao: headFallback,
      ux_po: projectData.ux_po_user_id || headFallback,
      dev_chatbot: projectData.dev_user_id || headFallback,
      treinamento: projectData.treinamento_user_id || headFallback,
      ativacao: projectData.ativacao_user_id || headFallback,
      automacao: projectData.dev_user_id || headFallback,
      curadoria_ia: projectData.dev_user_id || headFallback,
      go_live_assistido: (projectData as any)?.go_live_user_id || headFallback,
      verificacao_bm: (projectData as any)?.verificacao_bm_user_id || headFallback,
    };

    const { error: forcePhaseError } = await supabase.from('project_phases').insert({
      project_id: projectId,
      phase_name: targetPhaseName,
      status: 'BACKLOG',
      sort_order: targetPhaseIndex,
      is_active: true,
      assigned_user_id: phaseUserMap[targetPhaseName] ?? null,
    } as any);
    if (forcePhaseError) {
      throw new Error(`Falha ao criar fase ${targetPhaseName}: ${forcePhaseError.message}`);
    }

    // Create initial transition
    await supabase.from('project_status_transitions').insert({
      project_id: projectId,
      phase_name: targetPhaseName,
      status: 'BACKLOG',
      entered_at: new Date().toISOString(),
      changed_by_user_id: user.id,
    } as any);
  }

  // Deactivate all other phases in a single query
  await supabase
    .from('project_phases')
    .update({ is_active: false } as any)
    .eq('project_id', projectId)
    .neq('phase_name', targetPhaseName);

  // Update project current_phase and un-archive if needed
  await supabase
    .from('projects')
    .update({ current_phase: targetPhaseName, archived: false, overall_status: 'ativo' } as any)
    .eq('id', projectId);

  // Log the forced move
  await supabase.from('project_activity_logs').insert({
    project_id: projectId,
    user_id: user.id,
    action_type: 'force_phase_move',
    phase_name: targetPhaseName,
    old_value: oldPhase,
    new_value: targetPhaseName,
    description: `⚠️ Moveu manualmente o projeto de "${PHASE_LABELS[oldPhase] || oldPhase}" para "${PHASE_LABELS[targetPhaseName] || targetPhaseName}" (correção administrativa)`,
  } as any);

};

// --- Finalizar projeto Evolução como "Concluído" (sem IA) ---
export const finalizeEvolutionProject = async (projectId: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  await supabase
    .from('projects')
    .update({ overall_status: 'concluido', current_phase: 'concluido' } as any)
    .eq('id', projectId);

  await supabase.from('project_activity_logs').insert({
    project_id: projectId,
    user_id: user.id,
    action_type: 'project_delivered',
    phase_name: 'dev_chatbot',
    description: 'Projeto de Evolução concluído (sem IA) após conclusão do Dev Chatbot',
  } as any);

  supabase.functions.invoke('trigger-automatic-message', {
    body: { trigger_key: 'project_delivered', project_id: projectId },
  }).catch(console.error);
};

// --- Calcular prazo de Curadoria IA com base na dificuldade ---
const CURADORIA_DEADLINES: Record<string, number> = {
  baixa: 15,
  media: 25,
  alta: 40,
};

export interface AdvanceToAICurationResult {
  dueDateApplied: string;
  usedFallback: boolean;
}

// --- Avançar projeto para Curadoria de IA ---
const advanceToAICuration = async (
  projectId: string,
  currentSortOrder: number,
): Promise<AdvanceToAICurationResult> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { data: projectData } = await supabase
    .from('projects')
    .select('head_user_id, dev_user_id, complexity_level')
    .eq('id', projectId)
    .single();

  const headFallback = (projectData as any)?.head_user_id || null;
  const curadoriaAssignee = (projectData as any)?.dev_user_id || headFallback;
  const complexity = (projectData as any)?.complexity_level as string | null;
  const normalizedComplexity = complexity?.toLowerCase() || null;
  const usedFallback = !normalizedComplexity || !CURADORIA_DEADLINES[normalizedComplexity];
  const days = (normalizedComplexity && CURADORIA_DEADLINES[normalizedComplexity]) || 25;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + days);
  const dueDateStr = dueDate.toISOString().split('T')[0];

  const { error: curadoriaPhaseError } = await supabase.from('project_phases').insert({
    project_id: projectId,
    phase_name: 'curadoria_ia',
    status: 'BACKLOG',
    sort_order: currentSortOrder + 1,
    is_active: true,
    assigned_user_id: curadoriaAssignee,
    due_date: dueDateStr,
  } as any);
  if (curadoriaPhaseError) {
    throw new Error(`Falha ao criar fase curadoria_ia: ${curadoriaPhaseError.message}`);
  }

  await supabase
    .from('projects')
    .update({ current_phase: 'curadoria_ia' } as any)
    .eq('id', projectId);

  await supabase.from('project_status_transitions').insert({
    project_id: projectId,
    phase_name: 'curadoria_ia',
    status: 'BACKLOG',
    entered_at: new Date().toISOString(),
    changed_by_user_id: user.id,
  } as any);

  await supabase.from('project_activity_logs').insert({
    project_id: projectId,
    user_id: user.id,
    action_type: 'phase_advanced',
    phase_name: 'curadoria_ia',
    old_value: 'dev_chatbot',
    new_value: 'curadoria_ia',
    description: `Projeto de Evolução avançou para Curadoria de IA (prazo: ${days} dias — dificuldade ${normalizedComplexity || 'padrão'})`,
  } as any);

  return { dueDateApplied: dueDateStr, usedFallback };
};

// --- Finalizar qualquer projeto como "Concluído" ---
const finalizeProjectAsDelivered = async (projectId: string, userId: string, phaseName: string, projectType: string) => {
  const { data: proj } = await supabase
    .from('projects')
    .select('delivered_at')
    .eq('id', projectId)
    .single();

  const updatePayload: Record<string, unknown> = {
    overall_status: 'concluido',
    current_phase: 'concluido',
  };

  if (!(proj as any)?.delivered_at) {
    updatePayload.delivered_at = new Date().toISOString();
  }

  await supabase
    .from('projects')
    .update(updatePayload as any)
    .eq('id', projectId);

  const typeLabel = PROJECT_TYPE_LABELS[projectType as ProjectType] || projectType;
  const phaseLabel = PHASE_LABELS[phaseName] || phaseName;

  await supabase.from('project_activity_logs').insert({
    project_id: projectId,
    user_id: userId,
    action_type: 'project_delivered',
    phase_name: phaseName,
    description: `Projeto de ${typeLabel} concluído após ${phaseLabel} 🎉`,
  } as any);

  supabase.functions.invoke('trigger-automatic-message', {
    body: { trigger_key: 'project_delivered', project_id: projectId },
  }).catch(console.error);
};

// --- Finalizar projeto Evolução ao concluir Curadoria de IA (legacy wrapper) ---
const finalizeEvolutionFromCuradoria = async (projectId: string, userId: string) => {
  await finalizeProjectAsDelivered(projectId, userId, 'curadoria_ia', 'evolucao');
};

// --- Finalizar projeto API Oficial como "Concluído" ao concluir ativação ---
const finalizeApiOficialProject = async (projectId: string, userId: string) => {
  await finalizeProjectAsDelivered(projectId, userId, 'ativacao', 'api_oficial');
};

// --- Create a standalone curadoria_ia project ---
export interface CreateCuradoriaProjectInput {
  companyName: string;
  cnpj?: string;
  assignedUserId?: string;
  dueDate: string; // ISO date string
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
}

export const createCuradoriaProject = async (input: CreateCuradoriaProjectInput): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const now = new Date();

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      project_type: 'venda', // curadoria_ia is not a valid project_type; using 'venda' as fallback
      created_by_user_id: user.id,
      overall_status: 'ativo',
      priority: 'media',
      company_name: input.companyName,
      cnpj: input.cnpj || null,
      contact_name: input.contactName,
      contact_phone: input.contactPhone || null,
      contact_email: input.contactEmail || null,
      notes: input.notes || null,
      current_phase: 'curadoria_ia',
      has_ai: true,
      start_date: now.toISOString().split('T')[0],
      due_date: input.dueDate,
      head_user_id: user.id,
    } as any)
    .select('id')
    .single();

  if (projectError) throw projectError;

  const projectId = project.id;

  // Assign the responsible user if provided
  if (input.assignedUserId) {
    await supabase
      .from('projects')
      .update({ dev_user_id: input.assignedUserId } as any)
      .eq('id', projectId);
  }

  // Create curadoria_ia phase
  await supabase.from('project_phases').insert({
    project_id: projectId,
    phase_name: 'curadoria_ia',
    status: 'BACKLOG',
    sort_order: 0,
    is_active: true,
    assigned_user_id: input.assignedUserId || null,
  } as any);

  // Status transition record
  await supabase.from('project_status_transitions').insert({
    project_id: projectId,
    phase_name: 'curadoria_ia',
    status: 'BACKLOG',
    entered_at: now.toISOString(),
    changed_by_user_id: user.id,
  } as any);

  // Activity log
  await supabase.from('project_activity_logs').insert({
    project_id: projectId,
    user_id: user.id,
    action_type: 'project_created',
    description: 'Projeto de curadoria IA criado manualmente',
  } as any);

  return projectId;
};
