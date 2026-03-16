import { useState } from 'react';
import { useRoles, Role } from '@/hooks/useRoles';
import { RolePermissionEditor } from './RolePermissionEditor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Plus, Pencil, Trash2, Shield } from 'lucide-react';

export const RolesManagementSection = () => {
  const {
    roles,
    permissions,
    isLoading,
    getRolePermissionIds,
    createRole,
    deleteRole,
    updateRolePermissions,
  } = useRoles();

  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const handleCreateRole = () => {
    if (newName.trim()) {
      createRole.mutate(
        { name: newName.trim(), description: newDesc.trim() },
        {
          onSuccess: () => {
            setShowCreate(false);
            setNewName('');
            setNewDesc('');
          },
        },
      );
    }
  };

  const handleSavePermissions = (roleId: string, permissionIds: string[]) => {
    updateRolePermissions.mutate(
      { roleId, permissionIds },
      { onSuccess: () => setEditingRole(null) },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Perfis de Acesso
            </CardTitle>
            <CardDescription>
              Gerencie os perfis de acesso e suas permissões.
            </CardDescription>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Perfil
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Permissões</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => {
                  const permCount = getRolePermissionIds(role.id).length;
                  return (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {role.description}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{permCount} permissões</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {role.is_system && (
                            <Badge variant="outline" className="text-xs">Sistema</Badge>
                          )}
                          {role.is_default && (
                            <Badge className="text-xs bg-primary/10 text-primary border-primary/20">Padrão</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingRole(role)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {!role.is_system && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteRole.mutate(role.id)}
                              disabled={deleteRole.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create Role Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Perfil</DialogTitle>
            <DialogDescription>Crie um novo perfil de acesso customizado.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Analista" />
            </div>
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Descrição do perfil" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreateRole} disabled={!newName.trim() || createRole.isPending}>
              {createRole.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permission Editor */}
      <RolePermissionEditor
        role={editingRole}
        permissions={permissions}
        currentPermissionIds={editingRole ? getRolePermissionIds(editingRole.id) : []}
        onSave={handleSavePermissions}
        onClose={() => setEditingRole(null)}
        isSaving={updateRolePermissions.isPending}
      />
    </>
  );
};
