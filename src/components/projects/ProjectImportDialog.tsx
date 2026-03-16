import { useState, useRef, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Upload, FileSpreadsheet, Loader2, Search, CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

// ── Mappable fields for CSV import ──
const MAPPABLE_FIELDS = [
  { key: "company_name", label: "Empresa", required: true },
  { key: "cnpj", label: "CNPJ" },
  { key: "project_type", label: "Tipo de Projeto" },
  { key: "phase_name", label: "Fase" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Prioridade" },
  { key: "assigned_user_email", label: "Responsável (email)" },
  { key: "contact_name", label: "Contato" },
  { key: "contact_phone", label: "Telefone" },
  { key: "contact_email", label: "Email Contato" },
  { key: "project_description", label: "Descrição" },
  { key: "notes", label: "Observações" },
  { key: "due_date", label: "Data Prevista" },
  { key: "start_date", label: "Data Início" },
  { key: "tags", label: "Tags" },
  { key: "version", label: "Versão" },
  { key: "broker", label: "Broker" },
  { key: "closer_name", label: "Closer" },
  { key: "sdr_name", label: "SDR" },
  { key: "complexity_level", label: "Complexidade" },
  { key: "plan_name", label: "Plano" },
  { key: "api_type", label: "Tipo de API" },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface ClickUpPreviewTask {
  clickup_task_id: string;
  clickup_task_name: string;
  clickup_status: string;
  clickup_assignees: string[];
  mapped_project: Record<string, unknown>;
}

export function ProjectImportDialog({ open, onOpenChange, onImportComplete }: Props) {
  // ── CSV state ──
  const [fileData, setFileData] = useState<string[][] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // ── ClickUp state ──
  const [listId, setListId] = useState("");
  const [clickupTasks, setClickupTasks] = useState<ClickUpPreviewTask[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [clickupProjectType, setClickupProjectType] = useState("venda");
  const [clickupPhase, setClickupPhase] = useState("validacao");
  const [clickupStatus, setClickupStatus] = useState("BACKLOG");

  // ── Shared state ──
  const [isLoading, setIsLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: any[] } | null>(null);

  const reset = () => {
    setFileData(null);
    setHeaders([]);
    setMappings({});
    setFileName("");
    setListId("");
    setClickupTasks([]);
    setSelectedTaskIds(new Set());
    setIsLoading(false);
    setImportResult(null);
  };

  // ── CSV handlers ──
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

        if (json.length < 2) {
          toast.error("Planilha deve ter pelo menos 2 linhas");
          return;
        }

        const hdrs = json[0].map((h) => String(h).trim());
        setHeaders(hdrs);
        setFileData(json.slice(1).filter((row) => row.some((cell) => cell !== "")));

        // Auto-map
        const autoMap: Record<string, string> = {};
        for (const field of MAPPABLE_FIELDS) {
          const match = hdrs.find((h) => {
            const lower = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const key = field.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return lower.includes(key) || lower === field.key;
          });
          if (match) autoMap[field.key] = match;
        }
        setMappings(autoMap);
      } catch {
        toast.error("Erro ao ler a planilha");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCsvImport = async () => {
    if (!fileData || !mappings.company_name) {
      toast.error("Mapeie pelo menos o campo Empresa");
      return;
    }

    setIsLoading(true);
    try {
      const headerIndex: Record<string, number> = {};
      headers.forEach((h, i) => { headerIndex[h] = i; });

      const projects = fileData.map((row) => {
        const project: Record<string, unknown> = {};
        for (const field of MAPPABLE_FIELDS) {
          const col = mappings[field.key];
          if (col && headerIndex[col] !== undefined) {
            const val = String(row[headerIndex[col]] || "").trim();
            if (val) project[field.key] = val;
          }
        }
        // Defaults
        if (!project.project_type) project.project_type = "venda";
        if (!project.phase_name) project.phase_name = "validacao";
        if (!project.status) project.status = "BACKLOG";
        return project;
      }).filter((p) => p.company_name);

      if (projects.length === 0) {
        toast.error("Nenhum registro válido encontrado");
        return;
      }

      const { data, error } = await supabase.functions.invoke("import-projects", {
        body: { projects },
      });

      if (error) throw error;

      setImportResult({ imported: data.imported, errors: data.errors });
      if (data.imported > 0) {
        toast.success(`${data.imported} projeto(s) importado(s) com sucesso!`);
        onImportComplete();
      }
      if (data.errors?.length > 0) {
        toast.error(`${data.errors.length} erro(s) na importação`);
      }
    } catch (err) {
      toast.error(`Erro: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── ClickUp handlers ──
  const fetchClickupTasks = useCallback(async () => {
    if (!listId.trim()) {
      toast.error("Informe o List ID do ClickUp");
      return;
    }

    setIsLoading(true);
    setClickupTasks([]);
    try {
      const { data, error } = await supabase.functions.invoke("clickup-import", {
        body: {
          list_id: listId.trim(),
          mode: "preview",
          project_type: clickupProjectType,
          phase_name: clickupPhase,
          status: clickupStatus,
        },
      });

      if (error) throw error;

      if (data.tasks && data.tasks.length > 0) {
        setClickupTasks(data.tasks);
        setSelectedTaskIds(new Set(data.tasks.map((t: ClickUpPreviewTask) => t.clickup_task_id)));
        toast.success(`${data.tasks.length} task(s) encontrada(s)`);
      } else {
        toast.info("Nenhuma task encontrada nessa lista");
      }
    } catch (err) {
      toast.error(`Erro: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [listId, clickupProjectType, clickupPhase, clickupStatus]);

  const handleClickupImport = async () => {
    if (selectedTaskIds.size === 0) {
      toast.error("Selecione pelo menos uma task");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("clickup-import", {
        body: {
          list_id: listId.trim(),
          mode: "import",
          task_ids: Array.from(selectedTaskIds),
          project_type: clickupProjectType,
          phase_name: clickupPhase,
          status: clickupStatus,
        },
      });

      if (error) throw error;

      setImportResult({ imported: data.imported, errors: data.errors });
      if (data.imported > 0) {
        toast.success(`${data.imported} projeto(s) importado(s) do ClickUp!`);
        onImportComplete();
      }
      if (data.errors?.length > 0) {
        toast.error(`${data.errors.length} erro(s) na importação`);
      }
    } catch (err) {
      toast.error(`Erro: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTask = (id: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedTaskIds.size === clickupTasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(clickupTasks.map((t) => t.clickup_task_id)));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Projetos</DialogTitle>
          <DialogDescription>Importe projetos via planilha ou diretamente do ClickUp.</DialogDescription>
        </DialogHeader>

        {importResult ? (
          <div className="flex flex-col items-center gap-4 py-8">
            {importResult.imported > 0 ? (
              <CheckCircle2 className="h-12 w-12 text-success" />
            ) : (
              <XCircle className="h-12 w-12 text-destructive" />
            )}
            <div className="text-center">
              <p className="text-lg font-semibold">{importResult.imported} projeto(s) importado(s)</p>
              {importResult.errors.length > 0 && (
                <p className="text-sm text-destructive mt-1">{importResult.errors.length} erro(s)</p>
              )}
            </div>
            {importResult.errors.length > 0 && (
              <ScrollArea className="max-h-32 w-full">
                <div className="space-y-1">
                  {importResult.errors.map((err: any, i: number) => (
                    <div key={i} className="text-xs text-destructive bg-destructive/5 p-2 rounded">
                      Linha {err.index + 1}: {err.error}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            <Button variant="outline" onClick={reset}>Nova Importação</Button>
          </div>
        ) : (
          <Tabs defaultValue="csv" className="flex-1 min-h-0">
            <TabsList className="h-9">
              <TabsTrigger value="csv" className="text-xs gap-1.5 px-3">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                CSV / Excel
              </TabsTrigger>
              <TabsTrigger value="clickup" className="text-xs gap-1.5 px-3">
                <Search className="h-3.5 w-3.5" />
                ClickUp
              </TabsTrigger>
            </TabsList>

            {/* ── CSV Tab ── */}
            <TabsContent value="csv" className="mt-3 space-y-4 overflow-auto">
              {!fileData ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="rounded-full bg-muted p-4">
                    <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Selecione uma planilha (.xlsx ou .csv)</p>
                  <Button variant="outline" onClick={() => fileRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" /> Escolher Arquivo
                  </Button>
                  <input ref={fileRef} type="file" accept=".xlsx,.csv,.xls" className="hidden" onChange={handleFileChange} />
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    <strong>{fileName}</strong> — {fileData.length} registros
                  </p>

                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2.5 pr-2">
                      {MAPPABLE_FIELDS.map((field) => (
                        <div key={field.key} className="flex items-center gap-3">
                          <Label className="w-36 text-xs shrink-0">
                            {field.label} {"required" in field && field.required && <span className="text-destructive">*</span>}
                          </Label>
                          <Select
                            value={mappings[field.key] || "_none"}
                            onValueChange={(v) =>
                              setMappings((prev) => ({ ...prev, [field.key]: v === "_none" ? "" : v }))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Selecione a coluna" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">— Não mapear —</SelectItem>
                              {headers.map((h) => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {/* Preview */}
                  {fileData.length > 0 && mappings.company_name && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Preview (5 primeiras linhas)
                      </span>
                      <ScrollArea className="max-h-[120px] mt-1">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {MAPPABLE_FIELDS.filter((f) => mappings[f.key]).map((f) => (
                                <TableHead key={f.key} className="text-xs py-1 px-2 whitespace-nowrap">{f.label}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {fileData.slice(0, 5).map((row, ri) => {
                              const headerIndex: Record<string, number> = {};
                              headers.forEach((h, i) => { headerIndex[h] = i; });
                              return (
                                <TableRow key={ri}>
                                  {MAPPABLE_FIELDS.filter((f) => mappings[f.key]).map((f) => (
                                    <TableCell key={f.key} className="text-xs py-1 px-2 truncate max-w-[150px]">
                                      {String(row[headerIndex[mappings[f.key]]] || "").slice(0, 50)}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={reset} disabled={isLoading}>Voltar</Button>
                    <Button onClick={handleCsvImport} disabled={isLoading || !mappings.company_name}>
                      {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Importar {fileData.length} registros
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── ClickUp Tab ── */}
            <TabsContent value="clickup" className="mt-3 space-y-4 overflow-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">ClickUp List ID</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={listId}
                      onChange={(e) => setListId(e.target.value)}
                      placeholder="Ex: 901234567890"
                      className="h-8 text-xs font-mono"
                    />
                    <Button size="sm" onClick={fetchClickupTasks} disabled={isLoading} className="shrink-0 h-8">
                      {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                      <span className="ml-1.5">Buscar</span>
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Tipo de Projeto</Label>
                  <Select value={clickupProjectType} onValueChange={setClickupProjectType}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="venda">Venda</SelectItem>
                      <SelectItem value="evolucao">Evolução</SelectItem>
                      <SelectItem value="api_oficial">API Oficial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Fase Inicial</Label>
                  <Select value={clickupPhase} onValueChange={setClickupPhase}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="validacao">Validação</SelectItem>
                      <SelectItem value="ux_po">UX/PO</SelectItem>
                      <SelectItem value="dev_chatbot">Dev Chatbot</SelectItem>
                      <SelectItem value="treinamento">Treinamento</SelectItem>
                      <SelectItem value="ativacao">Ativação</SelectItem>
                      <SelectItem value="verificacao_bm">Verificação BM</SelectItem>
                      <SelectItem value="automacao">Automação</SelectItem>
                      <SelectItem value="curadoria_ia">Curadoria IA</SelectItem>
                      <SelectItem value="go_live_assistido">Go Live Assistido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {clickupTasks.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {selectedTaskIds.size} de {clickupTasks.length} selecionadas
                    </span>
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={toggleAll}>
                      {selectedTaskIds.size === clickupTasks.length ? "Desmarcar todas" : "Selecionar todas"}
                    </Button>
                  </div>

                  <ScrollArea className="max-h-[250px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8 px-2"></TableHead>
                          <TableHead className="text-xs py-1">Task</TableHead>
                          <TableHead className="text-xs py-1">Status</TableHead>
                          <TableHead className="text-xs py-1">Responsável</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clickupTasks.map((task) => (
                          <TableRow key={task.clickup_task_id}>
                            <TableCell className="px-2 py-1">
                              <Checkbox
                                checked={selectedTaskIds.has(task.clickup_task_id)}
                                onCheckedChange={() => toggleTask(task.clickup_task_id)}
                              />
                            </TableCell>
                            <TableCell className="text-xs py-1 max-w-[200px] truncate">
                              {task.clickup_task_name}
                            </TableCell>
                            <TableCell className="py-1">
                              <Badge variant="outline" className="text-[10px]">{task.clickup_status}</Badge>
                            </TableCell>
                            <TableCell className="text-xs py-1 text-muted-foreground">
                              {task.clickup_assignees?.[0] || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>

                  <div className="flex justify-end">
                    <Button onClick={handleClickupImport} disabled={isLoading || selectedTaskIds.size === 0}>
                      {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Importar {selectedTaskIds.size} projeto(s)
                    </Button>
                  </div>
                </>
              )}

              {!isLoading && clickupTasks.length === 0 && (
                <div className="text-center py-8">
                  <AlertTriangle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Informe o List ID e clique em Buscar.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Encontre o List ID na URL do ClickUp: app.clickup.com/.../li/<strong>LIST_ID</strong>
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
