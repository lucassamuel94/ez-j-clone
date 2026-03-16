import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  Bell, CheckCheck, ClipboardCheck, Trophy, ArrowLeftRight,
  FolderPlus, AlertTriangle, Phone, FileSearch, RotateCcw, AtSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'task_assigned':
    case 'task_completed':
      return ClipboardCheck;
    case 'opportunity_won':
      return Trophy;
    case 'lead_returned':
      return ArrowLeftRight;
    case 'project_assigned':
      return FolderPlus;
    case 'overdue_lead':
      return AlertTriangle;
    case 'call_analysis':
      return Phone;
    case 'api_analysis':
      return FileSearch;
    case 'comment_mention':
      return AtSign;
    case 'reminder':
      return RotateCcw;
    default:
      return Bell;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'task_assigned':
    case 'project_assigned':
      return 'bg-chart-1/10 border-chart-1/30 text-chart-1';
    case 'task_completed':
    case 'opportunity_won':
      return 'bg-chart-3/10 border-chart-3/30 text-chart-3';
    case 'overdue_lead':
    case 'reminder':
      return 'bg-chart-4/10 border-chart-4/30 text-chart-4';
    case 'comment_mention':
      return 'bg-chart-2/10 border-chart-2/30 text-chart-2';
    case 'lead_returned':
      return 'bg-chart-5/10 border-chart-5/30 text-chart-5';
    case 'call_analysis':
    case 'api_analysis':
      return 'bg-primary/10 border-primary/30 text-primary';
    default:
      return 'bg-primary/10 border-primary/30 text-primary';
  }
};

interface GroupedNotifications {
  label: string;
  items: Notification[];
}

function groupByDate(notifications: Notification[]): GroupedNotifications[] {
  const groups: GroupedNotifications[] = [];
  const todayItems: Notification[] = [];
  const yesterdayItems: Notification[] = [];
  const olderItems: Notification[] = [];

  for (const n of notifications) {
    const date = new Date(n.created_at);
    if (isToday(date)) todayItems.push(n);
    else if (isYesterday(date)) yesterdayItems.push(n);
    else olderItems.push(n);
  }

  if (todayItems.length) groups.push({ label: 'Hoje', items: todayItems });
  if (yesterdayItems.length) groups.push({ label: 'Ontem', items: yesterdayItems });
  if (olderItems.length) groups.push({ label: 'Anteriores', items: olderItems });

  return groups;
}

export const NotificationCenter = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const { notifications, unreadCount, markAsRead, markAllAsRead, isError } = useNotifications();

  const handleClose = useCallback(() => setOpen(false), []);

  const grouped = useMemo(() => groupByDate(notifications), [notifications]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button data-notification-trigger variant="ghost" size="icon" className="relative h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-card animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notificações</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsRead()}
              className="text-xs h-7"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Marcar todas como lidas
            </Button>
          )}
        </div>

        <ScrollArea className="h-80">
          {isError ? (
            <div className="p-8 text-center text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Erro ao carregar notificações</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma notificação</p>
            </div>
          ) : (
            <div>
              {grouped.map((group) => (
                <div key={group.label}>
                  <div className="px-4 py-1.5 bg-muted/30 sticky top-0 z-10">
                    <span className="text-xs font-medium text-muted-foreground">{group.label}</span>
                  </div>
                  <div className="divide-y">
                    {group.items.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onMarkAsRead={markAsRead}
                        onNavigate={navigate}
                        onClose={handleClose}
                        location={location}
                        setSearchParams={setSearchParams}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onNavigate: (path: string) => void;
  onClose: () => void;
  location: ReturnType<typeof useLocation>;
  setSearchParams: ReturnType<typeof useSearchParams>[1];
}

const NotificationItem = ({ notification, onMarkAsRead, onNavigate, onClose, location, setSearchParams }: NotificationItemProps) => {
  const Icon = getNotificationIcon(notification.type);
  const typeColor = getTypeColor(notification.type);

  const handleClick = () => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    if (notification.link) {
      try {
        let link = notification.link;
        if (link.startsWith('/?lead=') || link.startsWith('/?filter=')) {
          link = '/leads' + link.substring(1);
        }
        const url = new URL(link, window.location.origin);
        const leadId = url.searchParams.get('lead');
        if (location.pathname === '/leads' && leadId) {
          setSearchParams({ lead: leadId });
        } else {
          onNavigate(link);
        }
        onClose();
      } catch (e) {
        console.warn('Invalid notification link:', notification.link);
      }
    }
  };

  return (
    <div
      className={cn(
        'p-3 hover:bg-muted/50 transition-colors cursor-pointer',
        !notification.read && 'bg-primary/5'
      )}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <div className={cn('p-1.5 rounded-md border', typeColor)}>
          <Icon className="h-3 w-3" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn('text-sm font-medium', !notification.read && 'text-foreground')}>
              {notification.title}
            </p>
            {!notification.read && (
              <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.message}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            {formatDistanceToNow(new Date(notification.created_at), {
              addSuffix: true,
              locale: ptBR,
            })}
          </p>
        </div>
      </div>
    </div>
  );
};
