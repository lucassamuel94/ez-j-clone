import { Building2 } from 'lucide-react';

export function GeneralSection() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground font-display">Geral</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Informações do espaço de trabalho e configurações gerais.
        </p>
      </div>

      <div className="rounded-lg border border-border/40 bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">EZ Soft</p>
            <p className="text-xs text-muted-foreground">Espaço de trabalho principal</p>
          </div>
        </div>
      </div>
    </div>
  );
}
