import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2,
  Download,
  Trash2,
  User,
  Users,
  Shuffle,
  CloudUpload,
  ArrowRight,
  FileDown,
  Copy,
  AlertOctagon,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CLOSER_STAGES } from '@/services/closerService';

type AllocationType = 'importer' | 'specific' | 'distribute' | 'specific_closer' | 'distribute_closers';

interface Profile {
  id: string;
  name: string;
  role: string;
  active: boolean;
}

interface ParsedRow {
  [key: string]: string | number | null;
}

interface FieldMapping {
  fileColumn: string;
  dbColumn: string;
}

interface ImportJob {
  id: string;
  status: string;
  total_rows: number;
  processed_rows: number;
  success_count: number;
  error_count: number;
  duplicate_count: number;
  file_name: string;
  error_message: string | null;
  created_at?: string;
}

interface StatusOption {
  label: string;
  value: string;
  /** Unique key for SelectItem when value might be duplicated */
  selectKey?: string;
}

// SDR funnel stages only (no sub-statuses like "Não atendeu", "Ocupado", etc.)
const SDR_STATUSES: StatusOption[] = [
  { label: 'Novo', value: 'Novo' },
  { label: 'Em contato', value: 'Em contato' },
  { label: 'Lead quente', value: 'Interesse' },
  { label: 'Reunião agendada', value: 'Interesse/Agendar Retorno', selectKey: 'sdr_reuniao_agendada' },
  { label: 'Reunião Confirmada (SQO)', value: 'Oportunidade criada' },
  { label: 'Oportunidade futura', value: 'Interesse/Agendar Retorno', selectKey: 'sdr_oportunidade_futura' },
  { label: 'Reciclagem', value: 'Reciclagem' },
  { label: 'Perdido', value: 'Descartado' },
];

// Closer statuses derived from CLOSER_STAGES constant — single source of truth
const CLOSER_STATUSES: StatusOption[] = CLOSER_STAGES.map(v => ({
  label: v === 'Perdido' ? 'Perdido (Closer)' : v,
  value: v,
}));

const ALL_STATUSES_FOR_MAPPING = [
  { group: 'Funil SDR', options: SDR_STATUSES },
  { group: 'Estágio Closer', options: CLOSER_STATUSES },
];

/** Get unique select key for a status option */
const getSelectKey = (s: StatusOption) => s.selectKey || s.value;

/** Resolve a select key back to the actual status value */
const resolveSelectKey = (key: string): string => {
  const allOptions = [...SDR_STATUSES, ...CLOSER_STATUSES];
  const match = allOptions.find(s => getSelectKey(s) === key);
  return match ? match.value : key;
};

/** Find the select key for a given status value (picks first match) */
const findSelectKeyForValue = (value: string, options: StatusOption[]): string => {
  const match = options.find(s => s.value === value);
  return match ? getSelectKey(match) : value;
};

const DB_COLUMNS = [
  { value: 'skip', label: '-- Ignorar --', required: false },
  { value: 'cep', label: 'CEP', required: false },
  { value: 'city', label: 'Cidade', required: false },
  { value: 'closer_name', label: 'Closer (Responsável)', required: false },
  { value: 'cnpj', label: 'CNPJ', required: false },
  { value: 'email', label: 'E-mail', required: false },
  { value: 'state', label: 'Estado', required: false },
  { value: 'revenue_range', label: 'Faixa de Faturamento', required: false },
  { value: 'clickup_id', label: 'ID ClickUp', required: false },
  { value: 'name', label: 'Nome do Contato', required: true },
  { value: 'nome_fantasia', label: 'Nome Fantasia', required: false },
  { value: 'observation_note', label: 'Observação (Histórico)', required: false },
  { value: 'source', label: 'Origem', required: false },
  { value: 'country', label: 'País', required: false },
  { value: 'employee_count', label: 'Qtd Funcionários', required: false },
  { value: 'razao_social', label: 'Razão Social', required: true },
  { value: 'owner_name', label: 'SDR (Responsável)', required: false },
  { value: 'company_segment', label: 'Segmento', required: false },
  { value: 'status_column', label: 'Status (mapear valores)', required: false },
  { value: 'phone', label: 'Telefone 1', required: false },
  { value: 'phone_2', label: 'Telefone 2', required: false },
  { value: 'last_contact_at', label: 'Última Data de Contato', required: false },
  { value: 'website', label: 'Website', required: false },
];

const POLL_INTERVAL_MS = 2000;

