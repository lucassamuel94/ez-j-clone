import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, X, Link2, Upload, FileText } from 'lucide-react';
import type { DocFile } from '@/hooks/useApiAnalysis';

interface ApiAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { title: string; description: string; documentation_url: string; documentation_files: DocFile[] }) => Promise<void>;
  onUploadFile: (file: File) => Promise<DocFile>;
}

export function ApiAnalysisDialog({ open, onOpenChange, onSubmit, onUploadFile }: ApiAnalysisDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [linkInput, setLinkInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isValid = title.trim() && description.trim() && docs.length > 0;

  const addLink = () => {
    const url = linkInput.trim();
    if (!url) return;
    setDocs((prev) => [...prev, { type: 'link', name: url, url }]);
    setLinkInput('');
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const doc = await onUploadFile(file);
        setDocs((prev) => [...prev, doc]);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeDoc = (index: number) => {
    setDocs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    try {
      const firstLink = docs.find((d) => d.type === 'link')?.url || docs[0]?.url || '';
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        documentation_url: firstLink,
        documentation_files: docs,
      });
      setTitle('');
      setDescription('');
      setDocs([]);
      setLinkInput('');
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Solicitação de Análise</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs font-medium">Título *</Label>
            <Input id="title" placeholder="Ex: API do WhatsApp Business" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-medium">Descrição *</Label>
            <Textarea id="description" placeholder="Descreva o objetivo da integração e requisitos..." rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {/* Documentation section */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Documentação * <span className="text-muted-foreground font-normal">(links ou arquivos)</span></Label>

            {/* Add link */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="https://docs.example.com/api"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLink())}
                  className="pl-8 h-9"
                />
              </div>
              <Button type="button" variant="outline" size="sm" className="h-9 px-3" onClick={addLink} disabled={!linkInput.trim()}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Upload file */}
            <div>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.json,.yaml,.yml,.md,.html,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-xs w-full"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploading ? 'Enviando...' : 'Enviar arquivos'}
              </Button>
            </div>

            {/* Docs list */}
            {docs.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {docs.map((doc, i) => (
                  <div key={i} className="flex items-center gap-2 text-[13px] bg-muted/50 rounded-md px-2.5 py-1.5 group">
                    {doc.type === 'link' ? (
                      <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate flex-1 text-foreground">{doc.name}</span>
                    <button
                      type="button"
                      onClick={() => removeDoc(i)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!isValid || submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enviar Solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
