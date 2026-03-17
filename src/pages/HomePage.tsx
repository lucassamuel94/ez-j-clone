import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useMyTasks } from '@/hooks/useMyTasks';
import { useMyProjects } from '@/hooks/useMyProjects';
import { useNotifications } from '@/hooks/useNotifications';
import { useDashboardCounts } from '@/hooks/useDashboardCounts';
import { usePermissions } from '@/hooks/usePermissions';

import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Bell, ListTodo, Calendar, Inbox, Handshake, FolderKanban,
  ArrowRight, Clock, AlertCircle, Sparkles,
} from 'lucide-react';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { isTaskCompleted } from '@/utils/taskStatus';
import { PageHeader } from '@/components/PageHeader';

const QUOTES = [
  { text: "O sucesso em vendas não é sobre o que você vende, mas sobre como você faz o cliente se sentir.", author: "Zig Ziglar" },
  { text: "Pessoas não compram produtos, compram versões melhores de si mesmas.", author: "Seth Godin" },
  { text: "O segredo do sucesso é a constância do propósito.", author: "Benjamin Disraeli" },
  { text: "A persistência é o caminho do êxito.", author: "Charlie Chaplin" },
  { text: "Cada 'não' te aproxima de um 'sim'.", author: "Mark Cuban" },
  { text: "O melhor vendedor não é o que fala mais, é o que escuta melhor.", author: "Dale Carnegie" },
  { text: "Disciplina é escolher entre o que você quer agora e o que você quer mais.", author: "Abraham Lincoln" },
  { text: "Sua atitude, não sua aptidão, determinará sua altitude.", author: "Zig Ziglar" },
  { text: "Grandes resultados requerem grandes ambições.", author: "Heráclito" },
  { text: "A excelência não é um destino, é uma jornada contínua.", author: "Aristóteles" },
  { text: "Oportunidades não acontecem, você as cria.", author: "Chris Grosser" },
  { text: "O fracasso é simplesmente a oportunidade de começar de novo, desta vez de forma mais inteligente.", author: "Henry Ford" },
];

