import React from 'react';
import { Wrench, Cpu, Gauge, Zap, Disc, Sparkles } from 'lucide-react';

/**
 * Badge visuel pour la spécialité d'un mécanicien.
 */
export const MecanicienSpecialiteBadge = ({ specialite, size = 'normal' }) => {
  if (!specialite) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
        Non spécifiée
      </span>
    );
  }

  const norm = specialite.toLowerCase();

  let config = {
    icon: Wrench,
    classes: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  };

  if (norm.includes('moteur')) {
    config = {
      icon: Gauge,
      classes: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  } else if (norm.includes('électr') || norm.includes('diag')) {
    config = {
      icon: Zap,
      classes: 'bg-sky-50 text-sky-700 border-sky-200',
    };
  } else if (norm.includes('frein') || norm.includes('suspension')) {
    config = {
      icon: Disc,
      classes: 'bg-rose-50 text-rose-700 border-rose-200',
    };
  } else if (norm.includes('carrosserie') || norm.includes('peinture')) {
    config = {
      icon: Sparkles,
      classes: 'bg-purple-50 text-purple-700 border-purple-200',
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
      <span>{specialite}</span>
    </span>
  );
};

export default MecanicienSpecialiteBadge;
