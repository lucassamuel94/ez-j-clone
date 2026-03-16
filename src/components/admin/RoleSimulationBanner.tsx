import { Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRoleSimulation } from '@/stores/useRoleSimulation';
import { ROLE_OPTIONS } from './RoleSimulationDialog';
import { cn } from '@/lib/utils';

export function RoleSimulationBanner() {
  const { isSimulating, simulatedRole, stopSimulation } = useRoleSimulation();

  if (!isSimulating || !simulatedRole) return null;

  const roleInfo = ROLE_OPTIONS.find(r => r.value === simulatedRole);

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-primary text-primary-foreground">
      <div className="flex items-center justify-center gap-3 px-4 py-1.5 text-xs font-medium">
        <Eye className="h-3.5 w-3.5 animate-pulse" />
        <span>Modo Simulação</span>
        <Badge variant="secondary" className="text-[10px] h-5 bg-primary-foreground/20 text-primary-foreground border-none">
          {roleInfo?.label || simulatedRole}
        </Badge>
        <span className="text-primary-foreground/70">— Visualizando como este perfil</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={stopSimulation}
          className="h-6 px-2 text-[10px] text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground ml-2"
        >
          <X className="h-3 w-3 mr-1" />
          Encerrar
        </Button>
      </div>
    </div>
  );
}
