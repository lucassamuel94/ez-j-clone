import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { usePermissions } from '@/hooks/usePermissions';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileSearch, Plus, AlertTriangle, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApiAnalysis, type ApiAnalysisRequest, type DocFile } from '@/hooks/useApiAnalysis';
import { ApiAnalysisDialog } from '@/components/ApiAnalysisDialog';
import { ApiAnalysisDetailDialog } from '@/components/ApiAnalysisDetailDialog';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-warning/10 text-warning border-warning/20' },
  in_progress: { label: 'Em Análise', className: 'bg-info/10 text-info border-info/20' },
  completed: { label: 'Concluído', className: 'bg-success/10 text-success border-success/20' },
  rejected: { label: 'Recusado', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export default function ApiAnalysisPage() {
  const { requests, isLoading, createRequest, updateRequest, deleteRequest, uploadFile, currentUserId } = useApiAnalysis();
  const { hasPermission } = usePermissions();
  
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ApiAnalysisRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [handledHighlightId, setHandledHighlightId] = useState<string | null>(null);

  // Auto-open a specific request from notification link (only once)
  const highlightId = searchParams.get('id');
  if (highlightId && highlightId !== handledHighlightId && !selectedRequest && requests.length > 0) {
    const found = requests.find((r) => r.id === highlightId);
    if (found) {
      setHandledHighlightId(highlightId);
      setTimeout(() => setSelectedRequest(found), 0);
    }
  }

  // Sync URL with selected request
  const openRequest = (r: ApiAnalysisRequest) => {
    setSelectedRequest(r);
    setSearchParams({ id: r.id }, { replace: true });
  };

  const closeRequest = () => {
    setSelectedRequest(null);
    setSearchParams({}, { replace: true });
  };

  const counts = {
    all: requests.length,
    pending: requests.filter((r) => r.status === 'pending').length,
    in_progress: requests.filter((r) => r.status === 'in_progress').length,
    completed: requests.filter((r) => r.status === 'completed').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
  };

  const byStatus = statusFilter === 'all' ? requests : requests.filter((r) => r.status === statusFilter);
  const q = searchQuery.toLowerCase();
  const filtered = q
    ? byStatus.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        (r.requester_name || '').toLowerCase().includes(q) ||
        (r.assignee_name || '').toLowerCase().includes(q)
      )
    : byStatus;

  const isOverdue = (r: ApiAnalysisRequest) =>
    r.deadline_at && new Date(r.deadline_at) < new Date() && !['completed', 'rejected'].includes(r.status);

  const handleCreate = async (data: { title: string; description: string; documentation_url: string; documentation_files: DocFile[] }) => {
    await createRequest.mutateAsync(data);
    toast.success('Solicitação enviada');
  };

  const handleUpdate = async (payload: { id: string; status?: string; analysis_response?: string; feasibility?: string | null; assigned_to?: string | null }) => {
    await updateRequest.mutateAsync(payload);
    toast.success('Análise atualizada');
  };

  const handleDelete = async (id: string) => {
    await deleteRequest.mutateAsync(id);
    toast.success('Análise excluída');
  };

  const overdueCount = requests.filter(isOverdue).length;

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <main className="px-4 sm:px-6 py-4 space-y-4">
          <PageHeader
            icon={<FileSearch className="h-5 w-5" />}
            title="Análise de API"
            subtitle="Solicitações de análise de integrações"
            badges={overdueCount > 0 ? (
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
                <AlertTriangle className="h-3 w-3" /> {overdueCount} atrasada{overdueCount > 1 ? 's' : ''}
              </Badge>
            ) : undefined}
            actions={
              <Button size="sm" className="h-8 text-xs font-medium" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova Solicitação
              </Button>
            }
            toolbar={
              <div className="flex items-center gap-2">
                <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                  <TabsList className="h-8">
                    <TabsTrigger value="all" className="text-xs px-3 h-7">Todas ({counts.all})</TabsTrigger>
                    <TabsTrigger value="pending" className="text-xs px-3 h-7">Pendentes ({counts.pending})</TabsTrigger>
                    <TabsTrigger value="in_progress" className="text-xs px-3 h-7">Em Análise ({counts.in_progress})</TabsTrigger>
                    <TabsTrigger value="completed" className="text-xs px-3 h-7">Concluídas ({counts.completed})</TabsTrigger>
                    <TabsTrigger value="rejected" className="text-xs px-3 h-7">Recusadas ({counts.rejected})</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por título, solicitante ou responsável..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-xs font-medium bg-background"
                  />
                </div>
              </div>
            }
          />

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileSearch className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma solicitação encontrada.</p>
            </div>
          ) : (
            <div className="border border-border rounded-lg bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Título</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Solicitante</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Responsável</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Prazo</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const overdue = isOverdue(r);
                    const st = STATUS_MAP[r.status] || STATUS_MAP.pending;
                    return (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => openRequest(r)}
                      >
                        <TableCell className="text-[13px] font-medium text-foreground max-w-[240px] truncate">
                          {r.title}
                        </TableCell>
                        <TableCell className="text-[13px] text-muted-foreground">{r.requester_name}</TableCell>
                        <TableCell className="text-[13px] text-muted-foreground">{r.assignee_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={st.className + ' text-[10px]'}>{st.label}</Badge>
                            {overdue && (
                              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] gap-0.5">
                                <AlertTriangle className="h-2.5 w-2.5" /> Atrasado
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className={`text-[13px] ${overdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          {r.deadline_at ? format(new Date(r.deadline_at), 'dd/MM HH:mm') : '—'}
                        </TableCell>
                        <TableCell className="text-[13px] text-muted-foreground">
                          {format(new Date(r.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </main>
      </div>

      <ApiAnalysisDialog open={createOpen} onOpenChange={setCreateOpen} onSubmit={handleCreate} onUploadFile={uploadFile} />
      <ApiAnalysisDetailDialog
        request={selectedRequest}
        open={!!selectedRequest}
        onOpenChange={(open) => !open && closeRequest()}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        currentUserId={currentUserId}
        isAdminOrHead={hasPermission('access_admin')}
      />
    </AppLayout>
  );
}
