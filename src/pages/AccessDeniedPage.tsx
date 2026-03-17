import { useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home, ShieldX } from "lucide-react";

const AccessDeniedPage = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const attemptedRoute = params.get("from");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-md px-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Acesso negado
        </h1>
        <p className="text-muted-foreground">
          Você não tem permissão para acessar esta página. Entre em contato com
          um administrador caso precise de acesso.
        </p>
        {attemptedRoute && (
          <p className="text-xs text-muted-foreground/60 font-mono bg-muted rounded-lg px-3 py-2">
            Rota: {attemptedRoute}
          </p>
        )}
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <Button asChild>
            <Link to="/">
              <Home className="h-4 w-4 mr-2" />
              Início
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AccessDeniedPage;
