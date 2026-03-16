import { useState } from 'react';
import { LogOut, User, ChevronDown, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUserRole } from '@/hooks/useUserRole';
import { RoleSimulationDialog } from '@/components/admin/RoleSimulationDialog';

interface UserMenuProps {
  greeting: string;
  userName: string;
}

export function UserMenu({ greeting, userName }: UserMenuProps) {
  const navigate = useNavigate();
  const { isRealAdmin } = useUserRole();
  const [simDialogOpen, setSimDialogOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Logout realizado com sucesso');
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Erro ao fazer logout');
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-1 px-2 h-auto py-1">
            <span className="text-sm text-muted-foreground">
              {greeting}, {userName} 👋🏼
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem className="gap-2 text-muted-foreground cursor-default" disabled>
            <User className="h-4 w-4" />
            <span>{userName}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {isRealAdmin && (
            <DropdownMenuItem onClick={() => setSimDialogOpen(true)} className="gap-2">
              <Eye className="h-4 w-4" />
              <span>Simular Perfil</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleLogout} className="gap-2 text-destructive focus:text-destructive">
            <LogOut className="h-4 w-4" />
            <span>Sair</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RoleSimulationDialog open={simDialogOpen} onOpenChange={setSimDialogOpen} />
    </>
  );
}
