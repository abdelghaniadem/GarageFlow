import React from 'react';
import { Construction, CheckCircle2, ShieldCheck } from 'lucide-react';
import { ROLE_LABELS } from '../../utils/constants';

/**
 * Composant Placeholder propre et professionnel pour les modules futurs (Phase 2).
 */
export const ModulePlaceholder = ({
  title,
  subtitle,
  icon: Icon,
  allowedRoles = [],
  apiEndpoint,
  features = [],
}) => {
  return (
    <div className="space-y-6">
      {/* En-tête du module */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-brand-50 text-brand-600 rounded-xl border border-brand-100 shadow-sm">
            {Icon && <Icon className="w-8 h-8" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                Phase 2
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
          </div>
        </div>

        {/* Badges d'accès */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-medium text-slate-500 flex items-center">
            <ShieldCheck className="w-4 h-4 mr-1 text-slate-400" />
            Accès autorisé :
          </span>
          {allowedRoles.map((role) => (
            <span
              key={role}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 text-slate-700 border border-slate-200"
            >
              {ROLE_LABELS[role] || role}
            </span>
          ))}
        </div>
      </div>

      {/* Carte d'information du module en attente */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-8 text-center max-w-2xl mx-auto my-12">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400 border border-slate-200">
          <Construction className="w-8 h-8 text-brand-600 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Module en attente de la Phase 2</h2>
        <p className="text-slate-600 text-sm max-w-md mx-auto mb-6">
          La fondation technique et l'authentification (Phase 1) sont opérationnelles.
          Ce module sera connecté à l'API backend validée au cours de la phase suivante.
        </p>

        {apiEndpoint && (
          <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600 mb-6">
            Endpoint API : <span className="font-semibold text-brand-600 ml-1.5">{apiEndpoint}</span>
          </div>
        )}

        {features.length > 0 && (
          <div className="text-left bg-slate-50 rounded-lg p-5 border border-slate-200">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Fonctionnalités prévues au contrat d'API :
            </h3>
            <ul className="space-y-2">
              {features.map((feature, idx) => (
                <li key={idx} className="flex items-start text-xs text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-2 flex-shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModulePlaceholder;
