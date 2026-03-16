import { supabase } from '@/integrations/supabase/client';
import { ChecklistData, PHASES_BY_TYPE, PHASE_LABELS, PROJECT_TYPE_LABELS, ProjectType } from '@/types/project';

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
}

const addBusinessDays = (startDate: Date, days: number): Date => {
  const result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }
  return result;
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
    closer_name: input.closer_name || null,
    sdr_name: input.sdr_name || null,
    start_date: now.toISOString().split('T')[0],
    due_date: dueDate.toISOString().split('T')[0],
  };

  if (checklist.type === 'venda' || checklist.type === 'migracao') {
    projectData.company_name = checklist.razao_social;
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
    projectData.company_name = checklist.razao_social;
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
    projectData.storage_time = '1 ano';
  } else if (checklist.type === 'api_oficial') {
    projectData.company_name = checklist.razao_social || checklist.cnpj || '';
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
    verificacao_bm: assignments.head_user_id,
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

export const updatePhaseStatus = async (
  phaseId: string,
  projectId: string,
  phaseName: string,
  newStatus: string,
  oldStatus: string
): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  // Close current transition
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
    await supabase
      .from('projects')
      .update({ overall_status: 'em_pausa' } as any)
      .eq('id', projectId);
  } else if (CANCEL_STATUSES.includes(newStatusUpper)) {
    await supabase
      .from('projects')
      .update({ overall_status: 'cancelado' } as any)
      .eq('id', projectId);
  } else if (
    (PAUSE_STATUSES.includes(oldStatusUpper) || CANCEL_STATUSES.includes(oldStatusUpper)) &&
    !TERMINAL_STATUSES.includes(newStatusUpper)
  ) {
    // Returning from pause/cancel to an active status → reactivate project
    await supabase
      .from('projects')
      .update({ overall_status: 'ativo' } as any)
      .eq('id', projectId);
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
      .select('project_type, ux_po_user_id, dev_user_id, treinamento_user_id, head_user_id, ativacao_user_id, has_ai')
      .eq('id', projectId)
      .single();

    const projectType = projectData?.project_type as ProjectType | undefined;
    const allPhasesForType = projectType ? PHASES_BY_TYPE[projectType] : null;

    // --- REGRA ESPECIAL: curadoria_ia concluída para Evolução — finaliza projeto ---
    if (projectType === 'evolucao' && phaseName === 'curadoria_ia') {
      await finalizeEvolutionFromCuradoria(projectId, user.id);
      return;
    }

    // --- REGRA ESPECIAL: automação concluída — decisão baseada em has_ai ---
    if (phaseName === 'automacao') {
      const hasAI = (projectData as Record<string, unknown>)?.has_ai === true;
      if (!hasAI) {
        if (projectType === 'evolucao') {
          // Evolução sem IA → finalizar projeto como entregue
          await finalizeEvolutionFromCuradoria(projectId, user.id);
          return;
        } else {
          // Venda/Migração sem IA → pular curadoria_ia, ir direto para go_live_assistido
          const headFallback = (projectData as Record<string, unknown>)?.head_user_id as string | null;
          const goLiveAssignee = headFallback || null;

          await supabase.from('project_phases').insert({
            project_id: projectId,
            phase_name: 'go_live_assistido',
            status: 'BACKLOG',
            sort_order: currentSortOrder + 2, // +2 to skip curadoria_ia slot
            is_active: true,
            assigned_user_id: goLiveAssignee,
          } as any);

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
            description: 'Projeto sem IA — avançou de Automação direto para Go-Live Assistido (Curadoria de IA pulada)',
          } as any);

          return;
        }
      }
      // has_ai === true → continua fluxo normal (avança para curadoria_ia)
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
          go_live_assistido: headFallback,
          verificacao_bm: headFallback,
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
  const allPhases = PHASES_BY_TYPE[projectType];
  if (!allPhases || !allPhases.includes(targetPhaseName)) {
    throw new Error('Fase inválida para este tipo de projeto');
  }

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
      go_live_assistido: headFallback,
      verificacao_bm: headFallback,
    };

    await supabase.from('project_phases').insert({
      project_id: projectId,
      phase_name: targetPhaseName,
      status: 'BACKLOG',
      sort_order: targetPhaseIndex,
      is_active: true,
      assigned_user_id: phaseUserMap[targetPhaseName] ?? null,
    } as any);

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

// --- Finalizar projeto Evolução como "Entregue" (sem IA) ---
export const finalizeEvolutionProject = async (projectId: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  await supabase
    .from('projects')
    .update({ overall_status: 'entregue', current_phase: 'entregue' } as any)
    .eq('id', projectId);

  await supabase.from('project_activity_logs').insert({
    project_id: projectId,
    user_id: user.id,
    action_type: 'project_delivered',
    phase_name: 'dev_chatbot',
    description: 'Projeto de Evolução entregue (sem IA) após conclusão do Dev Chatbot',
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

// --- Avançar projeto Evolução para Curadoria de IA ---
export const advanceEvolutionToAICuration = async (
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

  await supabase.from('project_phases').insert({
    project_id: projectId,
    phase_name: 'curadoria_ia',
    status: 'BACKLOG',
    sort_order: currentSortOrder + 1,
    is_active: true,
    assigned_user_id: curadoriaAssignee,
    due_date: dueDateStr,
  } as any);

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

// --- Finalizar projeto Evolução ao concluir Curadoria de IA ---
const finalizeEvolutionFromCuradoria = async (projectId: string, userId: string) => {
  // Check if delivered_at already exists — don't overwrite
  const { data: proj } = await supabase
    .from('projects')
    .select('delivered_at')
    .eq('id', projectId)
    .single();

  const updatePayload: Record<string, unknown> = {
    overall_status: 'entregue',
    current_phase: 'entregue',
  };

  if (!(proj as any)?.delivered_at) {
    updatePayload.delivered_at = new Date().toISOString();
  }

  await supabase
    .from('projects')
    .update(updatePayload as any)
    .eq('id', projectId);

  await supabase.from('project_activity_logs').insert({
    project_id: projectId,
    user_id: userId,
    action_type: 'project_delivered',
    phase_name: 'curadoria_ia',
    description: 'Projeto de Evolução concluído e entregue após Curadoria de IA 🎉',
  } as any);

  supabase.functions.invoke('trigger-automatic-message', {
    body: { trigger_key: 'project_delivered', project_id: projectId },
  }).catch(console.error);
};
