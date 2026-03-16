import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Copy, Mail, Eye, ArrowLeft, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ProposalEmailDialog } from '@/components/ProposalEmailDialog';

const ProposalSuccessPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/proposal-preview/${id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-primary" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Proposta Gerada com Sucesso!</h1>
          <p className="text-muted-foreground">
            Sua proposta comercial foi gerada e está pronta para alguma ação abaixo:
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={handleCopyLink}>
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? 'Copiado!' : 'Copiar link'}
          </Button>
          <Button variant="outline" onClick={() => navigate(`/proposal-preview/${id}`)}>
            <Eye className="h-4 w-4 mr-2" />
            Visualizar proposta
          </Button>
          <Button 
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => setEmailDialogOpen(true)}
          >
            <Mail className="h-4 w-4 mr-2" />
            Enviar por e-mail
          </Button>
        </div>

        <div className="pt-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/simulator')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao simulador
          </Button>
        </div>
      </div>

      {id && (
        <ProposalEmailDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          proposalId={id}
        />
      )}
    </div>
  );
};

export default ProposalSuccessPage;
