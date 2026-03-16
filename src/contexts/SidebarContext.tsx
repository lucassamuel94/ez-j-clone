import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

const SIDEBAR_COLLAPSED_KEY = 'sidebar_collapsed';

interface SidebarContextType {
  collapsed: boolean;
  toggle: () => void;
  isMobile: boolean;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  toggle: () => {},
  isMobile: false,
  mobileOpen: false,
  setMobileOpen: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggle = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  // Close mobile sidebar on route changes (handled by consumers)
  // Keyboard shortcut: Ctrl/Cmd + B (desktop only)
  useEffect(() => {
    if (isMobile) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle, isMobile]);

  const value = useMemo(
    () => ({ collapsed, toggle, isMobile, mobileOpen, setMobileOpen }),
    [collapsed, toggle, isMobile, mobileOpen]
  );

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}
