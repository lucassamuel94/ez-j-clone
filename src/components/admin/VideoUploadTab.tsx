import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileVideo, Loader2, Trash2, Video, Zap, CheckCircle2, AlertCircle, Upload, Sparkles } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useUploadCallAnalysis } from '@/hooks/useCallAnalyses';
import { useCloserUsers } from '@/hooks/useCloserUsers';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { validateFileSize } from '@/utils/audioCompressor';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const VIDEO_FORMATS = '.mp4,.webm,.mov,.avi,.mpeg';
const MAX_VIDEO_SIZE_GB = 2;

interface VideoQueueItem {
  id: string;
  file: File;
  closerUserId: string;
  leadId: string;
  leadSearch: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  errorMsg?: string;
  autoSearchPending?: boolean;
  autoFilled?: { lead?: boolean; closer?: boolean };
}

let itemIdCounter = 0;
const nextId = () => `vq-${++itemIdCounter}`;

const VIDEO_MIME_PREFIXES = ['video/'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi', '.mpeg'];

const isVideoFile = (file: File) =>
  VIDEO_MIME_PREFIXES.some((p) => file.type.startsWith(p)) ||
  VIDEO_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));

/** Extract company name from filenames like "Apresentação EZ Chat – CompanyName.mp4" */
const extractCompanyFromFilename = (filename: string): string => {
  // Remove extension
  let name = filename.replace(/\.[^.]+$/, '');
  // Remove known prefixes (before the first dash/em-dash)
  const prefixes = [
    /^Apresenta[çc][aã]o\s+EZ\s+Chat\s*/i,
    /^Apresenta[çc][aã]o\s*/i,
    /^Demo\s*/i,
    /^Reuniao\s*/i,
    /^Reuni[aã]o\s*/i,
  ];
  for (const p of prefixes) {
    name = name.replace(p, '');
  }
  // Remove leading separators (–, -, —, |)
  name = name.replace(/^[\s\-–—|]+/, '').trim();
  // Split by em-dash/en-dash and take first segment (company name)
  const segments = name.split(/\s*[–—]\s*/);
  name = segments[0].trim();
  // Remove trailing date patterns as fallback
  name = name.replace(/\s+\d{2,4}[-/._]\d{2}[-/._]\d{2,4}.*$/, '').trim();
  return name;
};

