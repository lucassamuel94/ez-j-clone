import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications, type Notification } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Bell,
  CheckCheck,
  AtSign,
  MessageSquare,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  FolderKanban,
  Info,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

type TabFilter = 'all' | 'unread' | 'mentions';

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  reminder: {
    icon: <Calendar className="h-3.5 w-3.5" />,
    color: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
    label: 'Lembrete',
  },
  success: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    color: 'bg-success/10 text-success border-success/20',
    label: 'Sucesso',
  },
  warning: {
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    color: 'bg-warning/10 text-warning border-warning/20',
    label: 'Alerta',
  },
  error: {
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    color: 'bg-destructive/10 text-destructive border-destructive/20',
    label: 'Erro',
  },
  mention: {
    icon: <AtSign className="h-3.5 w-3.5" />,
    color: 'bg-primary/10 text-primary border-primary/20',
    label: 'Menção',
  },
  comment: {
    icon: <MessageSquare className="h-3.5 w-3.5" />,
    color: 'bg-primary/10 text-primary border-primary/20',
    label: 'Comentário',
  },
  call_analysis: {
    icon: <Info className="h-3.5 w-3.5" />,
    color: 'bg-primary/10 text-primary border-primary/20',
    label: 'Análise',
  },
  task: {
    icon: <FolderKanban className="h-3.5 w-3.5" />,
    color: 'bg-primary/10 text-primary border-primary/20',
    label: 'Tarefa',
  },
};

const DEFAULT_TYPE_CONFIG = {
  icon: <Bell className="h-3.5 w-3.5" />,
  color: 'bg-primary/10 text-primary border-primary/20',
  label: 'Notificação',
};

function isMention(n: Notification): boolean {
  return n.type === 'comment_mention' || n.type === 'mention' || n.message.includes('@');
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();
  const [tab, setTab] = useState<TabFilter>('all');

  const filtered = useMemo(() => {
    switch (tab) {
      case 'unread':
        return notifications.filter((n) => !n.read);
      case 'mentions':
        return notifications.filter(isMention);
      default:
        return notifications;
    }
  }, [notifications, tab]);

  const mentionCount = useMemo(() => notifications.filter(isMention).length, [notifications]);

  const handleClick = (notification: Notification) => {
    if (!notification.read) markAsRead(notification.id);
    if (notification.link) {
      // Fix legacy links that use / instead of /leads
      let link = notification.link;
      if (link.startsWith('/?lead=') || link.startsWith('/?filter=')) {
        link = '/leads' + link.substring(1);
      }
      navigate(link);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 flex-1 overflow-auto">
          <PageHeader
            icon={<Bell className="h-5 w-5" strokeWidth={1.5} />}
            title="Notificações"
            subtitle="Acompanhe alertas, menções e atualizações do sistema"
            actions={
              unreadCount > 0 ? (
                <Button variant="outline" size="sm" onClick={() => markAllAsRead()} className="gap-1.5 text-xs">
                  <CheckCheck className="h-3.5 w-3.5" />
                  Marcar todas como lidas
                </Button>
              ) : undefined
            }
          />

          {/* Tabs */}
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabFilter)}>
            <TabsList>
              <TabsTrigger value="all" className="gap-1.5 text-xs">
                <Bell className="h-3.5 w-3.5" />
                Todas
                {notifications.length > 0 && (
                  <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px] font-semibold">
                    {notifications.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="unread" className="gap-1.5 text-xs">
                Não lidas
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px] font-semibold bg-destructive/10 text-destructive border-destructive/20">
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="mentions" className="gap-1.5 text-xs">
                <AtSign className="h-3.5 w-3.5" />
                Menções
                {mentionCount > 0 && (
                  <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px] font-semibold">
                    {mentionCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Content */}
          {isLoading ? (
            <div className="space-y-1.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="flex items-start gap-3 px-4 py-3 shadow-sm bg-card">
                  <Skeleton className="h-8 w-8 rounded-md shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-14 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-full max-w-[320px]" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </Card>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bell className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                {tab === 'all' && 'Nenhuma notificação ainda.'}
                {tab === 'unread' && 'Todas as notificações foram lidas. 🎉'}
                {tab === 'mentions' && 'Nenhuma menção encontrada.'}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Notificações e menções aparecerão aqui
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((notification) => {
                const config = TYPE_CONFIG[notification.type] || DEFAULT_TYPE_CONFIG;
                return (
                  <Card
                    key={notification.id}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 shadow-sm transition-all cursor-pointer hover:bg-muted/30 bg-card',
                      !notification.read && 'border-primary/20',
                    )}
                    onClick={() => handleClick(notification)}
                  >
                    {/* Icon */}
                    <div className={cn('p-2 rounded-md border shrink-0 mt-0.5', config.color)}>
                      {config.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('text-sm font-semibold text-foreground', notification.read && 'font-medium')}>
                          {notification.title}
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                          {!notification.read && (
                            <div className="h-2 w-2 rounded-full bg-primary" />
                          )}
                          <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 h-4 font-medium', config.color)}>
                            {config.label}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-[11px] text-muted-foreground/60">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
