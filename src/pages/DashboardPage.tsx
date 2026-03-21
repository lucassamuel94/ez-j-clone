import { AppLayout } from '@/components/AppLayout';
import { Link } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNotifications } from '@/hooks/useNotifications';
import { useMyTasks } from '@/hooks/useMyTasks';
import { useDashboardCounts } from '@/hooks/useDashboardCounts';
import { usePermissions } from '@/hooks/usePermissions';

import {
  Bell,
  ListTodo,
  Calendar,
  Inbox,
  Handshake,
  FolderKanban,
  ArrowRight,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { isTaskCompleted } from '@/utils/taskStatus';
import { DailyBriefingCard } from '@/components/DailyBriefingCard';
import { useUserRole } from '@/hooks/useUserRole';

interface QuickCard {
  to: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  stat?: string | number;
  statLabel?: string;
  accent?: string;
  visible: boolean;
}

export default function DashboardPage() {
  const { user } = useCurrentUser();
  const { unreadCount } = useNotifications();
  const { data: tasks = [] } = useMyTasks();
  const { data: counts } = useDashboardCounts();
  const { hasPermission } = usePermissions();
  const { role } = useUserRole();

  const canAccessCommercial = hasPermission('view_sdr_leads') || hasPermission('view_closer_pipeline');
  const canAccessProjects = hasPermission('view_projects');

  const pendingTasks = tasks.filter((t) => !isTaskCompleted(t));
  const overdueTasks = pendingTasks.filter(t => t.due_date && typeof t.due_date === 'string' && isPast(parseISO(t.due_date)));
  const todayTasks = pendingTasks.filter(t => t.due_date && typeof t.due_date === 'string' && isToday(parseISO(t.due_date)));

  const newLeadsCount = counts?.newLeadsCount ?? 0;
  const activeOppsCount = counts?.activeOppsCount ?? 0;

  const firstName = user?.name?.split(' ')[0] || 'Usuário';

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

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
      accent: 'text-info bg-info/10',
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
      to: '/',
      icon: <Inbox className="h-5 w-5" />,
      label: 'Leads SDR',
      description: 'Acompanhe seus leads e prospecções',
      stat: newLeadsCount,
      statLabel: newLeadsCount === 1 ? 'lead novo' : 'leads novos',
      accent: 'text-success bg-success/15 dark:bg-success/15 dark:text-success',
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
      accent: 'text-primary bg-primary/10',
      visible: canAccessProjects,
    },
  ];

  const visibleCards = cards.filter(c => c.visible);

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        <div className="p-6 lg:p-8 space-y-8 flex-1 overflow-auto">
          <PageHeader
            title={`${greeting}, ${firstName} 👋`}
            subtitle="Aqui está o resumo do seu espaço de trabalho."
          />

          {/* Daily AI Briefing */}
          <DailyBriefingCard
            role={role || 'sdr'}
            stats={{
              hotLeads: 0,
              pendingReturns: 0,
              scheduledMeetings: 0,
              activeOpps: activeOppsCount,
              stuckDeals: 0,
              pendingTasks: pendingTasks.length,
              overdueItems: overdueTasks.length,
            }}
          />

          {/* Alert bar */}
          {overdueTasks.length > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-destructive/20 bg-destructive/5">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-xs font-medium text-destructive">
                {overdueTasks.length} {overdueTasks.length === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}
              </p>
            </div>
          )}

          {/* Quick Access Cards */}
          <div>
            <div className="px-0.5 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                Acesso Rápido
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleCards.map((card) => (
                <Link
                  key={card.to + card.label}
                  to={card.to}
                  className="group rounded-lg border border-border/40 bg-card p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', card.accent)}>
                      {card.icon}
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-foreground">{card.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{card.description}</p>
                  </div>
                  {card.stat !== undefined && (
                    <div className="mt-3 pt-3 border-t border-border/30">
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

          {/* Upcoming tasks */}
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
              <div className="rounded-lg border border-border/40 bg-card shadow-sm divide-y divide-border/30">
                {pendingTasks.slice(0, 5).map((task) => {
                  const isOverdue = task.due_date && isPast(parseISO(task.due_date));
                  const isDueToday = task.due_date && isToday(parseISO(task.due_date));
                  return (
                    <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                      <div className={cn(
                        'h-2 w-2 rounded-full shrink-0',
                        isOverdue ? 'bg-destructive' : isDueToday ? 'bg-warning' : 'bg-muted-foreground/30',
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{task.project_company_name}</p>
                      </div>
                      {task.due_date && (
                        <div className={cn(
                          'flex items-center gap-1 text-xs font-medium shrink-0',
                          isOverdue ? 'text-destructive' : isDueToday ? 'text-warning' : 'text-muted-foreground',
                        )}>
                          <Clock className="h-3 w-3" />
                          {isOverdue
                            ? 'Atrasada'
                            : isDueToday
                              ? 'Hoje'
                              : isTomorrow(parseISO(task.due_date))
                                ? 'Amanhã'
                                : format(parseISO(task.due_date), "dd MMM", { locale: ptBR })}
                        </div>
                      )}
                    </div>
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
