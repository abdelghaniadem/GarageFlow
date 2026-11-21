import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, ArrowRight, Car, User, Wrench } from 'lucide-react';

/**
 * Tableau interactif des réparations récentes d'atelier.
 */
export const RecentRepairsWidget = ({ reparations = [] }) => {
  const navigate = useNavigate();

  // Badges visuels de statut
  const getStatusBadge = (statut) => {
    switch (statut) {
      case 'EN_COURS':
      case 'EN_REPARATION':
      case 'EN_DIAGNOSTIC':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800 border border-sky-200">
            En cours
          </span>
        );
      case 'TERMINEE':
      case 'LIVREE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            Terminée
          </span>
        );
      case 'EN_ATTENTE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            En attente
          </span>
        );
      case 'ANNULEE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            Annulée
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
            {statut}
          </span>
        );
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between overflow-hidden">
      {/* En-tête */}
      <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-sky-50 text-sky-600">
            <ClipboardList className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Réparations Récentes
            </h2>
            <p className="text-xs text-slate-500">Dernières interventions d'atelier</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/reparations')}
          className="inline-flex items-center text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
        >
          <span>Voir tout</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </button>
      </div>

      {/* Tableau / Liste */}
      <div className="overflow-x-auto">
        {reparations.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            <p>Aucune réparation enregistrée pour l'instant.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
                <th className="py-3 px-4">Véhicule</th>
                <th className="py-3 px-4">Client</th>
                <th className="py-3 px-4">Intervention</th>
                <th className="py-3 px-4">Mécanicien</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {reparations.map((rep) => (
                <tr
                  key={rep.id_reparation}
                  onClick={() => navigate('/reparations')}
                  className="hover:bg-slate-50/90 cursor-pointer transition-colors"
                >
                  {/* Véhicule */}
                  <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <Car className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div>
                        <p className="font-bold text-slate-800">
                          {rep.vehicule ? `${rep.vehicule.marque} ${rep.vehicule.modele}` : 'Véhicule n/d'}
                        </p>
                        <p className="text-[11px] font-mono text-slate-400 font-normal">
                          {rep.vehicule?.immatriculation || '—'}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Client */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {rep.client ? (
                      <div className="flex items-center space-x-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span>{rep.client.prenom} {rep.client.nom}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* Description */}
                  <td className="py-3.5 px-4 max-w-xs truncate" title={rep.description}>
                    <span className="text-slate-800 font-medium">{rep.description}</span>
                  </td>

                  {/* Mécanicien */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {rep.mecanicien ? (
                      <span className="text-slate-600 font-medium">
                        {rep.mecanicien.prenom} {rep.mecanicien.nom}
                      </span>
                    ) : (
                      <span className="text-slate-400">Non assigné</span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                    {formatDate(rep.date_reparation)}
                  </td>

                  {/* Statut */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {getStatusBadge(rep.statut)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default RecentRepairsWidget;
