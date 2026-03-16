import { useState, useCallback, useRef, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, Download, Check, X, CloudDownload, Cpu, DatabaseZap, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PHASE_LABELS, PHASES_BY_TYPE, ProjectType } from "@/types/project";
import { usePhaseStatuses } from "@/hooks/usePhaseStatuses";
import { ListGroup } from "@/components/kibo-ui/list";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPhase?: string;
  onImported: (projectId: string) => void;
}

const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: "venda", label: "Venda" },
  { value: "migracao", label: "Migração" },
  { value: "evolucao", label: "Evolução" },
  { value: "api_oficial", label: "API Oficial" },
];

type ImportStep = "idle" | "fetching" | "mapping" | "importing" | "done" | "error";

interface StepInfo {
  key: ImportStep;
  label: string;
  icon: React.ReactNode;
}

const STEPS: StepInfo[] = [
  { key: "fetching", label: "Buscando no ClickUp", icon: <CloudDownload className="h-4 w-4" /> },
  { key: "mapping", label: "Mapeando dados", icon: <Cpu className="h-4 w-4" /> },
  { key: "importing", label: "Salvando projeto", icon: <DatabaseZap className="h-4 w-4" /> },
  { key: "done", label: "Concluído", icon: <CheckCircle2 className="h-4 w-4" /> },
];

