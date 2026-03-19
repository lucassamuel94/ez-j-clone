import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  MessageSquare, Star, AlertTriangle, Zap, Target,
  BookOpen, Lightbulb, Users, ChevronDown, Play,
  CheckCircle2,
} from 'lucide-react';
import { CoachingData, CATEGORY_COLORS } from './types';

interface Props {
  data: CoachingData;
  onSeekTo?: (time: number) => void;
  segments?: { start: number; end: number; text: string }[];
}

const formatTime = (s: number) => {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const MOMENT_CONFIG = {
  positive: { icon: Star, color: 'text-success dark:text-success', bg: 'bg-success/5 dark:bg-success/10', border: 'border-success/20 dark:border-success/20', dot: 'bg-success/50' },
  negative: { icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/20', dot: 'bg-red-500' },
  turning_point: { icon: Zap, color: 'text-warning dark:text-warning', bg: 'bg-warning/5 dark:bg-warning/10', border: 'border-warning/20 dark:border-warning/20', dot: 'bg-warning/50' },
};

export function CoachTab({ data, onSeekTo, segments }: Props) {
  const [expandedTechnique, setExpandedTechnique] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {/* Coach Message */}
      {data.coachMessage && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-primary">
              <MessageSquare className="h-4 w-4" />
              Mensagem do Coach
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
              {data.coachMessage}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Moments Timeline */}
      {data.keyMoments.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-warning" />
              Momentos-Chave
              <Badge variant="secondary" className="text-[10px] ml-auto">{data.keyMoments.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative pl-4">
              {/* Timeline line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

              <div className="space-y-4">
                {data.keyMoments.map((moment, i) => {
                  const cfg = MOMENT_CONFIG[moment.type] || MOMENT_CONFIG.positive;
                  const Icon = cfg.icon;
                  const seg = segments?.[moment.segment_index];

                  return (
                    <div key={i} className="relative flex gap-3">
                      {/* Dot */}
                      <div className={`absolute -left-4 top-1 h-3.5 w-3.5 rounded-full ${cfg.dot} ring-2 ring-background z-10 flex items-center justify-center`}>
                        <Icon className="h-2 w-2 text-white" />
                      </div>

                      <div className={`flex-1 rounded-lg border p-3 ${cfg.bg} ${cfg.border}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className={`text-xs font-semibold ${cfg.color}`}>{moment.title}</p>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{moment.description}</p>
                          </div>
                          {seg && onSeekTo && (
                            <Button
                              variant="ghost" size="sm"
                              className="h-7 px-2 text-[10px] shrink-0 gap-1"
                              onClick={() => onSeekTo(seg.start)}
                            >
                              <Play className="h-3 w-3" /> {formatTime(seg.start)}
                            </Button>
                          )}
                        </div>
                        {moment.impact_on_outcome && (
                          <p className="text-[11px] text-muted-foreground mt-2 pt-2 border-t border-current/10">
                            <span className="font-semibold">Impacto:</span> {moment.impact_on_outcome}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Missed Opportunities */}
      {data.missedOpportunities.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-red-500" />
              Oportunidades Perdidas
              <Badge variant="secondary" className="text-[10px] ml-auto">{data.missedOpportunities.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.missedOpportunities.map((opp, i) => {
              const seg = segments?.[opp.segment_index];
              return (
                <div key={i} className="rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-red-700 dark:text-red-400">
                      {opp.opportunity}
                    </p>
                    {seg && onSeekTo && (
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 px-2 text-[10px] shrink-0 gap-1"
                        onClick={() => onSeekTo(seg.start)}
                      >
                        <Play className="h-3 w-3" /> {formatTime(seg.start)}
                      </Button>
                    )}
                  </div>
                  <Separator className="my-2 bg-red-200/50 dark:bg-red-500/10" />
                  <div className="space-y-1.5">
                    <div>
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">O que fazer:</span>
                      <p className="text-xs text-muted-foreground leading-relaxed">{opp.what_to_do}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] h-5 border-red-300 dark:border-red-500/30 text-red-600 dark:text-red-400">
                      <BookOpen className="h-2.5 w-2.5 mr-1" />
                      {opp.technique}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Technique Suggestions */}
      {data.techniques.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Técnicas Recomendadas
              <Badge variant="secondary" className="text-[10px] ml-auto">{data.techniques.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.techniques.map((tech, i) => {
              const isExpanded = expandedTechnique === i;
              return (
                <div
                  key={i}
                  className="rounded-lg border bg-card p-3 cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => setExpandedTechnique(isExpanded ? null : i)}
                >
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0" />
                    <p className="text-xs font-semibold text-foreground flex-1">{tech.technique_name}</p>
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                  {isExpanded && (
                    <div className="mt-2 space-y-2 pt-2 border-t">
                      <p className="text-xs text-muted-foreground leading-relaxed">{tech.description}</p>
                      <div className="bg-primary/5 rounded-md p-2.5">
                        <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Aplicação nesta conversa:</span>
                        <p className="text-xs text-foreground/80 leading-relaxed mt-0.5">{tech.application}</p>
                      </div>
                      {tech.relevant_segments.length > 0 && segments && onSeekTo && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-muted-foreground">Segmentos:</span>
                          {tech.relevant_segments.map((idx) => {
                            const seg = segments[idx];
                            if (!seg) return null;
                            return (
                              <Button
                                key={idx}
                                variant="outline" size="sm"
                                className="h-5 px-1.5 text-[10px] gap-0.5"
                                onClick={(e) => { e.stopPropagation(); onSeekTo(seg.start); }}
                              >
                                <Play className="h-2.5 w-2.5" /> {formatTime(seg.start)}
                              </Button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Role Play Scenario */}
      {data.rolePlay && (
        <Card className="border-indigo-200 dark:border-indigo-500/20 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-500/5 dark:to-purple-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
              <Users className="h-4 w-4" />
              Cenário de Role Play
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm font-semibold text-foreground">{data.rolePlay.scenario_title}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="rounded-md border bg-background/60 p-2.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Contexto</span>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{data.rolePlay.context}</p>
              </div>
              <div className="rounded-md border bg-background/60 p-2.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Persona do Cliente</span>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{data.rolePlay.client_persona}</p>
              </div>
            </div>

            <div className="rounded-md border bg-background/60 p-2.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Objetivo</span>
              <p className="text-xs text-foreground/80 mt-0.5 leading-relaxed">{data.rolePlay.objective}</p>
            </div>

            <div className="rounded-md border-2 border-indigo-300 dark:border-indigo-500/30 bg-indigo-100/50 dark:bg-indigo-500/10 p-3">
              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Frase de abertura do cliente:</span>
              <p className="text-sm text-foreground font-medium mt-1 italic">
                &ldquo;{data.rolePlay.opening_line}&rdquo;
              </p>
            </div>

            {data.rolePlay.success_criteria.length > 0 && (
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Critérios de sucesso:</span>
                <div className="mt-1.5 space-y-1">
                  {data.rolePlay.success_criteria.map((c, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground leading-relaxed">{c}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
