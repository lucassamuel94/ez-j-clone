import { useState, useEffect } from 'react';
import { Role, Permission } from '@/hooks/useRoles';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface RolePermissionEditorProps {
  role: Role | null;
  permissions: Permission[];
  currentPermissionIds: string[];
  onSave: (roleId: string, permissionIds: string[]) => void;
  onClose: () => void;
  isSaving: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  navigation: 'Navegação',
  commercial: 'Comercial',
  projects: 'Gestão de Projetos',
  management: 'Gestão',
  tools: 'Ferramentas',
};

const CATEGORY_ORDER = ['navigation', 'commercial', 'projects', 'management', 'tools'];

export const RolePermissionEditor = ({
  role,
  permissions,
  currentPermissionIds,
  onSave,
  onClose,
  isSaving,
}: RolePermissionEditorProps) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelected(new Set(currentPermissionIds));
  }, [currentPermissionIds]);

  if (!role) return null;

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat] || cat,
    perms: permissions.filter((p) => p.category === cat),
  })).filter((g) => g.perms.length > 0);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (ids: string[], checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  };

  return (
    <Dialog open={!!role} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar: {role.name}</DialogTitle>
          <DialogDescription>
            Selecione as permissões para este perfil.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {grouped.map((group) => {
            const allIds = group.perms.map((p) => p.id);
            const allChecked = allIds.every((id) => selected.has(id));
            const someChecked = allIds.some((id) => selected.has(id));

            return (
              <div key={group.category}>
                <div className="flex items-center gap-2 mb-2">
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={(checked) => toggleAll(allIds, !!checked)}
                    className="data-[state=indeterminate]:bg-primary"
                    {...(someChecked && !allChecked ? { 'data-state': 'indeterminate' as any } : {})}
                  />
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {group.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pl-6">
                  {group.perms.map((perm) => (
                    <div key={perm.id} className="flex items-center gap-2">
                      <Checkbox
                        id={perm.id}
                        checked={selected.has(perm.id)}
                        onCheckedChange={() => toggle(perm.id)}
                      />
                      <Label htmlFor={perm.id} className="text-sm font-normal cursor-pointer">
                        {perm.description}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => onSave(role.id, Array.from(selected))}
            disabled={isSaving}
          >
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
