import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import { PROJECT_TYPE_LABELS, PHASE_LABELS, PRIORITY_LABELS, ProjectType } from '@/types/project';
import { cn } from '@/lib/utils';

interface ProjectFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  typeFilter: string;
  onTypeFilterChange: (v: string) => void;
  phaseFilter: string;
  onPhaseFilterChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  priorityFilter: string;
  onPriorityFilterChange: (v: string) => void;
  ownerFilter: string;
  onOwnerFilterChange: (v: string) => void;
  totalCount: number;
  filteredCount: number;
}

const STATUS_OPTIONS: [string, string][] = [
  ['ativo', 'Ativo'],
  ['em_pausa', 'Em Pausa'],
  ['concluido', 'Concluído'],
  ['entregue', 'Entregue'],
  ['cancelado', 'Cancelado'],
  ['arquivado', 'Arquivado'],
  ['lixeira', '🗑️ Lixeira'],
];

export function ProjectFilters({
  search, onSearchChange,
  typeFilter, onTypeFilterChange,
  phaseFilter, onPhaseFilterChange,
  statusFilter, onStatusFilterChange,
  priorityFilter, onPriorityFilterChange,
  ownerFilter, onOwnerFilterChange,
  totalCount, filteredCount,
}: ProjectFiltersProps) {
  const activeFiltersCount = [typeFilter, phaseFilter, statusFilter, priorityFilter, ownerFilter]
    .filter(f => f !== 'all').length;

  const clearAll = () => {
    onTypeFilterChange('all');
    onPhaseFilterChange('all');
    onStatusFilterChange('all');
    onPriorityFilterChange('all');
    onOwnerFilterChange('all');
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" strokeWidth={1.5} />
        <Input
          placeholder="Buscar por empresa, CNPJ, contato ou nº..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-9 h-10 text-sm border-border/50 bg-background placeholder:text-muted-foreground/40 rounded-lg focus-visible:ring-1 focus-visible:ring-primary/30"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-2 flex-wrap">
        <FilterSelect
          label="Tipo"
          value={typeFilter}
          onChange={onTypeFilterChange}
          options={Object.entries(PROJECT_TYPE_LABELS) as [string, string][]}
        />
        <FilterSelect
          label="Etapa"
          value={phaseFilter}
          onChange={onPhaseFilterChange}
          options={Object.entries(PHASE_LABELS)}
        />
        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={onStatusFilterChange}
          options={STATUS_OPTIONS}
        />
        <FilterSelect
          label="Prioridade"
          value={priorityFilter}
          onChange={onPriorityFilterChange}
          options={Object.entries(PRIORITY_LABELS) as [string, string][]}
        />
        <FilterSelect
          label="Responsável"
          value={ownerFilter}
          onChange={onOwnerFilterChange}
          options={[['mine', 'Meus projetos']]}
        />

        {activeFiltersCount > 0 && (
          <>
            <div className="h-5 w-px bg-border/30 mx-1" />
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors"
            >
              <X className="h-3 w-3" strokeWidth={2} />
              Limpar ({activeFiltersCount})
            </button>
          </>
        )}

        <span className="ml-auto text-xs text-muted-foreground/60 tabular-nums shrink-0">
          <span className="font-semibold text-foreground">{filteredCount}</span>
          <span className="ml-0.5">de {totalCount}</span>
        </span>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  const isActive = value !== 'all';
  const selectedLabel = options.find(([k]) => k === value)?.[1];

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className={cn(
          'h-8 min-w-0 w-auto gap-1.5 px-3 text-xs rounded-lg border shadow-none transition-all duration-200',
          isActive
            ? 'border-primary/40 bg-primary/5 text-foreground font-medium'
            : 'border-border/50 bg-background text-muted-foreground hover:border-border hover:text-foreground'
        )}
      >
        <span className="truncate max-w-[140px]">
          {isActive ? selectedLabel : label}
        </span>
      </SelectTrigger>
      <SelectContent align="start" className="min-w-[160px]">
        <SelectItem value="all" className="text-xs">
          Todos
        </SelectItem>
        {options.map(([k, v]) => (
          <SelectItem key={k} value={k} className="text-xs">
            {v}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
