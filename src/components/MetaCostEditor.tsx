import { memo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import type { MetaCostConfig, MetaCostEntry } from '@/hooks/useSimulator';

interface MetaCostEditorProps {
  metaConfig: MetaCostConfig;
  showMetaCosts: boolean;
  onShowMetaCostsChange: (v: boolean) => void;
  localPercentages: Record<string, number>;
  onPercentageChange: (name: string, value: number) => void;
  compact?: boolean;
}

export const MetaCostEditor = memo(function MetaCostEditor({
  metaConfig,
  showMetaCosts,
  onShowMetaCostsChange,
  localPercentages,
  onPercentageChange,
  compact = false,
}: MetaCostEditorProps) {
  const totalPct = metaConfig.entries.reduce(
    (sum, e) => sum + (localPercentages[e.name] ?? e.percentage),
    0,
  );
  const isValid = Math.abs(totalPct - 100) < 0.01;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            id="show-meta-costs"
            checked={showMetaCosts}
            onCheckedChange={onShowMetaCostsChange}
          />
          <Label htmlFor="show-meta-costs" className={compact ? 'text-xs' : 'text-sm'}>
            Incluir custos Meta na proposta
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                Quando desativado, a proposta enviada ao cliente não exibirá a estimativa de custos Meta WhatsApp.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {!isValid && (
          <Badge variant="destructive" className="text-[10px]">
            Total: {totalPct.toFixed(0)}% (deve ser 100%)
          </Badge>
        )}
      </div>

      {showMetaCosts && (
        <div className={`grid gap-2 ${compact ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-4'}`}>
          {metaConfig.entries.map((entry) => {
            const value = localPercentages[entry.name] ?? entry.percentage;
            return (
              <div key={entry.name} className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">{entry.name} (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={value}
                  onChange={(e) =>
                    onPercentageChange(entry.name, Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))
                  }
                  className="h-8 text-sm"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
