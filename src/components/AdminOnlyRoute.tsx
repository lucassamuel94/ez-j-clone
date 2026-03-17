import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface AdminOnlyRouteProps {
  children: React.ReactNode;
}

export const AdminOnlyRoute = ({ children }: AdminOnlyRouteProps) => {
  const location = useLocation();
  const { isAdmin, isLoading } = useUserRole();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to={`/access-denied?from=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return <ProtectedRoute>{children}</ProtectedRoute>;
};
