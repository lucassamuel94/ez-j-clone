import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

const MAPPABLE_FIELDS: Array<{ key: string; label: string; required?: boolean }> = [
  { key: 'company', label: 'Empresa', required: true },
  { key: 'cnpj', label: 'CNPJ' },
  { key: 'contact_name', label: 'Contato' },
  { key: 'email', label: 'E-mail' },
  { key: 'phone', label: 'Telefone' },
  { key: 'segment', label: 'Segmento' },
  { key: 'notes', label: 'Observações' },
  { key: 'city', label: 'Cidade' },
  { key: 'state', label: 'Estado' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (clients: any[]) => Promise<void>;
}

export function ClientImportDialog({ open, onOpenChange, onImport }: Props) {
  const [fileData, setFileData] = useState<any[][] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [isImporting, setIsImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFileData(null);
    setHeaders([]);
    setMappings({});
    setFileName('');
    setIsImporting(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (json.length < 2) {
          toast.error('Planilha deve ter pelo menos 2 linhas (cabeçalho + dados)');
          return;
        }

        const hdrs = (json[0] as string[]).map(h => String(h).trim());
        setHeaders(hdrs);
        setFileData(json.slice(1).filter(row => row.some(cell => cell !== '')));

        // Auto-map by fuzzy name matching
        const autoMap: Record<string, string> = {};
        for (const field of MAPPABLE_FIELDS) {
          const match = hdrs.find(h => {
            const lower = h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const key = field.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return lower.includes(key) || lower === field.key;
          });
          if (match) autoMap[field.key] = match;
        }
        setMappings(autoMap);
      } catch {
        toast.error('Erro ao ler a planilha');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (!fileData || !mappings.company) {
      toast.error('Mapeie pelo menos o campo Empresa');
      return;
    }

    setIsImporting(true);
    try {
      const headerIndex: Record<string, number> = {};
      headers.forEach((h, i) => { headerIndex[h] = i; });

      const clients = fileData.map(row => {
        const client: Record<string, any> = {};
        for (const field of MAPPABLE_FIELDS) {
          const col = mappings[field.key];
          if (col && headerIndex[col] !== undefined) {
            const val = String(row[headerIndex[col]] || '').trim();
            if (val) client[field.key] = val;
          }
        }
        return client;
      }).filter(c => c.company);

      if (clients.length === 0) {
        toast.error('Nenhum registro válido encontrado');
        return;
      }

      // Check for CNPJs that already exist in leads table
      const cnpjsToCheck = clients
        .map(c => c.cnpj?.replace(/\D/g, '') || '')
        .filter(c => c.length === 14);

      if (cnpjsToCheck.length > 0) {
        const { data: existingLeads } = await supabase
          .from('leads')
          .select('cnpj, name, company')
          .in('cnpj', cnpjsToCheck);

        if (existingLeads && existingLeads.length > 0) {
          const existingSet = new Set(existingLeads.map(l => l.cnpj?.replace(/\D/g, '') || ''));
          const duplicateCount = clients.filter(c => {
            const clean = c.cnpj?.replace(/\D/g, '') || '';
            return clean.length === 14 && existingSet.has(clean);
          }).length;

          if (duplicateCount > 0) {
            toast.error(`${duplicateCount} registro(s) possuem CNPJ já cadastrado na base de leads e serão ignorados`);
            // Filter out duplicates
            const filtered = clients.filter(c => {
              const clean = c.cnpj?.replace(/\D/g, '') || '';
              return clean.length !== 14 || !existingSet.has(clean);
            });
            if (filtered.length === 0) {
              toast.error('Todos os registros possuem CNPJ duplicado');
              return;
            }
            await onImport(filtered);
            reset();
            onOpenChange(false);
            return;
          }
        }
      }

      await onImport(clients);
      reset();
      onOpenChange(false);
    } catch {
      // error handled by mutation
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Base de Clientes</DialogTitle>
          <DialogDescription>Faça upload de um arquivo XLSX ou CSV com os dados dos clientes ativos.</DialogDescription>
        </DialogHeader>

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
              <strong>{fileName}</strong> — {fileData.length} registros encontrados
            </p>

            <div className="space-y-3">
              {MAPPABLE_FIELDS.map(field => (
                <div key={field.key} className="flex items-center gap-3">
                  <Label className="w-28 text-xs shrink-0">
                    {field.label} {field.required && <span className="text-destructive">*</span>}
                  </Label>
                  <Select
                    value={mappings[field.key] || '_none'}
                    onValueChange={(v) => setMappings(prev => ({ ...prev, [field.key]: v === '_none' ? '' : v }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecione a coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— Não mapear —</SelectItem>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { reset(); }} disabled={isImporting}>
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={isImporting || !mappings.company}>
                {isImporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Importar {fileData.length} registros
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
