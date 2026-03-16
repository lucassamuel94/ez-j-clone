import { useState } from 'react';
import { useTeams } from '@/hooks/useTeams';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Plus, Trash2, UserPlus, X, UsersRound, ChevronDown } from 'lucide-react';

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export function TeamsSection() {
  const { teams, getTeamMembers, createTeam, deleteTeam, addMember, removeMember, isLoading } =
    useTeams();
  const { users } = useAdminUsers();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [managingTeamId, setManagingTeamId] = useState<string | null>(null);
  const [memberSelectOpen, setMemberSelectOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  const handleCreate = () => {
    if (!newName.trim()) return;
    createTeam.mutate(
      { name: newName.trim(), description: newDesc.trim() },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setNewName('');
          setNewDesc('');
        },
      },
    );
  };

  const managingTeam = teams.find((t) => t.id === managingTeamId);
  const managingMembers = managingTeamId ? getTeamMembers(managingTeamId) : [];
  const memberUserIds = new Set(managingMembers.map((m) => m.user_id));
  const filteredUsers = users.filter((u) => {
    if (!memberSearch.trim()) return true;
    return u.name.toLowerCase().includes(memberSearch.toLowerCase());
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground font-display">Equipes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organize os membros em departamentos e equipes.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="h-8 text-xs">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Criar equipe
        </Button>
      </div>

      {/* Teams list */}
      <div className="space-y-3">
        {teams.map((team) => {
          const members = getTeamMembers(team.id);
          return (
            <div
              key={team.id}
              className="rounded-lg border border-border/40 bg-card p-4 shadow-sm hover:shadow transition-shadow cursor-pointer"
              onClick={() => setManagingTeamId(team.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <UsersRound className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{team.name}</p>
                    {team.description && (
                      <p className="text-xs text-muted-foreground">{team.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Avatar stack */}
                  <div className="flex -space-x-2">
                    {members.slice(0, 5).map((m) => (
                      <Avatar key={m.id} className="h-7 w-7 border-2 border-card">
                        <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-semibold">
                          {m.profile ? getInitials(m.profile.name) : '?'}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {members.length > 5 && (
                      <div className="h-7 w-7 rounded-full border-2 border-card bg-muted flex items-center justify-center">
                        <span className="text-[9px] font-medium text-muted-foreground">
                          +{members.length - 5}
                        </span>
                      </div>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {members.length} {members.length === 1 ? 'membro' : 'membros'}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Remover esta equipe?')) deleteTeam.mutate(team.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {!isLoading && teams.length === 0 && (
          <div className="rounded-lg border border-dashed border-border/40 bg-card p-12 flex flex-col items-center gap-3">
            <UsersRound className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhuma equipe criada ainda.</p>
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Equipe</DialogTitle>
            <DialogDescription>Defina o nome e descrição do novo departamento.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label className="text-xs">Nome</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Comercial"
                className="h-8 text-xs"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">Descrição</Label>
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Opcional"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="h-8 text-xs">
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim()} className="h-8 text-xs">
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage members dialog */}
      <Dialog open={!!managingTeamId} onOpenChange={(o) => !o && setManagingTeamId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{managingTeam?.name}</DialogTitle>
            <DialogDescription>Adicione ou remova membros desta equipe.</DialogDescription>
          </DialogHeader>

          {/* Add/remove members - searchable toggle list */}
          <Popover open={memberSelectOpen} onOpenChange={(o) => { setMemberSelectOpen(o); if (!o) setMemberSearch(''); }}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-8 text-xs w-full justify-between font-normal">
                <span className="flex items-center gap-1.5">
                  <UserPlus className="h-3.5 w-3.5" />
                  Gerenciar membros
                </span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
              <div className="p-2 border-b border-border">
                <Input
                  placeholder="Buscar usuário..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="h-7 text-xs"
                  autoFocus
                />
              </div>
              <div className="max-h-52 overflow-y-auto p-1 space-y-0.5">
                {filteredUsers.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">Nenhum usuário encontrado.</p>
                )}
                {filteredUsers.map((u) => {
                  const isMember = memberUserIds.has(u.id);
                  const member = isMember ? managingMembers.find((m) => m.user_id === u.id) : null;
                  return (
                    <label
                      key={u.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer text-xs"
                    >
                      <Checkbox
                        checked={isMember}
                        onCheckedChange={(checked) => {
                          if (!managingTeamId) return;
                          if (checked) {
                            addMember.mutate({ teamId: managingTeamId, userId: u.id });
                          } else if (member) {
                            removeMember.mutate(member.id);
                          }
                        }}
                        className="h-3.5 w-3.5"
                      />
                      <span className="text-sm">{u.name}</span>
                      {isMember && <Badge variant="secondary" className="ml-auto text-[9px] py-0 px-1.5">membro</Badge>}
                    </label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          {/* Members list */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {managingMembers.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/30">
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-semibold">
                      {m.profile ? getInitials(m.profile.name) : '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground">
                    {m.profile?.name || 'Usuário'}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => removeMember.mutate(m.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {managingMembers.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhum membro nesta equipe.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