function safeParseISO(v: any) {
  if (!v || typeof v !== 'string') return null;
  try { return parseISO(v); } catch { return null; }
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

interface QuickCard {
  to: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  stat?: string | number;
  statLabel?: string;
  accent: string;
  visible: boolean;
}

// ── Skeleton ──
function HomeSkeleton() {
  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-[1400px] mx-auto">
        <div className="space-y-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border/40 bg-card p-5 space-y-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-40" />
                <div className="pt-3 border-t border-border/20">
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function HomePage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const { data: tasks, isLoading: tasksLoading } = useMyTasks();
  const { notifications, unreadCount, isLoading: notifsLoading } = useNotifications();
  const { data: counts } = useDashboardCounts();
  const { hasPermission } = usePermissions();
  const { data: myProjects = [] } = useMyProjects();

  const isLoading = userLoading || tasksLoading || notifsLoading;

  const quote = useMemo(() => QUOTES[Math.floor(Math.random() * QUOTES.length)], []);

  const canAccessCommercial = hasPermission('view_sdr_leads') || hasPermission('view_closer_pipeline');
  const canAccessProjects = hasPermission('view_projects');

  const pendingTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter((t) => !isTaskCompleted(t)).sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
  }, [tasks]);

  const overdueTasks = pendingTasks.filter((t) => {
    const d = safeParseISO(t.due_date);
    return d && isPast(d) && !isToday(d);
  });
  const todayTasks = pendingTasks.filter((t) => {
    const d = safeParseISO(t.due_date);
    return d && isToday(d);
  });

  const newLeadsCount = counts?.newLeadsCount ?? 0;
  const activeOppsCount = counts?.activeOppsCount ?? 0;
  const firstName = user?.name?.split(' ')[0] || 'Usuário';

  if (isLoading) return <HomeSkeleton />;

  // ── Quick access cards ──
  const cards: QuickCard[] = [
    {
      to: '/notifications',
      icon: <Bell className="h-5 w-5" />,
      label: 'Notificações',
      description: 'Acompanhe alertas e atualizações',
      stat: unreadCount,
      statLabel: unreadCount === 1 ? 'não lida' : 'não lidas',
      accent: 'text-warning bg-warning/10',
      visible: true,
    },
    {
      to: '/tasks',
      icon: <ListTodo className="h-5 w-5" />,
      label: 'Minhas Tarefas',
      description: 'Gerencie suas atividades pendentes',
      stat: pendingTasks.length,
      statLabel: pendingTasks.length === 1 ? 'pendente' : 'pendentes',
      accent: 'text-primary bg-accent dark:bg-primary/10',
      visible: true,
    },
    {
      to: '/calendar',
      icon: <Calendar className="h-5 w-5" />,
      label: 'Calendário',
      description: 'Visualize reuniões e compromissos',
      stat: todayTasks.length,
      statLabel: 'para hoje',
      accent: 'text-primary bg-primary/10',
      visible: true,
    },
    {
      to: '/leads',
      icon: <Inbox className="h-5 w-5" />,
      label: 'Leads SDR',
      description: 'Acompanhe seus leads e prospecções',
      stat: newLeadsCount,
      statLabel: newLeadsCount === 1 ? 'lead novo' : 'leads novos',
      accent: 'text-success bg-success/10',
      visible: canAccessCommercial,
    },
    {
      to: '/closer',
      icon: <Handshake className="h-5 w-5" />,
      label: 'Oportunidades',
      description: 'Gerencie o pipeline de fechamento',
      stat: activeOppsCount,
      statLabel: activeOppsCount === 1 ? 'ativa' : 'ativas',
      accent: 'text-warning bg-warning/10',
      visible: canAccessCommercial,
    },
    {
      to: '/projects',
      icon: <FolderKanban className="h-5 w-5" />,
      label: 'Projetos',
      description: 'Acompanhe a gestão de projetos',
      accent: 'text-info bg-info/10',
      visible: canAccessProjects,
    },
  ];

  const visibleCards = cards.filter((c) => c.visible);

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        <div className="p-4 sm:p-6 lg:p-8 space-y-8 flex-1 max-w-[1400px] mx-auto w-full">
          <PageHeader
            title={`${getGreeting()}, ${firstName} 👋`}
            subtitle="Aqui está o resumo do seu espaço de trabalho."
          />

          {/* ── Alert banner ── */}
          {overdueTasks.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-destructive/20 bg-destructive/5">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-xs font-medium text-destructive">
                {overdueTasks.length} {overdueTasks.length === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}
              </p>
            </div>
          )}

          {/* ── Quote (subtle) ── */}
          <div className="flex items-start gap-3 px-1">
            <Sparkles className="h-3.5 w-3.5 text-primary/40 mt-0.5 shrink-0" />
            <p className="text-xs italic text-muted-foreground/60 leading-relaxed">
              "{quote.text}" — <span className="font-medium">{quote.author}</span>
            </p>
          </div>

          {/* ── Quick Access ── */}
          <div>
            <div className="px-0.5 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                Acesso Rápido
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visibleCards.map((card) => (
                <Link
                  key={card.to + card.label}
                  to={card.to}
                  className="group rounded-xl border border-border/40 bg-card p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', card.accent)}>
                      {card.icon}
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-foreground">{card.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{card.description}</p>
                  </div>
                  {card.stat !== undefined && (
                    <div className="mt-4 pt-3 border-t border-border/20">
                      <p className="text-lg font-bold text-foreground leading-none">
                        {card.stat}
                        <span className="text-xs font-medium text-muted-foreground ml-1.5">
                          {card.statLabel}
                        </span>
                      </p>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* ── Upcoming tasks ── */}
          {pendingTasks.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-0.5 pb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                  Próximas Tarefas
                </span>
                <Link to="/tasks" className="text-xs font-medium text-primary hover:underline">
                  Ver todas
                </Link>
              </div>
              <div className="rounded-xl border border-border/40 bg-card shadow-sm divide-y divide-border/20">
                {pendingTasks.slice(0, 5).map((task) => {
                  const d = safeParseISO(task.due_date);
                  const isOverdue = d && isPast(d) && !isToday(d);
                  const isDueToday = d && isToday(d);
                  return (
                    <div key={task.id} className="flex items-center gap-3 px-5 py-3.5">
                      <div className={cn(
                        'h-2 w-2 rounded-full shrink-0',
                        isOverdue ? 'bg-destructive' : isDueToday ? 'bg-warning' : 'bg-muted-foreground/30',
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{task.project_company_name}</p>
                      </div>
                      {d && (
                        <div className={cn(
                          'flex items-center gap-1 text-xs font-medium shrink-0',
                          isOverdue ? 'text-destructive' : isDueToday ? 'text-warning' : 'text-muted-foreground',
                        )}>
                          <Clock className="h-3 w-3" />
                          {isOverdue
                            ? 'Atrasada'
                            : isDueToday
                              ? 'Hoje'
                              : isTomorrow(d)
                                ? 'Amanhã'
                                : format(d, "dd MMM", { locale: ptBR })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── My Projects ── */}
          {canAccessProjects && myProjects.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-0.5 pb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                  Meus Projetos
                </span>
                <Link to="/projects" className="text-xs font-medium text-primary hover:underline">
                  Ver todos
                </Link>
              </div>
              <div className="rounded-xl border border-border/40 bg-card shadow-sm divide-y divide-border/20">
                {myProjects.slice(0, 8).map((project) => {
                  const d = safeParseISO(project.due_date);
                  const isOverdue = d && isPast(d) && !isToday(d);
                  const isDueToday = d && isToday(d);
                  const isHighPriority = project.priority === 'alta' || project.priority === 'urgente';
                  return (
                    <Link
                      key={project.id}
                      to="/projects"
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-accent/50 transition-colors"
                    >
                      <div className={cn(
                        'h-2 w-2 rounded-full shrink-0',
                        isOverdue ? 'bg-destructive' : isDueToday ? 'bg-warning' : 'bg-muted-foreground/30',
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{project.company_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {project.project_type}
                          {project.current_phase && ` · ${project.current_phase}`}
                        </p>
                      </div>
                      {isHighPriority && (
                        <Badge
                          variant={project.priority === 'urgente' ? 'destructive' : 'secondary'}
                          className="text-[10px] shrink-0"
                        >
                          {project.priority === 'urgente' ? 'Urgente' : 'Alta'}
                        </Badge>
                      )}
                      {d && (
                        <div className={cn(
                          'flex items-center gap-1 text-xs font-medium shrink-0',
                          isOverdue ? 'text-destructive' : isDueToday ? 'text-warning' : 'text-muted-foreground',
                        )}>
                          <Clock className="h-3 w-3" />
                          {isOverdue
                            ? 'Atrasado'
                            : isDueToday
                              ? 'Hoje'
                              : isTomorrow(d)
                                ? 'Amanhã'
                                : format(d, "dd MMM", { locale: ptBR })}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