export function MailingImportSection() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [fileColumns, setFileColumns] = useState<string[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; errors: number; duplicates: number; errorDetails?: Array<{ row_number: number; name: string; email?: string; cnpj?: string; reason: string }>; duplicateDetails?: Array<{ row_number: number; name: string; email?: string; cnpj?: string }> } | null>(null);
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'done'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  
  // Allocation states
  const [allocationType, setAllocationType] = useState<AllocationType>('importer');
  const [selectedSdrId, setSelectedSdrId] = useState<string>('');
  const [sdrList, setSdrList] = useState<Profile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string>('Novo');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Status mapping: spreadsheet value -> system status
  const [statusMappings, setStatusMappings] = useState<Record<string, string>>({});

  // Background job polling
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<ImportJob | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Import history
  const [importHistory, setImportHistory] = useState<ImportJob[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [selectedHistoryJob, setSelectedHistoryJob] = useState<any | null>(null);

  // Determine which statuses to show based on allocation type
  const isCloserAllocation = allocationType === 'specific_closer' || allocationType === 'distribute_closers';
  const activeStatuses = isCloserAllocation ? CLOSER_STATUSES : SDR_STATUSES;


  const statusColumnMapping = useMemo(() => mappings.find(m => m.dbColumn === 'status_column'), [mappings]);

  // Detect if owner/closer is mapped from the file (hides allocation section)
  const hasOwnerMapped = useMemo(() => mappings.some(m => m.dbColumn === 'owner_name'), [mappings]);
  const hasCloserMapped = useMemo(() => mappings.some(m => m.dbColumn === 'closer_name'), [mappings]);
  const hasResponsibleMapped = hasOwnerMapped || hasCloserMapped;

  // Extract unique status values from the spreadsheet
  const uniqueStatusValues = useMemo(() => {
    if (!statusColumnMapping) return [];
    const values = new Set<string>();
    parsedData.forEach(row => {
      const val = row[statusColumnMapping.fileColumn];
      if (val != null && String(val).trim() !== '') {
        values.add(String(val).trim());
      }
    });
    return Array.from(values).sort();
  }, [statusColumnMapping, parsedData]);

  // All statuses flattened for auto-matching
  const allStatusesFlat = useMemo(() => [...SDR_STATUSES, ...CLOSER_STATUSES], []);

  // Normalize text for fuzzy comparison (remove accents, emoji, extra spaces, lowercase)
  const normalize = (s: string) =>
    s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      // Remove emoji and other non-letter/digit/space chars
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

  // Keyword-based fuzzy matching rules (file keyword → system label keyword)
  const KEYWORD_MAP: Array<{ keywords: string[]; label: string }> = [
    { keywords: ['perdido', 'negocio perdido', 'lost'], label: 'Perdido' },
    { keywords: ['lead quente', 'quente', 'hot'], label: 'Lead quente' },
    { keywords: ['oportunidade futura', 'op futura'], label: 'Oportunidade futura' },
    { keywords: ['reuniao agendada', 'agendada'], label: 'Reunião agendada' },
    { keywords: ['reuniao confirmada', 'sqo', 'confirmada'], label: 'Reunião Confirmada (SQO)' },
    { keywords: ['reciclagem', 'reciclar'], label: 'Reciclagem' },
    { keywords: ['em contato', 'contato', 'primeiro contato', 'segundo contato', 'terceiro contato', 'quarto contato', 'quinto contato'], label: 'Em contato' },
    { keywords: ['reagendar', 'reagendar reuniao'], label: 'Reunião agendada' },
    { keywords: ['proposta enviada', 'proposta'], label: 'Proposta enviada' },
    { keywords: ['contrato enviado', 'contrato'], label: 'Contrato enviado' },
    { keywords: ['ganho', 'won', 'fechado'], label: 'Ganho' },
    { keywords: ['demonstracao', 'demo'], label: 'Demonstração' },
    { keywords: ['lead out', 'outbound'], label: 'Em contato' },
    { keywords: ['novo', 'new'], label: 'Novo' },
  ];

  /** Try to auto-match a file status to a system status, returns selectKey */
  const autoMatchStatus = (fileVal: string): string | null => {
    const norm = normalize(fileVal);

    // 1. Exact match on label or value
    const exact = allStatusesFlat.find(s =>
      normalize(s.label) === norm || normalize(s.value) === norm
    );
    if (exact) return getSelectKey(exact);

    // 2. Keyword contains match (longest keyword first for specificity)
    const sortedRules = [...KEYWORD_MAP].sort((a, b) => {
      const maxA = Math.max(...a.keywords.map(k => k.length));
      const maxB = Math.max(...b.keywords.map(k => k.length));
      return maxB - maxA;
    });
    for (const rule of sortedRules) {
      if (rule.keywords.some(kw => norm.includes(kw))) {
        const match = allStatusesFlat.find(s => s.label === rule.label);
        if (match) return getSelectKey(match);
      }
    }

    return null;
  };

  // Initialize status mappings when unique values change
  useEffect(() => {
    if (uniqueStatusValues.length > 0) {
      setStatusMappings(prev => {
        const next: Record<string, string> = {};
        uniqueStatusValues.forEach(val => {
          next[val] = prev[val] || autoMatchStatus(val) || activeStatuses[0].value;
        });
        return next;
      });
    } else {
      setStatusMappings({});
    }
  }, [uniqueStatusValues, activeStatuses]);

  // Fetch import history
  useEffect(() => {
    const fetchHistory = async () => {
      const { data } = await supabase
        .from('import_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20) as any;
      
      if (data) {
        setImportHistory(data);
      }
      setIsLoadingHistory(false);
    };
    fetchHistory();
  }, [step]);

  // Check for active import job on mount
  useEffect(() => {
    const checkActiveJob = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: jobs } = await supabase
        .from('import_jobs')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1) as any;

      if (jobs && jobs.length > 0) {
        setActiveJobId(jobs[0].id);
        setActiveJob(jobs[0]);
        setStep('importing');
        setIsImporting(true);
      }
    };
    checkActiveJob();
  }, []);

  // Poll for job progress
  useEffect(() => {
    if (!activeJobId) return;

    const poll = async () => {
      const { data: job } = await supabase
        .from('import_jobs')
        .select('*')
        .eq('id', activeJobId)
        .single() as any;

      if (!job) return;

      setActiveJob(job);

      if (job.total_rows > 0) {
        setImportProgress(Math.round((job.processed_rows / job.total_rows) * 100));
      }

      const isFinished = job.status === 'completed' || 
        (job.status === 'processing' && job.total_rows > 0 && job.processed_rows >= job.total_rows);

      // Detect stuck jobs (no progress for 3+ minutes)
      const updatedAt = new Date(job.updated_at).getTime();
      const isStuck = job.status === 'processing' && job.processed_rows > 0 && 
        (Date.now() - updatedAt > 3 * 60 * 1000) && !isFinished;

      if (isFinished || isStuck) {
        const finalStatus = isStuck ? 'failed' : 'completed';
        if (job.status !== finalStatus) {
          await supabase.from('import_jobs').update({ 
            status: finalStatus,
            error_message: isStuck ? 'Importação interrompida por timeout. Detalhes parciais salvos.' : null,
            updated_at: new Date().toISOString(),
          } as any).eq('id', activeJobId);
        }

        const errorDetails = (job as any).error_details || [];
        const duplicateDetails = (job as any).duplicate_details || [];

        setImportResults({
          success: job.success_count,
          errors: job.error_count,
          duplicates: job.duplicate_count,
          errorDetails,
          duplicateDetails,
        });
        setIsImporting(false);
        setStep('done');
        setActiveJobId(null);
        if (isStuck) {
          toast.error('Importação interrompida por timeout. Verifique o relatório de erros.');
        } else {
          toast.success(`Importação concluída! ${job.success_count} leads importados.`);
        }
      } else if (job.status === 'failed') {
        const errorDetails = (job as any).error_details || [];
        const duplicateDetails = (job as any).duplicate_details || [];
        setIsImporting(false);
        setStep('done');
        setActiveJobId(null);
        setImportResults({
          success: job.success_count,
          errors: job.error_count,
          duplicates: job.duplicate_count,
          errorDetails,
          duplicateDetails,
        });
        toast.error(`Importação falhou: ${job.error_message || 'Erro desconhecido'}`);
      }
    };

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeJobId]);

  // Fetch SDR list and current user on mount
  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }

      // Fetch active profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, active')
        .eq('active', true)
        .order('name');

      // Fetch roles from user_roles table
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (profiles) {
        const roleMap = new Map((userRoles || []).map(r => [r.user_id, r.role]));
        const profilesWithRoles: Profile[] = profiles.map(p => ({
          id: p.id,
          name: p.name,
          role: roleMap.get(p.id) || '',
          active: p.active ?? true,
        }));
        setSdrList(profilesWithRoles);
      }
    };

    fetchData();
  }, []);

  const validateAndProcessFile = useCallback((selectedFile: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];

    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.csv')) {
      toast.error('Formato inválido. Use arquivos .xlsx, .xls ou .csv');
      return;
    }

    setFile(selectedFile);
    parseFile(selectedFile);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    validateAndProcessFile(selectedFile);
  }, [validateAndProcessFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      validateAndProcessFile(droppedFile);
    }
  }, [validateAndProcessFile]);

  const parseFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<ParsedRow>(worksheet, { defval: null });

      if (jsonData.length === 0) {
        toast.error('Arquivo vazio ou sem dados válidos');
        return;
      }

      const columns = Object.keys(jsonData[0]);
      setFileColumns(columns);
      setParsedData(jsonData);

      // Auto-map columns based on name similarity
      const autoMappings: FieldMapping[] = columns.map((col) => {
        const colLower = col.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        
        let matchedDb = 'skip';
        
        if (colLower === 'task name') matchedDb = 'razao_social';
        else if (colLower === 'assignee' || colLower === 'assignees') matchedDb = 'owner_name';
        else if (colLower === 'task id') matchedDb = 'clickup_id';
        else if (colLower.includes('nome') && !colLower.includes('fantasia')) matchedDb = 'name';
        else if (colLower.includes('empresa') || colLower.includes('company') || colLower.includes('razao') || colLower.includes('social')) matchedDb = 'razao_social';
        else if (colLower.includes('email') || colLower.includes('e-mail')) matchedDb = 'email';
        else if (colLower.includes('telefone') || colLower.includes('phone') || colLower.includes('fone') || colLower.includes('celular') || colLower.includes('whatsapp') || colLower.includes('whats')) {
          if (colLower.includes('2') || colLower.includes('secundario')) matchedDb = 'phone_2';
          else matchedDb = 'phone';
        }
        else if (colLower.includes('cnpj')) matchedDb = 'cnpj';
        else if (colLower.includes('fantasia')) matchedDb = 'nome_fantasia';
        else if (colLower.includes('segmento') || colLower.includes('setor') || colLower.includes('ramo')) matchedDb = 'company_segment';
        else if (colLower.includes('funcionario') || colLower.includes('empregado')) matchedDb = 'employee_count';
        else if (colLower.includes('faturamento') || colLower.includes('receita')) matchedDb = 'revenue_range';
        else if (colLower.includes('site') || colLower.includes('website') || colLower.includes('url')) matchedDb = 'website';
        else if (colLower.includes('cidade') || colLower.includes('city')) matchedDb = 'city';
        else if (colLower.includes('estado') || colLower.includes('uf') || colLower.includes('state')) matchedDb = 'state';
        else if (colLower.includes('cep') || colLower.includes('postal')) matchedDb = 'cep';
        else if (colLower.includes('pais') || colLower.includes('country')) matchedDb = 'country';
        else if (colLower.includes('origem') || colLower.includes('source') || colLower.includes('fonte')) matchedDb = 'source';
        else if (colLower.includes('obs') || colLower.includes('nota') || colLower.includes('comentario') || colLower.includes('historico')) matchedDb = 'observation_note';
        else if (colLower.includes('sdr') || colLower.includes('responsavel') || colLower.includes('responsável') || colLower.includes('owner')) matchedDb = 'owner_name';
        else if (colLower.includes('clickup') || colLower.includes('click up')) matchedDb = 'clickup_id';
        else if (colLower.includes('status') || colLower.includes('etapa') || colLower.includes('fase') || colLower.includes('estagio')) matchedDb = 'status_column';
        else if (colLower.includes('ultimo contato') || colLower.includes('ultima data') || colLower.includes('last contact') || colLower.includes('data contato') || colLower.includes('dt contato')) matchedDb = 'last_contact_at';

        return { fileColumn: col, dbColumn: matchedDb };
      });

      setMappings(autoMappings);
      setStep('mapping');
      toast.success(`${jsonData.length} linhas encontradas`);
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('Erro ao ler o arquivo');
    }
  };

  const handleMappingChange = (fileColumn: string, dbColumn: string) => {
    setMappings((prev) =>
      prev.map((m) => (m.fileColumn === fileColumn ? { ...m, dbColumn } : m))
    );
  };

  const validateMappings = () => {
    const hasName = mappings.some((m) => m.dbColumn === 'name');
    const hasRazaoSocial = mappings.some((m) => m.dbColumn === 'razao_social');

    if (!hasName || !hasRazaoSocial) {
      toast.error('É necessário mapear os campos "Nome do Contato" e "Razão Social"');
      return false;
    }
    return true;
  };

  const handleDownloadErrorReport = () => {
    if (!importResults) return;
    const rows: Array<Record<string, string>> = [];

    if (importResults.errorDetails && importResults.errorDetails.length > 0) {
      importResults.errorDetails.forEach((err) => {
        rows.push({
          'Tipo': 'Erro',
          'Linha': String(err.row_number),
          'Nome': err.name || '',
          'Email': err.email || '',
          'CNPJ': err.cnpj || '',
          'Motivo': err.reason || '',
        });
      });
    }

    if (importResults.duplicateDetails && importResults.duplicateDetails.length > 0) {
      importResults.duplicateDetails.forEach((dup) => {
        rows.push({
          'Tipo': 'Duplicado',
          'Linha': String(dup.row_number),
          'Nome': dup.name || '',
          'Email': dup.email || '',
          'CNPJ': dup.cnpj || '',
          'Motivo': 'Registro duplicado (CNPJ, email ou ID ClickUp já existente)',
        });
      });
    }

    if (rows.length === 0) {
      toast.info('Sem detalhes de erro para exportar');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Erros');
    XLSX.writeFile(wb, `relatorio-erros-importacao.xlsx`);
    toast.success('Relatório de erros baixado');
  };

  const handleDownloadHistoryReport = (job: any, type: 'all' | 'success' | 'errors' | 'duplicates') => {
    const rows: Array<Record<string, string>> = [];
    const errorDetails: any[] = job.error_details || [];
    const duplicateDetails: any[] = job.duplicate_details || [];

    if (type === 'errors' || type === 'all') {
      errorDetails.forEach((err: any) => {
        rows.push({
          'Status': 'Erro',
          'Linha': String(err.row_number || ''),
          'Nome': err.name || '',
          'Email': err.email || '',
          'CNPJ': err.cnpj || '',
          'Motivo': err.reason || '',
        });
      });
    }

    if (type === 'duplicates' || type === 'all') {
      duplicateDetails.forEach((dup: any) => {
        rows.push({
          'Status': 'Duplicado',
          'Linha': String(dup.row_number || ''),
          'Nome': dup.name || '',
          'Email': dup.email || '',
          'CNPJ': dup.cnpj || '',
          'Motivo': 'ClickUp ID já existente',
        });
      });
    }

    if (rows.length === 0) {
      toast.info('Sem registros para exportar nesta categoria');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type === 'all' ? 'Relatório' : type === 'errors' ? 'Erros' : 'Duplicados');
    const suffix = type === 'all' ? 'completo' : type === 'errors' ? 'erros' : 'duplicados';
    XLSX.writeFile(wb, `relatorio-${suffix}-${job.file_name || 'importacao'}.xlsx`);
    toast.success('Relatório baixado com sucesso');
  };

  const handleStartImport = async () => {
    if (!file || !currentUserId) return;
    if (!validateMappings()) return;

    if (!hasResponsibleMapped) {
      if ((allocationType === 'specific' || allocationType === 'specific_closer') && !selectedSdrId) {
        toast.error(allocationType === 'specific_closer' ? 'Selecione um Closer para alocar os leads' : 'Selecione um SDR para alocar os leads');
        return;
      }

      if (allocationType === 'distribute' && sdrList.filter(s => s.role === 'sdr').length === 0) {
        toast.error('Não há SDRs ativos para distribuição');
        return;
      }

      if (allocationType === 'distribute_closers' && sdrList.filter(s => ['closer', 'admin', 'manager'].includes(s.role)).length === 0) {
        toast.error('Não há Closers ativos para distribuição');
        return;
      }
    }

    setIsImporting(true);
    setStep('importing');
    setImportProgress(0);

    try {
      // 1. Upload file to storage
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${currentUserId}/${Date.now()}-${sanitizedFileName}`;
      const { error: uploadError } = await supabase.storage
        .from('imports')
        .upload(storagePath, file);

      if (uploadError) {
        console.error('Upload error:', JSON.stringify(uploadError));
        toast.error(`Erro ao enviar o arquivo: ${uploadError.message || JSON.stringify(uploadError)}`);
        setIsImporting(false);
        setStep('mapping');
        return;
      }

      // Build mappings - include status_mappings if status column is mapped
      const hasStatusColumn = !!statusColumnMapping;

      // 2. Create import job
      const { data: job, error: jobError } = await supabase
        .from('import_jobs')
        .insert({
          user_id: currentUserId,
          file_name: file.name,
          storage_path: storagePath,
          total_rows: parsedData.length,
          mappings: mappings as any,
          allocation_type: allocationType,
          selected_sdr_id: (allocationType === 'specific' || allocationType === 'specific_closer') ? selectedSdrId : null,
          import_status: resolveSelectKey(importStatus),
          status_mappings: hasStatusColumn ? Object.fromEntries(
            Object.entries(statusMappings).map(([k, v]) => [k, resolveSelectKey(v)])
          ) : null,
        } as any)
        .select()
        .single();

      if (jobError || !job) {
        console.error('Job creation error:', jobError);
        toast.error('Erro ao criar job de importação');
        setIsImporting(false);
        setStep('mapping');
        return;
      }

      const jobData = job as any;
      setActiveJobId(jobData.id);
      setActiveJob(jobData);

      // 3. Trigger edge function (fire and forget)
      supabase.functions.invoke('process-import', {
        body: { job_id: jobData.id },
      }).catch(err => {
        console.error('Edge function invocation error:', err);
      });

      toast.success('Importação iniciada em background! Você pode sair desta tela com segurança.');

    } catch (error) {
      console.error('Import error:', error);
      toast.error('Erro ao iniciar importação');
      setIsImporting(false);
      setStep('mapping');
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedData([]);
    setFileColumns([]);
    setMappings([]);
    setImportProgress(0);
    setImportResults(null);
    setStep('upload');
    setAllocationType('importer');
    setSelectedSdrId('');
    setImportStatus('Novo');
    setStatusMappings({});
    setActiveJobId(null);
    setActiveJob(null);
  };

  const downloadTemplate = () => {
    const template = [
      {
        'Nome': 'João Silva',
        'Empresa': 'Empresa Exemplo LTDA',
        'Email': 'joao@empresa.com.br',
        'Telefone 1': '11987654321',
        'Telefone 2': '1133334444',
        'CNPJ': '12.345.678/0001-90',
        'Razão Social': 'Empresa Exemplo LTDA',
        'Nome Fantasia': 'Empresa Exemplo',
        'Segmento': 'Tecnologia',
        'Funcionários': '10-50',
        'Faturamento': '1M-5M',
        'Website': 'www.empresa.com.br',
        'Cidade': 'São Paulo',
        'Estado': 'SP',
        'CEP': '01234-567',
        'Origem': 'Lista Prospecção',
        'Observação': 'Lead qualificado',
        'Status': 'Novo',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'template_importacao_mailing.xlsx');
  };

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Importação de Mailing
        </CardTitle>
        <CardDescription>
          Importe leads de arquivos Excel (.xlsx, .xls) ou CSV — a importação continua em background
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div 
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                isDragging 
                  ? 'border-primary bg-primary/5 scale-[1.02]' 
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex flex-col items-center justify-center">
                <CloudUpload className="h-12 w-12 text-primary/60 mb-4" />
                <p className="font-semibold text-lg">Arraste o arquivo aqui</p>
                <p className="text-sm text-muted-foreground mt-1">ou clique para selecionar</p>
              </div>
              <Input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <Label htmlFor="file-upload" className="cursor-pointer" />
            </div>
            
            <div className="flex gap-2 justify-center flex-wrap">
              <Button onClick={downloadTemplate} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>
          </div>
        )}

        {/* Step: Mapping */}
        {step === 'mapping' && file && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Arquivo carregado</AlertTitle>
              <AlertDescription>
                {file.name} - {parsedData.length} linhas encontradas
              </AlertDescription>
            </Alert>

            <ScrollArea className="h-[500px] border rounded-lg">
              <div className="p-4 space-y-6">
                {/* Allocation - FIRST (hidden when owner/closer mapped from file) */}
                {hasResponsibleMapped ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Alocação definida pelo arquivo</AlertTitle>
                    <AlertDescription>
                      A coluna <strong>{hasOwnerMapped ? 'SDR (Responsável)' : 'Closer (Responsável)'}</strong> foi mapeada. Os leads serão atribuídos conforme o nome no arquivo. Leads sem correspondência serão alocados para você (importador).
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div>
                    <h3 className="font-semibold mb-3">Configuração de alocação</h3>
                    <div className="space-y-3">
                      <RadioGroup value={allocationType} onValueChange={(val) => { setAllocationType(val as AllocationType); setSelectedSdrId(''); setImportStatus(val === 'specific_closer' || val === 'distribute_closers' ? 'Demonstração' : 'Novo'); setStatusMappings({}); }}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="importer" id="importer" />
                          <Label htmlFor="importer" className="font-normal cursor-pointer">
                            <User className="h-4 w-4 inline mr-2" />
                            Alocar para mim (importador)
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="specific" id="specific" />
                          <Label htmlFor="specific" className="font-normal cursor-pointer">
                            <User className="h-4 w-4 inline mr-2" />
                            Alocar para um SDR específico
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="distribute" id="distribute" />
                          <Label htmlFor="distribute" className="font-normal cursor-pointer">
                            <Users className="h-4 w-4 inline mr-2" />
                            Distribuir entre {sdrList.filter(s => s.role === 'sdr').length} SDRs ativos
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="specific_closer" id="specific_closer" />
                          <Label htmlFor="specific_closer" className="font-normal cursor-pointer">
                            <User className="h-4 w-4 inline mr-2" />
                            Alocar para um Closer específico
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="distribute_closers" id="distribute_closers" />
                          <Label htmlFor="distribute_closers" className="font-normal cursor-pointer">
                            <Users className="h-4 w-4 inline mr-2" />
                            Distribuir entre {sdrList.filter(s => ['closer', 'admin', 'manager'].includes(s.role)).length} Closers ativos
                          </Label>
                        </div>
                      </RadioGroup>

                      {(allocationType === 'specific' || allocationType === 'specific_closer') && (
                        <Select value={selectedSdrId} onValueChange={setSelectedSdrId}>
                          <SelectTrigger>
                            <SelectValue placeholder={allocationType === 'specific_closer' ? 'Selecione um Closer' : 'Selecione um SDR'} />
                          </SelectTrigger>
                          <SelectContent>
                            {sdrList
                              .filter(p => allocationType === 'specific_closer' ? ['closer', 'admin', 'manager'].includes(p.role) : p.role === 'sdr')
                              .map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Field Mapping */}
                <div>
                  <h3 className="font-semibold mb-4">Mapeamento de campos</h3>
                  <div className="space-y-3">
                    {mappings.map((mapping) => {
                      const sampleValue = parsedData[0]?.[mapping.fileColumn];
                      return (
                        <div key={mapping.fileColumn} className="flex items-center gap-2">
                          <span className="text-sm font-medium min-w-[180px] truncate">
                            {mapping.fileColumn}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <Select value={mapping.dbColumn} onValueChange={(val) => handleMappingChange(mapping.fileColumn, val)}>
                            <SelectTrigger className="w-[200px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DB_COLUMNS.map((col) => (
                                <SelectItem key={col.value} value={col.value}>
                                  {col.label} {col.required ? '*' : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-xs text-muted-foreground truncate max-w-[200px] min-w-[100px]">
                            {sampleValue != null ? String(sampleValue) : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Status Mapping - only shown when a status column is mapped */}
                {statusColumnMapping && uniqueStatusValues.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold mb-2">Mapeamento de status</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Relacione cada status da planilha com o status correspondente no sistema
                      </p>
                      <div className="space-y-2">
                        {uniqueStatusValues.map((val) => (
                          <div key={val} className="flex items-center gap-2">
                            <span className="text-sm font-medium min-w-[180px] truncate" title={val}>
                              {val}
                            </span>
                            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <Select 
                              value={statusMappings[val] || getSelectKey(activeStatuses[0])} 
                              onValueChange={(selectKey) => {
                                setStatusMappings(prev => ({ ...prev, [val]: selectKey }));
                              }}
                            >
                              <SelectTrigger className="w-[250px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ALL_STATUSES_FOR_MAPPING.map((group) => (
                                  <div key={group.group}>
                                    <div className="px-2 py-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                      {group.group}
                                    </div>
                                    {group.options.map((s) => (
                                      <SelectItem key={`${group.group}-${getSelectKey(s)}`} value={getSelectKey(s)}>{s.label}</SelectItem>
                                    ))}
                                  </div>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Default Status - only shown when no status column is mapped */}
                {!statusColumnMapping && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold mb-3">Status inicial dos leads</h3>
                      <Select 
                        value={importStatus} 
                        onValueChange={(selectKey) => setImportStatus(selectKey)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {activeStatuses.map((s) => (
                            <SelectItem key={getSelectKey(s)} value={getSelectKey(s)}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleReset}>
                Voltar
              </Button>
              <Button onClick={handleStartImport} disabled={isImporting}>
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  'Iniciar Importação'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && activeJob && (
          <div className="space-y-4">
            <div className="text-center">
              <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
              <p className="mt-4 font-semibold">Importando leads em background...</p>
              <p className="text-sm text-muted-foreground mt-2">
                Você pode sair desta tela com segurança
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progresso</span>
                <span>{importProgress}%</span>
              </div>
              <Progress value={importProgress} className="bg-muted/30" />
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <div>
                  <p className="font-semibold">{activeJob.total_rows}</p>
                  <p className="text-muted-foreground">Total</p>
                </div>
                <div>
                  <p className="font-semibold">{activeJob.processed_rows}</p>
                  <p className="text-muted-foreground">Processados</p>
                </div>
                <div>
                  <p className="font-semibold text-success">{activeJob.success_count}</p>
                  <p className="text-muted-foreground">Sucesso</p>
                </div>
                <div>
                  <p className="font-semibold text-destructive">{activeJob.error_count}</p>
                  <p className="text-muted-foreground">Erros</p>
                </div>
              </div>
            </div>

            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={async () => {
                  if (!activeJobId) return;
                  await supabase.from('import_jobs').update({
                    status: 'failed',
                    error_message: 'Cancelado pelo usuário',
                    updated_at: new Date().toISOString(),
                  } as any).eq('id', activeJobId);
                  if (pollRef.current) clearInterval(pollRef.current);
                  setIsImporting(false);
                  setActiveJobId(null);
                  setActiveJob(null);
                  setStep('done');
                  setImportResults({
                    success: activeJob?.success_count || 0,
                    errors: activeJob?.error_count || 0,
                    duplicates: activeJob?.duplicate_count || 0,
                    errorDetails: [],
                    duplicateDetails: [],
                  });
                  toast.info('Importação cancelada.');
                }}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Cancelar importação
              </Button>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && importResults && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-4 py-4">
              {importResults.errors === 0 && importResults.duplicates > 0 ? (
                <CheckCircle className="h-12 w-12 text-chart-2" />
              ) : importResults.errors > 0 ? (
                <XCircle className="h-12 w-12 text-destructive" />
              ) : (
                <CheckCircle className="h-12 w-12 text-chart-2" />
              )}
              <p className="text-lg font-medium">
                {importResults.errors === 0 
                  ? 'Importação Concluída!' 
                  : 'Importação Concluída com Erros'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                <p className="text-2xl font-bold text-green-600">{importResults.success}</p>
                <p className="text-sm text-muted-foreground">Importados</p>
              </div>
              {importResults.duplicates > 0 && (
                <div className="p-3 rounded-lg bg-warning/5">
                  <p className="text-2xl font-bold text-warning">{importResults.duplicates}</p>
                  <p className="text-sm text-muted-foreground">Duplicados</p>
                </div>
              )}
              {importResults.errors > 0 && (
                <div className="p-3 rounded-lg bg-destructive/5">
                  <p className="text-2xl font-bold text-destructive">{importResults.errors}</p>
                  <p className="text-sm text-muted-foreground">Erros</p>
                </div>
              )}
            </div>

            {importResults.errorDetails && importResults.errorDetails.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erros encontrados</AlertTitle>
                <AlertDescription>
                  <ScrollArea className="h-[200px] mt-2">
                    <div className="space-y-2 pr-4">
                      {importResults.errorDetails.map((err, idx) => (
                        <div key={idx} className="text-sm">
                          <p className="font-semibold">Linha {err.row_number}: {err.name}</p>
                          <p className="text-destructive/70 mt-1">Motivo: {err.reason}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </AlertDescription>
              </Alert>
            )}

            {importResults.duplicateDetails && importResults.duplicateDetails.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Registros Duplicados</AlertTitle>
                <AlertDescription>
                  <ScrollArea className="h-[150px] mt-2">
                    <div className="space-y-2 pr-4">
                      {importResults.duplicateDetails.map((dup, idx) => (
                        <div key={idx} className="text-sm">
                          <p className="font-semibold">Linha {dup.row_number}: {dup.name}</p>
                          {dup.email && <p className="text-muted-foreground">Email: {dup.email}</p>}
                          {dup.cnpj && <p className="text-muted-foreground">CNPJ: {dup.cnpj}</p>}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-center gap-2">
              {(importResults.errors > 0 || importResults.duplicates > 0) && (
                <Button variant="outline" onClick={handleDownloadErrorReport}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Relatório de Erros
                </Button>
              )}
              <Button onClick={handleReset}>
                Nova Importação
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Import History */}
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Histórico de Importações
        </CardTitle>
        <CardDescription>
          Últimas importações realizadas
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : importHistory.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma importação realizada ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Arquivo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Sucesso</TableHead>
                <TableHead className="text-right">Duplicados</TableHead>
                <TableHead className="text-right">Erros</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {importHistory.map((job) => (
                <TableRow
                  key={job.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedHistoryJob(job)}
                >
                  <TableCell className="font-medium max-w-[200px] truncate">{job.file_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {job.created_at ? new Date(job.created_at).toLocaleString('pt-BR') : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-medium border",
                        job.status === 'completed' && "bg-success/10 text-success border-success/20",
                        job.status === 'failed' && "bg-destructive/10 text-destructive border-destructive/20",
                        job.status === 'processing' && "bg-info/10 text-info border-info/20",
                        !['completed', 'failed', 'processing'].includes(job.status) && "bg-muted text-muted-foreground border-border",
                      )}
                    >
                      {job.status === 'completed' ? 'Concluído' :
                       job.status === 'failed' ? 'Falhou' :
                       job.status === 'processing' ? 'Processando' : 'Pendente'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{job.total_rows}</TableCell>
                  <TableCell className="text-right text-success font-medium">{job.success_count}</TableCell>
                  <TableCell className="text-right text-warning font-medium">{job.duplicate_count}</TableCell>
                  <TableCell className="text-right text-destructive font-medium">{job.error_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>

    {/* Import Detail Dialog */}
    <Dialog open={!!selectedHistoryJob} onOpenChange={(open) => !open && setSelectedHistoryJob(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Detalhes da Importação
          </DialogTitle>
          <DialogDescription>
            {selectedHistoryJob?.file_name}
          </DialogDescription>
        </DialogHeader>

        {selectedHistoryJob && (() => {
          const totalRows = selectedHistoryJob.total_rows || 0;
          const processedRows = selectedHistoryJob.processed_rows || 0;
          const notProcessed = totalRows - processedRows;
          const statusLabel = selectedHistoryJob.status === 'completed' ? 'Concluído' : selectedHistoryJob.status === 'failed' ? 'Falhou' : selectedHistoryJob.status === 'processing' ? 'Processando...' : 'Pendente';
          const statusColor = selectedHistoryJob.status === 'completed' ? 'text-success' : selectedHistoryJob.status === 'failed' ? 'text-destructive' : 'text-warning';
          const createdAt = selectedHistoryJob.created_at ? new Date(selectedHistoryJob.created_at).toLocaleString('pt-BR') : '—';
          const allocationLabel = selectedHistoryJob.allocation_type === 'importer' ? 'Importador' : selectedHistoryJob.allocation_type === 'specific' ? 'SDR Específico' : selectedHistoryJob.allocation_type === 'distribute' ? 'Distribuir SDRs' : selectedHistoryJob.allocation_type === 'specific_closer' ? 'Closer Específico' : selectedHistoryJob.allocation_type === 'distribute_closers' ? 'Distribuir Closers' : selectedHistoryJob.allocation_type;

          return (
          <div className="space-y-4">
            {/* Status & Meta */}
            <div className="flex items-center justify-between text-sm">
              <span className={`font-semibold ${statusColor}`}>{statusLabel}</span>
              <span className="text-muted-foreground">{createdAt}</span>
            </div>

            {/* Key Numbers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold text-foreground">{totalRows.toLocaleString('pt-BR')}</p>
                <p className="text-xs text-muted-foreground">Total no Arquivo</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold text-foreground">{processedRows.toLocaleString('pt-BR')}</p>
                <p className="text-xs text-muted-foreground">Processados</p>
              </div>
            </div>

            {/* Result Breakdown */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-lg bg-success/5">
                <p className="text-xl font-bold text-success">{selectedHistoryJob.success_count.toLocaleString('pt-BR')}</p>
                <p className="text-xs text-muted-foreground">Sucesso</p>
              </div>
              <div className="p-3 rounded-lg bg-warning/5">
                <p className="text-xl font-bold text-warning">{selectedHistoryJob.duplicate_count.toLocaleString('pt-BR')}</p>
                <p className="text-xs text-muted-foreground">Duplicados</p>
              </div>
              <div className="p-3 rounded-lg bg-destructive/5">
                <p className="text-xl font-bold text-destructive">{selectedHistoryJob.error_count.toLocaleString('pt-BR')}</p>
                <p className="text-xs text-muted-foreground">Erros</p>
              </div>
            </div>

            {/* Not Processed Warning */}
            {notProcessed > 0 && (
              <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
                <div className="flex items-center gap-2">
                  <AlertOctagon className="h-4 w-4 text-warning shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-warning">
                      {notProcessed.toLocaleString('pt-BR')} leads não processados
                    </p>
                    <p className="text-xs text-warning/70">
                      Importação interrompida por timeout. Re-importe o arquivo para processar os restantes.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Extra Info */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs border-t pt-3">
              <span className="text-muted-foreground">Alocação</span>
              <span className="font-medium text-foreground text-right">{allocationLabel}</span>
              <span className="text-muted-foreground">Status Inicial</span>
              <span className="font-medium text-foreground text-right">{selectedHistoryJob.import_status}</span>
              {selectedHistoryJob.error_message && (
                <>
                  <span className="text-muted-foreground">Motivo da falha</span>
                  <span className="font-medium text-destructive text-right">{selectedHistoryJob.error_message}</span>
                </>
              )}
            </div>

            {/* Download Buttons */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Downloads</p>

              {(selectedHistoryJob.error_count > 0 || selectedHistoryJob.duplicate_count > 0) && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => handleDownloadHistoryReport(selectedHistoryJob, 'all')}
                >
                  <FileDown className="h-4 w-4 text-primary" />
                  Relatório Completo (Erros + Duplicados)
                </Button>
              )}

              {selectedHistoryJob.duplicate_count > 0 && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => handleDownloadHistoryReport(selectedHistoryJob, 'duplicates')}
                >
                  <Copy className="h-4 w-4 text-warning" />
                  Apenas Duplicados ({selectedHistoryJob.duplicate_count.toLocaleString('pt-BR')})
                </Button>
              )}

              {selectedHistoryJob.error_count > 0 && (
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => handleDownloadHistoryReport(selectedHistoryJob, 'errors')}
                >
                  <AlertOctagon className="h-4 w-4 text-destructive" />
                  Apenas Erros ({selectedHistoryJob.error_count})
                </Button>
              )}

              {selectedHistoryJob.error_count === 0 && selectedHistoryJob.duplicate_count === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Importação perfeita — sem erros ou duplicados para baixar.
                </p>
              )}
            </div>
          </div>
          );
        })()}
      </DialogContent>
    </Dialog>
    </>
  );
}
