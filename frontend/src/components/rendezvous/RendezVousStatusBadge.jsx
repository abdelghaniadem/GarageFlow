import React from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Wrench,
  CheckCheck,
  XCircle,
  Award,
  AlertTriangle,
  UserX,
  Sparkles,
} from 'lucide-react';
import {
  RENDEZ_VOUS_STATUSES,
  RENDEZ_VOUS_STATUS_LABELS,
  RENDEZ_VOUS_STATUS_BADGE_CLASSES,
} from '../../utils/constants';

/**
 * Badge visuel pour le statut d'un rendez-vous d'atelier.
 * Aligné strictement sur les statuts du modèle RendezVous backend :
 * PLANIFIE, CONFIRME, EN_ATTENTE, EN_COURS, TERMINE, ANNULE, HONORE, NON_HONORE, ABSENT.
 */
export const RendezVousStatusBadge = ({ statut, size = 'normal' }) => {
  const norm = (statut || '').toUpperCase();

  const iconMap = {
    [RENDEZ_VOUS_STATUSES.PLANIFIE]: Calendar,
    [RENDEZ_VOUS_STATUSES.CONFIRME]: CheckCircle2,
    [RENDEZ_VOUS_STATUSES.EN_ATTENTE]: Clock,
    [RENDEZ_VOUS_STATUSES.EN_COURS]: Wrench,
    [RENDEZ_VOUS_STATUSES.TERMINE]: CheckCheck,
    [RENDEZ_VOUS_STATUSES.ANNULE]: XCircle,
    [RENDEZ_VOUS_STATUSES.HONORE]: Award,
    [RENDEZ_VOUS_STATUSES.NON_HONORE]: AlertTriangle,
    [RENDEZ_VOUS_STATUSES.ABSENT]: UserX,
  };

  const Icon = iconMap[norm] || Sparkles;
  const label = RENDEZ_VOUS_STATUS_LABELS[norm] || statut || 'Inconnu';
  const badgeClasses =
    RENDEZ_VOUS_STATUS_BADGE_CLASSES[norm] ||
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';

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

export default RendezVousStatusBadge;