export function ClickUpQuickImportDialog({ open, onOpenChange, defaultPhase, onImported }: Props) {
  const [taskId, setTaskId] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("venda");
  const [phaseName, setPhaseName] = useState(defaultPhase || "validacao");
  const [status, setStatus] = useState("BACKLOG");
  const [autoMapStatus, setAutoMapStatus] = useState(true);
  const [currentStep, setCurrentStep] = useState<ImportStep>("idle");
  const [importResult, setImportResult] = useState<{
    imported: number;
    errors: Array<{ index: number; error: string }>;
    projectId?: string;
    taskName?: string;
  } | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { getStatusesForPhase } = usePhaseStatuses();
  const statuses = getStatusesForPhase(phaseName);
  const phases = PHASES_BY_TYPE[projectType] || PHASES_BY_TYPE.venda;

  const startTimer = useCallback(() => {
    setElapsedMs(0);
    const start = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 100);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  const reset = useCallback(() => {
    setTaskId("");
    setProjectType("venda");
    setPhaseName(defaultPhase || "validacao");
    setStatus("BACKLOG");
    setAutoMapStatus(true);
    setCurrentStep("idle");
    setImportResult(null);
    setElapsedMs(0);
    stopTimer();
  }, [defaultPhase, stopTimer]);

  const handleImport = useCallback(async () => {
    const trimmed = taskId.trim();
    if (!trimmed) {
      toast.error("Informe o Task ID do ClickUp");
      return;
    }

    startTimer();
    setImportResult(null);

    try {
      // Step 1: Fetching
      setCurrentStep("fetching");

      // We simulate steps because the edge function does fetch+map+import in one call
      // but we can time the phases approximately
      const fetchStart = Date.now();

      const { data, error } = await supabase.functions.invoke("clickup-import", {
        body: {
          mode: "import",
          task_id: trimmed,
          project_type: projectType,
          phase_name: phaseName,
          status,
          auto_map_status: autoMapStatus,
        },
      });

      if (error) throw error;

      // Show mapping briefly
      setCurrentStep("mapping");
      await new Promise((r) => setTimeout(r, 300));

      setCurrentStep("importing");
      await new Promise((r) => setTimeout(r, 300));

      stopTimer();

      if (data.imported > 0) {
        const firstProjectId = data.projects?.[0]?.project_id;
        setCurrentStep("done");
        setImportResult({
          imported: data.imported,
          errors: data.errors || [],
          projectId: firstProjectId,
          taskName: data.clickup_tasks_found ? `${data.clickup_tasks_found} task(s)` : undefined,
        });
      } else {
        setCurrentStep("error");
        setImportResult({
          imported: 0,
          errors: data.errors || [{ index: 0, error: "Nenhum projeto importado" }],
        });
      }
    } catch (err) {
      stopTimer();
      setCurrentStep("error");
      setImportResult({
        imported: 0,
        errors: [{ index: 0, error: (err as Error).message }],
      });
    }
  }, [taskId, projectType, phaseName, status, autoMapStatus, startTimer, stopTimer]);

  const handleClose = useCallback(() => {
    if (importResult?.projectId) {
      onImported(importResult.projectId);
    }
    reset();
    onOpenChange(false);
  }, [importResult, onImported, reset, onOpenChange]);

  const isProcessing = currentStep !== "idle" && currentStep !== "done" && currentStep !== "error";
  const stepOrder: ImportStep[] = ["fetching", "mapping", "importing", "done"];
  const currentStepIndex = stepOrder.indexOf(currentStep);

  const progressPercent =
    currentStep === "idle" ? 0 :
    currentStep === "error" ? 100 :
    currentStep === "done" ? 100 :
    ((currentStepIndex + 1) / STEPS.length) * 100;

  const formatElapsed = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v && !isProcessing) {
        reset();
        onOpenChange(v);
      }
    }}>
      <DialogContent className="max-w-md bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Importar do ClickUp
          </DialogTitle>
          <DialogDescription>
            Informe o Task ID da task do ClickUp.
          </DialogDescription>
        </DialogHeader>

        {currentStep === "idle" ? (
          /* ===== FORM STATE ===== */
          <div className="space-y-3 mt-2">
            <ListGroup label="Identificação" defaultOpen>
              <div className="px-2 pb-2">
                <Label className="text-xs font-medium">Task ID</Label>
                <Input
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                  placeholder="Ex: abc123xyz"
                  className="h-8 text-xs font-mono mt-1"
                  onKeyDown={(e) => e.key === 'Enter' && taskId.trim() && handleImport()}
                />
              </div>
            </ListGroup>

            <ListGroup label="Configurações" defaultOpen>
              <div className="px-2 pb-2 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium">Tipo de Projeto</Label>
                    <Select value={projectType} onValueChange={(v) => {
                      setProjectType(v as ProjectType);
                      const newPhases = PHASES_BY_TYPE[v] || [];
                      if (!newPhases.includes(phaseName)) setPhaseName(newPhases[0] || "validacao");
                    }}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PROJECT_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Fase Inicial</Label>
                    <Select value={phaseName} onValueChange={setPhaseName}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {phases.map((p) => (
                          <SelectItem key={p} value={p}>{PHASE_LABELS[p] || p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium">Status Inicial</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between py-1">
                  <Label className="text-xs font-medium cursor-pointer" htmlFor="auto-map-switch">
                    Mapear status automaticamente
                  </Label>
                  <Switch id="auto-map-switch" checked={autoMapStatus} onCheckedChange={setAutoMapStatus} />
                </div>
              </div>
            </ListGroup>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleImport} disabled={!taskId.trim()}>
                Importar
              </Button>
            </div>
          </div>
        ) : (
          /* ===== PROGRESS / RESULT STATE ===== */
          <div className="space-y-4 mt-2">
            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Progresso</span>
                <span className="text-xs font-mono text-muted-foreground">{formatElapsed(elapsedMs)}</span>
              </div>
              <Progress value={progressPercent} className="h-1.5" />
            </div>

            {/* Steps timeline */}
            <div className="space-y-1">
              {STEPS.map((step, i) => {
                const stepIdx = stepOrder.indexOf(step.key);
                const isActive = step.key === currentStep;
                const isCompleted = currentStep === "done" ? true : (currentStep !== "error" && stepIdx < currentStepIndex);
                const isError = step.key !== "done" && currentStep === "error" && stepIdx <= currentStepIndex;
                const isPending = !isActive && !isCompleted && !isError;

                return (
                  <div
                    key={step.key}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                      isActive && "bg-primary/5 border border-primary/20",
                      isCompleted && "opacity-100",
                      isPending && "opacity-40",
                      isError && "bg-destructive/5 border border-destructive/20"
                    )}
                  >
                    <div className={cn(
                      "flex items-center justify-center h-7 w-7 rounded-full border transition-colors",
                      isActive && "border-primary bg-primary/10 text-primary",
                      isCompleted && "border-chart-3 bg-chart-3/10 text-chart-3",
                      isError && "border-destructive bg-destructive/10 text-destructive",
                      isPending && "border-border text-muted-foreground"
                    )}>
                      {isCompleted && !isError ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : isError ? (
                        <X className="h-3.5 w-3.5" />
                      ) : isActive ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        step.icon
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-xs font-medium",
                        isActive && "text-foreground",
                        isCompleted && "text-chart-3",
                        isError && "text-destructive",
                        isPending && "text-muted-foreground"
                      )}>
                        {step.label}
                      </p>
                    </div>
                    {isActive && (
                      <Badge variant="outline" className="text-[10px] h-5 animate-pulse">
                        Processando...
                      </Badge>
                    )}
                    {isCompleted && !isError && (
                      <Badge variant="outline" className="text-[10px] h-5 border-chart-3/30 text-chart-3 bg-chart-3/5">
                        OK
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Result */}
            {(currentStep === "done" || currentStep === "error") && importResult && (
              <>
                <Separator />
                <div className={cn(
                  "rounded-lg p-3 space-y-2",
                  currentStep === "done" ? "bg-chart-3/5 border border-chart-3/20" : "bg-destructive/5 border border-destructive/20"
                )}>
                  {currentStep === "done" ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-chart-3" />
                      <span className="text-sm font-medium text-foreground">
                        {importResult.imported} projeto{importResult.imported > 1 ? 's' : ''} importado{importResult.imported > 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatElapsed(elapsedMs)}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span className="text-sm font-medium text-destructive">Erro na importação</span>
                      </div>
                      {importResult.errors.map((err, i) => (
                        <p key={i} className="text-xs text-destructive/80 pl-6">
                          {err.error}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  {currentStep === "error" && (
                    <Button variant="outline" size="sm" onClick={() => { setCurrentStep("idle"); setImportResult(null); }}>
                      Tentar novamente
                    </Button>
                  )}
                  <Button size="sm" onClick={handleClose}>
                    {currentStep === "done" ? "Concluir" : "Fechar"}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
