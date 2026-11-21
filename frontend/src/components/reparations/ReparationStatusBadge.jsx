import React from 'react';
import { Clock, Wrench, CheckCircle2, XCircle, AlertCircle, Sparkles, CheckCheck } from 'lucide-react';

/**
 * Badge de statut pour les réparations GarageFlow.
 * Aligné strictement sur les statuts réels du Backend :
 * EN_ATTENTE, EN_COURS, EN_DIAGNOSTIC, EN_REPARATION, TERMINEE, LIVREE, ANNULEE.
 */
export const ReparationStatusBadge = ({ statut, size = 'normal' }) => {
  const normStatut = (statut || '').toUpperCase();

  const config = {
    EN_ATTENTE: {
      label: 'En attente',
      icon: Clock,
      classes: 'bg-slate-100 text-slate-700 border-slate-200',
    },
    EN_COURS: {
      label: 'En cours',
      icon: Wrench,
      classes: 'bg-sky-50 text-sky-700 border-sky-200',
    },
    EN_DIAGNOSTIC: {
      label: 'Diagnostic',
      icon: AlertCircle,
      classes: 'bg-purple-50 text-purple-700 border-purple-200',
    },
    EN_REPARATION: {
      label: 'En réparation',
      icon: Wrench,
      classes: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    TERMINEE: {
      label: 'Terminée',
      icon: CheckCircle2,
      classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    LIVREE: {
      label: 'Livrée',
      icon: CheckCheck,
      classes: 'bg-teal-50 text-teal-700 border-teal-200',
    },
    ANNULEE: {
      label: 'Annulée',
      icon: XCircle,
      classes: 'bg-rose-50 text-rose-700 border-rose-200',
    },
  };

  const current = config[normStatut] || {
    label: statut || 'Non défini',
    icon: Sparkles,
    classes: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const Icon = current.icon;
  const isSmall = size === 'small';

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border shadow-2xs whitespace-nowrap ${
        isSmall ? 'px-2 py-0.5 text-[10px] space-x-1' : 'px-2.5 py-1 text-xs space-x-1.5'
      } ${current.classes}`}
    >
      <Icon className={isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{current.label}</span>
    </span>
  );
};

export default ReparationStatusBadge;
