import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Play, Search, ChevronDown, Clock, CheckCircle2, XCircle,
  Loader2, Copy, FileCode2, Shield, Zap, Globe, Bot, Database,
  Mail, Phone, Upload, Users, Calculator, Calendar, RefreshCw,
  AlertTriangle, Info
} from 'lucide-react';

interface EdgeFunctionDoc {
  name: string;
  description: string;
  category: string;
  method: string;
  auth: 'jwt' | 'api-key' | 'public' | 'jwt-or-api-key';
  samplePayload?: string;
  sampleHeaders?: Record<string, string>;
  notes?: string;
}

const EDGE_FUNCTIONS: EdgeFunctionDoc[] = [
  // AI
  { name: 'ai-text-improve', description: 'Melhora textos usando IA (reescrever, encurtar, formalizar).', category: 'IA', method: 'POST', auth: 'jwt', samplePayload: '{"action":"improve","text":"Olá mundo"}' },
  { name: 'generate-ai-summary', description: 'Gera resumo inteligente de um lead usando dados do CRM.', category: 'IA', method: 'POST', auth: 'jwt', samplePayload: '{"lead_id":"uuid-do-lead"}' },
  { name: 'generate-insights', description: 'Gera insights estratégicos sobre um lead.', category: 'IA', method: 'POST', auth: 'jwt', samplePayload: '{"lead_id":"uuid-do-lead"}' },
  { name: 'generate-auto-message', description: 'Gera mensagens automáticas com variáveis dinâmicas.', category: 'IA', method: 'POST', auth: 'jwt', samplePayload: '{"action":"generate","context":"notificação de vendas"}' },
  { name: 'validate-qualification', description: 'Valida qualificação SQO de um lead com IA.', category: 'IA', method: 'POST', auth: 'jwt', samplePayload: '{"lead_id":"uuid-do-lead"}' },
  { name: 'icp-chat', description: 'Chat inteligente para análise de ICP com base na carteira de clientes.', category: 'IA', method: 'POST', auth: 'jwt', samplePayload: '{"message":"Qual é o perfil ideal?"}' },
  
  // Enriquecimento
  { name: 'cnpja-search', description: 'Busca dados de empresa pelo CNPJ na API CNPJa.', category: 'Enriquecimento', method: 'POST', auth: 'public', samplePayload: '{"cnpj":"00000000000100"}' },
  { name: 'bulk-cnpja-search', description: 'Busca dados em lote de múltiplos CNPJs.', category: 'Enriquecimento', method: 'POST', auth: 'jwt', samplePayload: '{"cnpjs":["00000000000100"]}' },
  { name: 'bulk-enrich', description: 'Enriquecimento em lote de leads no banco.', category: 'Enriquecimento', method: 'POST', auth: 'public', samplePayload: '{"job_id":"uuid-do-job"}' },
  { name: 'enrich-company', description: 'Enriquece dados de empresa de um lead específico.', category: 'Enriquecimento', method: 'POST', auth: 'jwt', samplePayload: '{"lead_id":"uuid-do-lead"}' },
  { name: 'enrich-individual-lead', description: 'Enriquece um lead individual via CNPJa.', category: 'Enriquecimento', method: 'POST', auth: 'public', samplePayload: '{"lead_id":"uuid-do-lead"}' },
  { name: 'enrich-active-clients', description: 'Enriquece clientes ativos com dados da CNPJa.', category: 'Enriquecimento', method: 'POST', auth: 'public', samplePayload: '{}' },
  { name: 'analyze-client-profile', description: 'Analisa perfil de cliente ativo com IA.', category: 'Enriquecimento', method: 'POST', auth: 'public', samplePayload: '{"client_id":"uuid"}' },

  // E-mail & Comunicação
  { name: 'send-gmail', description: 'Envia e-mail via Gmail OAuth do usuário.', category: 'Comunicação', method: 'POST', auth: 'public', samplePayload: '{"to":"email@example.com","subject":"Teste","body":"<p>Olá</p>","user_id":"uuid"}' },
  { name: 'send-invite-email', description: 'Envia e-mail de convite para novo usuário.', category: 'Comunicação', method: 'POST', auth: 'jwt', samplePayload: '{"email":"novo@example.com","role":"sdr"}' },
  { name: 'send-meeting-invite', description: 'Envia convite de reunião por e-mail.', category: 'Comunicação', method: 'POST', auth: 'public', samplePayload: '{"lead_id":"uuid","meeting_datetime":"2025-01-01T10:00:00Z"}' },
  { name: 'send-meeting-reminders', description: 'Cron: envia lembretes de reuniões próximas.', category: 'Comunicação', method: 'POST', auth: 'public', samplePayload: '{}' },

  // Calendário
  { name: 'google-calendar-auth', description: 'Inicia fluxo OAuth do Google Calendar.', category: 'Integrações', method: 'POST', auth: 'public', samplePayload: '{"action":"authorize","user_id":"uuid"}' },
  { name: 'google-calendar-api', description: 'Proxy para API do Google Calendar.', category: 'Integrações', method: 'POST', auth: 'public', samplePayload: '{"action":"list_events","user_id":"uuid"}' },

  // Importação
  { name: 'process-import', description: 'Processa arquivo de importação de leads.', category: 'Importação', method: 'POST', auth: 'public', samplePayload: '{"job_id":"uuid-do-job"}' },
  { name: 'import-projects', description: 'Importa projetos via API (individual ou lote). Suporta campos expandidos: tags, start_date, estimated_hours, version, broker, closer_email, sdr_email, head_email, ux_po_email, dev_email, has_integration, has_ai, complexity_level, etc.', category: 'Importação', method: 'POST', auth: 'jwt-or-api-key', samplePayload: '{"projects":[{"company_name":"Empresa","project_type":"venda","phase_name":"validacao","status":"BACKLOG","priority":"media","tags":["tag1"],"closer_email":"closer@empresa.com","version":"2.0","broker":"Broker X","has_integration":true,"has_ai":false}]}' },
  
  { name: 'normalize-integration', description: 'Normaliza dados de integração externa.', category: 'Importação', method: 'POST', auth: 'public', samplePayload: '{"source":"econodata","data":{}}' },
  { name: 'econodata-webhook', description: 'Webhook para receber leads do Econodata.', category: 'Importação', method: 'POST', auth: 'public', samplePayload: '{}', notes: 'Webhook externo. Requer ECONODATA_WEBHOOK_TOKEN.' },

  // Formulários
  { name: 'lead-form-submit', description: 'Recebe submissão de formulário embed de leads.', category: 'Formulários', method: 'POST', auth: 'public', samplePayload: '{"form_id":"uuid","data":{"name":"João","email":"joao@test.com"}}' },
  { name: 'lead-form-embed', description: 'Retorna HTML/config do formulário embed.', category: 'Formulários', method: 'GET', auth: 'public', samplePayload: '', notes: 'GET request. Query param: ?form_id=uuid' },

  // Call Intelligence
  { name: 'transcribe-call', description: 'Transcreve áudio de ligação.', category: 'Call Intelligence', method: 'POST', auth: 'public', samplePayload: '{"analysis_id":"uuid"}' },
  { name: 'analyze-call', description: 'Analisa transcrição de ligação com IA.', category: 'Call Intelligence', method: 'POST', auth: 'public', samplePayload: '{"analysis_id":"uuid"}' },

  // Cron Jobs
  { name: 'calculate-lead-scores', description: 'Cron: recalcula scores de todos os leads.', category: 'Cron', method: 'POST', auth: 'public', samplePayload: '{}' },
  { name: 'check-overdue-leads', description: 'Cron: verifica leads com ações atrasadas.', category: 'Cron', method: 'POST', auth: 'public', samplePayload: '{}' },
  { name: 'check-overdue-analyses', description: 'Cron: verifica análises de API atrasadas.', category: 'Cron', method: 'POST', auth: 'public', samplePayload: '{}' },

  // Admin
  { name: 'force-logout', description: 'Força logout de um usuário específico.', category: 'Admin', method: 'POST', auth: 'public', samplePayload: '{"user_id":"uuid"}' },
  { name: 'bulk-reassign', description: 'Reatribui leads/oportunidades em lote.', category: 'Admin', method: 'POST', auth: 'public', samplePayload: '{"job_id":"uuid"}' },

  // Financeiro
  { name: 'get-exchange-rate', description: 'Retorna cotação USD/BRL com cache de 1h.', category: 'Financeiro', method: 'POST', auth: 'jwt', samplePayload: '{}' },
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'IA': <Bot className="h-4 w-4" />,
  'Enriquecimento': <Database className="h-4 w-4" />,
  'Comunicação': <Mail className="h-4 w-4" />,
  'Integrações': <Calendar className="h-4 w-4" />,
  'Importação': <Upload className="h-4 w-4" />,
  'Formulários': <FileCode2 className="h-4 w-4" />,
  'Call Intelligence': <Phone className="h-4 w-4" />,
  'Cron': <Clock className="h-4 w-4" />,
  'Admin': <Users className="h-4 w-4" />,
  'Financeiro': <Calculator className="h-4 w-4" />,
};

