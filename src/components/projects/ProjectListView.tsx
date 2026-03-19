import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { PROJECT_TYPE_LABELS, PHASE_LABELS, PRIORITY_LABELS, ProjectType, ProjectPriority } from '@/types/project';
import { formatDateBR } from '@/utils/dateFormat';
import { Building2, Clock, MessageSquare } from 'lucide-react';
import { FieldConfig } from './ProjectViewConfig';
import { supabase } from '@/integrations/supabase/client';
import {
  TableProvider,
  TableHeader,
  TableHeaderGroup,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableColumnHeader,
  type ColumnDef,
} from '@/components/kibo-ui/table';

interface ProjectRow {
  id: string;
  project_number: number;
  company_name: string;
  cnpj: string | null;
  project_type: string;
  current_phase: string | null;
  overall_status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  contact_name: string | null;
  tags: string[] | null;
}

interface ProjectListViewProps {
  projects: ProjectRow[];
  onSelect: (project: ProjectRow) => void;
  columns: FieldConfig[];
}

const statusColors: Record<string, string> = {
  ativo: 'bg-primary/10 text-primary border-primary/20',
  em_pausa: 'bg-chart-5/10 text-chart-5 border-chart-5/20',
  concluido: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  cancelado: 'bg-destructive/10 text-destructive border-destructive/20',
};

const statusLabels: Record<string, string> = {
  ativo: 'Ativo',
  em_pausa: 'Pausado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const projectTypeColors: Record<string, string> = {
  venda: 'bg-chart-3/10 text-chart-3 border-chart-3/20',
  evolucao: 'bg-primary/10 text-primary border-primary/20',
  api_oficial: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
  migracao: 'bg-chart-2/10 text-chart-2 border-chart-2/20',
};

const priorityColors: Record<string, string> = {
  baixa: 'bg-muted/30 text-muted-foreground border-border',
  media: 'bg-primary/10 text-primary border-primary/20',
  alta: 'bg-warning/10 text-warning border-warning/20',
  urgente: 'bg-destructive/10 text-destructive border-destructive/20',
};

