import { useState, useMemo } from 'react';
import { UserWithRole, RoleOption } from '@/hooks/useAdminUsers';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  TableProvider,
  TableHeader,
  TableHeaderGroup,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableColumnHeader,
  type ColumnDef,
} from '@/components/kibo-ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { LogOut, Pencil, Shield, Circle, RefreshCw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UserManagementTableProps {
  users: UserWithRole[];
  roles: RoleOption[];
  onToggleActive: (userId: string, active: boolean) => void;
  onToggleExcludeAutoAssign: (userId: string, exclude: boolean) => void;
  onUpdateRole: (userId: string, roleId: string) => void;
  onUpdateName: (userId: string, name: string) => void;
  isUpdating: boolean;
  isAdmin: boolean;
}

const ONLINE_THRESHOLD_MS = 3 * 60 * 1000;

const isUserOnline = (lastSeenAt: string | null): boolean => {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;
};

export const UserManagementTable = ({
  users,
  roles,
  onToggleActive,
  onToggleExcludeAutoAssign,
  onUpdateRole,
  onUpdateName,
  isUpdating,
  isAdmin,
}: UserManagementTableProps) => {
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [editName, setEditName] = useState('');
  const [loggingOut, setLoggingOut] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const handleResendInvite = async (user: UserWithRole) => {
    setResendingId(user.id);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      let inviterName = 'Administrador';
      if (currentUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', currentUser.id)
          .single();
        if (profile?.name) inviterName = profile.name;
      }
      const { data: invitation } = await supabase
        .from('user_invitations')
        .select('id, email, role')
        .eq('email', user.email)
        .is('accepted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (!invitation) {
        toast.error('Nenhum convite pendente encontrado para este usuário');
        return;
      }
      const signupUrl = `${window.location.origin}/login?invite=${invitation.id}`;
      const { error } = await supabase.functions.invoke('send-invite-email', {
        body: { email: invitation.email, role: invitation.role, invitedByName: inviterName, signupUrl },
      });
      if (error) throw error;
      toast.success(`Convite reenviado para ${user.email}`);
    } catch (error) {
      console.error('Error resending invite:', error);
      toast.error('Erro ao reenviar convite');
    } finally {
      setResendingId(null);
    }
  };

  const handleEditClick = (user: UserWithRole) => {
    setEditingUser(user);
    setEditName(user.name);
  };

  const handleSaveEdit = () => {
    if (editingUser && editName.trim()) {
      onUpdateName(editingUser.id, editName.trim());
      setEditingUser(null);
    }
  };

  const handleForceLogout = async (userId: string, userName: string) => {
    setLoggingOut(userId);
    try {
      const res = await supabase.functions.invoke('force-logout', { body: { user_id: userId } });
      if (res.error) throw res.error;
      toast.success(`Sessão de ${userName} encerrada com sucesso`);
    } catch (error: any) {
      console.error('Force logout error:', error);
      toast.error(`Erro ao encerrar sessão: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setLoggingOut(null);
    }
  };

  const columns = useMemo<ColumnDef<UserWithRole>[]>(() => [
    {
      accessorKey: 'name',
      header: ({ column }) => <TableColumnHeader column={column} title="Nome" />,
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex items-center gap-2 font-medium">
            <Tooltip>
              <TooltipTrigger>
                <Circle
                  className={`h-2.5 w-2.5 fill-current ${
                    isUserOnline(user.last_seen_at) ? 'text-green-500' : 'text-muted-foreground/40'
                  }`}
                />
              </TooltipTrigger>
              <TooltipContent>
                {isUserOnline(user.last_seen_at)
                  ? 'Online agora'
                  : user.last_seen_at
                    ? `Visto por último em ${format(new Date(user.last_seen_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                    : 'Nunca acessou'}
              </TooltipContent>
            </Tooltip>
            {user.name}
          </div>
        );
      },
    },
    {
      accessorFn: (row) => row.role_name || row.role || '',
      id: 'role_name',
      header: ({ column }) => <TableColumnHeader column={column} title="Papel" />,
      cell: ({ row }) => {
        const user = row.original;
        return (
          <Select
            value={user.role_id || ''}
            onValueChange={(value) => onUpdateRole(user.id, value)}
            disabled={isUpdating}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecione um perfil">
                {user.role_name || user.role || 'Sem perfil'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  <div className="flex items-center gap-2">
                    <Shield className="h-3 w-3" />
                    {role.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => <TableColumnHeader column={column} title="Criado em" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {format(new Date(row.original.created_at), "dd/MM/yyyy", { locale: ptBR })}
        </span>
      ),
    },
    {
      accessorFn: (row) => row.active,
      id: 'active',
      header: ({ column }) => <TableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={user.active}
              onCheckedChange={(checked) => onToggleActive(user.id, checked)}
              disabled={isUpdating}
            />
            <Badge variant={user.active ? 'default' : 'secondary'}>
              {user.active ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
        );
      },
    },
    ...(isAdmin ? [{
      accessorFn: (row: UserWithRole) => row.exclude_from_auto_assign,
      id: 'exclude_auto_assign',
      header: ({ column }: any) => <TableColumnHeader column={column} title="Auto-assign" />,
      cell: ({ row }: any) => {
        const user = row.original as UserWithRole;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={user.exclude_from_auto_assign}
                  onCheckedChange={(checked) => onToggleExcludeAutoAssign(user.id, !!checked)}
                  disabled={isUpdating}
                />
                <span className="text-xs text-muted-foreground">
                  {user.exclude_from_auto_assign ? 'Excluído' : 'Incluído'}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {user.exclude_from_auto_assign
                ? 'Usuário recebe projetos apenas por atribuição manual'
                : 'Usuário participa da atribuição automática de projetos'}
            </TooltipContent>
          </Tooltip>
        );
      },
    }] as ColumnDef<UserWithRole>[] : []),
    {
      id: 'actions',
      header: () => <span className="text-xs">Ações</span>,
      enableSorting: false,
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => handleEditClick(user)} className="h-8 w-8">
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Editar nome</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => handleResendInvite(user)} disabled={resendingId === user.id} className="h-8 w-8">
                  <RefreshCw className={`h-4 w-4 ${resendingId === user.id ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reenviar convite</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => handleForceLogout(user.id, user.name)} disabled={loggingOut === user.id} className="h-8 w-8">
                  <LogOut className="h-4 w-4 text-destructive" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Forçar logout</TooltipContent>
            </Tooltip>
          </div>
        );
      },
    },
  ], [roles, isUpdating, isAdmin, onUpdateRole, onToggleActive, onToggleExcludeAutoAssign, resendingId, loggingOut]);

  return (
    <>
      <div className="rounded-md border">
        <TableProvider columns={columns} data={users}>
          <TableHeader>
            {({ headerGroup }) => (
              <TableHeaderGroup headerGroup={headerGroup}>
                {({ header }) => <TableHead header={header} />}
              </TableHeaderGroup>
            )}
          </TableHeader>
          <TableBody>
            {({ row }) => (
              <TableRow key={row.id} row={row}>
                {({ cell }) => <TableCell cell={cell} />}
              </TableRow>
            )}
          </TableBody>
        </TableProvider>
      </div>

      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>Altere as informações do usuário abaixo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nome do usuário" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={!editName.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
