import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, X, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  FolderOpen, CheckCircle2, AlertTriangle, Clock,
  Timer,
} from "lucide-react";
import {
  usePhaseDistribution, useAvgTimePerPhase, useRecentActivities,
  useWorkloadHeatmap, useAgingBoard, useWeeklyThroughput,
  useLeadTimeByUser, useSlaCompliance,
} from "@/hooks/useProjectDashboard";
import { useAllTeamProductivity } from "@/hooks/useProductivityMetrics";
import {
  PROJECT_TYPE_LABELS, PHASE_LABELS, ProjectType,
} from "@/types/project";
import { useIsMobile } from "@/hooks/use-mobile";
import { KpiProjectsModal } from "./KpiProjectsModal";

// Sub-components
import { DashboardKpiCard } from "./dashboard/DashboardKpiCard";
import { DashboardChartWrapper } from "./dashboard/DashboardChartWrapper";
import { DashboardRiskList } from "./dashboard/DashboardRiskList";
import { DashboardAgingList } from "./dashboard/DashboardAgingList";
import { DashboardActivityFeed } from "./dashboard/DashboardActivityFeed";
import { DashboardWorkloadGrid } from "./dashboard/DashboardWorkloadGrid";
import { DashboardFunnelChart } from "./dashboard/DashboardFunnelChart";
import { DashboardSlaTable } from "./dashboard/DashboardSlaTable";
import { DashboardProductivityCards } from "./dashboard/DashboardProductivityCards";
import { DashboardDeliveriesSection } from "./dashboard/DashboardDeliveriesSection";
import { CHART_PALETTE, STATUS_COLORS_MAP, STATUS_LABELS } from "./dashboard/constants";

interface ProjectsDashboardProps {
  projects: any[];
  onSelectProject?: (project: any) => void;
}

function DashboardTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-lg" role="status" aria-live="polite">
      <p className="font-medium text-foreground">{label || payload[0]?.name}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-muted-foreground tabular-nums">
          {p.name ? `${p.name}: ` : ''}{p.value}
        </p>
      ))}
    </div>
  );
}

