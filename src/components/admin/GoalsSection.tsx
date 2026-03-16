import { useState, useMemo } from 'react';
import { useGoals, GoalFormData, GoalType } from '@/hooks/useGoals';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Pencil, Trash2, Loader2, Target, Users, User, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const currentMonth = new Date().getMonth() + 1;
const currentYear = new Date().getFullYear();

const defaultSdrForm: GoalFormData = {
  target_user_id: null,
  period_month: currentMonth,
  period_year: currentYear,
  goal_type: 'sdr',
  meetings_scheduled_goal: 0,
  meetings_held_percentage: 65,
  sqo_percentage: 0,
  setup_revenue_goal: 0,
  conversion_percentage: 0,
};

const defaultCloserForm: GoalFormData = {
  target_user_id: null,
  period_month: currentMonth,
  period_year: currentYear,
  goal_type: 'closer',
  meetings_scheduled_goal: 0,
  meetings_held_percentage: 0,
  sqo_percentage: 0,
  setup_revenue_goal: 0,
  conversion_percentage: 0,
};

export const GoalsSection = () => {
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [goalTab, setGoalTab] = useState<GoalType>('sdr');
  const { goals, isLoading, upsertGoal, deleteGoal, copyToNextMonth } = useGoals(filterMonth, filterYear);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalFormData | null>(null);

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-goals'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, name, role').eq('active', true).order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch user_roles to reliably filter users by role
  const { data: userRoles = [] } = useQuery({
    queryKey: ['user-roles-goals'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_roles').select('user_id, role');
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<GoalFormData>(defaultSdrForm);

  const sdrGoals = useMemo(() => goals.filter(g => g.goal_type === 'sdr'), [goals]);
  const closerGoals = useMemo(() => goals.filter(g => g.goal_type === 'closer'), [goals]);
  const postSalesGoals = useMemo(() => goals.filter(g => ['ux_po', 'dev_chatbot', 'treinamento'].includes(g.goal_type)), [goals]);
  const filteredGoals = goalTab === 'sdr' ? sdrGoals : goalTab === 'closer' ? closerGoals : postSalesGoals.filter(g => g.goal_type === goalTab);

  // New SDR logic: SQO qty is the primary input (stored in sqo_percentage as raw number)
  // Show rate = meetings_held_percentage (default 65%)
  // Agendas needed = ceil(sqo / (showRate/100))
  const sqoTarget = useMemo(() => Math.round(form.sqo_percentage), [form.sqo_percentage]);
  const agendasNeeded = useMemo(
    () => form.meetings_held_percentage > 0 ? Math.ceil(sqoTarget / (form.meetings_held_percentage / 100)) : 0,
    [sqoTarget, form.meetings_held_percentage]
  );

  const openNew = () => {
    setEditingGoal(null);
    const isPostSales = ['ux_po', 'dev_chatbot', 'treinamento'].includes(goalTab);
    const base = goalTab === 'closer' ? defaultCloserForm : { ...defaultSdrForm, goal_type: goalTab as GoalType };
    setForm({ ...base, period_month: filterMonth, period_year: filterYear, goal_type: goalTab });
    setDialogOpen(true);
  };

  const openEdit = (goal: any) => {
    const formData: GoalFormData = {
      target_user_id: goal.target_user_id,
      period_month: goal.period_month,
      period_year: goal.period_year,
      goal_type: goal.goal_type || 'sdr',
      meetings_scheduled_goal: goal.meetings_scheduled_goal,
      meetings_held_percentage: Number(goal.meetings_held_percentage),
      sqo_percentage: Number(goal.sqo_percentage),
      setup_revenue_goal: Number(goal.setup_revenue_goal || 0),
      conversion_percentage: Number(goal.conversion_percentage || 0),
    };
    setEditingGoal(formData);
    setForm(formData);
    setDialogOpen(true);
  };

  const handleSave = () => {
    const formToSave = { ...form };
    // For SDR, auto-calculate meetings_scheduled_goal from SQO qty and show rate
    if (formToSave.goal_type === 'sdr') {
      const sqo = Math.round(formToSave.sqo_percentage);
      const showRate = formToSave.meetings_held_percentage;
      formToSave.meetings_scheduled_goal = showRate > 0 ? Math.ceil(sqo / (showRate / 100)) : 0;
    }
    upsertGoal.mutate(formToSave, {
      onSuccess: () => setDialogOpen(false),
    });
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return 'Equipe (todos)';
    return profiles.find(p => p.id === userId)?.name || 'Desconhecido';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Metas
            </CardTitle>
            <CardDescription>Defina metas individuais ou por equipe para cada período.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={openNew} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Meta
            </Button>
            {filteredGoals.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={copyToNextMonth.isPending}
                onClick={() => {
                  const nextMonth = filterMonth === 12 ? 1 : filterMonth + 1;
                  const nextYear = filterMonth === 12 ? filterYear + 1 : filterYear;
                  copyToNextMonth.mutate({ goals: filteredGoals, nextMonth, nextYear });
                }}
              >
                {copyToNextMonth.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                Copiar para {MONTHS[filterMonth === 12 ? 0 : filterMonth]}/{filterMonth === 12 ? filterYear + 1 : filterYear}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Period filter */}
        <div className="flex items-center gap-3">
          <Select value={String(filterMonth)} onValueChange={(v) => setFilterMonth(Number(v))}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(Number(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* SDR / Closer tabs */}
        <Tabs value={goalTab} onValueChange={(v) => setGoalTab(v as GoalType)}>
          <TabsList>
            <TabsTrigger value="sdr">SDR</TabsTrigger>
            <TabsTrigger value="closer">Closer</TabsTrigger>
            <TabsTrigger value="ux_po">UX/PO</TabsTrigger>
            <TabsTrigger value="dev_chatbot">Dev Chatbot</TabsTrigger>
            <TabsTrigger value="treinamento">Treinamento</TabsTrigger>
          </TabsList>

          <TabsContent value="sdr" className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sdrGoals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma meta de SDR cadastrada para este período.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Destinatário</TableHead>
                    <TableHead className="text-center">Meta SQO</TableHead>
                    <TableHead className="text-center">Show Rate</TableHead>
                    <TableHead className="text-center">Agendas Necessárias</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sdrGoals.map((goal) => {
                    const sqo = Math.round(Number(goal.sqo_percentage));
                    const showRate = Number(goal.meetings_held_percentage);
                    const agendas = showRate > 0 ? Math.ceil(sqo / (showRate / 100)) : 0;
                    return (
                      <TableRow key={goal.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {goal.target_user_id ? <User className="h-4 w-4 text-muted-foreground" /> : <Users className="h-4 w-4 text-muted-foreground" />}
                            {getUserName(goal.target_user_id)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold">{sqo}</TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold">{showRate}%</span>
                        </TableCell>
                        <TableCell className="text-center font-semibold">{agendas}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(goal)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteGoal.mutate(goal.id)} disabled={deleteGoal.isPending}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Totals row - only when there are individual goals */}
                  {sdrGoals.filter(g => g.target_user_id).length > 1 && (() => {
                    const individualGoals = sdrGoals.filter(g => g.target_user_id);
                    const totalSqo = individualGoals.reduce((sum, g) => sum + Math.round(Number(g.sqo_percentage)), 0);
                    const avgShowRate = Math.round(individualGoals.reduce((sum, g) => sum + Number(g.meetings_held_percentage), 0) / individualGoals.length);
                    const totalAgendas = individualGoals.reduce((sum, g) => {
                      const sqo = Math.round(Number(g.sqo_percentage));
                      const sr = Number(g.meetings_held_percentage);
                      return sum + (sr > 0 ? Math.ceil(sqo / (sr / 100)) : 0);
                    }, 0);
                    return (
                      <TableRow className="bg-muted/30 border-t-2 border-border font-bold">
                        <TableCell>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Target className="h-4 w-4" /> Total
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{totalSqo}</TableCell>
                        <TableCell className="text-center">{avgShowRate}%</TableCell>
                        <TableCell className="text-center">{totalAgendas}</TableCell>
                        <TableCell />
                      </TableRow>
                    );
                  })()}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="closer" className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : closerGoals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma meta de Closer cadastrada para este período.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Destinatário</TableHead>
                    <TableHead className="text-center">Meta de Setup (R$)</TableHead>
                    <TableHead className="text-center">% Conversão</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {closerGoals.map((goal) => (
                    <TableRow key={goal.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {goal.target_user_id ? <User className="h-4 w-4 text-muted-foreground" /> : <Users className="h-4 w-4 text-muted-foreground" />}
                          {getUserName(goal.target_user_id)}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-semibold">{formatCurrency(Number(goal.setup_revenue_goal))}</TableCell>
                      <TableCell className="text-center">
                        <span className="font-semibold">{Number(goal.conversion_percentage)}%</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(goal)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteGoal.mutate(goal.id)} disabled={deleteGoal.isPending}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {closerGoals.filter(g => g.target_user_id).length > 1 && (() => {
                    const individualGoals = closerGoals.filter(g => g.target_user_id);
                    const totalSetup = individualGoals.reduce((sum, g) => sum + Number(g.setup_revenue_goal), 0);
                    const avgConversion = Math.round(individualGoals.reduce((sum, g) => sum + Number(g.conversion_percentage), 0) / individualGoals.length);
                    return (
                      <TableRow className="bg-muted/30 border-t-2 border-border font-bold">
                        <TableCell>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Target className="h-4 w-4" /> Total
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{formatCurrency(totalSetup)}</TableCell>
                        <TableCell className="text-center">{avgConversion}%</TableCell>
                        <TableCell />
                      </TableRow>
                    );
                  })()}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* Post-Sales tabs (ux_po, dev_chatbot, treinamento) */}
          {(['ux_po', 'dev_chatbot', 'treinamento'] as const).map(type => {
            const typeGoals = goals.filter(g => g.goal_type === type);
            const typeLabel = type === 'ux_po' ? 'UX/PO' : type === 'dev_chatbot' ? 'Dev Chatbot' : 'Treinamento';
            return (
              <TabsContent key={type} value={type} className="mt-4">
                {isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : typeGoals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma meta de {typeLabel} cadastrada para este período.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Destinatário</TableHead>
                        <TableHead className="text-center">Meta de Entregas</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {typeGoals.map((goal) => (
                        <TableRow key={goal.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {goal.target_user_id ? <User className="h-4 w-4 text-muted-foreground" /> : <Users className="h-4 w-4 text-muted-foreground" />}
                              {getUserName(goal.target_user_id)}
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-semibold">{goal.meetings_scheduled_goal}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(goal)}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteGoal.mutate(goal.id)} disabled={deleteGoal.isPending}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {typeGoals.filter(g => g.target_user_id).length > 1 && (() => {
                        const individualGoals = typeGoals.filter(g => g.target_user_id);
                        const totalEntregas = individualGoals.reduce((sum, g) => sum + g.meetings_scheduled_goal, 0);
                        return (
                          <TableRow className="bg-muted/30 border-t-2 border-border font-bold">
                            <TableCell>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Target className="h-4 w-4" /> Total
                              </div>
                            </TableCell>
                            <TableCell className="text-center">{totalEntregas}</TableCell>
                            <TableCell />
                          </TableRow>
                        );
                      })()}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            );
          })}
        </Tabs>

        {/* Goal Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingGoal ? 'Editar Meta' : 'Nova Meta'}
                <Badge variant="outline" className="ml-2 text-xs">{form.goal_type === 'closer' ? 'Closer' : 'SDR'}</Badge>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Target */}
              <div className="space-y-2">
                <Label>Destinatário</Label>
                <Select
                  value={form.target_user_id || 'team'}
                  onValueChange={(v) => setForm(f => ({ ...f, target_user_id: v === 'team' ? null : v }))}
                  disabled={!!editingGoal}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="team">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" /> Equipe (todos)
                      </div>
                    </SelectItem>
                    {profiles
                      .filter(p => {
                        const targetRole = form.goal_type === 'closer' ? 'closer'
                          : form.goal_type === 'ux_po' ? 'ux_po'
                          : form.goal_type === 'dev_chatbot' ? 'dev_chatbot'
                          : form.goal_type === 'treinamento' ? 'treinamento'
                          : 'sdr';
                        return userRoles.some(ur => ur.user_id === p.id && ur.role === targetRole);
                      })
                      .map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" /> {p.name}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Period */}
              <div className="flex gap-3">
                <div className="flex-1 space-y-2">
                  <Label>Mês</Label>
                  <Select
                    value={String(form.period_month)}
                    onValueChange={(v) => setForm(f => ({ ...f, period_month: Number(v) }))}
                    disabled={!!editingGoal}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[100px] space-y-2">
                  <Label>Ano</Label>
                  <Select
                    value={String(form.period_year)}
                    onValueChange={(v) => setForm(f => ({ ...f, period_year: Number(v) }))}
                    disabled={!!editingGoal}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {['ux_po', 'dev_chatbot', 'treinamento'].includes(form.goal_type) ? (
                <div className="space-y-2">
                  <Label>Meta de Entregas (projetos concluídos)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.meetings_scheduled_goal}
                    onChange={(e) => setForm(f => ({ ...f, meetings_scheduled_goal: Number(e.target.value) }))}
                  />
                </div>
              ) : form.goal_type === 'sdr' ? (
                <>
                  {/* SDR fields — new logic: SQO → Show Rate → Agendas */}
                  <div className="space-y-2">
                    <Label>Qde de SQO (meta)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.sqo_percentage}
                      onChange={(e) => setForm(f => ({ ...f, sqo_percentage: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>% Show Rate</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number" min={0} max={100}
                        value={form.meetings_held_percentage}
                        onChange={(e) => setForm(f => ({ ...f, meetings_held_percentage: Number(e.target.value) }))}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Qde agendas necessárias para meta de SQO (aprox.)</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        value={agendasNeeded}
                        disabled
                        className="w-24 bg-muted"
                      />
                      <span className="text-sm text-muted-foreground">
                        = <strong>{agendasNeeded}</strong> agendamentos
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Closer fields */}
                  <div className="space-y-2">
                    <Label>Meta de Setup (R$)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={100}
                      value={form.setup_revenue_goal}
                      onChange={(e) => setForm(f => ({ ...f, setup_revenue_goal: Number(e.target.value) }))}
                      placeholder="Ex: 50000"
                    />
                    {form.setup_revenue_goal > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Meta: <strong>{formatCurrency(form.setup_revenue_goal)}</strong>
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>% Conversão</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number" min={0} max={100}
                        value={form.conversion_percentage}
                        onChange={(e) => setForm(f => ({ ...f, conversion_percentage: Number(e.target.value) }))}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <Button onClick={handleSave} disabled={upsertGoal.isPending}>
                {upsertGoal.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
