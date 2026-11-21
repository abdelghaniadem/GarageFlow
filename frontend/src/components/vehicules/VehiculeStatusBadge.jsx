import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Sparkles, HelpCircle } from 'lucide-react';

/**
 * Badge visuel pour l'état d'un véhicule.
 * Gère les états courants ("Excellent", "Bon", "Passable", "À réparer", "En panne", etc.)
 * avec repli propre pour toute valeur personnalisée.
 */
export const VehiculeStatusBadge = ({ etat, size = 'normal' }) => {
  if (!etat) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
        Non renseigné
      </span>
    );
  }

  const norm = etat.trim().toLowerCase();

  let config = {
    label: etat,
    icon: HelpCircle,
    classes: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  if (norm.includes('neuf') || norm.includes('excellent')) {
    config = {
      label: etat,
      icon: Sparkles,
      classes: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    };
  } else if (norm.includes('bon')) {
    config = {
      label: etat,
      icon: CheckCircle2,
      classes: 'bg-teal-50 text-teal-800 border-teal-200',
    };
  } else if (norm.includes('passable') || norm.includes('moyen') || norm.includes('usure')) {
    config = {
      label: etat,
      icon: AlertTriangle,
      classes: 'bg-amber-50 text-amber-800 border-amber-200',
    };
  } else if (
    norm.includes('panne') ||
    norm.includes('réparer') ||
    norm.includes('accident') ||
    norm.includes('hors service')
  ) {
    config = {
      label: etat,
      icon: AlertCircle,
      classes: 'bg-rose-50 text-rose-800 border-rose-200',
    };
  }

  const Icon = config.icon;
  const isSmall = size === 'small';

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border shadow-2xs whitespace-nowrap ${
        isSmall ? 'px-2 py-0.5 text-[10px] space-x-1' : 'px-2.5 py-1 text-xs space-x-1.5'
      } ${config.classes}`}
    >
      <Icon className={isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{config.label}</span>
    </span>
  );
};

export default VehiculeStatusBadge;
