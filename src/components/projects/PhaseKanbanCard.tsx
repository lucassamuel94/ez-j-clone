import React, { DragEvent, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Calendar, Clock, Copy, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PRIORITY_LABELS, ProjectPriority } from "@/types/project";
import { formatDateBR } from "@/utils/dateFormat";
import type { PhaseDetailItem } from "@/hooks/usePhaseDetail";

// ── Helpers (module-level, stable references) ──

const priorityConfig: Record<string, { badge: string }> = {
  urgente: { badge: "bg-destructive/10 text-destructive border-destructive/20" },
  alta: { badge: "bg-chart-5/10 text-chart-5 border-chart-5/20" },
  media: { badge: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  baixa: { badge: "bg-muted text-muted-foreground border-border/30" },
};

type DeadlineStatus = "overdue" | "near" | "ok";

function getDeadlineStatus(dueDate: string | null | undefined): DeadlineStatus {
  if (!dueDate) return "ok";
  const now = new Date();
  const due = new Date(dueDate);
  const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 3) return "near";
  return "ok";
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ── Props ──

export interface PhaseKanbanCardProps {
  item: PhaseDetailItem;
  isDragged: boolean;
  visibleFieldIds: Set<string>;
  lastComment: string | undefined;
  onSelect: (item: PhaseDetailItem) => void;
  onDragStart: (e: DragEvent<HTMLDivElement>, item: PhaseDetailItem) => void;
  onDragEnd: () => void;
  onSoftDelete: (projectId: string, currentStatus: string) => void;
}

export const PhaseKanbanCard = React.memo(function PhaseKanbanCard({
  item,
  isDragged,
  visibleFieldIds,
  lastComment,
  onSelect,
  onDragStart,
  onDragEnd,
  onSoftDelete,
}: PhaseKanbanCardProps) {
  const deadline = getDeadlineStatus(item.project?.due_date);

  const handleClick = useCallback(() => {
    if (!isDragged) onSelect(item);
  }, [isDragged, onSelect, item]);

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>) => onDragStart(e, item),
    [onDragStart, item]
  );

  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}/projects?project=${item.project_id}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  }, [item.project_id]);

  const handleSoftDelete = useCallback(() => {
    onSoftDelete(item.project_id, item.project?.overall_status || item.status);
  }, [onSoftDelete, item.project_id, item.project?.overall_status, item.status]);

  const isVisible = (id: string) => visibleFieldIds.has(id);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          draggable
          onDragStart={handleDragStart}
          onDragEnd={onDragEnd}
          className={cn(
            "rounded-lg border border-border/50 bg-card shadow-sm hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30 transition-all duration-150 cursor-grab active:cursor-grabbing",
            isDragged && "opacity-40 scale-95",
            deadline === "overdue" && "border-l-2 border-l-destructive",
            deadline === "near" && "border-l-2 border-l-yellow-400",
          )}
          onClick={handleClick}
        >
          <div className="px-3 py-2.5 space-y-1.5">
            {/* Company name */}
            <div className="flex items-start gap-1.5">
              <p className="text-[13px] font-semibold text-foreground truncate leading-snug flex-1">
                {item.project?.company_name || "Sem nome"}
              </p>
              {item.phase_name === "verificacao_bm" && (
                <Badge
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 h-[16px] rounded-full bg-primary/5 text-primary/70 border-primary/20 shrink-0"
                >
                  API Oficial
                </Badge>
              )}
            </div>

            {/* Metadata row */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {isVisible("project_number") && (
                <span className="text-[10px] font-mono text-muted-foreground/50 tracking-wider">
                  PROJ-{String(item.project?.project_number || 0).padStart(4, "0")}
                </span>
              )}
              {isVisible("priority") && item.project?.priority && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1.5 py-0 h-[17px] leading-none font-medium border rounded-full",
                    priorityConfig[item.project.priority]?.badge || priorityConfig.baixa.badge,
                  )}
                >
                  {PRIORITY_LABELS[item.project.priority as ProjectPriority] || item.project.priority}
                </Badge>
              )}
              {isVisible("status") && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-[17px] leading-none font-normal rounded-full border-border/30 text-muted-foreground/70 bg-muted/10"
                >
                  {item.status}
                </Badge>
              )}
            </div>

            {/* Contact name */}
            {isVisible("contact_name") && item.project?.contact_name && (
              <p className="text-[11px] text-muted-foreground/50 truncate">{item.project.contact_name}</p>
            )}

            {/* Last comment */}
            {isVisible("last_comment") && lastComment && (
              <div className="flex items-start gap-1.5 pt-0.5">
                <MessageSquare className="h-3 w-3 text-muted-foreground/30 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                <span className="text-[11px] text-muted-foreground/50 line-clamp-2 leading-relaxed">
                  {lastComment}
                </span>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-1.5 border-t border-border/10">
              <div className="flex items-center gap-1.5">
                {isVisible("created_at") && (
                  <>
                    <Calendar className="h-3 w-3 text-muted-foreground/30 flex-shrink-0" strokeWidth={1.5} />
                    <span className="text-[11px] text-muted-foreground/40">
                      {item.project?.created_at ? formatDateBR(item.project.created_at) : "-"}
                    </span>
                  </>
                )}
                {isVisible("updated_at") && (
                  <>
                    <Clock className="h-3 w-3 text-muted-foreground/30 flex-shrink-0" strokeWidth={1.5} />
                    <span className="text-[11px] text-muted-foreground/40">
                      {item.project?.updated_at ? formatDateBR(item.project.updated_at) : "-"}
                    </span>
                  </>
                )}
              </div>
              {isVisible("assignee") && (
                <Avatar className="h-5 w-5 border border-border/30">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold text-[8px]">
                    {item.assigned_user ? getInitials(item.assigned_user.name) : "?"}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem className="gap-2 text-xs" onClick={handleCopyLink}>
          <Copy className="h-3.5 w-3.5" />
          Copiar link
        </ContextMenuItem>
        <ContextMenuItem
          className="gap-2 text-xs text-destructive focus:text-destructive"
          onClick={handleSoftDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Mover para lixeira
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});
