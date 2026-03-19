import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useMemo, useCallback } from "react";
import { KeyboardShortcutsDialog, useShortcutsDialog } from "@/components/KeyboardShortcutsDialog";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserRole } from "@/hooks/useUserRole";
import { usePermissions } from "@/hooks/usePermissions";

import { usePhaseProjectCounts } from "@/hooks/usePhaseProjectCounts";
import { useSidebar } from "@/contexts/SidebarContext";
import {
  Shield,
  Settings,
  BarChart3,
  FileText,
  FolderKanban,
  PanelLeftClose,
  PanelLeft,
  Inbox,
  Bell,
  
  LayoutDashboard,
  ListTodo,
  Calendar,
  ClipboardCheck,
  Palette,
  Code,
  GraduationCap,
  Rocket,
  Cog,
  Brain,
  RadioTower,
  ShieldCheck,
  ChevronsUpDown,
  User,
  LogOut,
  MessageSquare,
   TrendingUp,
   
   PieChart,
  Handshake,
  Briefcase,
  Building2,
   Plug,
   PackageCheck,
   FileText as FileTextIcon,
   FileSearch,
   History,
   UserCheck,
   Keyboard,
   ChevronRight } from
 "lucide-react";
import ezsoftLogo from "@/assets/ez-journey-logo-color.svg";
import ezsoftLogoWhite from "@/assets/ez-journey-logo-white.svg";
import { supabase } from "@/integrations/supabase/client";
import { useNotifications } from "@/hooks/useNotifications";
import { useMyTasks } from "@/hooks/useMyTasks";
import { RoleSimulationDialog } from "@/components/admin/RoleSimulationDialog";
import { Eye } from "lucide-react";

const PHASE_ICONS: Record<string, React.ReactNode> = {
  validacao: <ClipboardCheck className="h-3.5 w-3.5" />,
  ux_po: <Palette className="h-3.5 w-3.5" />,
  verificacao_bm: <ShieldCheck className="h-3.5 w-3.5" />,
  dev_chatbot: <Code className="h-3.5 w-3.5" />,
  treinamento: <GraduationCap className="h-3.5 w-3.5" />,
  ativacao: <Rocket className="h-3.5 w-3.5" />,
  automacao: <Cog className="h-3.5 w-3.5" />,
  curadoria_ia: <Brain className="h-3.5 w-3.5" />,
  go_live_assistido: <RadioTower className="h-3.5 w-3.5" />
};

const PHASE_LABELS: Record<string, string> = {
  validacao: "Validação",
  ux_po: "UX/PO",
  verificacao_bm: "Verificação de BM",
  dev_chatbot: "Dev Chatbot",
  treinamento: "Treinamento",
  ativacao: "Ativação",
  automacao: "Automação",
  curadoria_ia: "Curadoria de IA",
  go_live_assistido: "Go-live Assistido"
};

const PROJECT_PHASES_ORDER = [
"validacao",
"ux_po",
"verificacao_bm",
"dev_chatbot",
"treinamento",
"ativacao",
"automacao",
"curadoria_ia",
"go_live_assistido"];


const COMING_SOON_PHASES = new Set<string>();

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  comingSoon?: boolean;
  badgeCount?: number;
  validating?: boolean;
  children?: NavItem[];
}

const SIDEBAR_SECTIONS_KEY = 'sidebar_sections_state';

