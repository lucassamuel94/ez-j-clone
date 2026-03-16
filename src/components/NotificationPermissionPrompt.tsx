import { useState, useEffect, useCallback } from 'react';
import { Bell, X, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const isNotificationSupported = () => 'Notification' in window;

const requestBrowserPermission = async (): Promise<boolean> => {
  if (!isNotificationSupported()) return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
};

interface NotificationPermissionPromptProps {
  forceShow?: boolean;
}

export const NotificationPermissionPrompt = ({ forceShow = false }: NotificationPermissionPromptProps) => {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const supported = isNotificationSupported();

  useEffect(() => {
    if (supported) setPermission(Notification.permission);
  }, [supported]);

  useEffect(() => {
    const hasBeenPrompted = localStorage.getItem('notification-prompt-dismissed');
    if (supported && permission === 'default' && !hasBeenPrompted) {
      const timer = setTimeout(() => setOpen(true), 2000);
      return () => clearTimeout(timer);
    }
    if (forceShow && supported && permission !== 'granted') {
      setOpen(true);
    }
  }, [supported, permission, forceShow]);

  const handleEnable = useCallback(async () => {
    const granted = await requestBrowserPermission();
    setPermission(Notification.permission);
    if (granted) {
      toast.success('Notificações ativadas com sucesso!');
      setOpen(false);
    } else {
      toast.error('Permissão negada. Você pode ativar nas configurações do navegador.');
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setOpen(false);
    localStorage.setItem('notification-prompt-dismissed', Date.now().toString());
  }, []);

  useEffect(() => {
    const dismissedAt = localStorage.getItem('notification-prompt-dismissed');
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt);
      if (elapsed > 24 * 60 * 60 * 1000) {
        localStorage.removeItem('notification-prompt-dismissed');
      }
    }
  }, []);

  if (!supported || permission === 'granted' || dismissed) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <BellRing className="h-8 w-8 text-primary animate-pulse" />
          </div>
          <DialogTitle className="text-xl">Ative as Notificações</DialogTitle>
          <DialogDescription className="text-center">
            Receba alertas importantes sobre seus leads, como lembretes de retorno e novas oportunidades.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="grid gap-3">
            {[
              { title: 'Lembretes de Retorno', desc: 'Receba alertas quando for hora de entrar em contato com um lead' },
              { title: 'Novos Leads', desc: 'Seja notificado quando novos leads forem atribuídos a você' },
              { title: 'Reuniões Agendadas', desc: 'Lembretes antes de suas reuniões com clientes' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={handleEnable} className="w-full">
              <Bell className="h-4 w-4 mr-2" />
              Ativar Notificações
            </Button>
            <Button variant="ghost" onClick={handleDismiss} className="w-full text-muted-foreground">
              Lembrar depois
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const NotificationBanner = () => {
  const [visible, setVisible] = useState(false);
  const supported = isNotificationSupported();
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (supported) setPermission(Notification.permission);
  }, [supported]);

  useEffect(() => {
    if (supported && permission === 'default') {
      const dismissed = localStorage.getItem('notification-banner-dismissed');
      if (!dismissed) setVisible(true);
    }
  }, [supported, permission]);

  const handleEnable = useCallback(async () => {
    const granted = await requestBrowserPermission();
    setPermission(Notification.permission);
    if (granted) {
      toast.success('Notificações ativadas!');
      setVisible(false);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem('notification-banner-dismissed', 'true');
  }, []);

  if (!visible || permission === 'granted') return null;

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2">
      <div className="container mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BellRing className="h-4 w-4 text-primary animate-pulse" />
          <p className="text-sm">
            <span className="font-medium">Ative as notificações</span>
            <span className="text-muted-foreground hidden sm:inline"> para não perder nenhum lead importante</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleEnable}>Ativar</Button>
          <Button size="sm" variant="ghost" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
