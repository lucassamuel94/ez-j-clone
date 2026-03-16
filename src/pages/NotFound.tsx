import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-foreground">404</h1>
        <p className="text-xl text-muted-foreground">Página não encontrada</p>
        <p className="text-sm text-muted-foreground max-w-md">
          A página que você está procurando não existe ou foi movida.
        </p>
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

export default NotFound;
