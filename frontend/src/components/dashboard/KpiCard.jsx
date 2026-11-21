import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

/**
 * Carte KPI interactive pour le tableau de bord.
 * Affiche l'icône thématique, le libellé, la valeur calculée par l'API,
 * et permet la navigation vers le module correspondant au clic.
 */
export const KpiCard = ({
  title,
  value,
  icon: Icon,
  to,
  colorScheme = 'blue',
  subtitle,
  badgeText,
  badgeVariant = 'neutral',
}) => {
  const navigate = useNavigate();

  // Palette visuelle personnalisée par schéma de couleur
  const colorStyles = {
    blue: {
      bgIcon: 'bg-sky-50 text-sky-600 border-sky-100',
      hoverBorder: 'hover:border-sky-400 hover:shadow-sky-500/10',
      indicator: 'bg-sky-500',
    },
    emerald: {
      bgIcon: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      hoverBorder: 'hover:border-emerald-400 hover:shadow-emerald-500/10',
      indicator: 'bg-emerald-500',
    },
    amber: {
      bgIcon: 'bg-amber-50 text-amber-600 border-amber-100',
      hoverBorder: 'hover:border-amber-400 hover:shadow-amber-500/10',
      indicator: 'bg-amber-500',
    },
    purple: {
      bgIcon: 'bg-purple-50 text-purple-600 border-purple-100',
      hoverBorder: 'hover:border-purple-400 hover:shadow-purple-500/10',
      indicator: 'bg-purple-500',
    },
    rose: {
      bgIcon: 'bg-rose-50 text-rose-600 border-rose-100',
      hoverBorder: 'hover:border-rose-400 hover:shadow-rose-500/10',
      indicator: 'bg-rose-500',
    },
    teal: {
      bgIcon: 'bg-teal-50 text-teal-600 border-teal-100',
      hoverBorder: 'hover:border-teal-400 hover:shadow-teal-500/10',
      indicator: 'bg-teal-500',
    },
  };

  const style = colorStyles[colorScheme] || colorStyles.blue;

  const handleClick = () => {
    if (to) {
      navigate(to);
    }
  };

  return (
    <div
      onClick={handleClick}
      role={to ? 'button' : undefined}
      tabIndex={to ? 0 : undefined}
      onKeyDown={(e) => {
        if (to && (e.key === 'Enter' || e.key === ' ')) {
          handleClick();
        }
      }}
      className={`bg-white rounded-xl p-5 border border-slate-200/90 shadow-xs transition-all duration-200 group relative flex flex-col justify-between ${
        to ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : ''
      } ${style.hoverBorder}`}
    >
      {/* Haut de la carte : Icône et badge */}
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-xl border ${style.bgIcon} transition-transform group-hover:scale-105 duration-200`}>
          {Icon && <Icon className="w-5 h-5" />}
        </div>

        {to && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-slate-400 group-hover:text-slate-600">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        )}

        {badgeText && !to && (
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {badgeText}
          </span>
        )}
      </div>

      {/* Contenu principal : Valeur et Libellé */}
      <div>
        <div className="flex items-baseline space-x-1.5">
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {value !== undefined && value !== null ? value : '—'}
          </span>
        </div>

        <p className="text-xs font-semibold text-slate-600 mt-1 uppercase tracking-wider">
          {title}
        </p>

        {subtitle && (
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};

export default KpiCard;
