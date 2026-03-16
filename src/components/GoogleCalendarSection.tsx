import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';

export const GoogleCalendarSection = () => {
  const { isConnected, isLoading, isConnecting, connect, disconnect } = useGoogleCalendar();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Google Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
          {isConnected ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Conectado</p>
                <p className="text-xs text-muted-foreground">
                  Seus eventos do Google Calendar estão sincronizados
                </p>
              </div>
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Não conectado</p>
                <p className="text-xs text-muted-foreground">
                  Conecte para consultar e criar eventos
                </p>
              </div>
            </>
          )}
        </div>

        {isConnected ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
            onClick={disconnect}
          >
            Desconectar Google Calendar
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full"
            onClick={connect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Conectar Google Calendar
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
