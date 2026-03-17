import { Star, AlertTriangle, Zap } from 'lucide-react';
import { KeyMoment } from './types';

interface Props {
  moment: KeyMoment;
}

const CONFIG = {
  positive: { icon: Star, color: 'text-emerald-500', fill: 'fill-emerald-500', title: 'Momento positivo' },
  negative: { icon: AlertTriangle, color: 'text-red-500', fill: '', title: 'Momento negativo' },
  turning_point: { icon: Zap, color: 'text-amber-500', fill: 'fill-amber-500', title: 'Ponto de virada' },
};

export function KeyMomentBadge({ moment }: Props) {
  const cfg = CONFIG[moment.type] || CONFIG.positive;
  const Icon = cfg.icon;

  return (
    <span
      className={`inline-flex items-center ${cfg.color}`}
      title={`${cfg.title}: ${moment.title}`}
    >
      <Icon className={`h-3 w-3 ${cfg.fill}`} />
    </span>
  );
}
