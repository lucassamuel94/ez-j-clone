import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

import { usePermissions } from '@/hooks/usePermissions';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Users,
  UsersRound,
  ShieldCheck,
  ArrowLeft,
  MessageSquareMore,
  Handshake,
  Target,
  FileSpreadsheet,
  Package,
  Bot,
  Database,
  MailPlus,
  Headphones,
  Code2,
  ScrollText,
  Menu,
  Building2,
  PieChart,
  GitBranch,
  Blocks,
  Trash2,
  MailCheck,
  Cog,
  Megaphone,
  MessageCircle,
  Link as LinkIcon,
  BrainCircuit,
} from 'lucide-react';

interface SettingsNavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  comingSoon?: boolean;
}

function SectionLabel({ label }: {label: string;}) {
  return (
    <div className="px-3 pt-5 pb-1.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
        {label}
      </span>
    </div>);
}

function NavItem({ item, isActive, onNavigate }: {item: SettingsNavItem;isActive: boolean;onNavigate?: () => void;}) {
  return (
    <Link to={item.to} onClick={onNavigate}>
      <Button
        variant="ghost"
        className={cn(
          'w-full h-8 rounded-md justify-start gap-3 px-3 transition-all text-[13px] font-medium',
          isActive ?
          'bg-accent text-primary hover:bg-accent font-semibold' :
          'text-muted-foreground hover:text-foreground hover:bg-muted/30'
        )}>
        {item.icon}
        <span className="truncate">{item.label}</span>
        {item.comingSoon &&
        <span className="text-[8px] px-1 py-0 h-3.5 leading-[14px] font-medium border border-warning/20 text-warning bg-warning/10 ml-auto shrink-0 rounded">
            Breve
          </span>
        }
      </Button>
    </Link>);
}

interface SettingsLayoutProps {
  children: React.ReactNode;
}

function SettingsNavContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { hasPermission } = usePermissions();

  const isActive = (to: string) => {
    if (to === '/settings') return location.pathname === '/settings' && !location.search;
    const [toPath, toQuery] = to.split('?');
    if (toQuery) {
      return location.pathname.startsWith(toPath) && location.search === `?${toQuery}`;
    }
    return location.pathname.startsWith(toPath) && !location.search;
  };

  // ── Espaço de Trabalho ──────────────────────────────────────────────────
  const workspaceItems: SettingsNavItem[] = [
    { to: '/settings/people',      icon: <Users className="h-4 w-4" />,      label: 'Pessoas' },
    { to: '/settings/permissions', icon: <ShieldCheck className="h-4 w-4" />,label: 'Segurança e Permissões' },
  ];

  // ── Pipeline ────────────────────────────────────────────────────────────
  const pipelineItems: SettingsNavItem[] = [];
  if (hasPermission('access_admin')) {
    pipelineItems.push({ to: '/settings/pipeline-statuses', icon: <GitBranch className="h-4 w-4" />, label: 'Etapas do Pipeline' });
  }
  if (hasPermission('manage_products')) {
    pipelineItems.push({ to: '/settings/products', icon: <Package className="h-4 w-4" />, label: 'Produtos' });
  }
  if (hasPermission('manage_goals')) {
    pipelineItems.push({ to: '/settings/goals', icon: <Target className="h-4 w-4" />, label: 'Metas' });
  }
  if (hasPermission('access_admin')) {
    pipelineItems.push({ to: '/settings/team-phases', icon: <Cog className="h-4 w-4" />, label: 'Equipe → Fases' });
  }

  // ── Comunicação ─────────────────────────────────────────────────────────
  const comItems: SettingsNavItem[] = [];
  if (hasPermission('manage_automatic_messages')) {
    comItems.push({ to: '/settings/automatic-messages', icon: <MessageSquareMore className="h-4 w-4" />, label: 'Mensagens Automáticas' });
  }
  if (hasPermission('manage_email_templates')) {
    comItems.push({ to: '/settings/email-templates',  icon: <MailPlus className="h-4 w-4" />,  label: 'Templates de E-mail' });
    comItems.push({ to: '/settings/email-sequences',  icon: <MailCheck className="h-4 w-4" />,  label: 'Sequências de E-mail' });
  }
  if (hasPermission('access_admin')) {
    comItems.push({ to: '/settings/forms', icon: <Code2 className="h-4 w-4" />, label: 'Formulários' });
    comItems.push({ to: '/settings/forms?type=whatsapp', icon: <MessageCircle className="h-4 w-4" />, label: 'Widget WhatsApp' });
  }

  // ── Inteligência ────────────────────────────────────────────────────────
  const intelItems: SettingsNavItem[] = [];
  if (hasPermission('manage_ai')) {
    intelItems.push({ to: '/settings/ai', icon: <Bot className="h-4 w-4" />, label: 'IA' });
  }
  if (hasPermission('manage_enrichment')) {
    intelItems.push({ to: '/settings/enrich', icon: <Database className="h-4 w-4" />, label: 'Enriquecimento de Dados' });
  }
  if (hasPermission('access_call_intelligence')) {
    intelItems.push({ to: '/settings/call-intelligence', icon: <Headphones className="h-4 w-4" />, label: 'Call Intelligence' });
  }
  if (hasPermission('access_admin')) {
    intelItems.push({ to: '/settings/integrations-catalog', icon: <Blocks className="h-4 w-4" />, label: 'Catálogo de Integrações' });
    intelItems.push({ to: '/settings/business-chat', icon: <BrainCircuit className="h-4 w-4" />, label: 'Regras de Negócio' });
  }

  // ── Marketing ───────────────────────────────────────────────────────────
  const marketingItems: SettingsNavItem[] = [];
  if (hasPermission('access_admin')) {
    marketingItems.push({ to: '/settings/icp',              icon: <PieChart className="h-4 w-4" />,  label: 'Análise de ICP' });
    marketingItems.push({ to: '/settings/reports/marketing',icon: <Megaphone className="h-4 w-4" />, label: 'Relatórios de Marketing' });
    marketingItems.push({ to: '/settings/utm-generator',    icon: <LinkIcon className="h-4 w-4" />,  label: 'Gerador de UTM' });
  }

  // ── Relatórios ──────────────────────────────────────────────────────────
  const showReports = hasPermission('view_reports');

  // ── Sistema ─────────────────────────────────────────────────────────────
  const systemItems: SettingsNavItem[] = [];
  if (hasPermission('manage_import')) {
    systemItems.push({ to: '/settings/import',  icon: <FileSpreadsheet className="h-4 w-4" />, label: 'Importação' });
  }
  if (hasPermission('access_admin')) {
    systemItems.push({ to: '/settings/trash',  icon: <Trash2 className="h-4 w-4" />,     label: 'Lixeira' });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 pt-5 pb-3 shrink-0">
        <Link to="/">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h2 className="text-sm font-semibold text-foreground">Configurações</h2>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">

        {/* Espaço de Trabalho */}
        <SectionLabel label="Espaço de Trabalho" />
        {workspaceItems.map((item) =>
          <NavItem key={item.to} item={item} isActive={isActive(item.to)} onNavigate={onNavigate} />
        )}

        {/* Pipeline */}
        {pipelineItems.length > 0 && (
          <>
            <SectionLabel label="Pipeline" />
            {pipelineItems.map((item) =>
              <NavItem key={item.to} item={item} isActive={isActive(item.to)} onNavigate={onNavigate} />
            )}
          </>
        )}

        {/* Comunicação */}
        {comItems.length > 0 && (
          <>
            <SectionLabel label="Comunicação" />
            {comItems.map((item) =>
              <NavItem key={item.to} item={item} isActive={isActive(item.to)} onNavigate={onNavigate} />
            )}
          </>
        )}

        {/* Inteligência */}
        {intelItems.length > 0 && (
          <>
            <SectionLabel label="Inteligência" />
            {intelItems.map((item) =>
              <NavItem key={item.to} item={item} isActive={isActive(item.to)} onNavigate={onNavigate} />
            )}
          </>
        )}

        {/* Marketing */}
        {marketingItems.length > 0 && (
          <>
            <SectionLabel label="Marketing" />
            {marketingItems.map((item) =>
              <NavItem key={item.to} item={item} isActive={isActive(item.to)} onNavigate={onNavigate} />
            )}
          </>
        )}

        {/* Relatórios */}
        {showReports && (
          <>
            <SectionLabel label="Relatórios" />
            <NavItem
              item={{ to: '/settings/reports/sdr',    icon: <MessageSquareMore className="h-4 w-4" />, label: 'SDR' }}
              isActive={isActive('/settings/reports/sdr')}
              onNavigate={onNavigate}
            />
            <NavItem
              item={{ to: '/settings/reports/closer', icon: <Handshake className="h-4 w-4" />, label: 'Closer' }}
              isActive={isActive('/settings/reports/closer')}
              onNavigate={onNavigate}
            />
          </>
        )}

        {/* Sistema */}
        {systemItems.length > 0 && (
          <>
            <SectionLabel label="Sistema" />
            {systemItems.map((item) =>
              <NavItem key={item.to} item={item} isActive={isActive(item.to)} onNavigate={onNavigate} />
            )}
          </>
        )}

      </nav>
    </div>
  );
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] bg-background">
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside className="w-[260px] shrink-0 border-r border-border/40 flex flex-col bg-sidebar">
          <SettingsNavContent />
        </aside>
      )}

      {/* Mobile Sheet */}
      {isMobile && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[280px] p-0 flex flex-col bg-sidebar" aria-label="Menu de configurações">
            <SettingsNavContent onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      )}

      {/* Content area */}
      <main className="flex-1 overflow-y-auto">
        {isMobile && (
          <header className="sticky top-0 z-40 flex items-center gap-3 h-14 px-4 bg-card/80 backdrop-blur-md border-b border-border/40">
            <Link to="/">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h2 className="text-sm font-semibold text-foreground flex-1">Configurações</h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
          </header>
        )}
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
