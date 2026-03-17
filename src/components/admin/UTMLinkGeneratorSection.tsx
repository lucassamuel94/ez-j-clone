import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link, Copy, Sparkles, Zap, ExternalLink, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// ── Presets ────────────────────────────────────────────────────────────────────

const SOURCE_OPTIONS = [
  'instagram', 'facebook', 'google', 'linkedin', 'tiktok', 'email', 'whatsapp', 'indicacao',
] as const;

const MEDIUM_OPTIONS = [
  'social', 'cpc', 'cpm', 'email', 'organic', 'referral', 'display', 'stories', 'reels', 'bio',
] as const;

interface QuickTemplate {
  label: string;
  source: string;
  medium: string;
}

const QUICK_TEMPLATES: QuickTemplate[] = [
  { label: 'Instagram Bio', source: 'instagram', medium: 'bio' },
  { label: 'Instagram Stories', source: 'instagram', medium: 'stories' },
  { label: 'Instagram Reels', source: 'instagram', medium: 'reels' },
  { label: 'Meta Ads', source: 'facebook', medium: 'cpc' },
  { label: 'Google Ads', source: 'google', medium: 'cpc' },
  { label: 'WhatsApp', source: 'whatsapp', medium: 'social' },
];

const CUSTOM_VALUE = '__custom__';

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildUtmUrl(baseUrl: string, params: Record<string, string>): string {
  if (!baseUrl) return '';
  try {
    const url = new URL(baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`);
    Object.entries(params).forEach(([k, v]) => {
      if (v.trim()) url.searchParams.set(k, v.trim());
    });
    return url.toString();
  } catch {
    return '';
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toast.success('Link copiado!');
}

// ── History entry ──────────────────────────────────────────────────────────────

interface HistoryEntry {
  id: number;
  fullUrl: string;
  shortUrl?: string;
  label: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export const UTMLinkGeneratorSection = () => {
  const [baseUrl, setBaseUrl] = useState('');
  const [source, setSource] = useState('');
  const [sourceCustom, setSourceCustom] = useState('');
  const [medium, setMedium] = useState('');
  const [mediumCustom, setMediumCustom] = useState('');
  const [campaign, setCampaign] = useState('');
  const [term, setTerm] = useState('');
  const [content, setContent] = useState('');

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [shorteningId, setShorteningId] = useState<number | null>(null);

  const effectiveSource = source === CUSTOM_VALUE ? sourceCustom : source;
  const effectiveMedium = medium === CUSTOM_VALUE ? mediumCustom : medium;

  const generatedUrl = useMemo(
    () => buildUtmUrl(baseUrl, {
      utm_source: effectiveSource,
      utm_medium: effectiveMedium,
      utm_campaign: campaign,
      utm_term: term,
      utm_content: content,
    }),
    [baseUrl, effectiveSource, effectiveMedium, campaign, term, content],
  );

  const canGenerate = !!baseUrl && !!effectiveSource && !!generatedUrl;

  const applyTemplate = useCallback((t: QuickTemplate) => {
    setSource(SOURCE_OPTIONS.includes(t.source as any) ? t.source : CUSTOM_VALUE);
    setSourceCustom(SOURCE_OPTIONS.includes(t.source as any) ? '' : t.source);
    setMedium(MEDIUM_OPTIONS.includes(t.medium as any) ? t.medium : CUSTOM_VALUE);
    setMediumCustom(MEDIUM_OPTIONS.includes(t.medium as any) ? '' : t.medium);
  }, []);

  const handleAddToHistory = useCallback(() => {
    if (!canGenerate) return;
    const label = [effectiveSource, effectiveMedium, campaign].filter(Boolean).join(' / ');
    setHistory(prev => [{ id: Date.now(), fullUrl: generatedUrl, label }, ...prev]);
    toast.success('Link adicionado ao histórico!');
  }, [canGenerate, generatedUrl, effectiveSource, effectiveMedium, campaign]);

  const handleClearForm = useCallback(() => {
    setBaseUrl('');
    setSource('');
    setSourceCustom('');
    setMedium('');
    setMediumCustom('');
    setCampaign('');
    setTerm('');
    setContent('');
  }, []);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Link className="h-5 w-5 text-primary" />
          Gerador de Links UTM
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monte URLs com parâmetros UTM padronizados para rastrear a origem dos seus leads.
        </p>
      </div>

      {/* Quick templates */}
      <Card className="border border-border rounded-2xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Templates Rápidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {QUICK_TEMPLATES.map((t) => (
              <Button
                key={t.label}
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => applyTemplate(t)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <Card className="border border-border rounded-2xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Parâmetros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Base URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              URL Base <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="https://seusite.com/captacao"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>

          {/* Source + Medium row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                utm_source <span className="text-destructive">*</span>
              </label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Selecione a fonte" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_VALUE} className="text-xs">Personalizado...</SelectItem>
                </SelectContent>
              </Select>
              {source === CUSTOM_VALUE && (
                <Input
                  placeholder="Fonte personalizada"
                  value={sourceCustom}
                  onChange={(e) => setSourceCustom(e.target.value)}
                  className="mt-1.5"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">utm_medium</label>
              <Select value={medium} onValueChange={setMedium}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Selecione o meio" />
                </SelectTrigger>
                <SelectContent>
                  {MEDIUM_OPTIONS.map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_VALUE} className="text-xs">Personalizado...</SelectItem>
                </SelectContent>
              </Select>
              {medium === CUSTOM_VALUE && (
                <Input
                  placeholder="Meio personalizado"
                  value={mediumCustom}
                  onChange={(e) => setMediumCustom(e.target.value)}
                  className="mt-1.5"
                />
              )}
            </div>
          </div>

          {/* Campaign */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">utm_campaign</label>
            <Input
              placeholder="ex: lancamento-produto-x"
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
            />
          </div>

          {/* Term + Content row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">utm_term</label>
              <Input
                placeholder="Palavra-chave / público"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">utm_content</label>
              <Input
                placeholder="Variação do anúncio"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generated URL */}
      <Card className="border border-border rounded-2xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-primary" />
            URL Gerada
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            className="p-3 rounded-lg bg-muted/50 border text-xs font-mono break-all min-h-[48px] flex items-center text-foreground"
          >
            {generatedUrl || <span className="text-muted-foreground italic">Preencha os campos acima para gerar a URL...</span>}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              disabled={!canGenerate}
              onClick={() => copyToClipboard(generatedUrl)}
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar Link
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              disabled={!canGenerate}
              onClick={handleAddToHistory}
            >
              Salvar no Histórico
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5 text-muted-foreground"
              onClick={handleClearForm}
            >
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Session history */}
      {history.length > 0 && (
        <Card className="border border-border rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Histórico da Sessão</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => setHistory([])}
              >
                Limpar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-2 p-2.5 rounded-lg border bg-muted/20 group"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{entry.label}</p>
                  <p className="text-xs font-mono text-foreground break-all">{entry.fullUrl}</p>
                  {entry.shortUrl && (
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Zap className="h-2.5 w-2.5" />
                        {entry.shortUrl}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => copyToClipboard(entry.shortUrl!)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => copyToClipboard(entry.shortUrl || entry.fullUrl)}
                    title="Copiar"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => setHistory(prev => prev.filter(h => h.id !== entry.id))}
                    title="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