function useSectionCollapse() {
  const [sections, setSections] = useState<Record<string, boolean>>(() => {
    try {
      const stored = sessionStorage.getItem(SIDEBAR_SECTIONS_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const isSectionOpen = useCallback((key: string) => {
    return sections[key] !== false; // default open
  }, [sections]);

  const toggleSection = useCallback((key: string) => {
    setSections(prev => {
      const next = { ...prev, [key]: prev[key] === false };
      sessionStorage.setItem(SIDEBAR_SECTIONS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { isSectionOpen, toggleSection };
}

function SectionLabel({ label, collapsed, sectionKey, isOpen, onToggle }: {
  label: string;
  collapsed: boolean;
  sectionKey?: string;
  isOpen?: boolean;
  onToggle?: (key: string) => void;
}) {
  if (collapsed) return <div className="my-2 mx-2 border-t border-border/40" />;
  
  const clickable = sectionKey && onToggle;
  
  return (
    <CollapsibleTrigger asChild>
      <button
        type="button"
        className={cn(
          "px-3 pt-4 pb-1 flex items-center gap-1 w-full text-left",
          clickable && "cursor-pointer hover:opacity-80 transition-opacity group"
        )}
      >
        {clickable && (
          <ChevronRight
            className={cn(
              "h-3 w-3 text-muted-foreground/60 transition-transform duration-200 group-hover:text-muted-foreground",
              isOpen && "rotate-90"
            )}
          />
        )}
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">{label}</span>
      </button>
    </CollapsibleTrigger>
  );
}

function NavLinkItem({ item, collapsed, isActive, onNavigate }: {item: NavItem;collapsed: boolean;isActive: boolean;onNavigate?: () => void;}) {
  return (
    <Tooltip delayDuration={collapsed ? 0 : 1000}>
      <TooltipTrigger asChild>
        <Link to={item.to} onClick={onNavigate}>
          <Button
            variant="ghost"
            className={cn(
              "w-full h-8 rounded-md transition-all",
              collapsed ? "justify-center px-0" : "justify-start gap-3 px-3",
              isActive ?
              "bg-accent text-primary hover:bg-accent font-semibold" :
              "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            )}>

            {item.icon}
            {!collapsed &&
            <span className="text-[13px] font-medium truncate">{item.label}</span>
            }
            {!collapsed && item.comingSoon &&
            <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 leading-none font-medium border-warning/20 text-warning bg-warning/10 ml-auto shrink-0">
                Breve
              </Badge>
            }
            {!collapsed && !item.comingSoon && item.validating &&
            <div className="flex items-center gap-1 ml-auto shrink-0">
                {item.badgeCount != null && item.badgeCount > 0 &&
              <Badge className="text-[9px] px-1.5 py-0 h-4 leading-none font-semibold shrink-0 bg-destructive text-destructive-foreground border-0">
                    {item.badgeCount > 99 ? '99+' : item.badgeCount}
                  </Badge>
              }
                <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 leading-none font-medium border-info/20 text-info bg-info/10 shrink-0">
                  Validação
                </Badge>
              </div>
            }
            {!collapsed && !item.comingSoon && !item.validating && item.badgeCount != null && item.badgeCount > 0 &&
            <Badge className="text-[9px] px-1.5 py-0 h-4 leading-none font-semibold ml-auto shrink-0 bg-destructive text-destructive-foreground border-0">
                {item.badgeCount > 99 ? '99+' : item.badgeCount}
              </Badge>
            }
          </Button>
        </Link>
      </TooltipTrigger>
      {collapsed &&
      <TooltipContent side="right" className="text-xs">
          {item.label}
        </TooltipContent>
      }
    </Tooltip>);
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { open: shortcutsOpen, setOpen: setShortcutsOpen } = useShortcutsDialog();
  const { user: currentUser } = useCurrentUser();
  const { isRealAdmin } = useUserRole();
  const { hasPermission, isLoading: isLoadingPerms } = usePermissions();
  const { unreadCount } = useNotifications();
  const { data: myTasks } = useMyTasks();
  const pendingTaskCount = useMemo(() => (myTasks || []).filter(t => t.status === 'pendente').length, [myTasks]);
  const location = useLocation();
  const { collapsed, toggle, isMobile } = useSidebar();
  const { data: phaseCounts } = usePhaseProjectCounts();
  const navigate = useNavigate();
  const [simDialogOpen, setSimDialogOpen] = useState(false);
  const { isSectionOpen, toggleSection } = useSectionCollapse();

  // In mobile sheet, never show as "collapsed"
  const isCollapsed = isMobile ? false : collapsed;

  const canAccessProjects = hasPermission('view_projects');
  const canAccessSdr = hasPermission('view_sdr_leads');
  const canAccessCloser = hasPermission('view_closer_pipeline');
  const canAccessCommercial = canAccessSdr || canAccessCloser;
  const canAccessAdmin = hasPermission('access_admin');

  const isLinkActive = (to: string) => {
    if (to === "/") return location.pathname === "/";
    return location.pathname.startsWith(to);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const initials = currentUser?.name?.
  split(" ").
  map((n) => n[0]).
  join("").
  toUpperCase().
  slice(0, 2) || "";


  const quickAccess: NavItem[] = [
  { to: "/", icon: <LayoutDashboard className="h-4 w-4" />, label: "Home" },
  { to: "/notifications", icon: <Bell className="h-4 w-4" />, label: "Notificações", badgeCount: unreadCount },
  { to: "/tasks", icon: <ListTodo className="h-4 w-4" />, label: "Minhas Tarefas", badgeCount: pendingTaskCount },
  { to: "/calendar", icon: <Calendar className="h-4 w-4" />, label: "Calendário" }];

  const commercialLinks: NavItem[] = [];
  if (canAccessSdr) {
    commercialLinks.push({
      to: "/leads",
      icon: <MessageSquare className="h-4 w-4" />,
      label: "SDR",
      children: [
      { to: "/leads", icon: <Inbox className="h-3.5 w-3.5" />, label: "Leads" },
      { to: "/sdr/call-intelligence", icon: <TrendingUp className="h-3.5 w-3.5" />, label: "Call Intelligence" },
      { to: "/sdr/icp", icon: <PieChart className="h-3.5 w-3.5" />, label: "Análise de ICP" },
      { to: "/sdr/indicadores", icon: <BarChart3 className="h-3.5 w-3.5" />, label: "Dashboard" }]
    });
  }
  if (canAccessCloser) {
    commercialLinks.push({
      to: "/closer",
      icon: <Handshake className="h-4 w-4" />,
      label: "Closer",
      children: [
      { to: "/closer", icon: <Briefcase className="h-3.5 w-3.5" />, label: "Oportunidades" },
      { to: "/closer/evolucao", icon: <Rocket className="h-3.5 w-3.5" />, label: "Evoluções" },
      { to: "/closer/api-oficial", icon: <ShieldCheck className="h-3.5 w-3.5" />, label: "API Oficial" },
      { to: "/proposals", icon: <FileTextIcon className="h-3.5 w-3.5" />, label: "Propostas" },
      { to: "/sdr/icp", icon: <PieChart className="h-3.5 w-3.5" />, label: "Análise de ICP" },
      { to: "/closer/call-intelligence", icon: <TrendingUp className="h-3.5 w-3.5" />, label: "Call Intelligence" },
      { to: "/closer/indicadores", icon: <BarChart3 className="h-3.5 w-3.5" />, label: "Dashboard" },
      { to: "/sdr/meus-clientes", icon: <UserCheck className="h-3.5 w-3.5" />, label: "Meus Clientes" },
      { to: "/closer/parceiros", icon: <Handshake className="h-3.5 w-3.5" />, label: "Parceiros" }]
    });
  }

  return (
    <>
      {/* Logo + Collapse (desktop only) */}
      {!isMobile && (
        <div className="flex items-center justify-center h-14 px-3 border-b border-border/40 flex-shrink-0">
          {!isCollapsed &&
          <Link to="/" className="flex items-center justify-center flex-1">
              <img src={ezsoftLogo} alt="EZ Journey" className="h-10 w-auto dark:hidden" />
              <img src={ezsoftLogoWhite} alt="EZ Journey" className="h-10 w-auto hidden dark:block" />
            </Link>
          }
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggle}
                className={cn("h-8 w-8 text-muted-foreground hover:text-foreground", isCollapsed && "mx-auto")}>
                {isCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {isCollapsed ? "Expandir" : "Recolher"} <kbd className="ml-1 text-[10px] opacity-60">⌘B</kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 flex flex-col overflow-y-auto py-1 px-2 gap-y-0.5">
        <Collapsible open={isSectionOpen('quickAccess')} onOpenChange={() => toggleSection('quickAccess')}>
          <SectionLabel label="Acesso Rápido" collapsed={isCollapsed} sectionKey="quickAccess" isOpen={isSectionOpen('quickAccess')} onToggle={toggleSection} />
          <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1 overflow-hidden">
            {quickAccess.map((item) =>
              <NavLinkItem key={item.label} item={item} collapsed={isCollapsed} isActive={isLinkActive(item.to)} onNavigate={onNavigate} />
            )}
          </CollapsibleContent>
        </Collapsible>

        {canAccessCommercial &&
          <Collapsible open={isSectionOpen('commercial')} onOpenChange={() => toggleSection('commercial')}>
            <SectionLabel label="Comercial" collapsed={isCollapsed} sectionKey="commercial" isOpen={isSectionOpen('commercial')} onToggle={toggleSection} />
            <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1 overflow-hidden">
              {commercialLinks.map((item) => {
                if (item.children && !isCollapsed) {
                  return (
                    <div key={item.label}>
                      <div className={cn("px-3 pb-1", item.label === 'SDR' ? 'pt-1' : 'pt-4')}>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">{item.label}</span>
                      </div>
                      <div className="space-y-0.5">
                        {item.children.map((child) =>
                          <Link key={child.label} to={child.to} onClick={onNavigate}>
                            <Button
                              variant="ghost"
                              className={cn(
                                "w-full h-7 rounded-md justify-start gap-2.5 pl-7 pr-3 transition-all",
                                location.pathname === child.to ?
                                "bg-accent text-primary hover:bg-accent font-semibold" :
                                "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                              )}>
                              <span className="opacity-70 flex-shrink-0">{child.icon}</span>
                              <span className="text-[12px] font-medium truncate">{child.label}</span>
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>);
                }
                if (item.children && isCollapsed) {
                  return (
                    <NavLinkItem key={item.label} item={{ ...item, to: item.children[0].to }} collapsed={isCollapsed} isActive={item.children.some((c) => isLinkActive(c.to))} onNavigate={onNavigate} />);
                }
                return (
                  <NavLinkItem key={item.label} item={item} collapsed={isCollapsed} isActive={isLinkActive(item.to)} onNavigate={onNavigate} />);
              })}
            </CollapsibleContent>
          </Collapsible>
        }

        {canAccessProjects &&
          <Collapsible open={isSectionOpen('projects')} onOpenChange={() => toggleSection('projects')}>
            <SectionLabel label="Gestão de Projetos" collapsed={isCollapsed} sectionKey="projects" isOpen={isSectionOpen('projects')} onToggle={toggleSection} />
            <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1 overflow-hidden">
              <NavLinkItem
                item={{ to: "/projects", icon: <FolderKanban className="h-4 w-4" />, label: "Visão Geral" }}
                collapsed={isCollapsed}
                isActive={location.pathname === "/projects"}
                onNavigate={onNavigate} />

              {!isCollapsed && PROJECT_PHASES_ORDER.map((phase) => {
                const count = phaseCounts?.find((p) => p.phase_name === phase)?.count || 0;
                const isComingSoon = COMING_SOON_PHASES.has(phase);
                const phaseActive = location.pathname === `/projects/phase/${phase}`;
                return (
                  <Link key={phase} to={`/projects/phase/${phase}`} onClick={onNavigate}>
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full h-7 rounded-md justify-start gap-2.5 pl-7 pr-3 transition-all",
                        phaseActive ?
                        "bg-accent text-primary hover:bg-accent font-semibold" :
                        "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      )}>
                      <span className="opacity-70 flex-shrink-0">{PHASE_ICONS[phase]}</span>
                      <span className="text-[12px] font-medium truncate flex-1 text-left">
                        {PHASE_LABELS[phase]}
                      </span>
                      {isComingSoon ?
                        <Badge
                          variant="outline"
                          className="text-[8px] px-1 py-0 h-3.5 leading-none font-medium border-warning/20 text-warning bg-warning/10 ml-auto flex-shrink-0">
                          Breve
                        </Badge> :
                        count > 0 ?
                        <span className="text-[10px] font-medium text-muted-foreground ml-auto flex-shrink-0">
                          {count}
                        </span> :
                        null}
                    </Button>
                  </Link>);
              })}
            </CollapsibleContent>
          </Collapsible>
        }

        {(hasPermission('view_integrations') || hasPermission('view_deliveries')) &&
          <Collapsible open={isSectionOpen('support')} onOpenChange={() => toggleSection('support')}>
            <SectionLabel label="Material de Apoio" collapsed={isCollapsed} sectionKey="support" isOpen={isSectionOpen('support')} onToggle={toggleSection} />
            <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1 overflow-hidden">
              {hasPermission('view_integrations') &&
                <NavLinkItem
                  item={{ to: "/integrations", icon: <Plug className="h-4 w-4" />, label: "Catálogo de Integrações" }}
                  collapsed={isCollapsed}
                  isActive={isLinkActive("/integrations")}
                  onNavigate={onNavigate} />
              }
              {hasPermission('view_deliveries') &&
                <NavLinkItem
                  item={{ to: "/deliveries", icon: <PackageCheck className="h-4 w-4" />, label: "Projetos Entregues" }}
                  collapsed={isCollapsed}
                  isActive={isLinkActive("/deliveries")}
                  onNavigate={onNavigate} />
              }
              <NavLinkItem
                item={{ to: "/api-analysis", icon: <FileSearch className="h-4 w-4" />, label: "Análise de API" }}
                collapsed={isCollapsed}
                isActive={isLinkActive("/api-analysis")}
                onNavigate={onNavigate} />
            </CollapsibleContent>
          </Collapsible>
        }

        <div className="flex-1" />

        {canAccessAdmin &&
        <div className="pb-2">
            {!isCollapsed && <div className="pt-2" />}
            <NavLinkItem
            item={{ to: "/settings", icon: <Settings className="h-4 w-4" />, label: "Configurações" }}
            collapsed={isCollapsed}
            isActive={isLinkActive("/settings")}
            onNavigate={onNavigate} />
          </div>
        }
      </nav>

      {/* Bottom: Footer */}
      <div className="border-t border-border/20 flex-shrink-0 p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {isCollapsed ?
            <Button variant="ghost" size="icon" className="w-full h-9 rounded-md hover:bg-muted/40">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={currentUser?.avatarUrl || undefined} alt={currentUser?.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                    {initials || <User className="h-3.5 w-3.5" />}
                  </AvatarFallback>
                </Avatar>
              </Button> :
            <Button
              variant="ghost"
              className="w-full h-10 rounded-md justify-start gap-2.5 px-2 hover:bg-muted/40">
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarImage src={currentUser?.avatarUrl || undefined} alt={currentUser?.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                    {initials || <User className="h-3.5 w-3.5" />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start flex-1 min-w-0">
                  <span className="text-[13px] font-medium truncate w-full text-left text-foreground">
                    {currentUser?.name || "Usuário"}
                  </span>
                  <span className="text-[11px] truncate w-full text-left text-muted-foreground">
                    {currentUser?.email || ""}
                  </span>
                </div>
                <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              </Button>
            }
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? "bottom" : "top"}
            align="start"
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl bg-card dark:bg-popover border border-border/30 shadow-xl shadow-black/10 px-1 py-1"
            sideOffset={6}>
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2.5 px-2.5 py-2">
                <Avatar className="h-7 w-7 rounded-full">
                  <AvatarImage src={currentUser?.avatarUrl || undefined} alt={currentUser?.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                    {initials || <User className="h-3.5 w-3.5" />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0 gap-px">
                  <span className="text-[13px] font-medium leading-tight truncate text-foreground">{currentUser?.name || "Usuário"}</span>
                  <span className="text-[11px] leading-tight text-muted-foreground truncate">{currentUser?.email || ""}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="mx-1 bg-border/30" />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild className="gap-2.5 cursor-pointer rounded-lg text-[13px] font-medium h-8 text-foreground">
                <Link to="/profile">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Minha Conta
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2.5 cursor-pointer rounded-lg text-[13px] font-medium h-8" onSelect={() => setShortcutsOpen(true)}>
                <Keyboard className="h-4 w-4 text-muted-foreground" />
                Atalhos de Teclado
                <kbd className="ml-auto text-[10px] opacity-50 border border-border rounded px-1">?</kbd>
              </DropdownMenuItem>
              <ThemeToggle asSubmenu />
            </DropdownMenuGroup>
            {isRealAdmin && (
              <>
                <DropdownMenuSeparator className="mx-1 bg-border/30" />
                <DropdownMenuItem className="gap-2.5 cursor-pointer rounded-lg text-[13px] font-medium h-8 text-foreground" onSelect={() => setSimDialogOpen(true)}>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  Simular Perfil
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator className="mx-1 bg-border/30" />
            <DropdownMenuItem className="gap-2.5 cursor-pointer rounded-lg text-[13px] font-medium h-8 text-destructive focus:text-destructive focus:bg-destructive/8" onSelect={handleLogout}>
              <LogOut className="h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <RoleSimulationDialog open={simDialogOpen} onOpenChange={setSimDialogOpen} />
    </>
  );
}

export function AppSidebar() {
  const { collapsed, isMobile, mobileOpen, setMobileOpen } = useSidebar();

  const handleNavigate = () => {
    if (isMobile) setMobileOpen(false);
  };

  // Mobile: Sheet overlay
  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] p-0 flex flex-col bg-sidebar" aria-label="Menu de navegação">
          <SidebarContent onNavigate={handleNavigate} />
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Fixed sidebar
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-50 h-[100dvh] flex flex-col bg-sidebar transition-all duration-200 ease-in-out",
        collapsed ? "w-[60px]" : "w-[240px]"
      )}>
      <SidebarContent onNavigate={handleNavigate} />
    </aside>
  );
}
