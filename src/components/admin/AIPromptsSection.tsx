import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Loader2, Save, RotateCcw, Sparkles, ShieldCheck, Lightbulb, Bot, DollarSign, Hash, TrendingUp, Wand2, Minimize2, Maximize2, BriefcaseBusiness, SmilePlus, Target, Headphones } from 'lucide-react';
import { toast } from 'sonner';

interface AIPrompt {
  id: string;
  label: string;
  description: string | null;
  system_prompt: string;
  user_prompt_template: string;
  model: string;
  updated_at: string;
}

interface UsageStats {
  prompt_id: string;
  total_queries: number;
  avg_cost: number;
  total_cost: number;
  avg_tokens_input: number;
  avg_tokens_output: number;
}

const PROMPT_ICONS: Record<string, React.ReactNode> = {
  enrich_company: <Sparkles className="h-5 w-5" />,
  validate_qualification: <ShieldCheck className="h-5 w-5" />,
  generate_insights: <Lightbulb className="h-5 w-5" />,
  text_improve: <Wand2 className="h-5 w-5" />,
  text_shorten: <Minimize2 className="h-5 w-5" />,
  text_lengthen: <Maximize2 className="h-5 w-5" />,
  text_formal: <BriefcaseBusiness className="h-5 w-5" />,
  text_friendly: <SmilePlus className="h-5 w-5" />,
  text_persuasive: <Target className="h-5 w-5" />,
  analyze_call: <Headphones className="h-5 w-5" />,
};

type AIProvider = 'gemini' | 'perplexity' | 'anthropic' | 'openai';

const PROVIDER_LABELS: Record<AIProvider, string> = {
  gemini: 'Google Gemini',
  perplexity: 'Perplexity',
  anthropic: 'Anthropic',
  openai: 'OpenAI',
};

const MODEL_OPTIONS_BY_PROVIDER: Record<AIProvider, { value: string; label: string }[]> = {
  gemini: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (mais rápido)' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (equilibrado)' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (mais preciso)' },
  ],
  perplexity: [
    { value: 'sonar', label: 'Sonar (rápido)' },
    { value: 'sonar-pro', label: 'Sonar Pro (detalhado)' },
    { value: 'sonar-reasoning', label: 'Sonar Reasoning' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (rápido)' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o (multimodal)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (rápido)' },
    { value: 'gpt-4.1', label: 'GPT-4.1 (mais recente)' },
  ],
};

const ALL_MODEL_OPTIONS = Object.entries(MODEL_OPTIONS_BY_PROVIDER).flatMap(([, models]) => models);

const detectProvider = (model: string): AIProvider => {
  if (model.startsWith('gemini')) return 'gemini';
  if (model.startsWith('sonar')) return 'perplexity';
  if (model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('gpt')) return 'openai';
  return 'gemini';
};

const useAIPrompts = () => {
  return useQuery({
    queryKey: ['ai-prompts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_prompts')
        .select('*')
        .order('id');
      if (error) throw error;
      return data as AIPrompt[];
    },
  });
};

const useAIUsageStats = () => {
  return useQuery({
    queryKey: ['ai-usage-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_usage_logs' as any)
        .select('prompt_id, tokens_input, tokens_output, estimated_cost_usd');
      if (error) throw error;
      
      const rows = data as any[];
      const grouped: Record<string, UsageStats> = {};
      
      for (const row of rows) {
        if (!grouped[row.prompt_id]) {
          grouped[row.prompt_id] = {
            prompt_id: row.prompt_id,
            total_queries: 0,
            avg_cost: 0,
            total_cost: 0,
            avg_tokens_input: 0,
            avg_tokens_output: 0,
          };
        }
        const g = grouped[row.prompt_id];
        g.total_queries++;
        g.total_cost += Number(row.estimated_cost_usd || 0);
        g.avg_tokens_input += Number(row.tokens_input || 0);
        g.avg_tokens_output += Number(row.tokens_output || 0);
      }
      
      for (const g of Object.values(grouped)) {
        if (g.total_queries > 0) {
          g.avg_cost = g.total_cost / g.total_queries;
          g.avg_tokens_input = Math.round(g.avg_tokens_input / g.total_queries);
          g.avg_tokens_output = Math.round(g.avg_tokens_output / g.total_queries);
        }
      }
      
      return grouped;
    },
  });
};

interface ProviderSelectorProps {
  value: AIProvider;
  onChange: (provider: AIProvider) => void;
}

const ProviderSelector = ({ value, onChange }: ProviderSelectorProps) => (
  <div className="flex items-center gap-1.5">
    {(Object.keys(PROVIDER_LABELS) as AIProvider[]).map((provider) => (
      <Button
        key={provider}
        variant={value === provider ? 'default' : 'outline'}
        size="sm"
        className="h-7 text-[11px] px-2.5"
        onClick={() => onChange(provider)}
      >
        {PROVIDER_LABELS[provider]}
      </Button>
    ))}
  </div>
);

