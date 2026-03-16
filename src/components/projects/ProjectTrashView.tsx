import { useState } from "react";
import { useDeletedProjects, useRestoreProject, usePermanentDeleteProject } from "@/hooks/useProjects";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, RotateCcw, Clock, Building2, AlertTriangle } from "lucide-react";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PROJECT_TYPE_LABELS, ProjectType } from "@/types/project";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";

export function ProjectTrashView() {
  const { data: deletedProjects, isLoading } = useDeletedProjects();
  const restoreMutation = useRestoreProject();
  const permanentDeleteMutation = usePermanentDeleteProject();
  const { isAdmin } = useUserRole();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!deletedProjects || deletedProjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Trash2 className="h-10 w-10 mb-3 opacity-40" strokeWidth={1.5} />
        <p className="text-sm font-medium">Lixeira vazia</p>
        <p className="text-xs mt-1">Projetos excluídos aparecerão aqui por até 30 dias.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1 py-2">
        <AlertTriangle className="h-4 w-4 text-chart-5" />
        <p className="text-xs text-muted-foreground">
          Projetos são removidos permanentemente após 30 dias na lixeira.
        </p>
      </div>

      {deletedProjects.map((project: any) => {
        const deletedAt = new Date(project.deleted_at);
        const daysRemaining = Math.max(0, 30 - differenceInDays(new Date(), deletedAt));
        const isExpiring = daysRemaining <= 5;

        return (
          <Card key={project.id} className="border-border/40 bg-card/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">
                    PROJ-{String(project.project_number).padStart(4, "0")}
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-[18px] leading-none font-normal border">
                    {PROJECT_TYPE_LABELS[project.project_type as ProjectType] || project.project_type}
                  </Badge>
                </div>
                <p className="text-sm font-semibold text-foreground truncate">{project.company_name}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Excluído {formatDistanceToNow(deletedAt, { addSuffix: true, locale: ptBR })}
                  </span>
                  <span className={cn("font-medium", isExpiring ? "text-destructive" : "text-muted-foreground")}>
                    {daysRemaining} dias restantes
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => restoreMutation.mutate(project.id)}
                  disabled={restoreMutation.isPending}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restaurar
                </Button>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => setConfirmDelete(project.id)}
                    disabled={permanentDeleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O projeto e todos os seus dados serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDelete) {
                  permanentDeleteMutation.mutate(confirmDelete);
                  setConfirmDelete(null);
                }
              }}
            >
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
