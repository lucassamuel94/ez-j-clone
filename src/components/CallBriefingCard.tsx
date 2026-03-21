import { useCallBriefing, CallBriefing } from '@/hooks/useCallBriefing';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Sparkles, Loader2, Target, AlertCircle, Lightbulb, Clock, HelpCircle } from 'lucide-react';

interface CallBriefingCardProps {
  lead: Record<string, unknown>;
  interactions?: Record<string, unknown>[];
  callHistory?: Record<string, unknown>[];
}

const priorityStyles: Record<string, string> = {
  'Alta': 'bg-destructive/10 text-destructive border-destructive/20',
  'Média': 'bg-warning/10 text-warning border-warning/20',
  'Baixa': 'bg-success/10 text-success border-success/20',
};

export function CallBriefingCard({ lead, interactions, callHistory }: CallBriefingCardProps) {
  const { briefing, generate, isLoading } = useCallBriefing();

  if (!briefing) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2 border-dashed border-primary/30 hover:border-primary/50 hover:bg-primary/5"
        onClick={() => generate.mutate({ lead, interactions, callHistory })}
        disabled={isLoading}
      >
        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-primary" />}
        {isLoading ? 'Gerando briefing...' : 'Gerar Briefing Pré-Call'}
      </Button>
    );
  }

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardContent className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Briefing Pré-Call</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={cn('text-[10px] h-5', priorityStyles[briefing.nivel_prioridade] || '')}>
              {briefing.nivel_prioridade}
            </Badge>
            <Badge variant="outline" className="text-[10px] h-5">
              <Clock className="h-3 w-3 mr-0.5" />
              {briefing.tempo_estimado}
            </Badge>
          </div>
        </div>

        {/* Contexto */}
        <p className="text-xs text-muted-foreground leading-relaxed">{briefing.contexto_empresa}</p>

        {/* Histórico */}
        <div className="text-xs">
          <span className="font-medium text-foreground">Histórico: </span>
          <span className="text-muted-foreground">{briefing.historico_resumo}</span>
        </div>

        <Separator />

        {/* Estratégia de abertura */}
        <div className="flex items-start gap-2 p-2 rounded-md bg-primary/5 border border-primary/10">
          <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-foreground">{briefing.estrategia_abertura}</p>
        </div>

        {/* Pontos fortes */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Target className="h-3 w-3 text-success" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pontos Fortes</span>
          </div>
          <ul className="space-y-1">
            {briefing.pontos_fortes.map((ponto, i) => (
              <li key={i} className="text-xs text-muted-foreground pl-4 relative before:content-['•'] before:absolute before:left-1 before:text-success">
                {ponto}
              </li>
            ))}
          </ul>
        </div>

        {/* Objeções */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertCircle className="h-3 w-3 text-warning" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Objeções Previstas</span>
          </div>
          <ul className="space-y-1">
            {briefing.objecoes_previstas.map((obj, i) => (
              <li key={i} className="text-xs text-muted-foreground pl-4 relative before:content-['•'] before:absolute before:left-1 before:text-warning">
                {obj}
              </li>
            ))}
          </ul>
        </div>

        {/* Perguntas chave */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <HelpCircle className="h-3 w-3 text-info" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Perguntas Chave</span>
          </div>
          <ol className="space-y-1">
            {briefing.perguntas_chave.map((pergunta, i) => (
              <li key={i} className="text-xs text-muted-foreground pl-4">
                <span className="text-foreground font-medium">{i + 1}.</span> {pergunta}
              </li>
            ))}
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
