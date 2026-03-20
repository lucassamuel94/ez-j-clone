import { useState, useRef, useEffect, useCallback } from 'react';
import { sanitizeHtml } from '@/utils/sanitize';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BrainCircuit, Send, Sparkles, User, Copy, Check, Trash2, Info, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';

type Msg = { role: 'user' | 'assistant' | 'error'; content: string };

const SUGGESTIONS = [
  'Como funciona a regra de CNPJ duplicado?',
  'Qual o fluxo completo de lead até cliente ativo?',
  'Como funciona o round-robin de atribuição de projetos?',
  'Quais são os papéis e permissões do sistema?',
  'Como funciona a validação SQO?',
  'Qual a diferença entre negócio novo e evolução?',
];

function formatMarkdown(text: string): string {
  let processed = text
    .replace(/\*\*(.*?)\*\*/g, '⟦B⟧$1⟦/B⟧')
    .replace(/__(.*?)__/g, '⟦B⟧$1⟦/B⟧');

  const lines = processed.split('\n');
  let html = '';
  let listType: 'ul' | 'ol' | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const bulletMatch = trimmed.match(/^[\-•\*]\s+(.+)$/);
    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);

    if (bulletMatch) {
      if (listType !== 'ul') {
        if (listType) html += `</${listType}>`;
        html += '<ul>';
        listType = 'ul';
      }
      html += `<li>${bulletMatch[1]}</li>`;
    } else if (orderedMatch) {
      if (listType !== 'ol') {
        if (listType) html += `</${listType}>`;
        html += '<ol>';
        listType = 'ol';
      }
      html += `<li>${orderedMatch[1]}</li>`;
    } else {
      if (listType) { html += `</${listType}>`; listType = null; }
      if (trimmed === '') {
        html += '<div class="h-2"></div>';
      } else {
        html += `<p>${trimmed}</p>`;
      }
    }
  }
  if (listType) html += `</${listType}>`;

  html = html
    .replace(/⟦B⟧/g, '<strong>')
    .replace(/⟦\/B⟧/g, '</strong>');

  html = html.replace(/(?<!\*)(\*)(?!\*)(.*?)(?<!\*)\1(?!\*)/g, '<em>$2</em>');

  return html;
}

export function BusinessRulesChatSection() {
  const { user } = useCurrentUser();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const clearHistory = () => {
    setMessages([]);
    toast.success('Histórico limpo');
  };

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || isLoading || !user?.id) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      toast.error('Faça login para usar o chat');
      return;
    }

    const userMsg: Msg = { role: 'user', content: question };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let assistantSoFar = '';

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/business-rules-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ question, history }),
          signal: controller.signal,
        },
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(err.error || `Erro ${resp.status}`);
      }

      if (!resp.body) throw new Error('Sem stream');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const withoutStreaming = prev.filter((_, i) => i < prev.length - 1 || prev[prev.length - 1].role !== 'assistant');
                // If last message is the streaming assistant, replace it
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && prev.length > 1) {
                  return [...prev.slice(0, -1), { role: 'assistant', content: assistantSoFar }];
                }
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Flush remaining buffer
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
            }
          } catch { /* ignore */ }
        }
      }

      // Final update with complete message
      if (assistantSoFar.trim()) {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return [...prev.slice(0, -1), { role: 'assistant', content: assistantSoFar }];
          }
          return [...prev, { role: 'assistant', content: assistantSoFar }];
        });

        // Silent log + email notification — fire and forget
        const userName = user.name || user.email || '';
        (supabase as any).from('business_rules_logs').insert({
          user_id: user.id,
          user_name: userName,
          question,
          answer: assistantSoFar,
        }).then(() => { /* logged */ }, () => { /* ignore errors */ });

        // Notify admin via email
        supabase.functions.invoke('notify-business-rules-query', {
          body: { user_name: userName, question, answer: assistantSoFar },
        }).then(() => { /* notified */ }, () => { /* ignore errors */ });
      }
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      const errorMessage = e instanceof Error ? e.message : 'Erro ao consultar IA';
      console.error('Business rules chat error:', e);
      setMessages(prev => [...prev, { role: 'error', content: errorMessage }]);
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const noSession = !user?.id;

  return (
    <div className="space-y-1">
      <h1 className="text-lg font-semibold font-display">Regras de Negócio</h1>
      <p className="text-sm text-muted-foreground mb-4">Pergunte à IA sobre como o sistema funciona</p>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BrainCircuit className="h-4 w-4 text-primary" />
              Assistente de Regras de Negócio
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-xs">
                    Este assistente conhece todas as regras de negócio do EZ Journey: fluxos de lead, pipeline, projetos, permissões e mais.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                disabled={isLoading}
                className="text-xs text-muted-foreground h-7 px-2"
                onClick={clearHistory}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Suggestions */}
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map(s => (
                <Badge
                  key={s}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent transition-colors text-xs py-1.5 px-3"
                  onClick={() => send(s)}
                >
                  <Sparkles className="h-3 w-3 mr-1.5 text-primary" />
                  {s}
                </Badge>
              ))}
            </div>
          )}

          {/* Messages */}
          {messages.length > 0 && (
            <div className="max-h-[600px] overflow-y-auto rounded-lg border border-border p-3 space-y-4">
              {messages.map((msg, i) => {
                if (msg.role === 'error') {
                  return (
                    <div key={i} className="flex gap-2.5 justify-start">
                      <div className="h-6 w-6 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0 mt-1">
                        <AlertCircle className="h-3 w-3 text-destructive" />
                      </div>
                      <div className="rounded-lg px-3.5 py-2.5 text-sm bg-destructive/10 text-destructive border border-destructive/20 max-w-[90%]">
                        {msg.content}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                        <BrainCircuit className="h-3 w-3 text-primary" />
                      </div>
                    )}
                    <div className={`rounded-lg px-3.5 py-2.5 text-sm relative group ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground max-w-[80%]'
                        : 'bg-accent/50 dark:bg-accent/30 text-foreground max-w-[90%] border border-border/50'
                    }`}>
                      <div
                        className={`break-words leading-relaxed ${msg.role === 'assistant' ? '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-1.5 [&_li]:py-0.5 [&_li]:leading-normal [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0' : 'whitespace-pre-wrap'}`}
                        dangerouslySetInnerHTML={{
                          __html: msg.role === 'assistant'
                            ? sanitizeHtml(formatMarkdown(msg.content))
                            : sanitizeHtml(msg.content),
                        }}
                      />
                      {msg.role === 'assistant' && !isLoading && (
                        <button
                          onClick={() => copyToClipboard(msg.content, i)}
                          className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 rounded-full bg-background border border-border shadow-sm flex items-center justify-center"
                          title="Copiar resposta"
                        >
                          {copiedIdx === i
                            ? <Check className="h-3 w-3 text-success" />
                            : <Copy className="h-3 w-3 text-muted-foreground" />
                          }
                        </button>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}
              {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex gap-2.5">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <BrainCircuit className="h-3 w-3 text-primary animate-pulse" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2">
            <Input
              placeholder={noSession ? 'Faça login para usar o chat' : 'Pergunte sobre as regras de negócio...'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
              disabled={isLoading || noSession}
              className="flex-1"
            />
            <Button size="icon" onClick={() => send(input)} disabled={isLoading || !input.trim() || noSession}>
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Quick suggestions after conversation started */}
          {messages.length > 0 && !isLoading && (
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.filter(s => !messages.some(m => m.content === s)).slice(0, 3).map(s => (
                <Badge
                  key={s}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent transition-colors text-[11px] py-1 px-2"
                  onClick={() => send(s)}
                >
                  {s}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
