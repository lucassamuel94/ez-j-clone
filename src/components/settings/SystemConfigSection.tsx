import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Save, Settings } from 'lucide-react';
import { useSystemConfig, useUpdateSystemConfig } from '@/hooks/useSystemConfig';
import { useSystemUsers } from '@/hooks/useSystemUsers';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

function useHeadPosVendaUsers() {
  const { data: allUsers = [] } = useSystemUsers();

  return useQuery({
    queryKey: ['head-pos-venda-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'head_pos_venda' as any);
      if (error) throw error;
      return (data || []).map((r: { user_id: string }) => r.user_id);
    },
    staleTime: 5 * 60 * 1000,
    select: (roleUserIds) =>
      allUsers.filter((u) => roleUserIds.includes(u.id)),
  });
}

export function SystemConfigSection() {
  const { data: currentHeadId, isLoading: loadingConfig } = useSystemConfig('default_head_user_id');
  const { data: headUsers = [], isLoading: loadingUsers } = useHeadPosVendaUsers();
  const updateConfig = useUpdateSystemConfig();

  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    if (currentHeadId && !selectedId) {
      setSelectedId(currentHeadId);
    }
  }, [currentHeadId, selectedId]);

  const isDirty = useMemo(() => selectedId !== currentHeadId, [selectedId, currentHeadId]);

  const handleSave = useCallback(() => {
    if (!selectedId) return;
    updateConfig.mutate({ key: 'default_head_user_id', value: selectedId });
  }, [selectedId, updateConfig]);

  const isLoading = loadingConfig || loadingUsers;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Sistema</h2>
        <p className="text-sm text-muted-foreground">
          Configurações globais do sistema
        </p>
      </div>

      <Card className={cn('border border-border')}>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Atribuição de Projetos</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Define o usuário padrão atribuído como Head em todos os projetos novos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="head-select" className="text-sm font-medium">
                  Head Pós-Venda Padrão
                </Label>
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger id="head-select" className={cn('w-full')}>
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {headUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                        {u.email ? ` (${u.email})` : ''}
                      </SelectItem>
                    ))}
                    {headUsers.length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        Nenhum usuário com role &quot;head_pos_venda&quot; encontrado
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Apenas usuários com o papel &quot;Head Pós-Venda&quot; aparecem aqui.
                </p>
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={!isDirty || updateConfig.isPending}
                  onClick={handleSave}
                  className={cn('gap-2')}
                >
                  <Save className="h-3.5 w-3.5" />
                  {updateConfig.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
