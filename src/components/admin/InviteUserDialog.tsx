import { useState, useMemo } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmailTagInput } from '@/components/EmailTagInput';
import { UserPlus, Shield, Users, Phone } from 'lucide-react';

interface InviteUserDialogProps {
  onInvite: (email: string, role: AppRole, roleId?: string, teamId?: string, ramal?: string) => void;
  isLoading: boolean;
}

export const InviteUserDialog = ({ onInvite, isLoading }: InviteUserDialogProps) => {
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [ramal, setRamal] = useState('');
  const { roles } = useRoles();
  const { teams } = useTeams();

  const parsedEmails = emails ? emails.split(',').map((e) => e.trim()).filter(Boolean) : [];

  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === selectedTeamId),
    [teams, selectedTeamId],
  );

  const isComercial = selectedTeam?.name?.toLowerCase() === 'comercial';

  const isFormValid =
    parsedEmails.length > 0 &&
    !!selectedRoleId &&
    !!selectedTeamId &&
    (!isComercial || ramal.trim().length > 0);

  const handleSubmit = () => {
    if (!isFormValid) return;

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
    const trimmedRamal = ramal.trim() || undefined;

    for (const email of parsedEmails) {
      onInvite(email, enumRole, selectedRoleId, selectedTeamId, trimmedRamal);
    }

    setEmails('');
    setSelectedRoleId('');
    setSelectedTeamId('');
    setRamal('');
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
            <Label>
              E-mails <span className="text-destructive">*</span>
            </Label>
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
            <Label>
              Perfil <span className="text-destructive">*</span>
            </Label>
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
            <Label>
              Equipe <span className="text-destructive">*</span>
            </Label>
            <Select value={selectedTeamId} onValueChange={(v) => { setSelectedTeamId(v); if (!teams.find(t => t.id === v)?.name?.toLowerCase().includes('comercial')) setRamal(''); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma equipe" />
              </SelectTrigger>
              <SelectContent>
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
          </div>
          {isComercial && (
            <div className="grid gap-2">
              <Label>
                Ramal EZCall <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={ramal}
                  onChange={(e) => setRamal(e.target.value)}
                  placeholder="Ex: 3060"
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Ramal do PABX obrigatório para membros da equipe Comercial.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isFormValid || isLoading}>
            {parsedEmails.length > 1 ? `Enviar ${parsedEmails.length} Convites` : 'Enviar Convite'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
