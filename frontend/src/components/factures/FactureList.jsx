import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Receipt,
  User,
  Car,
  Calendar,
  DollarSign,
  Eye,
  CheckCircle2,
  AlertCircle,
  ArrowUpDown,
  RotateCcw,
  Wrench,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import FactureStatusBadge from './FactureStatusBadge';
import { FACTURE_STATUSES } from '../../utils/constants';

/**
 * Catalogue des factures avec recherche multi-critères, filtres par statut et période,
 * tri par montant ou date, pagination et actions rapides.
 */
export const FactureList = ({
  factures = [],
  reparationsMap = {},
  vehiculesMap = {},
  clientsMap = {},
  onSelectFacture,
  onQuickPay,
  onCreateFacture,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatut, setSelectedStatut] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Filtrage combiné (Recherche + Statut + Plage de dates)
  const filteredFactures = useMemo(() => {
    return factures.filter((f) => {
      // 1. Filtre par statut
      if (selectedStatut !== 'ALL' && (f.statut_paiement || '').toUpperCase() !== selectedStatut) {
        return false;
      }

      // 2. Filtre par date début
      if (startDate && f.date_facture && f.date_facture < startDate) {
        return false;
      }

      // 3. Filtre par date fin
      if (endDate && f.date_facture && f.date_facture > endDate) {
        return false;
      }

      // 4. Recherche textuelle
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();

      const idMatch =
        String(f.id_facture).includes(term) ||
        `fac-${f.id_facture}`.includes(term) ||
        `#fac-${f.id_facture}`.includes(term);

      const reparation = reparationsMap[f.id_reparation];
      const repMatch =
        reparation &&
        ((reparation.description || '').toLowerCase().includes(term) ||
          String(reparation.id_reparation).includes(term));

      const vehicule = reparation ? vehiculesMap[reparation.id_vehicule] : null;
      const vehMatch =
        vehicule &&
        ((vehicule.immatriculation || '').toLowerCase().includes(term) ||
          (vehicule.marque || '').toLowerCase().includes(term) ||
          (vehicule.modele || '').toLowerCase().includes(term));

      const client = vehicule ? clientsMap[vehicule.id_client] : null;
      const clientNom = (client?.nom || '').toLowerCase();
      const clientPrenom = (client?.prenom || '').toLowerCase();
      const clientMatch =
        clientNom.includes(term) ||
        clientPrenom.includes(term) ||
        `${clientPrenom} ${clientNom}`.includes(term) ||
        `${clientNom} ${clientPrenom}`.includes(term);

      return idMatch || repMatch || vehMatch || clientMatch;
    });
  }, [factures, selectedStatut, startDate, endDate, searchTerm, reparationsMap, vehiculesMap, clientsMap]);

  // Tri
  const sortedFactures = useMemo(() => {
    const list = [...filteredFactures];
    switch (sortBy) {
      case 'date_desc':
        return list.sort((a, b) => (b.date_facture || '').localeCompare(a.date_facture || ''));
      case 'date_asc':
        return list.sort((a, b) => (a.date_facture || '').localeCompare(b.date_facture || ''));
      case 'montant_desc':
        return list.sort((a, b) => Number(b.montant_total || 0) - Number(a.montant_total || 0));
      case 'montant_asc':
        return list.sort((a, b) => Number(a.montant_total || 0) - Number(b.montant_total || 0));
      case 'id_desc':
        return list.sort((a, b) => b.id_facture - a.id_facture);
      case 'id_asc':
        return list.sort((a, b) => a.id_facture - b.id_facture);
      default:
        return list;
    }
  }, [filteredFactures, sortBy]);

  // Pagination
  const totalPages = Math.ceil(sortedFactures.length / itemsPerPage) || 1;
  const paginatedFactures = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedFactures.slice(start, start + itemsPerPage);
  }, [sortedFactures, currentPage, itemsPerPage]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedStatut('ALL');
    setStartDate('');
    setEndDate('');
    setSortBy('date_desc');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchTerm !== '' || selectedStatut !== 'ALL' || startDate !== '' || endDate !== '';

  return (
    <div className="space-y-4">
      {/* Barre de contrôle : Recherche, Filtres de statut, Période et Tri */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Recherche textuelle */}
          <div className="md:col-span-5 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Rechercher par N° facture, client, véhicule, réparation..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />
          </div>

          {/* Filtre par statut */}
          <div className="md:col-span-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={selectedStatut}
                onChange={(e) => {
                  setSelectedStatut(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              >
                <option value="ALL" className="bg-white text-slate-900">Tous les statuts de paiement</option>
                <option value={FACTURE_STATUSES.EN_ATTENTE} className="bg-white text-slate-900">En attente</option>
                <option value={FACTURE_STATUSES.PAYEE} className="bg-white text-slate-900">Payée</option>
                <option value={FACTURE_STATUSES.IMPAYEE} className="bg-white text-slate-900">Impayée</option>
                <option value={FACTURE_STATUSES.PARTIELLE} className="bg-white text-slate-900">Partiellement payée</option>
                <option value={FACTURE_STATUSES.ANNULEE} className="bg-white text-slate-900">Annulée</option>
              </select>
            </div>
          </div>

          {/* Tri */}
          <div className="md:col-span-4">
            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              >
                <option value="date_desc" className="bg-white text-slate-900">Date la plus récente</option>
                <option value="date_asc" className="bg-white text-slate-900">Date la plus ancienne</option>
                <option value="montant_desc" className="bg-white text-slate-900">Montant décroissant (TND)</option>
                <option value="montant_asc" className="bg-white text-slate-900">Montant croissant (TND)</option>
                <option value="id_desc" className="bg-white text-slate-900">Numéro le plus élevé</option>
                <option value="id_asc" className="bg-white text-slate-900">Numéro croissant</option>
              </select>
            </div>
          </div>
        </div>

        {/* Ligne secondaire : Filtre par période (dates) & Réinitialisation */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-600 font-medium flex items-center">
              <Calendar className="w-3.5 h-3.5 mr-1 text-slate-500" />
              Période :
            </span>
            <div className="flex items-center space-x-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                title="Date de début"
                className="px-2.5 py-1 bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <span className="text-slate-400">à</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                title="Date de fin"
                className="px-2.5 py-1 bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center px-2 py-1 text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded transition-colors"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Réinitialiser
              </button>
            )}
          </div>

          <div className="text-slate-600">
            <span className="font-semibold text-slate-900">{filteredFactures.length}</span> facture(s) trouvée(s)
          </div>
        </div>
      </div>

      {/* Tableau / Cartes des factures */}
      {paginatedFactures.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
            <Receipt className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">
            {hasActiveFilters ? 'Aucune facture ne correspond aux critères' : 'Aucune facture enregistrée'}
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            {hasActiveFilters
              ? 'Essayez de modifier votre recherche ou de réinitialiser les filtres appliqués.'
              : 'Émettez une première facture à partir d\'une réparation effectuée dans l\'atelier.'}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-4 inline-flex items-center px-3.5 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-medium transition-colors"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Effacer les filtres
            </button>
          ) : (
            onCreateFacture && (
              <button
                type="button"
                onClick={onCreateFacture}
                className="mt-4 inline-flex items-center px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium shadow-sm transition-colors"
              >
                <Receipt className="w-4 h-4 mr-1.5" />
                Émettre une facture
              </button>
            )
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">N° Facture</th>
                  <th className="py-3 px-4">Date d'émission</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Véhicule</th>
                  <th className="py-3 px-4">Réparation</th>
                  <th className="py-3 px-4 text-right">Montant Total</th>
                  <th className="py-3 px-4 text-center">Statut</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {paginatedFactures.map((facture) => {
                  const reparation = reparationsMap[facture.id_reparation];
                  const vehicule = reparation ? vehiculesMap[reparation.id_vehicule] : null;
                  const client = vehicule ? clientsMap[vehicule.id_client] : null;
                  const formattedId = `#FAC-${String(facture.id_facture).padStart(4, '0')}`;
                  const isEnAttente = (facture.statut_paiement || '').toUpperCase() === FACTURE_STATUSES.EN_ATTENTE;

                  return (
                    <tr
                      key={facture.id_facture}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      {/* Numéro facture */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Receipt className="w-4 h-4 text-brand-600 flex-shrink-0" />
                          <span>{formattedId}</span>
                        </div>
                      </td>

                      {/* Date de facture */}
                      <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5 text-xs">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{facture.date_facture || '—'}</span>
                        </div>
                      </td>

                      {/* Client */}
                      <td className="py-3.5 px-4">
                        {client ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 text-xs font-semibold uppercase flex-shrink-0">
                              {(client.prenom?.[0] || '') + (client.nom?.[0] || '')}
                            </div>
                            <div className="truncate max-w-[150px]">
                              <p className="font-semibold text-slate-900 text-xs truncate">
                                {client.prenom} {client.nom}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">{client.telephone || ''}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Client non spécifié</span>
                        )}
                      </td>

                      {/* Véhicule */}
                      <td className="py-3.5 px-4">
                        {vehicule ? (
                          <div className="flex items-center space-x-1.5">
                            <Car className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            <div className="truncate max-w-[140px]">
                              <p className="text-xs font-semibold text-slate-900 truncate">
                                {vehicule.marque} {vehicule.modele}
                              </p>
                              <span className="font-mono text-[11px] text-slate-600">
                                {vehicule.immatriculation}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Réparation */}
                      <td className="py-3.5 px-4">
                        {reparation ? (
                          <div className="truncate max-w-[180px]">
                            <p className="text-xs font-medium text-slate-800 truncate">
                              {reparation.description}
                            </p>
                            <span className="text-[11px] text-slate-500">
                              Fiche #{reparation.id_reparation}
                            </span>
                          </div>
                        ) : (
                          <span className="font-mono text-xs text-slate-600">#{facture.id_reparation}</span>
                        )}
                      </td>

                      {/* Montant total */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="text-sm font-bold text-slate-900">
                          {Number(facture.montant_total || 0).toLocaleString('fr-TN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          TND
                        </span>
                        {(facture.cout_main_oeuvre !== undefined || facture.cout_pieces !== undefined) && (
                          <div className="text-[10px] text-slate-500 space-x-1">
                            <span>MO: {Number(facture.cout_main_oeuvre || 0).toFixed(0)} TND</span>
                            <span>•</span>
                            <span>Pièces: {Number(facture.cout_pieces || 0).toFixed(0)} TND</span>
                          </div>
                        )}
                      </td>

                      {/* Statut */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <FactureStatusBadge statut={facture.statut_paiement} size="small" />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {isEnAttente && onQuickPay && (
                            <button
                              type="button"
                              onClick={() => onQuickPay(facture.id_facture)}
                              title="Marquer comme payée"
                              className="p-1.5 rounded-lg text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 transition-colors"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onSelectFacture(facture.id_facture)}
                            title="Consulter le détail"
                            className="p-1.5 rounded-lg text-slate-600 hover:text-brand-600 hover:bg-slate-100 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
              <div>
                Affichage de <span className="font-semibold text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</span> à{' '}
                <span className="font-semibold text-slate-800">
                  {Math.min(currentPage * itemsPerPage, sortedFactures.length)}
                </span>{' '}
                sur <span className="font-semibold text-slate-800">{sortedFactures.length}</span> factures
              </div>
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-700"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => handlePageChange(page)}
                    className={`w-7 h-7 rounded text-xs font-semibold transition-colors ${
                      currentPage === page
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'border border-slate-300 hover:bg-slate-100 text-slate-700 bg-white'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-700"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FactureList;
