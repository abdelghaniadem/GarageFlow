import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Calendar as CalendarIcon,
  Clock,
  User,
  Car,
  FileText,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  LayoutList,
  CalendarDays,
  Plus,
  AlertCircle,
  ArrowUpDown,
} from 'lucide-react';
import RendezVousStatusBadge from './RendezVousStatusBadge';
import { RENDEZ_VOUS_STATUSES } from '../../utils/constants';

/**
 * Composant de liste et consultation des rendez-vous avec bascule Vue Liste / Vue Agenda Calendrier.
 */
export const RendezVousList = ({
  rendezVous = [],
  clientsMap = {},
  vehiculesMap = {},
  onSelectRdv,
  onDeleteRdv,
  onCreateRdv,
}) => {
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatut, setSelectedStatut] = useState('ALL');
  const [periodPreset, setPeriodPreset] = useState('ALL'); // 'ALL' | 'TODAY' | 'WEEK' | 'CUSTOM'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('date_asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Calcul des dates d'aujourd'hui et de la semaine courante
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const endOfWeekStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  }, []);

  // Filtrage combiné
  const filteredRendezVous = useMemo(() => {
    return rendezVous.filter((rdv) => {
      // 1. Filtre par statut
      if (selectedStatut !== 'ALL' && (rdv.statut || '').toUpperCase() !== selectedStatut) {
        return false;
      }

      // 2. Filtre par période
      if (periodPreset === 'TODAY') {
        if (rdv.date_rendezvous !== todayStr) return false;
      } else if (periodPreset === 'WEEK') {
        if (rdv.date_rendezvous < todayStr || rdv.date_rendezvous > endOfWeekStr) return false;
      } else if (periodPreset === 'CUSTOM') {
        if (startDate && rdv.date_rendezvous < startDate) return false;
        if (endDate && rdv.date_rendezvous > endDate) return false;
      }

      // 3. Recherche textuelle
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();

      const motifMatch = (rdv.motif || '').toLowerCase().includes(term);
      const idMatch = String(rdv.id_rendezvous).includes(term);

      // Client info
      const client = rdv.client || clientsMap[rdv.id_client];
      const clientNom = (client?.nom || '').toLowerCase();
      const clientPrenom = (client?.prenom || '').toLowerCase();
      const clientTel = (client?.telephone || '').toLowerCase();
      const clientMatch =
        clientNom.includes(term) ||
        clientPrenom.includes(term) ||
        `${clientPrenom} ${clientNom}`.includes(term) ||
        `${clientNom} ${clientPrenom}`.includes(term) ||
        clientTel.includes(term);

      // Véhicule info
      const vehicule = rdv.vehicule || vehiculesMap[rdv.id_vehicule];
      const immatMatch = (vehicule?.immatriculation || '').toLowerCase().includes(term);
      const marqueMatch = (vehicule?.marque || '').toLowerCase().includes(term);
      const modeleMatch = (vehicule?.modele || '').toLowerCase().includes(term);

      return motifMatch || idMatch || clientMatch || immatMatch || marqueMatch || modeleMatch;
    });
  }, [
    rendezVous,
    selectedStatut,
    periodPreset,
    startDate,
    endDate,
    searchTerm,
    clientsMap,
    vehiculesMap,
    todayStr,
    endOfWeekStr,
  ]);

  // Tri
  const sortedRendezVous = useMemo(() => {
    const list = [...filteredRendezVous];
    switch (sortBy) {
      case 'date_asc':
        return list.sort((a, b) => {
          const comp = (a.date_rendezvous || '').localeCompare(b.date_rendezvous || '');
          if (comp !== 0) return comp;
          return (a.heure || '').localeCompare(b.heure || '');
        });
      case 'date_desc':
        return list.sort((a, b) => {
          const comp = (b.date_rendezvous || '').localeCompare(a.date_rendezvous || '');
          if (comp !== 0) return comp;
          return (b.heure || '').localeCompare(a.heure || '');
        });
      case 'id_desc':
        return list.sort((a, b) => b.id_rendezvous - a.id_rendezvous);
      default:
        return list;
    }
  }, [filteredRendezVous, sortBy]);

  // Pagination pour la vue liste
  const totalPages = Math.ceil(sortedRendezVous.length / itemsPerPage) || 1;
  const paginatedRendezVous = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedRendezVous.slice(start, start + itemsPerPage);
  }, [sortedRendezVous, currentPage, itemsPerPage]);

  // Groupement par jour pour la vue Calendrier / Agenda
  const calendarGroupedDays = useMemo(() => {
    const groups = {};
    sortedRendezVous.forEach((rdv) => {
      const day = rdv.date_rendezvous || 'Date inconnue';
      if (!groups[day]) {
        groups[day] = [];
      }
      groups[day].push(rdv);
    });

    // Ordonner les jours
    return Object.keys(groups)
      .sort((a, b) => (sortBy === 'date_desc' ? b.localeCompare(a) : a.localeCompare(b)))
      .map((day) => ({
        date: day,
        items: groups[day],
      }));
  }, [sortedRendezVous, sortBy]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedStatut('ALL');
    setPeriodPreset('ALL');
    setStartDate('');
    setEndDate('');
    setSortBy('date_asc');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchTerm !== '' ||
    selectedStatut !== 'ALL' ||
    periodPreset !== 'ALL' ||
    startDate !== '' ||
    endDate !== '';

  return (
    <div className="space-y-4">
      {/* Contrôles de navigation et de filtrage */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
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
              placeholder="Rechercher par client, véhicule, motif..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
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
                className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              >
                <option value="ALL">Tous les statuts</option>
                <option value={RENDEZ_VOUS_STATUSES.PLANIFIE}>Planifié</option>
                <option value={RENDEZ_VOUS_STATUSES.CONFIRME}>Confirmé</option>
                <option value={RENDEZ_VOUS_STATUSES.EN_ATTENTE}>En attente</option>
                <option value={RENDEZ_VOUS_STATUSES.EN_COURS}>En atelier</option>
                <option value={RENDEZ_VOUS_STATUSES.TERMINE}>Terminé</option>
                <option value={RENDEZ_VOUS_STATUSES.HONORE}>Honoré</option>
                <option value={RENDEZ_VOUS_STATUSES.ANNULE}>Annulé</option>
              </select>
            </div>
          </div>

          {/* Tri */}
          <div className="md:col-span-2">
            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-8 pr-6 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              >
                <option value="date_asc">Chronologique (Prochains)</option>
                <option value="date_desc">Anté-chronologique</option>
                <option value="id_desc">Derniers créés</option>
              </select>
            </div>
          </div>

          {/* Bascule Vue Liste / Vue Agenda */}
          <div className="md:col-span-2 flex items-center justify-end">
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                title="Affichage en liste"
                className={`flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <LayoutList className="w-3.5 h-3.5 mr-1" />
                Liste
              </button>
              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                title="Affichage agenda par jour"
                className={`flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === 'calendar'
                    ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5 mr-1" />
                Agenda
              </button>
            </div>
          </div>
        </div>

        {/* Ligne secondaire : Filtres rapides par période */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Période :</span>
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => {
                  setPeriodPreset('ALL');
                  setCurrentPage(1);
                }}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  periodPreset === 'ALL'
                    ? 'bg-white dark:bg-slate-800 font-semibold text-brand-600 dark:text-brand-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                Tous
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriodPreset('TODAY');
                  setCurrentPage(1);
                }}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  periodPreset === 'TODAY'
                    ? 'bg-white dark:bg-slate-800 font-semibold text-brand-600 dark:text-brand-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                Aujourd'hui
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriodPreset('WEEK');
                  setCurrentPage(1);
                }}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  periodPreset === 'WEEK'
                    ? 'bg-white dark:bg-slate-800 font-semibold text-brand-600 dark:text-brand-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                7 prochains jours
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriodPreset('CUSTOM');
                  setCurrentPage(1);
                }}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  periodPreset === 'CUSTOM'
                    ? 'bg-white dark:bg-slate-800 font-semibold text-brand-600 dark:text-brand-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                }`}
              >
                Dates personnalisées
              </button>
            </div>

            {periodPreset === 'CUSTOM' && (
              <div className="flex items-center space-x-1.5 ml-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-200"
                />
                <span className="text-slate-400">à</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-200"
                />
              </div>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center px-2 py-1 text-slate-600 dark:text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Effacer filtres
              </button>
            )}
          </div>

          <div className="text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-800 dark:text-slate-200">{filteredRendezVous.length}</span> rendez-vous trouvé(s)
          </div>
        </div>
      </div>

      {/* Rendu principal selon le mode d'affichage */}
      {filteredRendezVous.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto text-slate-400 mb-3">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            {hasActiveFilters ? 'Aucun rendez-vous trouvé' : 'Aucun rendez-vous planifié'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {hasActiveFilters
              ? 'Ajustez votre recherche ou réinitialisez les critères de filtrage.'
              : 'Planifiez un rendez-vous pour recevoir un client et son véhicule à l\'atelier.'}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-4 inline-flex items-center px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 text-sm font-medium transition-colors"
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Réinitialiser les filtres
            </button>
          ) : (
            onCreateRdv && (
              <button
                type="button"
                onClick={onCreateRdv}
                className="mt-4 inline-flex items-center px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Planifier un rendez-vous
              </button>
            )
          )}
        </div>
      ) : viewMode === 'list' ? (
        /* VUE LISTE TABULAIRE */
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-700/80 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Date & Heure</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Véhicule</th>
                  <th className="py-3 px-4">Motif d'intervention</th>
                  <th className="py-3 px-4 text-center">Statut</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-sm">
                {paginatedRendezVous.map((rdv) => {
                  const client = rdv.client || clientsMap[rdv.id_client];
                  const vehicule = rdv.vehicule || vehiculesMap[rdv.id_vehicule];
                  const isProtected = ['TERMINE', 'HONORE'].includes((rdv.statut || '').toUpperCase());

                  return (
                    <tr
                      key={rdv.id_rendezvous}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-750/50 transition-colors"
                    >
                      {/* Date & Heure */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-100 text-xs">
                              {rdv.date_rendezvous}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              {rdv.heure ? rdv.heure.slice(0, 5) : '—'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Client */}
                      <td className="py-3.5 px-4">
                        {client ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 text-xs font-semibold uppercase flex-shrink-0">
                              {(client.prenom?.[0] || '') + (client.nom?.[0] || '')}
                            </div>
                            <div className="truncate max-w-[150px]">
                              <p className="font-medium text-slate-800 dark:text-slate-200 text-xs truncate">
                                {client.prenom} {client.nom}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">{client.telephone || ''}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Client #{rdv.id_client}</span>
                        )}
                      </td>

                      {/* Véhicule */}
                      <td className="py-3.5 px-4">
                        {vehicule ? (
                          <div className="flex items-center space-x-1.5">
                            <Car className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <div className="truncate max-w-[140px]">
                              <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                                {vehicule.marque} {vehicule.modele}
                              </p>
                              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                {vehicule.immatriculation}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">Véhicule #{rdv.id_vehicule}</span>
                        )}
                      </td>

                      {/* Motif */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2">
                          {rdv.motif || <span className="italic text-slate-400">Aucun motif renseigné</span>}
                        </p>
                      </td>

                      {/* Statut */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <RendezVousStatusBadge statut={rdv.statut} size="small" />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            type="button"
                            onClick={() => onSelectRdv(rdv.id_rendezvous)}
                            title="Détails et modification"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {onDeleteRdv && (
                            <button
                              type="button"
                              onClick={() => onDeleteRdv(rdv)}
                              title={
                                isProtected
                                  ? 'Suppression bloquée (statut honoré/terminé)'
                                  : 'Supprimer le rendez-vous'
                              }
                              className={`p-1.5 rounded-lg transition-colors ${
                                isProtected
                                  ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                  : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                              }`}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
              <div>
                Affichage de <span className="font-semibold text-slate-700 dark:text-slate-200">{(currentPage - 1) * itemsPerPage + 1}</span> à{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {Math.min(currentPage * itemsPerPage, sortedRendezVous.length)}
                </span>{' '}
                sur <span className="font-semibold text-slate-700 dark:text-slate-200">{sortedRendezVous.length}</span> rendez-vous
              </div>
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                      currentPage === page
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* VUE AGENDA / CALENDRIER */
        <div className="space-y-6">
          {calendarGroupedDays.map((group) => {
            const isToday = group.date === todayStr;
            return (
              <div
                key={group.date}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs"
              >
                {/* En-tête du jour */}
                <div
                  className={`px-4 py-3 flex items-center justify-between border-b ${
                    isToday
                      ? 'bg-brand-50/80 dark:bg-brand-950/40 border-brand-200 dark:border-brand-800'
                      : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-700/80'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <CalendarIcon
                      className={`w-4 h-4 ${isToday ? 'text-brand-600' : 'text-slate-400'}`}
                    />
                    <span
                      className={`text-sm font-bold ${
                        isToday ? 'text-brand-700 dark:text-brand-300' : 'text-slate-800 dark:text-slate-100'
                      }`}
                    >
                      {group.date}
                    </span>
                    {isToday && (
                      <span className="px-2 py-0.5 rounded-full bg-brand-600 text-white text-[10px] font-bold uppercase">
                        Aujourd'hui
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {group.items.length} rendez-vous
                  </span>
                </div>

                {/* Créneaux du jour */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.items.map((rdv) => {
                    const client = rdv.client || clientsMap[rdv.id_client];
                    const vehicule = rdv.vehicule || vehiculesMap[rdv.id_vehicule];
                    return (
                      <div
                        key={rdv.id_rendezvous}
                        onClick={() => onSelectRdv(rdv.id_rendezvous)}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-850 hover:bg-slate-100/80 dark:hover:bg-slate-750 transition-all cursor-pointer flex flex-col justify-between space-y-2.5 shadow-2xs hover:shadow-xs hover:border-brand-300"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-1.5 font-mono text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                            <Clock className="w-3.5 h-3.5 text-brand-600" />
                            <span>{rdv.heure ? rdv.heure.slice(0, 5) : '—'}</span>
                          </div>
                          <RendezVousStatusBadge statut={rdv.statut} size="small" />
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-slate-900 dark:text-white">
                            {client ? `${client.prenom} ${client.nom}` : `Client #${rdv.id_client}`}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {vehicule
                              ? `${vehicule.marque} ${vehicule.modele} (${vehicule.immatriculation})`
                              : `Véhicule #${rdv.id_vehicule}`}
                          </p>
                        </div>

                        {rdv.motif && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700/80">
                            {rdv.motif}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RendezVousList;
