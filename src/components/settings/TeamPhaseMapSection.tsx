import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTeams } from '@/hooks/useTeams';
import { ALL_PHASES, PHASE_LABELS } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PhaseMapping {
  id: string;
  team_id: string;
  phase_name: string;
}

export function TeamPhaseMapSection() {
  const queryClient = useQueryClient();
  const { teams, isLoading: isLoadingTeams } = useTeams();
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedPhase, setSelectedPhase] = useState<string>('');

  const { data: mappings = [], isLoading: isLoadingMappings } = useQuery({
    queryKey: ['team-phase-map'],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as Record<string, Function>)
        .from('team_phase_map')
        .select('id, team_id, phase_name') as { data: PhaseMapping[] | null; error: unknown };
      if (error) throw error;
      return (data ?? []) as PhaseMapping[];
    },
  });

  const addMapping = useMutation({
    mutationFn: async ({ teamId, phaseName }: { teamId: string; phaseName: string }) => {
      const { error } = await (supabase as unknown as Record<string, Function>)
        .from('team_phase_map')
        .insert({ team_id: teamId, phase_name: phaseName }) as { error: unknown };
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-phase-map'] });
      setSelectedPhase('');
      toast.success('Mapeamento adicionado');
    },
    onError: () => toast.error('Erro ao adicionar mapeamento'),
  });

  const removeMapping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as unknown as Record<string, Function>)
        .from('team_phase_map')
        .delete()
        .eq('id', id) as { error: unknown };
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-phase-map'] });
      toast.success('Mapeamento removido');
    },
    onError: () => toast.error('Erro ao remover'),
  });

  const groupedByTeam = useMemo(() => {
    const map = new Map<string, PhaseMapping[]>();
    mappings.forEach((m) => {
      const arr = map.get(m.team_id) ?? [];
      arr.push(m);
      map.set(m.team_id, arr);
    });
    return map;
  }, [mappings]);

  const handleAdd = useCallback(() => {
    if (!selectedTeam || !selectedPhase) return;
    addMapping.mutate({ teamId: selectedTeam, phaseName: selectedPhase });
  }, [selectedTeam, selectedPhase, addMapping]);

  if (isLoadingTeams || isLoadingMappings) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-base font-semibold">Mapeamento Equipe → Fases</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Define quais fases de projeto cada equipe pode visualizar na aba "Minha Fila".
        </p>
      </div>

      {/* Add form */}
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Equipe</label>
          <Select value={selectedTeam} onValueChange={setSelectedTeam}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Selecionar equipe" />
            </SelectTrigger>
            <SelectContent>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Fase</label>
          <Select value={selectedPhase} onValueChange={setSelectedPhase}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Selecionar fase" />
            </SelectTrigger>
            <SelectContent>
              {ALL_PHASES.map((p) => (
                <SelectItem key={p} value={p} className="text-xs">{PHASE_LABELS[p] ?? p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="h-8 gap-1 text-xs" onClick={handleAdd} disabled={!selectedTeam || !selectedPhase}>
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </Button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {teams.map((team) => {
          const teamMappings = groupedByTeam.get(team.id) ?? [];
          if (!teamMappings.length) return null;
          return (
            <div key={team.id} className="border border-border rounded-xl p-3 space-y-2">
              <h4 className="text-xs font-semibold">{team.name}</h4>
              <div className="flex flex-wrap gap-1.5">
                {teamMappings.map((m) => (
                  <Badge
                    key={m.id}
                    variant="outline"
                    className={cn('text-[10px] gap-1 pr-1 cursor-default')}
                  >
                    {PHASE_LABELS[m.phase_name] ?? m.phase_name}
                    <button
                      onClick={() => removeMapping.mutate(m.id)}
                      className="ml-0.5 hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          );
        })}
        {!mappings.length && (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhum mapeamento configurado.</p>
        )}
      </div>
    </div>
  );
}
