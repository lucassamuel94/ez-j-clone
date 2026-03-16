import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import CheckoutRegistration from '@/components/checkout/CheckoutRegistration';
import CheckoutSuccess from '@/components/checkout/CheckoutSuccess';
import ezLogo from '@/assets/ezsoft-logo-white.png';

const CheckoutPage = () => {
  const [searchParams] = useSearchParams();
  const proposalId = searchParams.get('id');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!proposalId) { setError(true); setLoading(false); return; }
    const fetch = async () => {
      const { data, error: err } = await supabase
        .from('proposals')
        .select('company_name, status')
        .eq('id', proposalId)
        .single();
      if (err || !data) { setError(true); setLoading(false); return; }
      setCompanyName(data.company_name);
      if (data.status === 'accepted') setCompleted(true);
      setLoading(false);
    };
    fetch();
  }, [proposalId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !proposalId) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <p className="text-muted-foreground">Proposta não encontrada</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-4">
          <img src={ezLogo} alt="EZ Soft" className="h-7 brightness-0 dark:brightness-0 dark:invert" />
          <span className="text-sm font-medium text-muted-foreground">Checkout — {companyName}</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {completed ? (
          <CheckoutSuccess companyName={companyName} />
        ) : (
          <CheckoutRegistration
            proposalId={proposalId}
            companyName={companyName}
            onComplete={() => setCompleted(true)}
          />
        )}
      </div>

      {/* Footer */}
      <div className="max-w-3xl mx-auto px-4 pb-8">
        <div className="text-center">
          <p className="text-muted-foreground text-xs">EZ Softwares · Avenida Cesário Alvim, 3813 · Uberlândia/MG</p>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
