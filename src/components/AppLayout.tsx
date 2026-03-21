import React from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { useSidebar } from '@/contexts/SidebarContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Menu, Bell } from 'lucide-react';
import { NotificationCenter } from '@/components/NotificationCenter';
import { UserAvatar } from '@/components/UserAvatar';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { RoleSimulationBanner } from '@/components/admin/RoleSimulationBanner';
import { useRoleSimulation } from '@/stores/useRoleSimulation';
import { GlobalCommandPalette } from '@/components/GlobalCommandPalette';
import { SmartSearchDialog } from '@/components/SmartSearchDialog';
import { useState, useEffect } from 'react';
import ezsoftLogo from '@/assets/ez-journey-logo-color.svg';
import ezsoftLogoWhite from '@/assets/ez-journey-logo-white.svg';
import { Link } from 'react-router-dom';

export const AppLayout = React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(function AppLayout({ children }, ref) {
  const { collapsed, isMobile, setMobileOpen } = useSidebar();
  const { user: currentUser } = useCurrentUser();
  const { isSimulating } = useRoleSimulation();
  const [smartSearchOpen, setSmartSearchOpen] = useState(false);

  // Ctrl+Shift+K to open Smart Search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'k') {
        e.preventDefault();
        setSmartSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="min-h-[100dvh] bg-sidebar">
      <RoleSimulationBanner />
      <GlobalCommandPalette />
      <SmartSearchDialog open={smartSearchOpen} onOpenChange={setSmartSearchOpen} />
      <div className={cn(isSimulating && 'pt-8')}>
      <AppSidebar />

      {/* Mobile top bar */}
      {isMobile && (
        <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-3 bg-card/80 backdrop-blur-md border-b border-border/40">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link to="/" className="flex items-center">
            <img src={ezsoftLogo} alt="EZ Journey" className="h-6 w-auto dark:hidden" />
            <img src={ezsoftLogoWhite} alt="EZ Journey" className="h-6 w-auto hidden dark:block" />
          </Link>
          <div className="flex items-center gap-1">
            <NotificationCenter />
            {currentUser && (
              <UserAvatar avatarUrl={currentUser.avatarUrl} userName={currentUser.name} />
            )}
          </div>
        </header>
      )}

      <div
        className={cn(
          'transition-all duration-200 ease-in-out min-h-[100dvh]',
          isMobile
            ? 'ml-0 p-0'
            : cn('p-2', collapsed ? 'ml-[60px]' : 'ml-[240px]')
        )}
      >
        <div
          className={cn(
            'bg-background overflow-auto',
            isMobile
              ? 'min-h-[calc(100dvh-56px)]'
              : 'rounded-xl h-[calc(100dvh-16px)] border border-border/40 shadow-sm'
          )}
        >
          {children}
        </div>
      </div>
      </div>
    </div>
  );
});
