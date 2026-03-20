import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { PHASE_LABELS } from '@/types/project';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronRight, Check, Search, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useMemo, useCallback } from 'react';

interface ProjectPhaseOwnersProps {
  project: Record<string, any>;
  phases?: any[];
  canEdit: boolean;
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// Project-level role fields mapped to labels and their corresponding app_role for filtering
const PROJECT_ROLE_FIELDS: { field: string; label: string; phaseEquiv?: string; appRole?: string; multiRole?: string[] }[] = [
  { field: 'head_user_id', label: 'Head', phaseEquiv: 'validacao', appRole: 'head_pos_venda' },
  { field: 'ux_po_user_id', label: 'UX/PO', phaseEquiv: 'ux_po', appRole: 'ux_po' },
  { field: 'dev_user_id', label: 'Dev', phaseEquiv: 'dev_chatbot', appRole: 'dev_chatbot' },
  { field: 'treinamento_user_id', label: 'Treinamento / Ativação', phaseEquiv: 'treinamento', appRole: 'treinamento', multiRole: ['treinamento', 'ativacao'] },
  { field: 'verificacao_bm_user_id', label: 'Verificação BM', phaseEquiv: 'verificacao_bm', appRole: 'verificacao_bm' },
  { field: 'go_live_user_id', label: 'Go Live', phaseEquiv: 'go_live_assistido', appRole: 'head_pos_venda' },
  { field: 'closer_user_id', label: 'Closer', multiRole: ['closer', 'admin', 'manager', 'head_pos_venda'] },
  { field: 'sdr_user_id', label: 'SDR', appRole: 'sdr' },
];

const PHASE_TO_PROJECT_FIELD: Record<string, string> = {
  validacao: 'head_user_id',
  ux_po: 'ux_po_user_id',
  dev_chatbot: 'dev_user_id',
  treinamento: 'treinamento_user_id',
  ativacao: 'ativacao_user_id',
  verificacao_bm: 'verificacao_bm_user_id',
  go_live_assistido: 'go_live_user_id',
};

function OwnerPopoverSelect({
  allUsers,
  currentUserId,
  onSelect,
}: {
  allUsers: { id: string; name: string; avatar_url: string | null }[];
  currentUserId: string | null;
  onSelect: (userId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return allUsers;
    const q = search.toLowerCase();
    return allUsers.filter((u) => u.name.toLowerCase().includes(q));
  }, [allUsers, search]);

  const currentUser = allUsers.find((u) => u.id === currentUserId);

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) setSearch(''); }}>
      <PopoverTrigger asChild>
        <button className="text-[11px] font-medium text-foreground hover:text-primary transition-colors truncate max-w-full text-left cursor-pointer">
          {currentUser?.name || <span className="text-muted-foreground/50 italic">Selecionar</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="px-2 py-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-7 text-sm"
              autoFocus
            />
          </div>
        </div>
        <ScrollArea className="max-h-[220px]">
          <div className="p-1">
            {!search.trim() && (
              <button
                onClick={() => { onSelect(null); setOpen(false); }}
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-md",
                  "hover:bg-accent hover:text-accent-foreground",
                  !currentUserId && "bg-accent"
                )}
              >
                <UserX className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="flex-1 text-left italic text-muted-foreground">Não atribuído</span>
                {!currentUserId && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            )}
            {filtered.map((u) => (
              <button
                key={u.id}
                onClick={() => { onSelect(u.id); setOpen(false); }}
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-md",
                  "hover:bg-accent hover:text-accent-foreground",
                  currentUserId === u.id && "bg-accent"
                )}
              >
                <Avatar className="h-5 w-5 text-[8px]">
                  {u.avatar_url && <AvatarImage src={u.avatar_url} alt={u.name} />}
                  <AvatarFallback className="bg-primary/10 text-primary text-[8px]">
                    {getInitials(u.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 text-left">{u.name}</span>
                {currentUserId === u.id && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">Nenhum resultado</p>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export function ProjectPhaseOwners({ project, phases = [], canEdit }: ProjectPhaseOwnersProps) {
  const queryClient = useQueryClient();
  const isMobileInit = typeof window !== 'undefined' && window.innerWidth < 768;
  const [isOpen, setIsOpen] = useState(!isMobileInit);

  const { data: allUsers = [] } = useQuery({
    queryKey: ['system-users-for-phases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch user roles to filter selectors per role
  const { data: userRoles = [] } = useQuery({
    queryKey: ['user-roles-for-phases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (error) throw error;
      return (data || []) as { user_id: string; role: string }[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Build a map: role → set of user_ids (includes head_pos_venda only)
  const usersByRole = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    const headIds = new Set<string>();
    for (const ur of userRoles) {
      if (!map[ur.role]) map[ur.role] = new Set();
      map[ur.role].add(ur.user_id);
      if (ur.role === 'head_pos_venda') {
        headIds.add(ur.user_id);
      }
    }
    // Head can appear in technical role selectors (ux_po, dev_chatbot, treinamento, ativacao, etc.)
    const technicalRoles = ['ux_po', 'dev_chatbot', 'treinamento', 'ativacao', 'verificacao_bm', 'suporte'];
    for (const role of technicalRoles) {
      if (!map[role]) map[role] = new Set();
      for (const id of headIds) {
        map[role].add(id);
      }
    }
    map['_head'] = headIds;
    return map;
  }, [userRoles]);

  const getUsersForRole = useCallback((appRole?: string, multiRole?: string[]) => {
    // Multi-role: union of all specified roles
    if (multiRole && multiRole.length > 0) {
      const ids = new Set<string>();
      for (const role of multiRole) {
        const roleIds = usersByRole[role];
        if (roleIds) {
          for (const id of roleIds) ids.add(id);
        }
      }
      if (ids.size === 0) return allUsers;
      return allUsers.filter(u => ids.has(u.id));
    }
    if (!appRole) return allUsers;
    const roleIds = usersByRole[appRole];
    if (!roleIds || roleIds.size === 0) {
      // Fallback: show only head users
      const headIds = usersByRole['_head'];
      if (headIds && headIds.size > 0) {
        return allUsers.filter(u => headIds.has(u.id));
      }
      return allUsers;
    }
    return allUsers.filter(u => roleIds.has(u.id));
  }, [allUsers, usersByRole]);

  const handleAssignPhase = async (phaseId: string, phaseName: string, userId: string | null) => {
    try {
      const { error } = await supabase
        .from('project_phases')
        .update({ assigned_user_id: userId } as any)
        .eq('id', phaseId);
      if (error) throw error;

      const projectField = PHASE_TO_PROJECT_FIELD[phaseName];
      if (projectField) {
        const { error: projError } = await supabase
          .from('projects')
          .update({ [projectField]: userId } as any)
          .eq('id', project.id);
        if (projError) console.error('Erro ao sincronizar com projects:', projError);
      }

      queryClient.invalidateQueries({ queryKey: ['project-phases', project.id] });
      queryClient.invalidateQueries({ queryKey: ['project-by-id', project.id] });
      queryClient.invalidateQueries({ queryKey: ['phase-owner-profile'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['user-phase-assignments'] });
      toast.success('Responsável atualizado');
    } catch {
      toast.error('Erro ao atribuir responsável');
    }
  };

  const handleAssignProjectRole = async (field: string, userId: string | null) => {
    try {
      const updatePayload: Record<string, string | null> = { [field]: userId };
      // When treinamento is assigned, also sync ativacao
      if (field === 'treinamento_user_id') {
        updatePayload['ativacao_user_id'] = userId;
      }

      const { error } = await supabase
        .from('projects')
        .update(updatePayload as any)
        .eq('id', project.id);
      if (error) throw error;

      const role = PROJECT_ROLE_FIELDS.find(r => r.field === field);
      const phaseEquiv = role?.phaseEquiv;
      if (phaseEquiv) {
        const phase = phases.find((p: any) => p.phase_name === phaseEquiv);
        if (phase) {
          await supabase
            .from('project_phases')
            .update({ assigned_user_id: userId } as any)
            .eq('id', phase.id);
          queryClient.invalidateQueries({ queryKey: ['project-phases', project.id] });
        }
      }
      // Also sync ativacao phase if treinamento changed
      if (field === 'treinamento_user_id') {
        const ativPhase = phases.find((p: any) => p.phase_name === 'ativacao');
        if (ativPhase) {
          await supabase
            .from('project_phases')
            .update({ assigned_user_id: userId } as any)
            .eq('id', ativPhase.id);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['project-by-id', project.id] });
      queryClient.invalidateQueries({ queryKey: ['phase-owner-profile'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['user-phase-assignments'] });
      toast.success('Responsável atualizado');
    } catch {
      toast.error('Erro ao atribuir responsável');
    }
  };

  // Build unified list: project-level roles + any extra phases not covered by roles
  const coveredPhaseNames = new Set(PROJECT_ROLE_FIELDS.map(r => r.phaseEquiv).filter(Boolean));

  // Fields to hide based on project type
  const projectType = project.project_type as string | undefined;
  const hiddenFieldsForEvolucao = new Set(['sdr_user_id']);
  const hiddenFieldsForVendaOrMigracao = new Set(['sdr_user_id']);

  const roleItems = PROJECT_ROLE_FIELDS
    .filter(role => {
      // Hide Treinamento and Ativação for evolucao projects
      if (projectType === 'evolucao' && hiddenFieldsForEvolucao.has(role.field)) {
        return false;
      }
      if ((projectType === 'venda' || projectType === 'migracao') && hiddenFieldsForVendaOrMigracao.has(role.field)) {
        return false;
      }
      return true;
    })
    .map(role => {
      const userId = project[role.field];
      const user = allUsers.find((u: any) => u.id === userId);
      const matchingPhase = role.phaseEquiv ? phases.find((p: any) => p.phase_name === role.phaseEquiv) : null;
      return {
        key: role.field,
        label: role.label,
        userId,
        user,
        isProjectRole: true,
        field: role.field,
        phaseId: matchingPhase?.id,
        phaseName: matchingPhase?.phase_name,
        appRole: role.appRole,
        multiRole: role.multiRole,
      };
    });

  // Map phase names to app roles for extra phases
  const PHASE_NAME_TO_ROLE: Record<string, string> = {
    validacao: 'head_pos_venda',
    ux_po: 'ux_po',
    dev_chatbot: 'dev_chatbot',
    treinamento: 'treinamento',
    ativacao: 'ativacao',
    verificacao_bm: 'verificacao_bm',
    suporte: 'suporte',
  };

  // Extra phases not covered by project role fields (e.g. ativacao, automacao, curadoria_ia, go_live_assistido, verificacao_bm)
  const extraPhases = phases
    .filter((p: any) => !coveredPhaseNames.has(p.phase_name))
    .map((phase: any) => {
      const user = allUsers.find((u: any) => u.id === phase.assigned_user_id);
      return {
        key: `phase-${phase.id}`,
        label: PHASE_LABELS[phase.phase_name] || phase.phase_name,
        userId: phase.assigned_user_id,
        user,
        isProjectRole: false,
        field: '',
        phaseId: phase.id,
        phaseName: phase.phase_name,
        appRole: PHASE_NAME_TO_ROLE[phase.phase_name],
        multiRole: undefined,
      };
    });

  const allItems = [...roleItems, ...extraPhases];

  if (allItems.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors py-1">
        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-90')} />
        Responsáveis
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-4">
          {allItems.map((item) => (
            <div key={item.key} className="min-w-0">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 block mb-1">
                {item.label}
              </span>
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5 text-[8px] flex-shrink-0">
                  {item.user?.avatar_url && (
                    <AvatarImage src={item.user.avatar_url} alt={item.user.name} />
                  )}
                  <AvatarFallback className="bg-primary/10 text-primary text-[8px] font-semibold">
                    {item.user ? getInitials(item.user.name) : '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  {canEdit ? (
                    <OwnerPopoverSelect
                      allUsers={getUsersForRole(item.appRole, item.multiRole)}
                      currentUserId={item.userId}
                      onSelect={(uid) => {
                        if (item.isProjectRole) {
                          handleAssignProjectRole(item.field, uid);
                        } else if (item.phaseId && item.phaseName) {
                          handleAssignPhase(item.phaseId, item.phaseName, uid);
                        }
                      }}
                    />
                  ) : (
                    <span className="text-xs text-foreground font-medium truncate block">
                      {item.user?.name || <span className="text-muted-foreground/30 italic">Selecionar</span>}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
