import { useNavigate } from 'react-router-dom';
import { ALL_PHASES, PHASE_LABELS } from '@/types/project';
import { usePhaseProjectCounts } from '@/hooks/usePhaseProjectCounts';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FolderKanban,
  ClipboardCheck,
  Palette,
  Code,
  GraduationCap,
  Rocket,
  Cog,
  Brain,
  RadioTower,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';

const PHASE_ICONS: Record<string, React.ReactNode> = {
  validacao: <ClipboardCheck className="h-4 w-4" strokeWidth={1.5} />,
  ux_po: <Palette className="h-4 w-4" strokeWidth={1.5} />,
  dev_chatbot: <Code className="h-4 w-4" strokeWidth={1.5} />,
  treinamento: <GraduationCap className="h-4 w-4" strokeWidth={1.5} />,
  ativacao: <Rocket className="h-4 w-4" strokeWidth={1.5} />,
  automacao: <Cog className="h-4 w-4" strokeWidth={1.5} />,
  curadoria_ia: <Brain className="h-4 w-4" strokeWidth={1.5} />,
  go_live_assistido: <RadioTower className="h-4 w-4" strokeWidth={1.5} />,
  verificacao_bm: <ShieldCheck className="h-4 w-4" strokeWidth={1.5} />,
};

const COMING_SOON_PHASES = new Set<string>();

export function ProjectPhaseSidebar() {
  const { data: phaseCounts, isLoading } = usePhaseProjectCounts();
  const navigate = useNavigate();

  const totalProjects = phaseCounts?.reduce((sum, p) => sum + p.count, 0) || 0;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <FolderKanban className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <span className="text-sm font-semibold text-foreground">Gestão de Projetos</span>
        <span className="ml-auto text-xs font-medium text-muted-foreground/50 tabular-nums">{totalProjects}</span>
      </div>

      {/* Phase List */}
      <div className="flex flex-col gap-0.5 px-1">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-lg" />
          ))
        ) : (
          ALL_PHASES.map((phase) => {
            const count = phaseCounts?.find(p => p.phase_name === phase)?.count || 0;
            return (
              <button
                key={phase}
                onClick={() => navigate('/projects/phase/' + phase)}
                className="flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all duration-150 group w-full text-left"
              >
                <span className="opacity-70 group-hover:opacity-100 flex-shrink-0">
                  {PHASE_ICONS[phase]}
                </span>
                <span className="truncate flex-1 font-medium">
                  {PHASE_LABELS[phase] || phase}
                </span>
                {COMING_SOON_PHASES.has(phase) ? (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 leading-none font-medium border-chart-5/20 text-chart-5 bg-chart-5/5 rounded-full ml-auto flex-shrink-0">
                    Em breve
                  </Badge>
                ) : count > 0 ? (
                  <span className="text-xs font-medium text-muted-foreground/50 ml-auto flex-shrink-0 tabular-nums">
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </div>

      {/* Footer link */}
      <div className="px-1 pt-2 mt-1 border-t border-border/20">
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-2 h-8 px-2.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-all duration-150 w-full"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Ver todos os projetos
        </button>
      </div>
    </div>
  );
}
