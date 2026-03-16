import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class RouteErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">
                Algo deu errado
              </h2>
              <p className="text-sm text-muted-foreground">
                Ocorreu um erro inesperado. Tente novamente ou recarregue a página.
              </p>
              {this.state.error && (
                <details className="mt-3 text-left">
                  <summary className="text-xs text-muted-foreground/60 cursor-pointer hover:text-muted-foreground">
                    Detalhes técnicos
                  </summary>
                  <pre className="mt-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground overflow-auto max-h-32 border border-border">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
            </div>
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" onClick={this.handleReset}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
              <Button size="sm" onClick={this.handleReload}>
                Recarregar página
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
