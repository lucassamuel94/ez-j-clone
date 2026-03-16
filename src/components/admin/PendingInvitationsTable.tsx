import { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { UserInvitation, AppRole } from '@/hooks/useAdminUsers';
import {
  TableProvider,
  TableHeader,
  TableHeaderGroup,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableColumnHeader,
} from '@/components/kibo-ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Trash2, Clock, Shield, UserCog, User, Copy, RefreshCw, Check, Crown, Palette, Code, GraduationCap } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface PendingInvitationsTableProps {
  invitations: UserInvitation[];
  onDelete: (invitationId: string) => void;
  isDeleting: boolean;
}

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador', manager: 'Gerente', sdr: 'SDR', closer: 'Closer',
  head_pos_venda: 'Head Pós-Venda', ux_po: 'UX/PO', dev_chatbot: 'Dev Chatbot', treinamento: 'Treinamento',
};

const roleIcons: Record<AppRole, React.ReactNode> = {
  admin: <Shield className="h-3 w-3" />, manager: <UserCog className="h-3 w-3" />,
  sdr: <User className="h-3 w-3" />, closer: <User className="h-3 w-3" />,
  head_pos_venda: <Crown className="h-3 w-3" />, ux_po: <Palette className="h-3 w-3" />,
  dev_chatbot: <Code className="h-3 w-3" />, treinamento: <GraduationCap className="h-3 w-3" />,
};

export const PendingInvitationsTable = ({
  invitations,
  onDelete,
  isDeleting,
}: PendingInvitationsTableProps) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const getInviteLink = (invitationId: string) => `${window.location.origin}/login?invite=${invitationId}`;

  const handleCopyLink = async (invitationId: string) => {
    try {
      await navigator.clipboard.writeText(getInviteLink(invitationId));
      setCopiedId(invitationId);
      toast.success('Link copiado para a área de transferência');
      setTimeout(() => setCopiedId(null), 2000);
    } catch { toast.error('Erro ao copiar link'); }
  };

  const handleResendEmail = async (invitation: UserInvitation) => {
    setResendingId(invitation.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let inviterName = 'Administrador';
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single();
        if (profile?.name) inviterName = profile.name;
      }
      const { error } = await supabase.functions.invoke('send-invite-email', {
        body: { email: invitation.email, role: invitation.role, invitedByName: inviterName, signupUrl: getInviteLink(invitation.id) },
      });
      if (error) throw error;
      toast.success(`Email reenviado para ${invitation.email}`);
    } catch (error) {
      console.error('Error resending invite:', error);
      toast.error('Erro ao reenviar email');
    } finally { setResendingId(null); }
  };

  const columns = useMemo<ColumnDef<UserInvitation, unknown>[]>(() => [
    {
      accessorKey: 'email',
      header: ({ column }) => <TableColumnHeader column={column} title="E-mail" />,
      cell: ({ row }) => <span className="font-medium">{row.original.email}</span>,
    },
    {
      accessorKey: 'role',
      header: ({ column }) => <TableColumnHeader column={column} title="Papel" />,
      cell: ({ row }) => (
        <Badge variant="outline" className="gap-1">
          {roleIcons[row.original.role]}
          {roleLabels[row.original.role]}
        </Badge>
      ),
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => <TableColumnHeader column={column} title="Convidado em" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {format(new Date(row.original.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
        </span>
      ),
    },
    {
      accessorKey: 'expires_at',
      header: ({ column }) => <TableColumnHeader column={column} title="Expira em" />,
      cell: ({ row }) => {
        const isExpired = isPast(new Date(row.original.expires_at));
        return (
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className={isExpired ? 'text-destructive' : 'text-muted-foreground'}>
              {format(new Date(row.original.expires_at), "dd/MM/yyyy", { locale: ptBR })}
            </span>
            {isExpired && <Badge variant="destructive" className="text-xs">Expirado</Badge>}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: 'Ações',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => handleCopyLink(row.original.id)} className="h-8 w-8">
                {copiedId === row.original.id ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copiar link de cadastro</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => handleResendEmail(row.original)} disabled={resendingId === row.original.id} className="h-8 w-8">
                <RefreshCw className={`h-4 w-4 ${resendingId === row.original.id ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reenviar email</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => onDelete(row.original.id)} disabled={isDeleting} className="h-8 w-8 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Excluir convite</TooltipContent>
          </Tooltip>
        </div>
      ),
    },
  ], [copiedId, resendingId, isDeleting]);

  return (
    <div className="rounded-md border">
      <TableProvider columns={columns} data={invitations}>
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
  );
};