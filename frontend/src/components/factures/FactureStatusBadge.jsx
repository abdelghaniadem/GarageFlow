import React from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PieChart,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import {
  FACTURE_STATUSES,
  FACTURE_STATUS_LABELS,
  FACTURE_STATUS_BADGE_CLASSES,
} from '../../utils/constants';

/**
 * Badge visuel pour le statut de paiement d'une facture.
 * Gère EN_ATTENTE, PAYEE, ANNULEE, IMPAYEE, PARTIELLE, PARTIELLEMENT_PAYEE, NON_PAYEE.
 */
export const FactureStatusBadge = ({ statut, size = 'normal' }) => {
  const norm = (statut || '').toUpperCase();

  const iconMap = {
    [FACTURE_STATUSES.EN_ATTENTE]: Clock,
    [FACTURE_STATUSES.PAYEE]: CheckCircle2,
    [FACTURE_STATUSES.ANNULEE]: XCircle,
    [FACTURE_STATUSES.IMPAYEE]: AlertTriangle,
    [FACTURE_STATUSES.PARTIELLE]: PieChart,
    [FACTURE_STATUSES.PARTIELLEMENT_PAYEE]: PieChart,
    [FACTURE_STATUSES.NON_PAYEE]: AlertCircle,
  };

  const Icon = iconMap[norm] || Sparkles;
  const label = FACTURE_STATUS_LABELS[norm] || statut || 'Inconnu';
  const badgeClasses =
    FACTURE_STATUS_BADGE_CLASSES[norm] ||
    'bg-slate-100 text-slate-800 border-slate-300 font-semibold';

  const isSmall = size === 'small';

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border shadow-2xs whitespace-nowrap ${
        isSmall ? 'px-2 py-0.5 text-[10px] space-x-1' : 'px-2.5 py-1 text-xs space-x-1.5'
      } ${badgeClasses}`}
    >
      <Icon className={isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{label}</span>
    </span>
  );
};

export default FactureStatusBadge;