export function ProjectListView({ projects, onSelect, columns: fieldColumns }: ProjectListViewProps) {
  const projectIds = useMemo(() => projects.map(p => p.id), [projects]);

  const { data: lastCommentsData, isLoading: isLoadingComments } = useQuery({
    queryKey: ['list-last-comments', projectIds],
    queryFn: async () => {
      if (projectIds.length === 0) return [];
      const { data, error } = await supabase
        .from('project_activity_logs')
        .select('project_id, description')
        .in('project_id', projectIds)
        .eq('action_type', 'observation')
        .order('created_at', { ascending: false })
        .limit(projectIds.length * 3);
      if (error) throw error;
      return data || [];
    },
    enabled: projectIds.length > 0,
    staleTime: 30 * 1000,
  });

  const lastCommentMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!lastCommentsData) return map;
    for (const row of lastCommentsData) {
      if (!map.has(row.project_id)) {
        map.set(row.project_id, row.description);
      }
    }
    return map;
  }, [lastCommentsData]);

  const visibleFieldIds = useMemo(() => new Set(fieldColumns.filter(c => c.visible).map(c => c.id)), [fieldColumns]);

  const allColumns = useMemo<ColumnDef<ProjectRow>[]>(() => {
    const cols: ColumnDef<ProjectRow>[] = [];

    if (visibleFieldIds.has('project_number')) {
      cols.push({
        accessorKey: 'project_number',
        header: ({ column }) => <TableColumnHeader column={column} title="Nº" />,
        cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">PROJ-{String(row.original.project_number).padStart(4, '0')}</span>,
      });
    }
    if (visibleFieldIds.has('company_name')) {
      cols.push({
        accessorKey: 'company_name',
        header: ({ column }) => <TableColumnHeader column={column} title="Empresa" />,
        cell: ({ row }) => (
          <div>
            <span className="font-medium text-sm">{row.original.company_name}</span>
            {row.original.cnpj && <span className="block text-xs text-muted-foreground font-mono">{row.original.cnpj}</span>}
          </div>
        ),
      });
    }
    if (visibleFieldIds.has('project_type')) {
      cols.push({
        accessorKey: 'project_type',
        header: ({ column }) => <TableColumnHeader column={column} title="Tipo" />,
        cell: ({ row }) => (
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${projectTypeColors[row.original.project_type] || ''}`}>
            {PROJECT_TYPE_LABELS[row.original.project_type as ProjectType] || row.original.project_type}
          </Badge>
        ),
      });
    }
    if (visibleFieldIds.has('current_phase')) {
      cols.push({
        accessorKey: 'current_phase',
        header: ({ column }) => <TableColumnHeader column={column} title="Fase" />,
        cell: ({ row }) => <span className="text-xs">{row.original.current_phase ? PHASE_LABELS[row.original.current_phase] || row.original.current_phase : '—'}</span>,
      });
    }
    if (visibleFieldIds.has('overall_status')) {
      cols.push({
        accessorKey: 'overall_status',
        header: ({ column }) => <TableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => (
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${statusColors[row.original.overall_status] || ''}`}>
            {statusLabels[row.original.overall_status] || row.original.overall_status}
          </Badge>
        ),
      });
    }
    if (visibleFieldIds.has('priority')) {
      cols.push({
        accessorKey: 'priority',
        header: ({ column }) => <TableColumnHeader column={column} title="Prioridade" />,
        cell: ({ row }) => (
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${priorityColors[row.original.priority] || ''}`}>
            {PRIORITY_LABELS[row.original.priority as ProjectPriority] || row.original.priority}
          </Badge>
        ),
      });
    }
    if (visibleFieldIds.has('contact_name')) {
      cols.push({
        accessorKey: 'contact_name',
        header: ({ column }) => <TableColumnHeader column={column} title="Contato" />,
        cell: ({ row }) => <span className="text-xs text-muted-foreground truncate max-w-[150px] block">{row.original.contact_name || '—'}</span>,
      });
    }
    if (visibleFieldIds.has('created_at')) {
      cols.push({
        accessorKey: 'created_at',
        header: ({ column }) => <TableColumnHeader column={column} title="Criado em" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDateBR(row.original.created_at)}
          </div>
        ),
      });
    }
    if (visibleFieldIds.has('updated_at')) {
      cols.push({
        accessorKey: 'updated_at',
        header: ({ column }) => <TableColumnHeader column={column} title="Atualizado" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDateBR(row.original.updated_at)}
          </div>
        ),
      });
    }
    if (visibleFieldIds.has('last_comment')) {
      cols.push({
        id: 'last_comment',
        header: () => <span className="text-xs">Último comentário</span>,
        enableSorting: false,
        cell: ({ row }) => {
          if (isLoadingComments) {
            return <div className="h-3 w-24 rounded bg-muted animate-pulse" />;
          }
          const comment = lastCommentMap.get(row.original.id);
          return comment ? (
            <div className="flex items-start gap-1.5 max-w-[200px]">
              <MessageSquare className="h-3 w-3 text-muted-foreground/40 mt-0.5 flex-shrink-0" />
              <span className="text-xs text-muted-foreground truncate">{comment}</span>
            </div>
          ) : <span className="text-xs text-muted-foreground/25">—</span>;
        },
      });
    }
    if (visibleFieldIds.has('tags')) {
      cols.push({
        id: 'tags',
        header: () => <span className="text-xs">Tags</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const tags = row.original.tags;
          if (!tags || tags.length === 0) return <span className="text-xs text-muted-foreground/25">—</span>;
          return (
            <div className="flex flex-wrap gap-0.5 max-w-[180px]">
              {tags.slice(0, 3).map((tag: string) => (
                <span key={tag} className="text-[9px] px-1 py-0 rounded bg-primary/8 text-primary/70 font-medium">
                  {tag}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="text-[9px] text-muted-foreground/40">+{tags.length - 3}</span>
              )}
            </div>
          );
        },
      });
    }

    return cols;
  }, [visibleFieldIds, lastCommentMap, isLoadingComments]);

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Building2 className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">Nenhum projeto encontrado</p>
        <p className="text-xs mt-1">Ajuste os filtros ou aguarde novos projetos.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-x-auto">
      <TableProvider columns={allColumns} data={projects}>
        <TableHeader>
          {({ headerGroup }) => (
            <TableHeaderGroup headerGroup={headerGroup}>
              {({ header }) => <TableHead header={header} className="text-xs whitespace-nowrap" />}
            </TableHeaderGroup>
          )}
        </TableHeader>
        <TableBody>
          {({ row }) => (
            <TableRow
              key={row.id}
              row={row}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => onSelect(row.original as ProjectRow)}
            >
              {({ cell }) => <TableCell cell={cell} />}
            </TableRow>
          )}
        </TableBody>
      </TableProvider>
    </div>
  );
}
