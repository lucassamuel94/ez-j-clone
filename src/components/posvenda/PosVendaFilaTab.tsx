import { memo, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import PosVendaKpiCard from './PosVendaKpiCard';
import type { ProjectRow } from '@/hooks/usePosVendaDashboard';

const PAGE_SIZE = 10;

const PILL_STYLES: Record<string, { label: string; cls: string }> = {
  on_time: { label: 'No prazo', cls: 'bg-[hsl(135,50%,33%)]/10 text-[hsl(135,50%,33%)]' },
  at_risk: { label: 'Em risco', cls: 'bg-[hsl(38,100%,30%)]/10 text-[hsl(38,100%,30%)]' },
  overdue: { label: 'Atrasado', cls: 'bg-[hsl(0,56%,46%)]/10 text-[hsl(0,56%,46%)]' },
  paused: { label: 'Pausado', cls: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Cancelado', cls: 'bg-muted/70 text-muted-foreground/70' },
  waiting: { label: 'Aguardando início', cls: 'bg-[hsl(220,79%,48%)]/10 text-[hsl(220,79%,48%)]' },
};

const TYPE_BADGES: Record<string, string> = {
  Implantação: 'bg-[hsl(135,50%,33%)]/10 text-[hsl(135,50%,33%)]',
  Evolução: 'bg-[hsl(220,79%,48%)]/10 text-[hsl(220,79%,48%)]',
  Migração: 'bg-[hsl(38,100%,30%)]/10 text-[hsl(38,100%,30%)]',
  'API Oficial': 'bg-muted text-muted-foreground',
};

interface Props {
  rows: ProjectRow[];
  queueKpis: { total: number; overdue: number; paused: number; notStarted: number };
}

const PosVendaFilaTab = memo(function PosVendaFilaTab({ rows, queueKpis }: Props) {
  const [situacao, setSituacao] = useState('all');
  const [tipo, setTipo] = useState('all');
  const [equipe, setEquipe] = useState('all');
  const [page, setPage] = useState(0);

  const types = useMemo(() => [...new Set(rows.map(r => r.type))], [rows]);
  const teams = useMemo(() => [...new Set(rows.map(r => r.team))], [rows]);

  const filtered = useMemo(() => {
    let result = rows;
    if (situacao !== 'all') result = result.filter(r => r.situationPill === situacao);
    if (tipo !== 'all') result = result.filter(r => r.type === tipo);
    if (equipe !== 'all') result = result.filter(r => r.team === equipe);
    return result;
  }, [rows, situacao, tipo, equipe]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <PosVendaKpiCard title="Total na fila" value={queueKpis.total} color="neutral" />
        <PosVendaKpiCard title="Com prazo vencido" value={queueKpis.overdue} color="danger" />
        <PosVendaKpiCard title="Parados aguardando" value={queueKpis.paused} color="warning" />
        <PosVendaKpiCard title="Ainda não começaram" value={queueKpis.notStarted} color="info" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={situacao} onValueChange={v => { setSituacao(v); setPage(0); }}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Qualquer situação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Qualquer situação</SelectItem>
            {Object.entries(PILL_STYLES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tipo} onValueChange={v => { setTipo(v); setPage(0); }}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Qualquer tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Qualquer tipo</SelectItem>
            {types.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={equipe} onValueChange={v => { setEquipe(v); setPage(0); }}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Qualquer equipe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Qualquer equipe</SelectItem>
            {teams.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">#</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Projeto</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Tipo</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Equipe</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Situação</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Prazo</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Progresso</th>
                <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Responsável</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r, i) => {
                const pill = PILL_STYLES[r.situationPill] || PILL_STYLES.on_time;
                const typeBadge = TYPE_BADGES[r.type] || 'bg-muted text-muted-foreground';
                const progressLabel = r.overdueDays > 0 ? `+${r.overdueDays}d` : `${Math.min(r.deadlinePercent, 100)}%`;
                const progressColor = r.overdueDays > 0 ? 'text-[hsl(0,56%,46%)]' : r.deadlinePercent > 80 ? 'text-[hsl(38,100%,30%)]' : 'text-[hsl(135,50%,33%)]';

                return (
                  <tr key={r.id} className={cn('border-b border-border/30 hover:bg-muted/20 transition-colors', i % 2 === 1 && 'bg-muted/5')}>
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{r.number}</td>
                    <td className="px-3 py-2.5 font-medium text-foreground max-w-[180px] truncate">{r.company}</td>
                    <td className="px-3 py-2.5"><span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', typeBadge)}>{r.type}</span></td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.team}</td>
                    <td className="px-3 py-2.5"><span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', pill.cls)}>{pill.label}</span></td>
                    <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{r.dueDate ? new Date(r.dueDate).toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="px-3 py-2.5"><span className={cn('text-[11px] font-mono font-semibold tabular-nums', progressColor)}>{progressLabel}</span></td>
                    <td className="px-3 py-2.5 text-muted-foreground max-w-[120px] truncate">{r.responsible}</td>
                  </tr>
                );
              })}
              {paged.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Nenhum projeto encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2.5 border-t border-border/30">
            <span className="text-[11px] text-muted-foreground">{filtered.length} projetos</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => (
                <Button
                  key={i}
                  variant={page === i ? 'default' : 'ghost'}
                  size="icon"
                  className={cn('h-7 w-7 text-xs', page === i && 'bg-primary text-primary-foreground')}
                  onClick={() => setPage(i)}
                >
                  {i + 1}
                </Button>
              ))}
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default PosVendaFilaTab;