export const VideoUploadTab = () => {
  const [queue, setQueue] = useState<VideoQueueItem[]>([]);
  const [defaultCloserId, setDefaultCloserId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const upload = useUploadCallAnalysis();
  const { data: closers = [] } = useCloserUsers();

  const addFiles = useCallback((files: File[]) => {
    const videos = files.filter(isVideoFile);
    if (videos.length === 0) return;

    const newItems: VideoQueueItem[] = videos.map((file) => {
      const companySearch = extractCompanyFromFilename(file.name);
      return {
        id: nextId(),
        file,
        closerUserId: defaultCloserId,
        leadId: '',
        leadSearch: companySearch,
        status: 'pending' as const,
        autoSearchPending: companySearch.length >= 2,
        autoFilled: {},
      };
    });

    setQueue((prev) => [...prev, ...newItems]);
  }, [defaultCloserId]);

  const handleFilesSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []));
    if (fileRef.current) fileRef.current.value = '';
  }, [addFiles]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    if (isProcessing) return;
    addFiles(Array.from(e.dataTransfer.files));
  }, [isProcessing, addFiles]);

  const updateItem = useCallback((id: string, patch: Partial<VideoQueueItem>) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Auto-search leads from filename
  useEffect(() => {
    const pendingAutoSearch = queue.filter((i) => i.autoSearchPending && i.leadSearch.length >= 2);
    if (pendingAutoSearch.length === 0) return;

    const doAutoSearch = async () => {
      for (const item of pendingAutoSearch) {
        // Mark as no longer pending to avoid re-running
        updateItem(item.id, { autoSearchPending: false });

        try {
          const searchTerm = item.leadSearch.trim();
          const { data: leads } = await supabase
            .from('leads')
            .select('id, name, company, razao_social, nome_fantasia')
            .or(`company.ilike.%${searchTerm}%,razao_social.ilike.%${searchTerm}%,nome_fantasia.ilike.%${searchTerm}%`)
            .limit(5);

          if (leads && leads.length > 0) {
            const lead = leads[0];
            const displayName = `${lead.name} — ${lead.company}`;
            const patch: Partial<VideoQueueItem> = {
              leadId: lead.id,
              leadSearch: displayName,
              autoFilled: { ...item.autoFilled, lead: true },
            };

            // Try to find the closer from api_oficial_deals
            const { data: deals } = await supabase
              .from('api_oficial_deals')
              .select('assigned_to_user_id')
              .eq('lead_id', lead.id)
              .not('assigned_to_user_id', 'is', null)
              .order('created_at', { ascending: false })
              .limit(1);

            if (deals && deals.length > 0 && deals[0].assigned_to_user_id) {
              const closerId = deals[0].assigned_to_user_id;
              // Only set if this closer exists in the closers list
              if (closers.some((c) => c.id === closerId)) {
                patch.closerUserId = closerId;
                patch.autoFilled = { ...patch.autoFilled, closer: true };
              }
            }

            updateItem(item.id, patch);
          }
        } catch {
          // Silently fail — user can still manually fill
        }
      }
    };

    doAutoSearch();
  }, [queue, closers, updateItem]);

  const pendingItems = queue.filter((i) => i.status === 'pending');
  const canStart = pendingItems.length > 0 && pendingItems.every((i) => i.closerUserId);

  const handleBatchUpload = useCallback(async () => {
    const toProcess = queue.filter((i) => i.status === 'pending' && i.closerUserId);
    if (toProcess.length === 0) return;

    setIsProcessing(true);

    for (const item of toProcess) {
      const sizeError = validateFileSize(item.file);
      if (sizeError) {
        updateItem(item.id, { status: 'error', errorMsg: sizeError });
        continue;
      }

      updateItem(item.id, { status: 'uploading' });

      try {
        await upload.mutateAsync({
          file: item.file,
          sdr_user_id: item.closerUserId,
          lead_id: item.leadId || undefined,
          media_type: 'video',
          analysis_context: 'demo_closer',
        });
        updateItem(item.id, { status: 'done' });
      } catch {
        updateItem(item.id, { status: 'error', errorMsg: 'Falha no upload' });
      }
    }

    setIsProcessing(false);

    // Remove done items after a short delay
    setTimeout(() => {
      setQueue((prev) => prev.filter((i) => i.status !== 'done'));
    }, 2000);
  }, [queue, upload, updateItem]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
        <Zap className="h-4 w-4 text-primary shrink-0" />
        <p className="text-xs text-muted-foreground">
          Selecione múltiplos vídeos de uma vez. Cada arquivo pode ter um Closer e Lead/Oportunidade distintos. Upload é processado <strong>1 por vez</strong>. Até <strong>{MAX_VIDEO_SIZE_GB}GB</strong> por arquivo.
        </p>
      </div>

      {/* Default closer + file input */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Closer padrão (opcional)</Label>
          <Select value={defaultCloserId} onValueChange={setDefaultCloserId} disabled={isProcessing}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Aplicar a novos itens" />
            </SelectTrigger>
            <SelectContent>
              {closers.map((u: { id: string; name: string }) => (
                <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs font-medium">Adicionar Vídeos</Label>
          <div
            role="button"
            tabIndex={0}
            onClick={() => !isProcessing && fileRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click(); }}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={cn(
              'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 cursor-pointer transition-all duration-200',
              isDragging
                ? 'border-primary bg-primary/10 scale-[1.01]'
                : 'border-border hover:border-primary/40 hover:bg-muted/30',
              isProcessing && 'opacity-50 pointer-events-none',
            )}
          >
            <Upload className={cn('h-8 w-8', isDragging ? 'text-primary' : 'text-muted-foreground')} />
            <p className="text-xs text-muted-foreground text-center">
              <span className="font-medium text-foreground">Arraste vídeos aqui</span> ou clique para selecionar
            </p>
            <p className="text-[10px] text-muted-foreground">MP4, WebM, MOV, AVI — até {MAX_VIDEO_SIZE_GB}GB cada</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={VIDEO_FORMATS}
            multiple
            onChange={handleFilesSelected}
            className="hidden"
          />
        </div>
      </div>

      {/* Queue table */}
      {queue.length > 0 && (
        <div className="border border-border rounded-xl overflow-visible">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-[30%]">Arquivo</TableHead>
                <TableHead className="text-xs w-[25%]">Closer</TableHead>
                <TableHead className="text-xs w-[30%]">Lead / Oportunidade</TableHead>
                <TableHead className="text-xs w-[15%] text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.map((item) => (
                <VideoQueueRow
                  key={item.id}
                  item={item}
                  closers={closers}
                  isProcessing={isProcessing}
                  onUpdate={updateItem}
                  onRemove={removeItem}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleBatchUpload}
          disabled={!canStart || isProcessing}
          className="w-full md:w-auto"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Iniciar Upload ({pendingItems.length})
            </>
          )}
        </Button>
        {queue.length > 0 && !isProcessing && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => setQueue([])}
          >
            Limpar lista
          </Button>
        )}
      </div>
    </div>
  );
};

