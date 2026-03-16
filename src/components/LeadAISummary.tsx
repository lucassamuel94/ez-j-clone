import { useState, useEffect, useCallback } from 'react';
import { Lead } from '@/types/lead';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, Loader2, RefreshCw, Clock, TrendingUp, Target, Zap, MessageSquare, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface AISummary {
  tempo_mercado: string;
  segmento: string;
  necessidade_automacao: string;
  potencial: string;
  sugestao_abordagem: string;
  prioridade: string;
}

interface LeadAISummaryProps {
  lead: Lead;
  onUpdateLead?: (lead: Lead) => void;
}

const SUMMARY_FIELDS = [
  { key: 'tempo_mercado', label: 'Tempo de mercado', icon: <Clock className="h-3.5 w-3.5" /> },
  { key: 'segmento', label: 'Segmento', icon: <Target className="h-3.5 w-3.5" /> },
  { key: 'necessidade_automacao', label: 'Necessidade de automação', icon: <Zap className="h-3.5 w-3.5" /> },
  { key: 'potencial', label: 'Potencial estimado', icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { key: 'sugestao_abordagem', label: 'Sugestão de abordagem', icon: <MessageSquare className="h-3.5 w-3.5" /> },
  { key: 'prioridade', label: 'Prioridade sugerida', icon: <AlertCircle className="h-3.5 w-3.5" /> },
];

const getPotentialColor = (potencial: string) => {
  const lower = potencial.toLowerCase();
  if (lower.includes('alto')) return 'bg-success/10 text-success border-success/20';
  if (lower.includes('méd') || lower.includes('med')) return 'bg-warning/10 text-warning border-warning/20';
  return 'bg-destructive/10 text-destructive border-destructive/20';
};

const getPriorityColor = (prioridade: string) => {
  const lower = prioridade.toLowerCase();
  if (lower.includes('alta')) return 'bg-destructive/10 text-destructive border-destructive/20';
  if (lower.includes('méd') || lower.includes('med')) return 'bg-warning/10 text-warning border-warning/20';
  return 'bg-muted text-muted-foreground border-border';
};

export const LeadAISummary = ({ lead, onUpdateLead }: LeadAISummaryProps) => {
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasAttempted, setHasAttempted] = useState(false);

  const hasData = lead.cnpj || lead.company || lead.razao_social;

  const generateSummary = useCallback(async () => {
    if (!hasData || isLoading) return;
    setIsLoading(true);
    setHasAttempted(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-ai-summary', {
        body: { lead },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      
      setSummary(data.summary);
    } catch (e) {
      console.error('Error generating AI summary:', e);
      toast.error('Erro ao gerar resumo da IA');
    } finally {
      setIsLoading(false);
    }
  }, [lead.id, hasData]);

  // Auto-generate on mount if company data exists
  useEffect(() => {
    if (hasData && !summary && !hasAttempted) {
      generateSummary();
    }
  }, [hasData, summary, hasAttempted, generateSummary]);

  if (!hasData) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Sparkles className="h-5 w-5 mx-auto mb-1 opacity-50" />
        <p className="text-xs">Preencha os dados da empresa para gerar o resumo inteligente.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 flex flex-col items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p className="text-xs">Analisando empresa...</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-4 text-center">
        <button
          onClick={generateSummary}
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Gerar resumo inteligente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">Resumo IA</span>
        </div>
        <button
          onClick={generateSummary}
          disabled={isLoading}
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      <div className="grid gap-2">
        {SUMMARY_FIELDS.map(({ key, label, icon }) => {
          const value = summary[key as keyof AISummary];
          if (!value) return null;

          const isBadgeField = key === 'potencial' || key === 'prioridade';

          return (
            <div key={key} className="flex items-start gap-2 text-xs">
              <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-muted-foreground">{label}: </span>
                {isBadgeField ? (
                  <Badge variant="outline" className={cn(
                    "text-[10px] h-5 ml-1",
                    key === 'potencial' ? getPotentialColor(value) : getPriorityColor(value)
                  )}>
                    {value}
                  </Badge>
                ) : (
                  <span className="text-foreground">{value}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