// Collapsible section wrapper for mobile
function CollapsibleSection({ title, icon, children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(defaultOpen || !isMobile);

  if (!isMobile) return <>{children}</>;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full px-1 py-2">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {icon} {title}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function ProjectsDashboard({ projects, onSelectProject }: ProjectsDashboardProps) {
  const isMobile = useIsMobile();
  const { data: phaseDistribution } = usePhaseDistribution();
  const { data: avgTimePerPhase } = useAvgTimePerPhase();
  const { data: recentActivities } = useRecentActivities();
  const { data: workloadData } = useWorkloadHeatmap();
  const { data: agingData } = useAgingBoard();
  const { data: throughputData } = useWeeklyThroughput();
  const [leadTimePhase, setLeadTimePhase] = useState('all');
  const { data: leadTimeData } = useLeadTimeByUser(leadTimePhase);
  const { data: slaData } = useSlaCompliance();
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const { data: allProductivity } = useAllTeamProductivity(currentMonth, currentYear);
  const uxMetrics = allProductivity?.ux_po;
  const devMetrics = allProductivity?.dev_chatbot;
  const treinamentoMetrics = allProductivity?.treinamento;

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [kpiModal, setKpiModal] = useState<{ title: string; projects: any[] } | null>(null);

  // Filter projects by selected period
  const filteredProjects = useMemo(() => {
    if (!dateRange?.from) return projects;
    return projects.filter((p) => {
      const created = new Date(p.created_at);
      if (dateRange.from && created < dateRange.from) return false;
      if (dateRange.to) {
        const endOfDay = new Date(dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        if (created > endOfDay) return false;
      }
      return true;
    });
  }, [projects, dateRange]);

  // KPIs
  const kpis = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const active = filteredProjects.filter((p) => p.overall_status === "ativo" && !p.archived);
    const completedThisMonth = filteredProjects.filter(
      (p) => (p.overall_status === "concluido" || p.archived) && new Date(p.updated_at) >= monthStart,
    );
    const overdue = active.filter((p) => p.due_date && new Date(p.due_date) < now);
    const completed = filteredProjects.filter((p) => p.overall_status === "concluido");
    let avgDays = 0;
    if (completed.length > 0) {
      const totalDays = completed.reduce((acc, p) => {
        return acc + (new Date(p.updated_at).getTime() - new Date(p.created_at).getTime()) / 86400000;
      }, 0);
      avgDays = Math.round(totalDays / completed.length);
    }
    return { activeCount: active.length, completedMonth: completedThisMonth.length, overdueCount: overdue.length, avgDays };
  }, [filteredProjects]);

  const kpiProjectLists = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      active: filteredProjects.filter((p) => p.overall_status === "ativo" && !p.archived),
      completedMonth: filteredProjects.filter(
        (p) => (p.overall_status === "concluido" || p.archived) && new Date(p.updated_at) >= monthStart,
      ),
      overdue: filteredProjects
        .filter((p) => p.overall_status === "ativo" && p.due_date && new Date(p.due_date) < now)
        .map((p) => {
          const diffDays = Math.ceil((now.getTime() - new Date(p.due_date).getTime()) / 86400000);
          return { ...p, daysOverdue: diffDays };
        }),
    };
  }, [filteredProjects]);

  // Distribution by type
  const typeData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredProjects.forEach((p) => {
      const label = PROJECT_TYPE_LABELS[p.project_type as ProjectType] || p.project_type;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredProjects]);

  // Distribution by status
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredProjects.forEach((p) => {
      counts[p.overall_status] = (counts[p.overall_status] || 0) + 1;
    });
    return Object.entries(counts).map(([key, value]) => ({
      name: STATUS_LABELS[key] || key,
      value,
      fill: STATUS_COLORS_MAP[key] || 'hsl(var(--muted-foreground))',
    }));
  }, [filteredProjects]);

  // Phase funnel
  const phaseFunnelData = useMemo(() => {
    if (!phaseDistribution) return [];
    return Object.entries(phaseDistribution)
      .map(([phase, count]) => ({ phase: PHASE_LABELS[phase] || phase, count }))
      .sort((a, b) => b.count - a.count);
  }, [phaseDistribution]);

  // Avg time per phase chart
  const avgTimeData = useMemo(() => {
    if (!avgTimePerPhase) return [];
    return Object.entries(avgTimePerPhase)
      .map(([phase, days]) => ({ phase: PHASE_LABELS[phase] || phase, dias: days || 0 }))
      .filter((d) => d.dias > 0);
  }, [avgTimePerPhase]);

  // Projects at risk
  const atRiskProjects = useMemo(() => {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000);
    return filteredProjects
      .filter((p) => p.overall_status === "ativo" && p.due_date && new Date(p.due_date) <= sevenDaysFromNow)
      .map((p) => {
        const dueDate = new Date(p.due_date);
        const diffDays = Math.ceil((now.getTime() - dueDate.getTime()) / 86400000);
        return { ...p, daysOverdue: diffDays };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [filteredProjects]);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Period Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 text-xs gap-1.5 border-border/50",
                dateRange?.from && "border-primary/50 bg-accent/50"
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>{format(dateRange.from, "dd/MM/yy", { locale: ptBR })} – {format(dateRange.to, "dd/MM/yy", { locale: ptBR })}</>
                ) : format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
              ) : "Filtrar período"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={isMobile ? 1 : 2} locale={ptBR} initialFocus />
          </PopoverContent>
        </Popover>
        {dateRange?.from && (
          <>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setDateRange(undefined)}>
              <X className="h-3.5 w-3.5 mr-1" />Limpar
            </Button>
            <span className="text-xs text-muted-foreground">{filteredProjects.length} de {projects.length} projetos</span>
          </>
        )}
      </div>

      {/* KPI Cards */}
      <section aria-label="Indicadores principais" className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <DashboardKpiCard label="Projetos Ativos" value={kpis.activeCount} icon={FolderOpen} variant="primary" onClick={() => setKpiModal({ title: "Projetos Ativos", projects: kpiProjectLists.active })} />
        <DashboardKpiCard label="Concluídos (mês)" value={kpis.completedMonth} icon={CheckCircle2} variant="success" onClick={() => setKpiModal({ title: "Concluídos no Mês", projects: kpiProjectLists.completedMonth })} />
        <DashboardKpiCard label="Em Atraso" value={kpis.overdueCount} icon={AlertTriangle} variant="warning" onClick={() => setKpiModal({ title: "Projetos em Atraso", projects: kpiProjectLists.overdue })} />
        <DashboardKpiCard label="Tempo Médio (dias)" value={kpis.avgDays} icon={Clock} variant="info" />
      </section>

      {/* Distribution Charts - Donut with external legend */}
      <section aria-label="Distribuição de projetos" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashboardChartWrapper title="Por Tipo" ariaLabel={`Distribuição por tipo: ${typeData.map(d => `${d.name}: ${d.value}`).join(', ')}`} isEmpty={typeData.length === 0}>
          <div className="flex flex-col items-center gap-3">
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    strokeWidth={2}
                    stroke="hsl(var(--card))"
                    className="cursor-pointer"
                    onClick={(_, index) => {
                      const entry = typeData[index];
                      if (!entry) return;
                      const projectsForType = filteredProjects.filter((p) => {
                        const label = PROJECT_TYPE_LABELS[p.project_type as ProjectType] || p.project_type;
                        return label === entry.name;
                      });
                      setKpiModal({ title: `Tipo: ${entry.name}`, projects: projectsForType });
                    }}
                  >
                    {typeData.map((_, i) => (
                      <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} className="cursor-pointer" />
                    ))}
                  </Pie>
                  <Tooltip content={<DashboardTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
              {typeData.map((entry, i) => (
                <div
                  key={entry.name}
                  className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => {
                    const projectsForType = filteredProjects.filter((p) => {
                      const label = PROJECT_TYPE_LABELS[p.project_type as ProjectType] || p.project_type;
                      return label === entry.name;
                    });
                    setKpiModal({ title: `Tipo: ${entry.name}`, projects: projectsForType });
                  }}
                >
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length] }} />
                  <span className="text-xs text-muted-foreground">{entry.name}</span>
                  <span className="text-xs font-bold text-foreground tabular-nums">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </DashboardChartWrapper>

        <DashboardChartWrapper title="Por Status" ariaLabel={`Distribuição por status: ${statusData.map(d => `${d.name}: ${d.value}`).join(', ')}`} isEmpty={statusData.length === 0}>
          <div className="flex flex-col items-center gap-3">
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    strokeWidth={2}
                    stroke="hsl(var(--card))"
                    className="cursor-pointer"
                    onClick={(_, index) => {
                      const entry = statusData[index];
                      if (!entry) return;
                      const statusKey = Object.entries(STATUS_LABELS).find(([, v]) => v === entry.name)?.[0] || entry.name;
                      const projectsForStatus = filteredProjects.filter((p) => p.overall_status === statusKey);
                      setKpiModal({ title: `Status: ${entry.name}`, projects: projectsForStatus });
                    }}
                  >
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} className="cursor-pointer" />
                    ))}
                  </Pie>
                  <Tooltip content={<DashboardTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
              {statusData.map((entry) => {
                const statusKey = Object.entries(STATUS_LABELS).find(([, v]) => v === entry.name)?.[0] || entry.name;
                return (
                  <div
                    key={entry.name}
                    className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => {
                      const projectsForStatus = filteredProjects.filter((p) => p.overall_status === statusKey);
                      setKpiModal({ title: `Status: ${entry.name}`, projects: projectsForStatus });
                    }}
                  >
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.fill }} />
                    <span className="text-xs text-muted-foreground">{entry.name}</span>
                    <span className="text-xs font-bold text-foreground tabular-nums">{entry.value}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </DashboardChartWrapper>
      </section>

      {/* Phase Funnel */}
      {phaseFunnelData.length > 0 && <DashboardFunnelChart data={phaseFunnelData} />}

      {/* Avg Time per Phase */}
      {avgTimeData.length > 0 && (
        <DashboardChartWrapper title="Tempo Médio por Fase (dias)" ariaLabel={`Tempo médio por fase: ${avgTimeData.map(d => `${d.phase}: ${d.dias}d`).join(', ')}`}>
          <div className={isMobile ? '' : 'h-[260px]'}>
            {isMobile ? (
              <div className="space-y-3 py-1">
                {avgTimeData.map((entry) => (
                  <div key={entry.phase} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground truncate mr-2">{entry.phase}</span>
                      <span className="text-xs font-bold text-foreground tabular-nums shrink-0">{entry.dias}d</span>
                    </div>
                    <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, (entry.dias / Math.max(...avgTimeData.map(d => d.dias), 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={avgTimeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="phase" fontSize={11} stroke="hsl(var(--muted-foreground))" angle={-30} textAnchor="end" height={60} />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip content={<DashboardTooltip />} />
                  <Bar dataKey="dias" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </DashboardChartWrapper>
      )}

      {/* ── PERFORMANCE ── */}
      <div className="border-b border-border pb-2 mt-6 mb-4">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Performance</span>
      </div>

      {/* Weekly Throughput */}
      {throughputData && throughputData.data.length > 0 && (
        <CollapsibleSection title="Throughput Semanal" icon={null} defaultOpen={false}>
          <DashboardChartWrapper
            title="Throughput Semanal (últimas 12 semanas)"
            icon={<Timer className="h-3.5 w-3.5" strokeWidth={1.5} />}
            ariaLabel="Throughput semanal das últimas 12 semanas"
          >
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={throughputData.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip content={<DashboardTooltip />} />
                  <Legend fontSize={10} />
                  {throughputData.phases.map((phase, i) => (
                    <Bar key={phase} dataKey={phase} stackId="a" name={PHASE_LABELS[phase] || phase} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DashboardChartWrapper>
        </CollapsibleSection>
      )}

      {/* Lead Time by User */}
      {leadTimeData && leadTimeData.length > 0 && (
        <CollapsibleSection title="Lead Time por Colaborador" icon={null} defaultOpen={false}>
          <Card className="bg-card border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Lead Time por Colaborador (dias)
                </CardTitle>
                <Select value={leadTimePhase} onValueChange={setLeadTimePhase}>
                  <SelectTrigger className="w-[140px] h-7 text-xs">
                    <SelectValue placeholder="Todas as fases" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {['ux_po', 'dev_chatbot', 'treinamento', 'validacao', 'ativacao'].map(p => (
                      <SelectItem key={p} value={p}>{PHASE_LABELS[p] || p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isMobile ? (
                <div className="space-y-3 py-1">
                  {leadTimeData.map((entry) => (
                    <div key={entry.userName} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground truncate mr-2">{entry.userName}</span>
                        <span className="text-xs font-bold text-foreground tabular-nums shrink-0">{entry.avgDays}d</span>
                      </div>
                      <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[hsl(var(--chart-4))] transition-all"
                          style={{ width: `${Math.min(100, (entry.avgDays / Math.max(...leadTimeData.map(d => d.avgDays), 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={leadTimeData} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                      <YAxis type="category" dataKey="userName" fontSize={11} stroke="hsl(var(--muted-foreground))" width={85} />
                      <Tooltip content={<DashboardTooltip />} />
                      <Bar dataKey="avgDays" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} name="Dias" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleSection>
      )}

      {/* SLA Compliance */}
      <CollapsibleSection title="SLA Compliance" icon={null} defaultOpen={false}>
        {slaData && slaData.length > 0 && <DashboardSlaTable data={slaData} />}
      </CollapsibleSection>

      {/* Productivity Pipeline */}
      <CollapsibleSection title="Pipeline de Produtividade" icon={null} defaultOpen={false}>
        <DashboardProductivityCards uxMetrics={uxMetrics} devMetrics={devMetrics} treinamentoMetrics={treinamentoMetrics} />
      </CollapsibleSection>

      {/* Monthly Deliveries */}
      <CollapsibleSection title="Entregas do Mês" icon={null} defaultOpen>
        <DashboardDeliveriesSection month={currentMonth} year={currentYear} />
      </CollapsibleSection>

      {/* ── OPERACIONAL ── */}
      <div className="border-b border-border pb-2 mt-6 mb-4">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Operacional</span>
      </div>

      {/* Projects at Risk */}
      <DashboardRiskList projects={atRiskProjects} onSelectProject={onSelectProject} />

      {/* Activity Feed */}
      <DashboardActivityFeed activities={recentActivities || []} />

      {/* Operational Views - collapsible on mobile */}
      <CollapsibleSection title="Carga por Colaborador" icon={null} defaultOpen={false}>
        {workloadData && workloadData.length > 0 && <DashboardWorkloadGrid data={workloadData} onSelectProject={onSelectProject} />}
      </CollapsibleSection>

      <CollapsibleSection title="Projetos Estagnados" icon={null} defaultOpen={false}>
        {agingData && agingData.length > 0 && (
          <DashboardAgingList
            data={agingData}
            onSelectProject={(projectId) => {
              const project = projects.find(p => p.id === projectId);
              if (project) onSelectProject?.(project);
            }}
          />
        )}
      </CollapsibleSection>

      <KpiProjectsModal
        open={!!kpiModal}
        onOpenChange={(open) => !open && setKpiModal(null)}
        title={kpiModal?.title || ""}
        projects={kpiModal?.projects || []}
        onSelectProject={onSelectProject}
      />
    </div>
  );
}
