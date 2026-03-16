import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthSession } from '@/contexts/AuthSessionContext';
import { useUserRole, UserRole } from '@/hooks/useUserRole';
import { usePermissions } from '@/hooks/usePermissions';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredPermission?: string;
}

const previewHostname = typeof window !== 'undefined' ? window.location.hostname : '';
const isLovablePreview =
  previewHostname.includes('id-preview--') ||
  previewHostname.endsWith('.lovableproject.com');

export const ProtectedRoute = ({ children, allowedRoles, requiredPermission }: ProtectedRouteProps) => {
  const { status, session, retry } = useAuthSession();
  const hasSession = !!session;
  const isUsable = status === 'authenticated' || (status === 'degraded' && hasSession);
  const { role, isLoading: isLoadingRole } = useUserRole(isUsable);
  const { hasPermission, isLoading: isLoadingPerms } = usePermissions(isUsable);
  const [showRoleTimeout, setShowRoleTimeout] = useState(false);

  // Timeout for role loading
  useEffect(() => {
    if (!allowedRoles || role) {
      setShowRoleTimeout(false);
      return;
    }
    const t = setTimeout(() => setShowRoleTimeout(true), 10000);
    return () => clearTimeout(t);
  }, [allowedRoles, role]);

  // Bypass auth in Lovable preview environment
  if (isLovablePreview) return <>{children}</>;

  // Loading state (only on initial boot, not degraded with session)
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // Degraded WITHOUT session — can't proceed
  if (status === 'degraded' && !hasSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-muted-foreground">Serviço temporariamente instável</p>
          <Button variant="outline" onClick={retry}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  // Unauthenticated
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  // Still loading role/perms
  if (isUsable && (isLoadingRole || isLoadingPerms)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando permissões...</p>
        </div>
      </div>
    );
  }

  // Wait for role to load before checking permissions (with timeout)
  if (allowedRoles && !role) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          {showRoleTimeout ? (
            <>
              <p className="text-muted-foreground">Erro ao carregar permissões.</p>
              <Button variant="outline" onClick={() => window.location.reload()}>Tentar novamente</Button>
            </>
          ) : (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Carregando permissões...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Permission-based check
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/" replace />;
  }

  // Role-based redirect
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    if (role === 'closer') return <Navigate to="/closer" replace />;
    if (role === 'sdr') return <Navigate to="/" replace />;
    if (role === 'head_pos_venda' || role === 'ux_po' || role === 'dev_chatbot' || role === 'treinamento' || role === 'suporte' || role === 'verificacao_bm') {
      return <Navigate to="/projects" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return (
    <>
      {/* Non-blocking degraded warning */}
      {status === 'degraded' && (
        <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 bg-destructive/90 text-destructive-foreground px-4 py-2 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>Conexão instável — alguns dados podem estar desatualizados</span>
          <Button variant="ghost" size="sm" className="text-white hover:text-white/80 h-6 px-2" onClick={retry}>
            Reconectar
          </Button>
        </div>
      )}
      {children}
    </>
  );
};