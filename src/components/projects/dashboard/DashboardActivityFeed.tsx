import { useState } from 'react';
import { Activity, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatDateTimeBR } from '@/utils/dateFormat';
import { cn } from '@/lib/utils';

interface ActivityItem {
  id: string;
  description: string;
  created_at: string;
  profile?: { name: string } | null;
  project?: { company_name: string } | null;
}

interface DashboardActivityFeedProps {
  activities: ActivityItem[];
}

export function DashboardActivityFeed({ activities }: DashboardActivityFeedProps) {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);
  const [isOpen, setIsOpen] = useState(!isMobile);

  const visibleItems = expanded ? activities : activities.slice(0, 5);

  const content = (
    <>
      {activities.length > 0 ? (
        <div className="divide-y divide-border/30">
          {visibleItems.map((a) => (
            <div key={a.id} className="px-4 py-3 flex items-start gap-3">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0 mt-0.5">
                {(a.profile?.name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">
                  <span className="font-medium">{a.profile?.name || 'Sistema'}</span>
                  {' '}{a.description}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {a.project?.company_name && <span>{a.project.company_name} · </span>}
                  {formatDateTimeBR(a.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center text-muted-foreground text-sm">
          Nenhuma atividade recente
        </div>
      )}
      {activities.length > 5 && !expanded && (
        <div className="px-4 pb-3">
          <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => setExpanded(true)}>
            Ver mais ({activities.length - 5})
          </Button>
        </div>
      )}
    </>
  );

  if (isMobile) {
    return (
      <Card className="bg-card border-border/50">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CardHeader className="pb-2">
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Atividade Recente
                </span>
              </CardTitle>
              <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="p-0">{content}</CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" strokeWidth={1.5} />
            Atividade Recente
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">{content}</CardContent>
    </Card>
  );
}
