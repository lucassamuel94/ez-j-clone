import { useMemo, useState, useCallback } from 'react';
import { Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { PHASE_LABELS } from '@/types/project';
import type { WorkloadCell } from '@/hooks/useProjectDashboard';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface DashboardWorkloadGridProps {
  data: WorkloadCell[];
  onSelectProject?: (project: any) => void;
}

const PHASES = ['ux_po', 'dev_chatbot', 'treinamento', 'validacao', 'ativacao'];

function getCountColor(count: number) {
  if (count === 0) return 'bg-muted/30 text-muted-foreground';
  if (count <= 2) return 'bg-chart-3/15 text-[hsl(var(--chart-3))]';
  if (count <= 4) return 'bg-chart-2/15 text-[hsl(var(--chart-2))]';
  return 'bg-destructive/15 text-destructive';
}

interface TeamGroup {
  teamId: string | null;
  teamName: string;
  members: WorkloadCell[];
  teamTotal: number;
}

interface ProjectListItem {
  id: string;
  company_name: string;
  current_phase: string;
  overall_status: string;
  project_number: number | null;
}

export function DashboardWorkloadGrid({ data, onSelectProject }: DashboardWorkloadGridProps) {
  const isMobile = useIsMobile();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalProjects, setModalProjects] = useState<ProjectListItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const teamGroups = useMemo<TeamGroup[]>(() => {
    const groupMap = new Map<string, TeamGroup>();

    for (const row of data) {
      const key = row.teamId || '__no_team__';
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          teamId: row.teamId,
          teamName: row.teamName || 'Sem equipe',
          members: [],
          teamTotal: 0,
        });
      }
      const group = groupMap.get(key)!;
      group.members.push(row);
      group.teamTotal += row.total;
    }

    return Array.from(groupMap.values()).sort((a, b) => {
      if (!a.teamId && b.teamId) return 1;
      if (a.teamId && !b.teamId) return -1;
      return b.teamTotal - a.teamTotal;
    });
  }, [data]);

  const handleCellClick = useCallback(async (userId: string, userName: string, phase: string | null) => {
    const label = phase ? `${userName} — ${PHASE_LABELS[phase] || phase}` : `${userName} — Todos`;
    setModalTitle(label);
    setModalProjects([]);
    setModalOpen(true);
    setLoadingProjects(true);

    try {
      let query = supabase
        .from('project_phases')
        .select('project_id')
        .eq('assigned_user_id', userId)
        .eq('is_active', true);

      if (phase) {
        query = query.eq('phase_name', phase);
      }

      const { data: phases } = await query;
      const projectIds = [...new Set((phases || []).map((p: any) => p.project_id))];

      if (projectIds.length === 0) {
        setModalProjects([]);
        setLoadingProjects(false);
        return;
      }

      const { data: projects } = await supabase
        .from('projects')
        .select('id, company_name, current_phase, overall_status, project_number')
        .in('id', projectIds)
        .order('project_number', { ascending: false });

      setModalProjects((projects || []) as ProjectListItem[]);
    } catch {
      setModalProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  if (data.length === 0) return null;

  const maxTotal = Math.max(...data.map(d => d.total), 1);
  const hasMultipleGroups = teamGroups.length > 1 || (teamGroups.length === 1 && teamGroups[0].teamId !== null);

  return (
    <>
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" strokeWidth={1.5} />
              Carga por Colaborador
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className={isMobile ? 'px-4 pb-4' : 'p-0'}>
          {isMobile ? (
            <div className="space-y-4">
              {teamGroups.map((group) => (
                <div key={group.teamId || '__no_team__'}>
                  {hasMultipleGroups && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary/70">{group.teamName}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">({group.teamTotal})</span>
                      <div className="flex-1 h-px bg-border/30" />
                    </div>
                  )}
                  <div className="space-y-3">
                    {group.members.map((row) => (
                      <div key={row.userId} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground truncate">{row.userName}</p>
                          <button
                            className="text-xs font-bold text-foreground tabular-nums hover:text-primary transition-colors"
                            onClick={() => handleCellClick(row.userId, row.userName, null)}
                          >
                            {row.total}
                          </button>
                        </div>
                        <Progress value={(row.total / maxTotal) * 100} className="h-1.5" />
                        <div className="flex flex-wrap gap-1">
                          {PHASES.map((p) => {
                            const count = row.phases[p] || 0;
                            if (count === 0) return null;
                            return (
                              <button
                                key={p}
                                className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
                                onClick={() => handleCellClick(row.userId, row.userName, p)}
                              >
                                {PHASE_LABELS[p] || p}: {count}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Colaborador</th>
                    {PHASES.map(p => (
                      <th key={p} className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">
                        {PHASE_LABELS[p] || p}
                      </th>
                    ))}
                    <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {teamGroups.map((group) => (
                    <TeamSection
                      key={group.teamId || '__no_team__'}
                      group={group}
                      showHeader={hasMultipleGroups}
                      onCellClick={handleCellClick}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">{modalTitle}</DialogTitle>
          </DialogHeader>
          {loadingProjects ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : modalProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum projeto encontrado</p>
          ) : (
            <div className="divide-y divide-border/30 max-h-[60vh] overflow-y-auto -mx-6 px-6">
              {modalProjects.map((project) => (
                <button
                  key={project.id}
                  className="w-full flex items-center justify-between gap-3 py-3 text-left hover:bg-accent/50 transition-colors duration-150 rounded-md px-2 -mx-2"
                  onClick={() => {
                    setModalOpen(false);
                    onSelectProject?.(project);
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {project.project_number ? `#${project.project_number} ` : ''}{project.company_name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {PHASE_LABELS[project.current_phase] || project.current_phase || '—'}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn('text-xs shrink-0', {
                      'bg-chart-3/15 text-[hsl(var(--chart-3))]': project.overall_status === 'on_track',
                      'bg-chart-2/15 text-[hsl(var(--chart-2))]': project.overall_status === 'at_risk',
                      'bg-destructive/15 text-destructive': project.overall_status === 'delayed',
                    })}
                  >
                    {project.overall_status === 'on_track' ? 'No prazo' : project.overall_status === 'at_risk' ? 'Em risco' : project.overall_status === 'delayed' ? 'Atrasado' : project.overall_status || '—'}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function TeamSection({ group, showHeader, onCellClick }: { group: TeamGroup; showHeader: boolean; onCellClick: (userId: string, userName: string, phase: string | null) => void }) {
  return (
    <>
      {showHeader && (
        <tr className="bg-muted/20">
          <td colSpan={PHASES.length + 2} className="px-4 py-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/70">{group.teamName}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {group.members.length} {group.members.length === 1 ? 'membro' : 'membros'} · {group.teamTotal} fases
              </span>
            </div>
          </td>
        </tr>
      )}
      {group.members.map(row => (
        <tr key={row.userId} className="border-b border-border/30 even:bg-muted/5">
          <td className="px-4 py-2 font-medium text-foreground">{row.userName}</td>
          {PHASES.map(p => {
            const count = row.phases[p] || 0;
            return (
              <td key={p} className="text-center px-3 py-2">
                <button
                  className={cn(
                    'inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold transition-all duration-150',
                    getCountColor(count),
                    count > 0 && 'cursor-pointer hover:ring-2 hover:ring-primary/30 hover:scale-110',
                    count === 0 && 'cursor-default',
                  )}
                  onClick={() => count > 0 && onCellClick(row.userId, row.userName, p)}
                  disabled={count === 0}
                  aria-label={`${row.userName}, ${PHASE_LABELS[p] || p}: ${count} projetos`}
                >
                  {count}
                </button>
              </td>
            );
          })}
          <td className="text-center px-3 py-2">
            <button
              className="font-bold text-foreground tabular-nums hover:text-primary transition-colors"
              onClick={() => onCellClick(row.userId, row.userName, null)}
              aria-label={`${row.userName}, total: ${row.total} projetos`}
            >
              {row.total}
            </button>
          </td>
        </tr>
      ))}
    </>
  );
}