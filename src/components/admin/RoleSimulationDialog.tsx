import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, Shield, Users, Code, GraduationCap, BarChart3, Headphones, Palette, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRoleSimulation } from '@/stores/useRoleSimulation';
import type { UserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROLE_OPTIONS: { value: UserRole; label: string; description: string; icon: React.ReactNode; color: string }[] = [
  { value: 'sdr', label: 'SDR', description: 'Prospecção, qualificação e agendamento de reuniões', icon: <Headphones className="h-4 w-4" />, color: 'bg-chart-1/10 text-chart-1 border-chart-1/20' },
  { value: 'closer', label: 'Closer', description: 'Pipeline de oportunidades, propostas e fechamento', icon: <BarChart3 className="h-4 w-4" />, color: 'bg-chart-2/10 text-chart-2 border-chart-2/20' },
  { value: 'manager', label: 'Gerente', description: 'Visão gerencial, relatórios e gestão de equipe', icon: <Users className="h-4 w-4" />, color: 'bg-chart-3/10 text-chart-3 border-chart-3/20' },
  { value: 'head_pos_venda', label: 'Head Pós-Venda', description: 'Gestão de projetos, entregas e equipe técnica', icon: <Shield className="h-4 w-4" />, color: 'bg-chart-4/10 text-chart-4 border-chart-4/20' },
  { value: 'ux_po', label: 'UX/PO', description: 'Design, experiência do usuário e gestão de produto', icon: <Palette className="h-4 w-4" />, color: 'bg-chart-5/10 text-chart-5 border-chart-5/20' },
  { value: 'dev_chatbot', label: 'Dev Chatbot', description: 'Desenvolvimento, integrações e análises técnicas', icon: <Code className="h-4 w-4" />, color: 'bg-primary/10 text-primary border-primary/20' },
  { value: 'treinamento', label: 'Treinamento', description: 'Capacitação, onboarding e suporte ao cliente', icon: <GraduationCap className="h-4 w-4" />, color: 'bg-chart-2/10 text-chart-2 border-chart-2/20' },
];

export function RoleSimulationDialog({ open, onOpenChange }: Props) {
  const { startSimulation, simulatedRole } = useRoleSimulation();
  const [selected, setSelected] = useState<UserRole | null>(simulatedRole);

  const handleStart = () => {
    if (!selected) return;
    startSimulation(selected);
    onOpenChange(false);
    toast.success(`Simulando como ${ROLE_OPTIONS.find(r => r.value === selected)?.label}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card p-0 gap-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4 text-primary" />
            Simular Perfil
          </DialogTitle>
          <DialogDescription className="text-xs">
            Visualize a plataforma como outro perfil veria. Nenhuma ação real será afetada.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] px-4">
          <div className="space-y-1.5 pb-2">
            {ROLE_OPTIONS.map((role) => (
              <button
                key={role.value}
                onClick={() => setSelected(role.value)}
                className={cn(
                  'w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all',
                  'hover:bg-muted/50',
                  selected === role.value
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border/50'
                )}
              >
                <div className={cn('p-2 rounded-md border', role.color)}>
                  {role.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{role.label}</span>
                    {selected === role.value && (
                      <UserCheck className="h-3.5 w-3.5 text-primary" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {role.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between p-4 pt-2 border-t border-border/40">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Apenas visual — sem impacto em dados
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleStart} disabled={!selected} className="h-8 text-xs">
              <Eye className="h-3.5 w-3.5 mr-1" />
              Iniciar Simulação
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { ROLE_OPTIONS };
