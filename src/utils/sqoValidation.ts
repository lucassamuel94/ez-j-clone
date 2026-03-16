import { Lead } from '@/types/lead';

interface SQOCriterion {
  label: string;
  met: boolean;
}

interface SQOValidationResult {
  approved: boolean;
  criteria: SQOCriterion[];
  missingLabels: string[];
}

export function validateSQOCriteria(lead: Partial<Lead>): SQOValidationResult {
  const criteria: SQOCriterion[] = [
    {
      label: 'Dor (categoria preenchida, clara e com impacto financeiro)',
      met: !!(lead.sqo_pain_category && lead.sqo_pain_clear && lead.sqo_pain_financial_impact !== false),
    },
    {
      label: 'Urgência (imediato ou curto prazo)',
      met: !!(lead.sqo_urgency && lead.sqo_urgency !== '' && lead.sqo_urgency !== 'longo_prazo'),
    },
    {
      label: 'Orçamento (aprovado ou com ajuste)',
      met: !!(lead.sqo_budget && lead.sqo_budget !== '' && !['nao_caro', 'nao_falou'].includes(lead.sqo_budget)),
    },
    {
      label: 'Decisor (próprio ou sócio mapeado)',
      met: !!(lead.sqo_decision_maker && lead.sqo_decision_maker !== '' && lead.sqo_decision_maker !== 'outro_nao_mapeado'),
    },
    {
      label: 'ICP Fit (sim ou parcial)',
      met: !!(lead.sqo_icp_fit && lead.sqo_icp_fit !== '' && lead.sqo_icp_fit !== 'nao'),
    },
  ];

  const missingLabels = criteria.filter(c => !c.met).map(c => c.label);
  return {
    approved: missingLabels.length === 0,
    criteria,
    missingLabels,
  };
}

/**
 * Shows a toast with missing SQO criteria. Returns true if validation passed.
 */
export async function requireSQOApproval(lead: Partial<Lead>): Promise<boolean> {
  const { approved, missingLabels } = validateSQOCriteria(lead);
  if (!approved) {
    const { toast } = await import('sonner');
    toast.error(`SQO: ${missingLabels.length} critério(s) não atendido(s)`, {
      description: missingLabels.join(' • '),
      duration: 6000,
    });
    return false;
  }
  return true;
}
