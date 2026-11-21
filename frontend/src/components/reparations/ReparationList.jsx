import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Car,
  User,
  Wrench,
  Calendar,
  DollarSign,
  ChevronRight,
  Eye,
  Trash2,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import ReparationStatusBadge from './ReparationStatusBadge';
import { ROLES } from '../../utils/constants';

/**
 * Composant de liste interactive des réparations avec recherche, filtres et pagination.
 */
export const ReparationList = ({
  reparations = [],
  vehiculesMap = {},
  clientsMap = {},
  mecaniciensMap = {},
  onSelectReparation,
  onDeleteReparation,
  userRole,
}) => {
  const isResponsable = userRole === ROLES.RESPONSABLE;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatut, setSelectedStatut] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Filtrage combiné (Recherche textuelle + Statut)
  const filteredReparations = useMemo(() => {
    return reparations.filter((rep) => {
      // 1. Filtre par statut
      if (selectedStatut !== 'ALL' && rep.statut !== selectedStatut) {
        return false;
      }

      // 2. Recherche textuelle
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();

      const descMatch = (rep.description || '').toLowerCase().includes(term);
      const idMatch = String(rep.id_reparation).includes(term);

      // Correspondance véhicule
      const veh = vehiculesMap[rep.id_vehicule];
      const immatMatch = (veh?.immatriculation || '').toLowerCase().includes(term);
      const marqueMatch = (veh?.marque || '').toLowerCase().includes(term);
      const modeleMatch = (veh?.modele || '').toLowerCase().includes(term);

      // Correspondance mécanicien
      const meca = mecaniciensMap[rep.id_mecanicien];
      const mecaNom = (meca?.utilisateur?.nom || '').toLowerCase();
      const mecaPrenom = (meca?.utilisateur?.prenom || '').toLowerCase();
      const mecaMatch = mecaNom.includes(term) || mecaPrenom.includes(term);

      // Correspondance client
      const client = veh?.id_client ? clientsMap[veh.id_client] : null;
      const clientNom = (client?.nom || '').toLowerCase();
      const clientPrenom = (client?.prenom || '').toLowerCase();
      const clientMatch = clientNom.includes(term) || clientPrenom.includes(term);

      return descMatch || idMatch || immatMatch || marqueMatch || modeleMatch || mecaMatch || clientMatch;
    });
  }, [reparations, selectedStatut, searchTerm, vehiculesMap, mecaniciensMap, clientsMap]);

  // Pagination client
  const totalPages = Math.ceil(filteredReparations.length / itemsPerPage) || 1;
  const paginatedReparations = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredReparations.slice(start, start + itemsPerPage);
  }, [filteredReparations, currentPage, itemsPerPage]);

  // Statistiques rapides
  const statsCounts = useMemo(() => {
    return {
      total: reparations.length,
      enAttente: reparations.filter((r) => r.statut === 'EN_ATTENTE').length,
      enCours: reparations.filter((r) => ['EN_COURS', 'EN_REPARATION', 'EN_DIAGNOSTIC'].includes(r.statut)).length,
      terminees: reparations.filter((r) => ['TERMINEE', 'LIVREE'].includes(r.statut)).length,
    };
  }, [reparations]);

  const handleStatusFilterChange = (statut) => {
    setSelectedStatut(statut);
    setCurrentPage(1);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Badges de synthèse en haut de tableau */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => handleStatusFilterChange('ALL')}
          className={`p-3 rounded-xl border text-left transition-all ${
            selectedStatut === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50'
          }`}
        >
          <span className="block text-[11px] font-semibold uppercase tracking-wider opacity-80">
            Total Dossiers
          </span>
          <span className="text-xl font-extrabold">{statsCounts.total}</span>
        </button>

        <button
          type="button"
          onClick={() => handleStatusFilterChange('EN_ATTENTE')}
          className={`p-3 rounded-xl border text-left transition-all ${
            selectedStatut === 'EN_ATTENTE'
              ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50'
          }`}
        >
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            En attente
          </span>
          <span className="text-xl font-extrabold text-slate-800">{statsCounts.enAttente}</span>
        </button>

        <button
          type="button"
          onClick={() => handleStatusFilterChange('EN_COURS')}
          className={`p-3 rounded-xl border text-left transition-all ${
            selectedStatut === 'EN_COURS'
              ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50'
          }`}
        >
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-sky-600">
            En cours
          </span>
          <span className="text-xl font-extrabold text-sky-700">{statsCounts.enCours}</span>
        </button>

        <button
          type="button"
          onClick={() => handleStatusFilterChange('TERMINEE')}
          className={`p-3 rounded-xl border text-left transition-all ${
            selectedStatut === 'TERMINEE'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50'
          }`}
        >
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
            Terminées
          </span>
          <span className="text-xl font-extrabold text-emerald-700">{statsCounts.terminees}</span>
        </button>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Rechercher par véhicule, immatriculation, client, mécanicien..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors"
          />
        </div>

        {/* Sélecteur de statut */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedStatut}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="EN_ATTENTE">En attente</option>
            <option value="EN_COURS">En cours</option>
            <option value="EN_DIAGNOSTIC">Diagnostic</option>
            <option value="EN_REPARATION">En réparation</option>
            <option value="TERMINEE">Terminée</option>
            <option value="LIVREE">Livrée</option>
            <option value="ANNULEE">Annulée</option>
          </select>
        </div>
      </div>

      {/* Tableau Desktop / Cartes Mobile */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        {filteredReparations.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <Wrench className="w-8 h-8 text-slate-300 mx-auto mb-2 stroke-1" />
            <p className="font-semibold text-slate-700 text-sm">Aucune réparation trouvée</p>
            <p className="mt-1">
              {searchTerm || selectedStatut !== 'ALL'
                ? 'Essayez de modifier vos critères de recherche ou de filtre.'
                : 'Aucune fiche de réparation enregistrée pour le moment.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/90 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Réf</th>
                  <th className="py-3 px-4">Véhicule</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Mécanicien</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4 text-right">Main d'œuvre</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedReparations.map((rep) => {
                  const veh = vehiculesMap[rep.id_vehicule];
                  const client = veh?.id_client ? clientsMap[veh.id_client] : null;
                  const meca = mecaniciensMap[rep.id_mecanicien];

                  return (
                    <tr
                      key={rep.id_reparation}
                      onClick={() => onSelectReparation(rep.id_reparation)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                    >
                      {/* Réf */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        REP-#{rep.id_reparation}
                      </td>

                      {/* Véhicule */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Car className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <div>
                            <p className="font-bold text-slate-900">
                              {veh ? `${veh.marque} ${veh.modele}` : `Véhicule #${rep.id_vehicule}`}
                            </p>
                            <p className="text-[11px] font-mono text-brand-600 font-semibold">
                              {veh?.immatriculation || '—'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Client */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {client ? (
                          <div className="flex items-center space-x-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="font-medium text-slate-800">
                              {client.prenom} {client.nom}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Mécanicien */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {meca ? (
                          <div>
                            <span className="font-semibold text-slate-800">
                              {meca.utilisateur
                                ? `${meca.utilisateur.prenom} ${meca.utilisateur.nom}`
                                : `Méc. #${meca.id_mecanicien}`}
                            </span>
                            <span className="block text-[10px] text-slate-400">
                              {meca.specialite}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">Non assigné</span>
                        )}
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4 max-w-xs truncate" title={rep.description}>
                        <span className="font-medium text-slate-900">{rep.description}</span>
                        {rep.travail_effectue && (
                          <span className="block text-[11px] text-slate-400 truncate">
                            {rep.travail_effectue}
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-500 text-[11px]">
                        {rep.date_reparation || '—'}
                      </td>

                      {/* Statut */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <ReparationStatusBadge statut={rep.statut} size="small" />
                      </td>

                      {/* Coût */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {rep.cout !== null && rep.cout !== undefined
                          ? `${Number(rep.cout).toFixed(2)} TND`
                          : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            type="button"
                            onClick={() => onSelectReparation(rep.id_reparation)}
                            title="Ouvrir la fiche"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isResponsable && (
                            <button
                              type="button"
                              onClick={() => onDeleteReparation(rep.id_reparation)}
                              title="Supprimer la réparation"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Barre de pagination */}
        {filteredReparations.length > itemsPerPage && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div>
              Affichage de {(currentPage - 1) * itemsPerPage + 1} à{' '}
              {Math.min(currentPage * itemsPerPage, filteredReparations.length)} sur{' '}
              {filteredReparations.length} réparations
            </div>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                Précédent
              </button>
              <span className="px-2 font-bold text-slate-800">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReparationList;
