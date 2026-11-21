import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Car,
  User,
  Gauge,
  Calendar,
  Eye,
  Edit2,
  Trash2,
  AlertCircle,
  Shield,
  Info,
} from 'lucide-react';
import VehiculeStatusBadge from './VehiculeStatusBadge';
import { ROLES } from '../../utils/constants';

/**
 * Composant de liste des véhicules avec recherche, filtres et actions adaptées aux rôles.
 */
export const VehiculeList = ({
  vehicules = [],
  clientsMap = {},
  onSelectVehicule,
  onEditVehicule,
  onDeleteVehicule,
  userRole,
}) => {
  const isResponsable = userRole === ROLES.RESPONSABLE;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEtat, setSelectedEtat] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Liste unique des états disponibles dans les données réelles
  const availableEtats = useMemo(() => {
    const etatsSet = new Set();
    vehicules.forEach((v) => {
      if (v.etat && v.etat.trim()) {
        etatsSet.add(v.etat.trim());
      }
    });
    return Array.from(etatsSet);
  }, [vehicules]);

  // Filtrage combiné (Recherche + État)
  const filteredVehicules = useMemo(() => {
    return vehicules.filter((v) => {
      // 1. Filtre par état
      if (selectedEtat !== 'ALL' && (v.etat || '').trim() !== selectedEtat) {
        return false;
      }

      // 2. Recherche textuelle
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();

      const immatMatch = (v.immatriculation || '').toLowerCase().includes(term);
      const marqueMatch = (v.marque || '').toLowerCase().includes(term);
      const modeleMatch = (v.modele || '').toLowerCase().includes(term);
      const anneeMatch = String(v.annee || '').includes(term);

      // Correspondance propriétaire
      const client = clientsMap[v.id_client];
      const clientNom = (client?.nom || '').toLowerCase();
      const clientPrenom = (client?.prenom || '').toLowerCase();
      const clientMatch =
        clientNom.includes(term) ||
        clientPrenom.includes(term) ||
        `${clientNom} ${clientPrenom}`.includes(term) ||
        `${clientPrenom} ${clientNom}`.includes(term);

      return immatMatch || marqueMatch || modeleMatch || anneeMatch || clientMatch;
    });
  }, [vehicules, selectedEtat, searchTerm, clientsMap]);

  // Pagination
  const totalPages = Math.ceil(filteredVehicules.length / itemsPerPage) || 1;
  const paginatedVehicules = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredVehicules.slice(start, start + itemsPerPage);
  }, [filteredVehicules, currentPage, itemsPerPage]);

  // Statistiques rapides
  const stats = useMemo(() => {
    const total = vehicules.length;
    let needRepair = 0;
    let totalKm = 0;
    let kmCount = 0;

    vehicules.forEach((v) => {
      const e = (v.etat || '').toLowerCase();
      if (e.includes('panne') || e.includes('réparer') || e.includes('accident')) {
        needRepair += 1;
      }
      if (typeof v.kilometrage === 'number' && v.kilometrage > 0) {
        totalKm += v.kilometrage;
        kmCount += 1;
      }
    });

    const avgKm = kmCount > 0 ? Math.round(totalKm / kmCount) : 0;

    return { total, needRepair, avgKm };
  }, [vehicules]);

  return (
    <div className="space-y-5">
      {/* Bannière d'information pour le mécanicien */}
      {!isResponsable && (
        <div className="bg-sky-50 border border-sky-200 text-sky-800 rounded-xl p-3 text-xs flex items-center space-x-2.5">
          <Info className="w-4 h-4 text-sky-600 flex-shrink-0" />
          <span>
            <strong>Mode Consultation Mécanicien :</strong> Vous pouvez rechercher et consulter les fiches techniques des véhicules. La création et modification sont réservées au Responsable.
          </span>
        </div>
      )}

      {/* Barre de métriques rapides */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-2xs flex items-center space-x-3.5">
          <div className="p-3 bg-brand-50 text-brand-600 rounded-xl">
            <Car className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Parc de Véhicules</p>
            <p className="text-xl font-bold text-slate-900">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-2xs flex items-center space-x-3.5">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">En Panne / À Réparer</p>
            <p className="text-xl font-bold text-rose-700">{stats.needRepair}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-2xs flex items-center space-x-3.5">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Kilométrage Moyen</p>
            <p className="text-xl font-bold text-indigo-700">
              {stats.avgKm > 0 ? `${stats.avgKm.toLocaleString()} km` : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Recherche et Filtres */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Rechercher par immatriculation, marque, modèle ou client..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 placeholder:text-slate-400 transition-all"
          />
        </div>

        {/* Filtre par État */}
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <select
            value={selectedEtat}
            onChange={(e) => {
              setSelectedEtat(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full md:w-48 py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-800"
          >
            <option value="ALL">Tous les états</option>
            {availableEtats.map((etat) => (
              <option key={etat} value={etat}>
                {etat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tableau des véhicules */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {filteredVehicules.length === 0 ? (
          <div className="p-12 text-center">
            <Car className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">Aucun véhicule trouvé</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchTerm || selectedEtat !== 'ALL'
                ? "Aucun véhicule ne correspond aux critères de recherche actuels."
                : "Le parc de véhicules est actuellement vide."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Immatriculation</th>
                  <th className="py-3 px-4">Véhicule</th>
                  <th className="py-3 px-4">Propriétaire</th>
                  <th className="py-3 px-4">Année / Km</th>
                  <th className="py-3 px-4">État</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedVehicules.map((vehicule) => {
                  const client = clientsMap[vehicule.id_client];
                  return (
                    <tr
                      key={vehicule.id_vehicule}
                      onClick={() => onSelectVehicule(vehicule.id_vehicule)}
                      className="hover:bg-slate-50/90 transition-colors cursor-pointer group"
                    >
                      {/* Plaque d'immatriculation stylisée */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="inline-flex items-stretch border-2 border-slate-800 rounded bg-white shadow-2xs overflow-hidden">
                          {/* Bandeau bleu UE */}
                          <div className="bg-blue-700 text-white px-1.5 flex flex-col items-center justify-center text-[9px] font-bold leading-none select-none">
                            <span>★</span>
                            <span className="text-[8px] font-bold">F</span>
                          </div>
                          {/* Numéro de plaque */}
                          <div className="px-2.5 py-0.5 text-xs font-black font-mono tracking-widest text-slate-900 group-hover:text-brand-600 transition-colors">
                            {vehicule.immatriculation}
                          </div>
                        </div>
                      </td>

                      {/* Marque & Modèle */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                          {vehicule.marque} {vehicule.modele}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          ID: #{vehicule.id_vehicule}
                        </div>
                      </td>

                      {/* Propriétaire */}
                      <td className="py-3 px-4">
                        {client ? (
                          <div className="flex items-center space-x-1.5 text-slate-800">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-semibold">
                              {client.nom} {client.prenom}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Client #{vehicule.id_client}</span>
                        )}
                      </td>

                      {/* Année & Kilométrage */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="text-slate-700 font-medium">
                          {vehicule.kilometrage ? (
                            <span className="font-mono">{vehicule.kilometrage.toLocaleString()} km</span>
                          ) : (
                            <span className="text-slate-400">Kilométrage N/A</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{vehicule.annee || 'Année inconnue'}</span>
                        </div>
                      </td>

                      {/* État */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <VehiculeStatusBadge etat={vehicule.etat} size="small" />
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            type="button"
                            onClick={() => onSelectVehicule(vehicule.id_vehicule)}
                            className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                            title="Consulter la fiche technique"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isResponsable && (
                            <>
                              <button
                                type="button"
                                onClick={() => onEditVehicule(vehicule)}
                                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                title="Modifier le véhicule"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteVehicule(vehicule)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Supprimer le véhicule"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
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

        {/* Pied de pagination */}
        {totalPages > 1 && (
          <div className="p-3 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Page {currentPage} sur {totalPages}
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white"
              >
                Précédent
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white"
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

export default VehiculeList;