const PromptCard = ({
  prompt,
  isEditing,
  editData,
  stats,
  saveMutation,
  onEdit,
  onCancel,
  onSave,
  onEditDataChange,
}: {
  prompt: AIPrompt;
  isEditing: boolean;
  editData: Partial<AIPrompt>;
  stats: UsageStats | undefined;
  saveMutation: { isPending: boolean };
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onEditDataChange: (data: Partial<AIPrompt>) => void;
}) => {
  const icon = PROMPT_ICONS[prompt.id] || <Sparkles className="h-5 w-5" />;
  const currentModel = editData.model || prompt.model;
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(detectProvider(currentModel));

  const handleProviderChange = (provider: AIProvider) => {
    setSelectedProvider(provider);
    const firstModel = MODEL_OPTIONS_BY_PROVIDER[provider][0]?.value;
    if (firstModel) {
      onEditDataChange({ ...editData, model: firstModel });
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              {icon}
            </div>
            <div>
              <CardTitle className="text-sm leading-tight">{prompt.label}</CardTitle>
              {prompt.description && (
                <CardDescription className="mt-0.5 text-xs">{prompt.description}</CardDescription>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {prompt.model}
            </Badge>
            {!isEditing ? (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onEdit}>
                Editar
              </Button>
            ) : (
              <div className="flex gap-1.5">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel} disabled={saveMutation.isPending}>
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Cancelar
                </Button>
                <Button size="sm" className="h-7 text-xs" onClick={onSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                  Salvar
                </Button>
              </div>
            )}
          </div>
        </div>
        {stats && stats.total_queries > 0 && (
          <div className="flex items-center gap-4 mt-2.5 pt-2.5 border-t border-border/50">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Hash className="h-3 w-3" />
              <span><strong className="text-foreground">{stats.total_queries}</strong> consultas</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              <span>Média: <strong className="text-foreground">${stats.avg_cost.toFixed(4)}</strong>/consulta</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              <span>Total: <strong className="text-foreground">${stats.total_cost.toFixed(4)}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>~{stats.avg_tokens_input} in / ~{stats.avg_tokens_output} out tokens</span>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {isEditing && (
          <div className="space-y-2">
            <Label className="text-xs font-medium">Provedor de IA</Label>
            <ProviderSelector value={selectedProvider} onChange={handleProviderChange} />
            <div className="space-y-1.5 mt-2">
              <Label className="text-xs font-medium">Modelo</Label>
              <Select
                value={currentModel}
                onValueChange={(v) => onEditDataChange({ ...editData, model: v })}
              >
                <SelectTrigger className="w-72 h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS_BY_PROVIDER[selectedProvider].map((m) => (
                    <SelectItem key={m.value} value={m.value} className="text-xs">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">System Prompt</Label>
          {isEditing ? (
            <Textarea
              value={editData.system_prompt ?? prompt.system_prompt}
              onChange={(e) => onEditDataChange({ ...editData, system_prompt: e.target.value })}
              className="min-h-[80px] text-xs font-mono bg-background"
            />
          ) : (
            <pre className="text-xs font-mono bg-muted/50 rounded-md p-3 whitespace-pre-wrap border max-h-[120px] overflow-y-auto">
              {prompt.system_prompt}
            </pre>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground">User Prompt Template</Label>
            <span className="text-[10px] text-muted-foreground">
              Use {'{{variavel}}'} para dados dinâmicos
            </span>
          </div>
          {isEditing ? (
            <Textarea
              value={editData.user_prompt_template ?? prompt.user_prompt_template}
              onChange={(e) => onEditDataChange({ ...editData, user_prompt_template: e.target.value })}
              className="min-h-[300px] text-xs font-mono bg-background"
            />
          ) : (
            <pre className="text-xs font-mono bg-muted/50 rounded-md p-3 whitespace-pre-wrap border max-h-[300px] overflow-y-auto">
              {prompt.user_prompt_template}
            </pre>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground text-right">
          Última atualização: {new Date(prompt.updated_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
        </p>
      </CardContent>
    </Card>
  );
};

export const AIPromptsSection = () => {
  const queryClient = useQueryClient();
  const { data: prompts = [], isLoading } = useAIPrompts();
  const { data: usageStats = {} } = useAIUsageStats();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<AIPrompt>>({});

  const saveMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AIPrompt> }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('ai_prompts' as any)
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-prompts'] });
      setEditingId(null);
      setEditData({});
      toast.success('Prompt atualizado com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao salvar prompt.');
    },
  });

  const handleEdit = (prompt: AIPrompt) => {
    setEditingId(prompt.id);
    setEditData({
      system_prompt: prompt.system_prompt,
      user_prompt_template: prompt.user_prompt_template,
      model: prompt.model,
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleSave = (id: string) => {
    saveMutation.mutate({ id, updates: editData });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const textPrompts = prompts.filter(p => p.id.startsWith('text_'));
  const otherPrompts = prompts.filter(p => !p.id.startsWith('text_'));

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Ações de IA</CardTitle>
              <CardDescription className="text-xs">
                Gerencie os prompts utilizados nas funcionalidades de Inteligência Artificial do sistema.
                Alterações aqui afetam diretamente as respostas da IA para todos os usuários.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Text improvement prompts */}
      {textPrompts.length > 0 && (
        <>
          <div className="flex items-center gap-2 pt-1">
            <Wand2 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Editor de E-mail</h3>
          </div>

          {textPrompts.map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              isEditing={editingId === prompt.id}
              editData={editingId === prompt.id ? editData : {}}
              stats={usageStats[prompt.id]}
              saveMutation={saveMutation}
              onEdit={() => handleEdit(prompt)}
              onCancel={handleCancel}
              onSave={() => handleSave(prompt.id)}
              onEditDataChange={setEditData}
            />
          ))}
        </>
      )}

      {/* Other AI prompts */}
      {otherPrompts.length > 0 && (
        <>
          <Separator className="my-3" />
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Enriquecimento & Análise</h3>
          </div>

          {otherPrompts.map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              isEditing={editingId === prompt.id}
              editData={editingId === prompt.id ? editData : {}}
              stats={usageStats[prompt.id]}
              saveMutation={saveMutation}
              onEdit={() => handleEdit(prompt)}
              onCancel={handleCancel}
              onSave={() => handleSave(prompt.id)}
              onEditDataChange={setEditData}
            />
          ))}
        </>
      )}
    </div>
  );
};