const AUTH_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  'jwt': { label: 'JWT', variant: 'default' },
  'api-key': { label: 'API Key', variant: 'secondary' },
  'public': { label: 'Público', variant: 'outline' },
  'jwt-or-api-key': { label: 'JWT / API Key', variant: 'secondary' },
};

interface TestResult {
  status: number;
  duration: number;
  body: string;
  timestamp: Date;
  success: boolean;
}

interface FunctionTestState {
  loading: boolean;
  results: TestResult[];
}

export function EdgeFunctionsSection() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedFn, setExpandedFn] = useState<string | null>(null);
  const [testStates, setTestStates] = useState<Record<string, FunctionTestState>>({});
  const [payloads, setPayloads] = useState<Record<string, string>>({});
  const [headerInputs, setHeaderInputs] = useState<Record<string, string>>({});

  const categories = useMemo(() => {
    const cats = [...new Set(EDGE_FUNCTIONS.map(f => f.category))];
    return ['all', ...cats];
  }, []);

  const filteredFunctions = useMemo(() => {
    return EDGE_FUNCTIONS.filter(fn => {
      const matchSearch = !search || fn.name.toLowerCase().includes(search.toLowerCase()) || fn.description.toLowerCase().includes(search.toLowerCase());
      const matchCategory = selectedCategory === 'all' || fn.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [search, selectedCategory]);

  const getPayload = (fnName: string) => {
    return payloads[fnName] ?? EDGE_FUNCTIONS.find(f => f.name === fnName)?.samplePayload ?? '';
  };

  const testFunction = useCallback(async (fn: EdgeFunctionDoc) => {
    setTestStates(prev => ({
      ...prev,
      [fn.name]: { loading: true, results: prev[fn.name]?.results || [] },
    }));

    const start = performance.now();
    try {
      const payload = getPayload(fn.name);
      const extraHeaders: Record<string, string> = {};
      
      const headerStr = headerInputs[fn.name];
      if (headerStr) {
        try {
          const parsed = JSON.parse(headerStr);
          Object.assign(extraHeaders, parsed);
        } catch { /* ignore */ }
      }

      let response: Response;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn.name}`;
      
      const session = await supabase.auth.getSession();
      const token = session.data?.session?.access_token;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        ...extraHeaders,
      };

      if (token && (fn.auth === 'jwt' || fn.auth === 'jwt-or-api-key')) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      if (fn.method === 'GET') {
        response = await fetch(url, { method: 'GET', headers });
      } else {
        response = await fetch(url, {
          method: 'POST',
          headers,
          body: payload || '{}',
        });
      }

      const duration = Math.round(performance.now() - start);
      let body: string;
      try {
        const json = await response.json();
        body = JSON.stringify(json, null, 2);
      } catch {
        body = await response.text();
      }

      const result: TestResult = {
        status: response.status,
        duration,
        body,
        timestamp: new Date(),
        success: response.ok,
      };

      setTestStates(prev => ({
        ...prev,
        [fn.name]: {
          loading: false,
          results: [result, ...(prev[fn.name]?.results || []).slice(0, 9)],
        },
      }));

      if (response.ok) {
        toast.success(`${fn.name} — ${response.status} em ${duration}ms`);
      } else {
        toast.error(`${fn.name} — ${response.status} em ${duration}ms`);
      }
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      const result: TestResult = {
        status: 0,
        duration,
        body: (err as Error).message,
        timestamp: new Date(),
        success: false,
      };

      setTestStates(prev => ({
        ...prev,
        [fn.name]: {
          loading: false,
          results: [result, ...(prev[fn.name]?.results || []).slice(0, 9)],
        },
      }));

      toast.error(`Erro de rede: ${(err as Error).message}`);
    }
  }, [payloads, headerInputs]);

  const copyUrl = (fnName: string) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`;
    navigator.clipboard.writeText(url);
    toast.success('URL copiada!');
  };

  const copyCurl = (fn: EdgeFunctionDoc) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn.name}`;
    const payload = getPayload(fn.name);
    let cmd = `curl -X ${fn.method} '${url}' \\\n  -H 'Content-Type: application/json' \\\n  -H 'apikey: YOUR_ANON_KEY'`;
    if (fn.auth === 'jwt' || fn.auth === 'jwt-or-api-key') {
      cmd += ` \\\n  -H 'Authorization: Bearer YOUR_JWT_TOKEN'`;
    }
    if (fn.method === 'POST' && payload) {
      cmd += ` \\\n  -d '${payload}'`;
    }
    navigator.clipboard.writeText(cmd);
    toast.success('cURL copiado!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-display">Edge Functions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Documentação completa, testes e logs de todas as {EDGE_FUNCTIONS.length} funções do sistema.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold">{EDGE_FUNCTIONS.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-warning" />
              <div>
                <p className="text-xs text-muted-foreground">Protegidas (JWT)</p>
                <p className="text-lg font-bold">{EDGE_FUNCTIONS.filter(f => f.auth === 'jwt' || f.auth === 'jwt-or-api-key').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-success" />
              <div>
                <p className="text-xs text-muted-foreground">Públicas</p>
                <p className="text-lg font-bold">{EDGE_FUNCTIONS.filter(f => f.auth === 'public').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-info" />
              <div>
                <p className="text-xs text-muted-foreground">Cron Jobs</p>
                <p className="text-lg font-bold">{EDGE_FUNCTIONS.filter(f => f.category === 'Cron').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar função..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-[200px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.filter(c => c !== 'all').map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Function List */}
      <div className="space-y-2">
        {filteredFunctions.map(fn => {
          const isExpanded = expandedFn === fn.name;
          const testState = testStates[fn.name];
          const authInfo = AUTH_LABELS[fn.auth];

          return (
            <Collapsible key={fn.name} open={isExpanded} onOpenChange={(open) => setExpandedFn(open ? fn.name : null)}>
              <Card className="border-border/50 overflow-hidden">
                <CollapsibleTrigger asChild>
                  <button className="w-full text-left p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                    <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                      {CATEGORY_ICONS[fn.category] || <Zap className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-semibold text-foreground">{fn.name}</code>
                        <Badge variant="outline" className="text-[10px] h-5 shrink-0">{fn.method}</Badge>
                        <Badge variant={authInfo.variant} className="text-[10px] h-5 shrink-0">{authInfo.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{fn.description}</p>
                    </div>
                    {testState?.results[0] && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {testState.results[0].success ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        <span className="text-xs text-muted-foreground">{testState.results[0].status} · {testState.results[0].duration}ms</span>
                      </div>
                    )}
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <Separator />
                  <div className="p-4">
                    <Tabs defaultValue="test" className="w-full">
                      <TabsList className="h-8">
                        <TabsTrigger value="test" className="text-xs h-7">Testar</TabsTrigger>
                        <TabsTrigger value="docs" className="text-xs h-7">Documentação</TabsTrigger>
                        <TabsTrigger value="logs" className="text-xs h-7">Logs ({testState?.results.length || 0})</TabsTrigger>
                      </TabsList>

                      {/* Test Tab */}
                      <TabsContent value="test" className="mt-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded flex-1 truncate">
                            {fn.method} /functions/v1/{fn.name}
                          </code>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyUrl(fn.name)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyCurl(fn)}>
                            <FileCode2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {fn.auth !== 'public' && (
                          <div className="flex items-center gap-2 p-2 bg-warning/5 rounded-md border border-warning/20">
                            <Shield className="h-3.5 w-3.5 text-warning shrink-0" />
                            <span className="text-xs text-warning">
                              {fn.auth === 'jwt' ? 'Requer JWT. Sessão ativa será usada automaticamente.' : 'Aceita JWT ou x-api-key.'}
                            </span>
                          </div>
                        )}

                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Headers Extras (JSON)</label>
                          <Input
                            value={headerInputs[fn.name] || ''}
                            onChange={e => setHeaderInputs(prev => ({ ...prev, [fn.name]: e.target.value }))}
                            placeholder='{"x-api-key":"..."}'
                            className="h-8 text-xs font-mono"
                          />
                        </div>

                        {fn.method === 'POST' && (
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Payload (JSON)</label>
                            <Textarea
                              value={getPayload(fn.name)}
                              onChange={e => setPayloads(prev => ({ ...prev, [fn.name]: e.target.value }))}
                              className="font-mono text-xs min-h-[80px] resize-y"
                              rows={4}
                            />
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => testFunction(fn)}
                            disabled={testState?.loading}
                            className="gap-2"
                          >
                            {testState?.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                            Executar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPayloads(prev => ({ ...prev, [fn.name]: fn.samplePayload || '{}' }))}
                            className="gap-2"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Reset Payload
                          </Button>
                        </div>

                        {/* Latest Result */}
                        {testState?.results[0] && (
                          <div className={`rounded-md border p-3 ${testState.results[0].success ? 'border-success/20 bg-success/5' : 'border-destructive/30 bg-destructive/5'}`}>
                            <div className="flex items-center gap-2 mb-2">
                              {testState.results[0].success ? (
                                <CheckCircle2 className="h-4 w-4 text-success" />
                              ) : (
                                <XCircle className="h-4 w-4 text-destructive" />
                              )}
                              <span className="text-xs font-semibold">
                                Status {testState.results[0].status} — {testState.results[0].duration}ms
                              </span>
                              <span className="text-[10px] text-muted-foreground ml-auto">
                                {testState.results[0].timestamp.toLocaleTimeString('pt-BR')}
                              </span>
                            </div>
                            <ScrollArea className="max-h-[200px]">
                              <pre className="text-xs font-mono whitespace-pre-wrap text-foreground/80 break-all">
                                {testState.results[0].body}
                              </pre>
                            </ScrollArea>
                          </div>
                        )}
                      </TabsContent>

                      {/* Docs Tab */}
                      <TabsContent value="docs" className="mt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Categoria</span>
                            <p className="text-sm mt-0.5 flex items-center gap-1.5">
                              {CATEGORY_ICONS[fn.category]}
                              {fn.category}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Método</span>
                            <p className="text-sm mt-0.5 font-mono">{fn.method}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Autenticação</span>
                            <p className="text-sm mt-0.5">{authInfo.label}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Endpoint</span>
                            <p className="text-xs mt-0.5 font-mono text-muted-foreground truncate">/functions/v1/{fn.name}</p>
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Descrição</span>
                          <p className="text-sm mt-0.5">{fn.description}</p>
                        </div>

                        {fn.notes && (
                          <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-md">
                            <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            <span className="text-xs text-muted-foreground">{fn.notes}</span>
                          </div>
                        )}

                        {fn.samplePayload && (
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Payload de Exemplo</span>
                            <pre className="mt-1 text-xs font-mono bg-muted/50 p-2 rounded-md whitespace-pre-wrap break-all">
                              {(() => {
                                try { return JSON.stringify(JSON.parse(fn.samplePayload), null, 2); } catch { return fn.samplePayload; }
                              })()}
                            </pre>
                          </div>
                        )}
                      </TabsContent>

                      {/* Logs Tab */}
                      <TabsContent value="logs" className="mt-3">
                        {(!testState || testState.results.length === 0) ? (
                          <div className="text-center py-8">
                            <AlertTriangle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground">Nenhum teste executado ainda.</p>
                            <p className="text-xs text-muted-foreground">Execute um teste para ver os logs aqui.</p>
                          </div>
                        ) : (
                          <ScrollArea className="max-h-[300px]">
                            <div className="space-y-2">
                              {testState.results.map((result, idx) => (
                                <div key={idx} className="flex items-start gap-2 p-2 rounded-md bg-muted/30 border border-border/30">
                                  {result.success ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                                  ) : (
                                    <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium">{result.status}</span>
                                      <span className="text-[10px] text-muted-foreground">{result.duration}ms</span>
                                      <span className="text-[10px] text-muted-foreground ml-auto">
                                        {result.timestamp.toLocaleTimeString('pt-BR')}
                                      </span>
                                    </div>
                                    <pre className="text-[11px] font-mono mt-1 text-muted-foreground truncate max-w-full">
                                      {result.body.slice(0, 150)}{result.body.length > 150 ? '...' : ''}
                                    </pre>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}

        {filteredFunctions.length === 0 && (
          <div className="text-center py-12">
            <Search className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma função encontrada.</p>
          </div>
        )}
      </div>
    </div>
  );
}
