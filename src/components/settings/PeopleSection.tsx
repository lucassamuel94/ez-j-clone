import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAdminUsers, UserWithRole, UserInvitation } from '@/hooks/useAdminUsers';
import { useRoles } from '@/hooks/useRoles';
import { useTeams } from '@/hooks/useTeams';
import { InviteUserDialog } from '@/components/admin/InviteUserDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Shield, Clock, Trash2, Pencil, UserX, RefreshCw, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type SortKey = 'name' | 'email' | 'role' | 'teams' | 'last_seen_at' | 'active';
type SortDir = 'asc' | 'desc';

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function PeopleSection() {
  const {
    users,
    invitations,
    isLoadingUsers,
    availableRoles,
    toggleUserActive,
    updateUserRole,
    updateUserName,
    createInvitation,
    deleteInvitation,
  } = useAdminUsers();
  const { roles } = useRoles();
  const { teams, teamMembers } = useTeams();

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Edit name dialog
  const [editUser, setEditUser] = useState<UserWithRole | null>(null);
  const [editName, setEditName] = useState('');
  const [editRamal, setEditRamal] = useState('');

  // Confirm disable dialog
  const [confirmDisableUser, setConfirmDisableUser] = useState<UserWithRole | null>(null);

  // Map user -> teams
  const getUserTeams = (userId: string) => {
    const memberEntries = teamMembers.filter((m) => m.user_id === userId);
    return memberEntries
      .map((m) => teams.find((t) => t.id === m.team_id))
      .filter(Boolean) as { id: string; name: string }[];
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const filteredUsers = useMemo(() => {
    let list = users;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) => u.name.toLowerCase().includes(q) || (u.email && u.email.toLowerCase().includes(q)),
      );
    }

    if (tab === 'admins') {
      list = list.filter((u) => u.role === 'admin' || u.role === 'manager');
    } else if (tab === 'members') {
      list = list.filter((u) => u.role !== 'admin' && u.role !== 'manager');
    }

    // Role filter
    if (roleFilter !== 'all') {
      list = list.filter((u) => u.role_id === roleFilter);
    }

    // Status filter
    if (statusFilter === 'active') {
      list = list.filter((u) => u.active);
    } else if (statusFilter === 'inactive') {
      list = list.filter((u) => !u.active);
    }

    // Sort
    const dir = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return dir * (a.name || '').localeCompare(b.name || '', 'pt-BR');
        case 'email':
          return dir * (a.email || '').localeCompare(b.email || '', 'pt-BR');
        case 'role':
          return dir * (a.role_name || a.role || '').localeCompare(b.role_name || b.role || '', 'pt-BR');
        case 'teams': {
          const aTeams = getUserTeams(a.id).map(t => t.name).join(', ');
          const bTeams = getUserTeams(b.id).map(t => t.name).join(', ');
          return dir * aTeams.localeCompare(bTeams, 'pt-BR');
        }
        case 'last_seen_at':
          return dir * (new Date(a.last_seen_at || 0).getTime() - new Date(b.last_seen_at || 0).getTime());
        case 'active':
          return dir * (Number(a.active) - Number(b.active));
        default:
          return 0;
      }
    });

    return list;
  }, [users, search, tab, roleFilter, statusFilter, sortKey, sortDir]);

  const filteredInvitations = useMemo(() => {
    if (tab !== 'pending' && tab !== 'all') return [];
    let list = invitations;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.email.toLowerCase().includes(q));
    }
    return list;
  }, [invitations, search, tab]);

  const showInvitations = tab === 'all' || tab === 'pending';

  const handleOpenEdit = async (user: UserWithRole) => {
    setEditName(user.name);
    setEditUser(user);
    // Fetch current ramal
    const { data } = await supabase.from('profiles').select('ramal').eq('id', user.id).single();
    setEditRamal((data as unknown as { ramal: string | null })?.ramal || '');
  };

  const handleSaveEdit = async () => {
    if (editUser && editName.trim()) {
      updateUserName.mutate({ userId: editUser.id, name: editName.trim() });
      // Save ramal separately
      await supabase.from('profiles').update({ ramal: editRamal.trim() || null } as Record<string, unknown>).eq('id', editUser.id);
      setEditUser(null);
    }
  };

  const handleConfirmDisable = () => {
    if (confirmDisableUser) {
      toggleUserActive.mutate({ userId: confirmDisableUser.id, active: false });
      setConfirmDisableUser(null);
    }
  };

  return (
    <div className="space-y-6 w-full flex-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Pessoas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os membros do espaço de trabalho e convites pendentes.
          </p>
        </div>
        <InviteUserDialog
          onInvite={(email, role, roleId, teamId) => createInvitation.mutate({ email, role, roleId, teamId })}
          isLoading={createInvitation.isPending}
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-9 text-xs"
          />
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs h-7 px-3">
              Todos
            </TabsTrigger>
            <TabsTrigger value="admins" className="text-xs h-7 px-3">
              Admins
            </TabsTrigger>
            <TabsTrigger value="members" className="text-xs h-7 px-3">
              Membros
            </TabsTrigger>
            <TabsTrigger value="pending" className="text-xs h-7 px-3">
              Pendentes{' '}
              {invitations.length > 0 && (
                <Badge className="ml-1.5 h-4 px-1.5 text-[9px] bg-destructive text-destructive-foreground border-0">
                  {invitations.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Perfil">
              {roleFilter === 'all' ? 'Todos os perfis' : availableRoles.find(r => r.id === roleFilter)?.name || 'Perfil'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos os perfis</SelectItem>
            {availableRoles.map((r) => (
              <SelectItem key={r.id} value={r.id} className="text-xs">
                <div className="flex items-center gap-2">
                  <Shield className="h-3 w-3" />
                  {r.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="Status">
              {statusFilter === 'all' ? 'Todos status' : statusFilter === 'active' ? 'Ativos' : 'Inativos'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos status</SelectItem>
            <SelectItem value="active" className="text-xs">Ativos</SelectItem>
            <SelectItem value="inactive" className="text-xs">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/40 bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {([['name', 'Usuário'], ['email', 'E-mail'], ['role', 'Perfil'], ['teams', 'Equipes'], ['last_seen_at', 'Última Atividade'], ['active', 'Status']] as [SortKey, string][]).map(([key, label]) => (
                <TableHead key={key} className={`text-xs font-bold uppercase tracking-widest text-muted-foreground h-9 ${key === 'active' ? 'text-center' : ''}`}>
                  <button
                    type="button"
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                    onClick={() => handleSort(key)}
                  >
                    {label}
                    <SortIcon col={key} />
                  </button>
                </TableHead>
              ))}
              <TableHead className="text-xs font-bold uppercase tracking-widest text-muted-foreground h-9 w-16 text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tab !== 'pending' &&
              filteredUsers.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  roles={availableRoles}
                  userTeams={getUserTeams(user.id)}
                  onToggleActive={(active) => {
                    if (!active) {
                      setConfirmDisableUser(user);
                    } else {
                      toggleUserActive.mutate({ userId: user.id, active });
                    }
                  }}
                  onUpdateRole={(roleId) =>
                    updateUserRole.mutate({ userId: user.id, roleId })
                  }
                  onEdit={() => handleOpenEdit(user)}
                  onDisable={() => setConfirmDisableUser(user)}
                />
              ))}

            {showInvitations &&
              filteredInvitations.map((inv) => (
                <InvitationRow
                  key={inv.id}
                  invitation={inv}
                  onDelete={() => deleteInvitation.mutate(inv.id)}
                />
              ))}

            {tab !== 'pending' && filteredUsers.length === 0 && filteredInvitations.length === 0 && (
              <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  Nenhum resultado encontrado.
                </TableCell>
              </TableRow>
            )}
            {tab === 'pending' && filteredInvitations.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  Nenhum convite pendente.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Name Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nome</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-8 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Ramal EZCall</Label>
              <Input
                value={editRamal}
                onChange={(e) => setEditRamal(e.target.value)}
                className="h-8 text-sm"
                placeholder="Ex: 3060"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
              />
              <p className="text-[10px] text-muted-foreground">Ramal do PABX para relatório de ligações</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditUser(null)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={!editName.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Disable Dialog */}
      <AlertDialog open={!!confirmDisableUser} onOpenChange={(open) => !open && setConfirmDisableUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desabilitar usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desabilitar <span className="font-semibold text-foreground">{confirmDisableUser?.name}</span>? O usuário perderá acesso ao sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDisable} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Desabilitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UserRow({
  user,
  roles,
  userTeams,
  onToggleActive,
  onUpdateRole,
  onEdit,
  onDisable,
}: {
  user: UserWithRole;
  roles: { id: string; name: string }[];
  userTeams: { id: string; name: string }[];
  onToggleActive: (active: boolean) => void;
  onUpdateRole: (roleId: string) => void;
  onEdit: () => void;
  onDisable: () => void;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TableRow className="cursor-default">
          <TableCell>
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground">{user.name}</span>
            </div>
          </TableCell>
          <TableCell className="text-xs text-muted-foreground">{user.email}</TableCell>
          <TableCell>
            <Select value={user.role_id || ''} onValueChange={onUpdateRole}>
              <SelectTrigger className="h-7 w-[160px] text-xs">
                <SelectValue placeholder="—">
                  {user.role_name || '—'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <Shield className="h-3 w-3" />
                      {r.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell>
            {userTeams.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {userTeams.map((t) => (
                  <Badge key={t.id} variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-medium">
                    {t.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </TableCell>
          <TableCell>
            {user.last_seen_at ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(user.last_seen_at), { addSuffix: true, locale: ptBR })}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </TableCell>
          <TableCell className="text-center">
            <Switch
              checked={user.active}
              onCheckedChange={onToggleActive}
              className="mx-auto"
            />
          </TableCell>
          <TableCell className="text-center">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </TableCell>
        </TableRow>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={onEdit} className="text-xs gap-2">
          <Pencil className="h-3.5 w-3.5" />
          Editar usuário
        </ContextMenuItem>
        <ContextMenuSeparator />
        {user.active ? (
          <ContextMenuItem onClick={onDisable} className="text-xs gap-2 text-destructive focus:text-destructive">
            <UserX className="h-3.5 w-3.5" />
            Desabilitar usuário
          </ContextMenuItem>
        ) : (
          <ContextMenuItem onClick={() => onToggleActive(true)} className="text-xs gap-2">
            <Shield className="h-3.5 w-3.5" />
            Reativar usuário
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function InvitationRow({
  invitation,
  onDelete,
}: {
  invitation: UserInvitation;
  onDelete: () => void;
}) {
  const [resending, setResending] = useState(false);

  const handleResendInvite = async () => {
    setResending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let inviterName = 'Administrador';
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .single();
        if (profile?.name) inviterName = profile.name;
      }

      const signupUrl = `${window.location.origin}/login?invite=${invitation.id}`;
      const { error } = await supabase.functions.invoke('send-invite-email', {
        body: {
          email: invitation.email,
          role: invitation.role,
          invitedByName: inviterName,
          signupUrl,
        },
      });
      if (error) throw error;
      toast.success(`Convite reenviado para ${invitation.email}`);
    } catch (error) {
      console.error('Error resending invite:', error);
      toast.error('Erro ao reenviar convite');
    } finally {
      setResending(false);
    }
  };

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-warning/10 text-warning text-[10px] font-semibold">
              {invitation.email[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-foreground">{invitation.email}</span>
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{invitation.email}</TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs font-medium capitalize">
          {invitation.role}
        </Badge>
      </TableCell>
      <TableCell>
        <span className="text-xs text-muted-foreground">—</span>
      </TableCell>
      <TableCell>
        <span className="text-xs text-muted-foreground">
          Enviado{' '}
          {formatDistanceToNow(new Date(invitation.created_at), { addSuffix: true, locale: ptBR })}
        </span>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-1">
          <Badge variant="outline" className="text-[10px] border-warning/20 text-warning bg-warning/10">
            Pendente
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-primary"
            onClick={handleResendInvite}
            disabled={resending}
          >
            <RefreshCw className={`h-3 w-3 ${resending ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
