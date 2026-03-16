import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PROJECT_TYPE_LABELS, PHASE_LABELS, ProjectType } from "@/types/project";
import { useSystemUsers } from "@/hooks/useSystemUsers";
import { UserCircle, Palette, Code, GraduationCap, CreditCard, Calendar, AlertTriangle } from "lucide-react";

interface KpiProjectsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  projects: any[];
  onSelectProject?: (project: any) => void;
}

function MetaItem({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <Icon className="h-3 w-3 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}

const COMPLEXITY_STYLES: Record<string, string> = {
  baixa: "border-success/50 text-success",
  media: "border-warning/50 text-warning",
  alta: "border-destructive/50 text-destructive",
};

export function KpiProjectsModal({ open, onOpenChange, title, projects, onSelectProject }: KpiProjectsModalProps) {
  const { data: users } = useSystemUsers();

  const userMap = useMemo(() => {
    if (!users) return new Map<string, string>();
    return new Map(users.map((u) => [u.id, u.name]));
  }, [users]);

  const resolveName = (id: string | null | undefined) => (id ? userMap.get(id) ?? null : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {projects.length} {projects.length === 1 ? "projeto" : "projetos"}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 -mx-6 px-6">
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum projeto encontrado.</p>
          ) : (
            <div className="divide-y divide-border/40">
              {projects.map((p) => {
                const uxName = resolveName(p.ux_po_user_id);
                const devName = resolveName(p.dev_user_id);
                const treiName = resolveName(p.treinamento_user_id);

                return (
                  <div
                    key={p.id}
                    className="py-3 cursor-pointer hover:bg-muted/30 -mx-2 px-2 rounded-md transition-colors"
                    onClick={() => {
                      onSelectProject?.(p);
                      onOpenChange(false);
                    }}
                  >
                    {/* Line 1 - Company, type, phase, date, priority */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{p.company_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {PROJECT_TYPE_LABELS[p.project_type as ProjectType] || p.project_type}
                          </span>
                          {p.current_phase && (
                            <>
                              <span className="text-muted-foreground/40">·</span>
                              <span className="text-xs text-muted-foreground">
                                {PHASE_LABELS[p.current_phase] || p.current_phase}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {p.daysOverdue != null && p.daysOverdue > 0 && (
                          <Badge variant="outline" className="text-[10px] border-destructive/50 text-destructive gap-0.5">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {p.daysOverdue}d atraso
                          </Badge>
                        )}
                        {p.due_date && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(p.due_date).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                        {p.priority && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              p.priority === "urgente" ? "border-destructive/50 text-destructive" :
                              p.priority === "alta" ? "border-warning/50 text-warning" :
                              "border-border text-muted-foreground"
                            }`}
                          >
                            {p.priority === "urgente" ? "Urgente" : p.priority === "alta" ? "Alta" : p.priority === "media" ? "Média" : "Baixa"}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Line 2 - Metadata tags */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                      {p.closer_name && <MetaItem icon={UserCircle} label={p.closer_name} />}
                      {uxName && <MetaItem icon={Palette} label={uxName} />}
                      {devName && <MetaItem icon={Code} label={devName} />}
                      {treiName && <MetaItem icon={GraduationCap} label={treiName} />}
                      {p.plan_name && <MetaItem icon={CreditCard} label={p.plan_name} />}
                      {p.complexity_level && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] py-0 h-4 ${COMPLEXITY_STYLES[p.complexity_level] || "border-border text-muted-foreground"}`}
                        >
                          {p.complexity_level === "baixa" ? "Baixa" : p.complexity_level === "media" ? "Média" : p.complexity_level === "alta" ? "Alta" : p.complexity_level}
                        </Badge>
                      )}
                      {p.created_at && (
                        <MetaItem icon={Calendar} label={new Date(p.created_at).toLocaleDateString("pt-BR")} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
