import { useState, useCallback } from 'react';
import { Lead } from '@/types/lead';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AIAlert {
  type: 'warning' | 'suggestion';
  message: string;
}

export const useQualificationValidation = () => {
  const [alerts, setAlerts] = useState<AIAlert[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  const initAlerts = useCallback((lead: Lead) => {
    if (lead.ai_validation_alerts && Array.isArray(lead.ai_validation_alerts)) {
      setAlerts(lead.ai_validation_alerts as AIAlert[]);
    }
  }, []);

  const validate = useCallback(async (lead: Lead, onUpdateLead?: (lead: Lead) => void) => {
    setIsValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-qualification', {
        body: { lead },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const resultAlerts = data?.alerts || [];
      setAlerts(resultAlerts);

      // Persist alerts to the lead
      if (onUpdateLead) {
        onUpdateLead({ ...lead, ai_validation_alerts: resultAlerts } as Lead);
      }

      if (resultAlerts.length === 0) {
        toast.success('Nenhuma incoerência encontrada! Qualificação parece consistente.');
      } else {
        toast.info(`${resultAlerts.length} alerta(s) encontrado(s). Veja abaixo do botão.`);
      }
    } catch (e) {
      console.error('AI validation error:', e);
      toast.error('Erro ao validar qualificação com IA');
    } finally {
      setIsValidating(false);
    }
  }, []);

  const clearAlerts = useCallback(() => setAlerts([]), []);

  return { alerts, isValidating, validate, clearAlerts, initAlerts };
};
