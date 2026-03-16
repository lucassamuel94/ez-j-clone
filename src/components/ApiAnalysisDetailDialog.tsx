import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, Loader2, AlertTriangle, Clock, Link2, FileText, Download, CheckCircle2, AlertCircle, XCircle, Copy, Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { ApiAnalysisRequest, DocFile } from '@/hooks/useApiAnalysis';
import { useSystemUsers } from '@/hooks/useSystemUsers';

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-warning/10 text-warning border-warning/20' },
  in_progress: { label: 'Em Análise', className: 'bg-info/10 text-info border-info/20' },
  completed: { label: 'Concluído', className: 'bg-success/10 text-success border-success/20' },
  rejected: { label: 'Recusado', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

interface Props {
  request: ApiAnalysisRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (payload: { id: string; status?: string; analysis_response?: string; feasibility?: string | null; assigned_to?: string | null }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  currentUserId?: string;
  isAdminOrHead?: boolean;
}

export function ApiAnalysisDetailDialog({ request, open, onOpenChange, onUpdate, onDelete, currentUserId, isAdminOrHead }: Props) {
  const [status, setStatus] = useState('');
  const [response, setResponse] = useState('');
  const [feasibility, setFeasibility] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data: users = [] } = useSystemUsers();

  useEffect(() => {
    if (request) {
      setStatus(request.status);
      setResponse(request.analysis_response || '');
      setFeasibility(request.feasibility || null);
      setAssignedTo(request.assigned_to || null);
    }
  }, [request]);

  if (!request) return null;

  const isAssignedDev = currentUserId === request.assigned_to;
  const canEdit = (isAssignedDev || isAdminOrHead) && request.status !== 'completed' && request.status !== 'rejected';
  const canReassign = !!isAdminOrHead;
  const canDelete = !!isAdminOrHead;
  const isOverdue = request.deadline_at && new Date(request.deadline_at) < new Date() && !['completed', 'rejected'].includes(request.status);
  const statusInfo = STATUS_MAP[request.status] || STATUS_MAP.pending;
  const isDirty = status !== request.status || response !== (request.analysis_response || '') || feasibility !== (request.feasibility || null) || assignedTo !== (request.assigned_to || null);

  // Merge legacy documentation_url with documentation_files
  const allDocs: DocFile[] = [];
  if (request.documentation_files && request.documentation_files.length > 0) {
    allDocs.push(...request.documentation_files);
  } else if (request.documentation_url) {
    allDocs.push({ type: 'link', name: request.documentation_url, url: request.documentation_url });
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate({ id: request.id, status, analysis_response: response, feasibility, assigned_to: assignedTo });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(request.id);
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/api-analysis?id=${request.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <DialogTitle className="text-base">{request.title}</DialogTitle>
            <Badge variant="outline" className={statusInfo.className}>{statusInfo.label}</Badge>
            {isOverdue && (
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
                <AlertTriangle className="h-3 w-3" /> Atrasado
              </Badge>
            )}
            <Button variant="ghost" size="sm" className="h-7 px-2 ml-auto text-xs gap-1" onClick={copyLink}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copiado' : 'Copiar link'}
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
            <div>
              <span className="text-muted-foreground text-xs">Solicitante</span>
              <p className="font-medium text-foreground">{request.requester_name}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Responsável</span>
              {canReassign ? (
                <Select value={assignedTo || 'unassigned'} onValueChange={(v) => setAssignedTo(v === 'unassigned' ? null : v)}>
                  <SelectTrigger className="h-8 mt-0.5 text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Não atribuído</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-medium text-foreground">{request.assignee_name}</p>
              )}
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Criado em</span>
              <p className="font-medium text-foreground">{format(new Date(request.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs flex items-center gap-1">
                <Clock className="h-3 w-3" /> Prazo
              </span>
              <p className={`font-medium ${isOverdue ? 'text-destructive' : 'text-foreground'}`}>
                {request.deadline_at ? format(new Date(request.deadline_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '—'}
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Descrição</Label>
            <div className="text-[13px] text-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-3 border border-border">
              {request.description}
            </div>
          </div>

          {/* Documentation */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Documentação ({allDocs.length})</Label>
            {allDocs.length > 0 ? (
              <div className="space-y-1.5">
                {allDocs.map((doc, i) => (
                  <a
                    key={i}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[13px] bg-muted/30 rounded-md px-3 py-2 border border-border hover:bg-muted/50 transition-colors group"
                  >
                    {doc.type === 'link' ? (
                      <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate flex-1 text-foreground">{doc.name}</span>
                    {doc.type === 'link' ? (
                      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    ) : (
                      <Download className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    )}
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground italic">Nenhuma documentação anexada.</p>
            )}
          </div>

          {/* Feasibility */}
          {canEdit ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Viabilidade da Integração</Label>
              <Select value={feasibility || ''} onValueChange={(v) => setFeasibility(v || null)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione a viabilidade..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="possible">
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Possível</span>
                  </SelectItem>
                  <SelectItem value="partially_possible">
                    <span className="flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5 text-warning" /> Parcialmente Possível</span>
                  </SelectItem>
                  <SelectItem value="impossible">
                    <span className="flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5 text-destructive" /> Impossível</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : request.feasibility ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Viabilidade</Label>
              <div>
                {request.feasibility === 'possible' && (
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Possível
                  </Badge>
                )}
                {request.feasibility === 'partially_possible' && (
                  <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 gap-1">
                    <AlertCircle className="h-3 w-3" /> Parcialmente Possível
                  </Badge>
                )}
                {request.feasibility === 'impossible' && (
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
                    <XCircle className="h-3 w-3" /> Impossível
                  </Badge>
                )}
              </div>
            </div>
          ) : null}

          {/* Status edit */}
          {canEdit && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="in_progress">Em Análise</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="rejected">Recusado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Analysis response */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{canEdit ? 'Retorno da Análise' : 'Retorno'}</Label>
            {canEdit ? (
              <Textarea rows={5} placeholder="Escreva aqui o retorno da análise técnica..." value={response} onChange={(e) => setResponse(e.target.value)} />
            ) : request.analysis_response ? (
              <div className="text-[13px] text-foreground whitespace-pre-wrap bg-success/5 rounded-lg p-3 border border-success/20">
                {request.analysis_response}
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground italic">Sem retorno ainda.</p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <div>
            {canDelete && onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5">
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir análise?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A solicitação "{request.title}" será excluída permanentemente. Essa ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
            {(canEdit || canReassign) && (
              <Button onClick={handleSave} disabled={saving || !isDirty}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Alterações
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