/* ─── Row Component ─── */

interface VideoQueueRowProps {
  item: VideoQueueItem;
  closers: { id: string; name: string }[];
  isProcessing: boolean;
  onUpdate: (id: string, patch: Partial<VideoQueueItem>) => void;
  onRemove: (id: string) => void;
}

const VideoQueueRow = ({ item, closers, isProcessing, onUpdate, onRemove }: VideoQueueRowProps) => {
  const isEditable = item.status === 'pending' && !isProcessing;

  const { data: leads = [] } = useQuery({
    queryKey: ['leads-search-video-row', item.id, item.leadSearch],
    queryFn: async () => {
      if (!item.leadSearch || item.leadSearch.length < 2) return [];
      const { data } = await supabase
        .from('leads')
        .select('id, name, company')
        .or(`name.ilike.%${item.leadSearch}%,company.ilike.%${item.leadSearch}%`)
        .limit(8);
      return data || [];
    },
    enabled: item.leadSearch.length >= 2 && !item.leadId,
  });

  return (
    <TableRow className={cn(
      item.status === 'done' && 'bg-primary/5',
      item.status === 'error' && 'bg-destructive/5',
      item.status === 'uploading' && 'bg-accent/50',
    )}>
      {/* File */}
      <TableCell className="py-2">
        <div className="flex items-center gap-1.5 text-xs">
          <FileVideo className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate max-w-[180px]" title={item.file.name}>{item.file.name}</span>
          <span className="text-muted-foreground shrink-0">({(item.file.size / 1024 / 1024).toFixed(0)}MB)</span>
        </div>
      </TableCell>

      {/* Closer */}
      <TableCell className="py-2">
        <div className="relative">
          <Select
            value={item.closerUserId}
            onValueChange={(v) => onUpdate(item.id, { closerUserId: v, autoFilled: { ...item.autoFilled, closer: false } })}
            disabled={!isEditable}
          >
            <SelectTrigger className={cn('h-8 text-xs', item.autoFilled?.closer && 'border-primary/40')}>
              <SelectValue placeholder="Closer" />
            </SelectTrigger>
            <SelectContent>
              {closers.map((u) => (
                <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {item.autoFilled?.closer && (
            <Sparkles className="absolute -top-1.5 -right-1.5 h-3 w-3 text-primary" />
          )}
        </div>
      </TableCell>

      {/* Lead */}
      <TableCell className="py-2">
        <div className="relative">
        <Popover open={leads.length > 0 && !item.leadId && isEditable} modal={false}>
          <PopoverTrigger asChild>
            <Input
              placeholder="Buscar lead..."
              value={item.leadSearch}
              onFocus={() => { if (item.leadId && isEditable) onUpdate(item.id, { leadId: '', autoFilled: { ...item.autoFilled, lead: false } }); }}
              onChange={(e) => onUpdate(item.id, { leadSearch: e.target.value, leadId: '', autoFilled: { ...item.autoFilled, lead: false } })}
              className={cn('h-8 text-xs', item.autoFilled?.lead && 'border-primary/40')}
              disabled={!isEditable}
            />
          </PopoverTrigger>
          <PopoverContent
            className="p-0 w-[var(--radix-popover-trigger-width)] max-h-36 overflow-y-auto"
            align="start"
            sideOffset={4}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            {leads.map((l: { id: string; name: string; company: string }) => (
              <button
                key={l.id}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                onClick={() => onUpdate(item.id, { leadId: l.id, leadSearch: `${l.name} — ${l.company}` })}
              >
                <span className="font-medium">{l.name}</span>
                <span className="text-muted-foreground"> — {l.company}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
        {item.autoFilled?.lead && (
          <Sparkles className="absolute -top-1.5 -right-1.5 h-3 w-3 text-primary" />
        )}
        </div>
      </TableCell>

      {/* Status / Actions */}
      <TableCell className="py-2 text-center">
        {item.status === 'pending' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onRemove(item.id)}
            disabled={isProcessing}
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
        {item.status === 'uploading' && (
          <Loader2 className="h-4 w-4 animate-spin text-primary mx-auto" />
        )}
        {item.status === 'done' && (
          <CheckCircle2 className="h-4 w-4 text-primary mx-auto" />
        )}
        {item.status === 'error' && (
          <div className="flex items-center justify-center gap-1" title={item.errorMsg}>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </div>
        )}
      </TableCell>
    </TableRow>
  );
};
