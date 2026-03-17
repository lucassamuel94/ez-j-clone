import { useMemo, useState, useEffect, useCallback } from 'react';
import { useRoles } from '@/hooks/useRoles';
import { useSystemConfig, useUpdateSystemConfig } from '@/hooks/useSystemConfig';
import { useSystemUsers } from '@/hooks/useSystemUsers';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Lock, Loader2, Save, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
    select: (roleUserIds) => allUsers.filter((u) => roleUserIds.includes(u.id)),
  });
}

const CATEGORY_LABELS: Record<string, string> = {
  navigation: 'Navegação',
  commercial: 'Comercial',
  projects: 'Projetos',
  management: 'Gestão',
  tools: 'Ferramentas',
};

const CATEGORY_ORDER = ['navigation', 'commercial', 'projects', 'management', 'tools'];

export function PermissionsSection() {
  const {
    roles,
    permissions,
    rolePermissions,
    isLoading,
    getRolePermissionIds,
    updateRolePermissions,
  } = useRoles();

  // Head Pós-Venda config
  const { data: currentHeadId, isLoading: loadingConfig } = useSystemConfig('default_head_user_id');
  const { data: headUsers = [], isLoading: loadingUsers } = useHeadPosVendaUsers();
  const updateConfig = useUpdateSystemConfig();
  const [selectedHeadId, setSelectedHeadId] = useState<string>('');
  useEffect(() => { if (currentHeadId && !selectedHeadId) setSelectedHeadId(currentHeadId); }, [currentHeadId, selectedHeadId]);
  const isHeadDirty = selectedHeadId !== currentHeadId;
  const handleSaveHead = useCallback(() => {
    if (!selectedHeadId) return;
    updateConfig.mutate({ key: 'default_head_user_id', value: selectedHeadId });
  }, [selectedHeadId, updateConfig]);

  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (roles.length > 0 && !selectedRoleId) {
      setSelectedRoleId(roles[0].id);
    }
  }, [roles, selectedRoleId]);

  useEffect(() => {
    if (selectedRoleId) {
      const ids = rolePermissions
        .filter((rp) => rp.role_id === selectedRoleId)
        .map((rp) => rp.permission_id);
      setSelected(new Set(ids));
      setIsDirty(false);
    }
  }, [selectedRoleId, rolePermissions]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof permissions>();
    for (const p of permissions) {
      const cat = p.category || 'navigation';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      category: c,
      label: CATEGORY_LABELS[c] || c,
      items: map.get(c)!,
    }));
  }, [permissions]);

  const totalPerms = permissions.length;
  const activePerms = selected.size;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setIsDirty(true);
  };

  const toggleAll = (ids: string[], checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
    setIsDirty(true);
  };

  const handleSave = () => {
    if (!selectedRoleId) return;
    updateRolePermissions.mutate(
      { roleId: selectedRoleId, permissionIds: Array.from(selected) },
      { onSuccess: () => setIsDirty(false) },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Segurança e Permissões
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Controle o acesso granular de cada perfil às funcionalidades do sistema.
          </p>
        </div>
        <Button
          size="sm"
          className="h-8 rounded-md text-xs font-medium shrink-0"
          onClick={handleSave}
          disabled={!isDirty || updateRolePermissions.isPending}
        >
          {updateRolePermissions.isPending ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" strokeWidth={1.5} />
          ) : (
            <Save className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
          )}
          Salvar alterações
        </Button>
      </div>

      {/* Top bar: policy + role selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="rounded-lg border border-border/40 bg-card px-3.5 py-2.5 shadow-sm flex items-center gap-2.5 flex-1 min-w-[240px]">
          <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Lock className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground leading-tight">Política de Acesso</p>
            <p className="text-[10px] text-muted-foreground leading-tight">
              Google OAuth ativo para todos os usuários
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border/40 bg-card px-3.5 py-2.5 shadow-sm flex items-center gap-3">
          <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" strokeWidth={1.5} />
          <Select value={selectedRoleId} onValueChange={(v) => setSelectedRoleId(v)}>
            <SelectTrigger className="w-[200px] h-8 text-xs font-medium rounded-md border-border/60">
              <SelectValue placeholder="Selecione um perfil" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id} className="text-xs">
                  <div className="flex items-center gap-2">
                    {role.name}
                    {role.is_system && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 leading-tight">
                        sistema
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedRole && (
            <Badge variant="outline" className="text-[10px] font-medium tabular-nums shrink-0">
              {activePerms}/{totalPerms}
            </Badge>
          )}
        </div>
      </div>


      {/* Permission groups - full width grid */}
      {selectedRole && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {grouped.map((group) => {
            const allIds = group.items.map((p) => p.id);
            const checkedCount = allIds.filter((id) => selected.has(id)).length;
            const allChecked = checkedCount === allIds.length;
            const someChecked = checkedCount > 0;

            return (
              <div
                key={group.category}
                className="rounded-xl border border-border/40 bg-card shadow-sm overflow-hidden"
              >
                {/* Category header */}
                <div className="px-4 py-2.5 border-b border-border/30 bg-muted/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={allChecked}
                      onCheckedChange={(checked) => toggleAll(allIds, !!checked)}
                      className="data-[state=indeterminate]:bg-primary"
                      {...(someChecked && !allChecked ? { 'data-state': 'indeterminate' as any } : {})}
                    />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {group.label}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-medium tabular-nums">
                    {checkedCount}/{allIds.length}
                  </Badge>
                </div>

                {/* Permission items */}
                <div className="px-4 py-2.5 space-y-1.5">
                  {group.items.map((perm) => (
                    <div
                      key={perm.id}
                      className="flex items-center gap-2.5 py-1 px-1.5 -mx-1.5 rounded-md hover:bg-muted/40 transition-colors cursor-pointer"
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('button')) return;
                        toggle(perm.id);
                      }}
                    >
                      <Checkbox
                        checked={selected.has(perm.id)}
                        tabIndex={-1}
                        onCheckedChange={() => toggle(perm.id)}
                      />
                      <span className="text-xs font-normal leading-tight flex-1">
                        {perm.description || perm.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
