import { useState } from 'react';
import { useRoles } from '@/hooks/useRoles';
import { useTeams } from '@/hooks/useTeams';
import { AppRole } from '@/hooks/useAdminUsers';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmailTagInput } from '@/components/EmailTagInput';
import { UserPlus, Shield, Users } from 'lucide-react';

interface InviteUserDialogProps {
  onInvite: (email: string, role: AppRole, roleId?: string, teamId?: string) => void;
  isLoading: boolean;
}

export const InviteUserDialog = ({ onInvite, isLoading }: InviteUserDialogProps) => {
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('none');
  const { roles } = useRoles();
  const { teams } = useTeams();

  const parsedEmails = emails ? emails.split(',').map((e) => e.trim()).filter(Boolean) : [];

  const handleSubmit = () => {
    if (parsedEmails.length === 0 || !selectedRoleId) return;

    const selectedRole = roles.find((r) => r.id === selectedRoleId);
    if (!selectedRole) return;

    const enumMap: Record<string, AppRole> = {
      'Administrador': 'admin',
      'Gerente': 'manager',
      'SDR': 'sdr',
      'Closer': 'closer',
      'Head Pós-Venda': 'head_pos_venda',
      'UX/PO': 'ux_po',
      'Dev Chatbot': 'dev_chatbot',
      'Treinamento': 'treinamento',
      'Viewer': 'sdr',
    };
    const enumRole = enumMap[selectedRole.name] || 'sdr';
    const teamId = selectedTeamId !== 'none' ? selectedTeamId : undefined;

    for (const email of parsedEmails) {
      onInvite(email, enumRole, selectedRoleId, teamId);
    }

    setEmails('');
    setSelectedRoleId('');
    setSelectedTeamId('none');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Convidar Usuário
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar Usuários</DialogTitle>
          <DialogDescription>
            Adicione um ou mais e-mails para convidar à plataforma.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>E-mails</Label>
            <EmailTagInput
              value={emails}
              onChange={setEmails}
              placeholder="Digite e-mails e pressione Enter"
            />
            <p className="text-xs text-muted-foreground">
              Pressione Enter ou cole múltiplos e-mails separados por vírgula.
            </p>
          </div>
          <div className="grid gap-2">
            <Label>Perfil</Label>
            <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um perfil" />
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
          </div>
          <div className="grid gap-2">
            <Label>Equipe</Label>
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma equipe (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground">Nenhuma equipe</span>
                </SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    <div className="flex items-center gap-2">
                      <Users className="h-3 w-3" />
                      {team.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              O usuário será adicionado à equipe ao aceitar o convite.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={parsedEmails.length === 0 || !selectedRoleId || isLoading}>
            {parsedEmails.length > 1 ? `Enviar ${parsedEmails.length} Convites` : 'Enviar Convite'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
