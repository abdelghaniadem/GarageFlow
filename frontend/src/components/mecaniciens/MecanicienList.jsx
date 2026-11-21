import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  UserCog,
  Mail,
  Phone,
  Wrench,
  Eye,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import MecanicienSpecialiteBadge from './MecanicienSpecialiteBadge';

/**
 * Composant de liste des mécaniciens avec recherche, filtres et métriques.
 */
export const MecanicienList = ({
  mecaniciens = [],
  reparationsCountMap = {},
  onSelectMecanicien,
  onEditMecanicien,
  onDeleteMecanicien,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialite, setSelectedSpecialite] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Liste unique des spécialités existantes
  const availableSpecialites = useMemo(() => {
    const set = new Set();
    mecaniciens.forEach((m) => {
      if (m.specialite && m.specialite.trim()) {
        set.add(m.specialite.trim());
      }
    });
    return Array.from(set);
  }, [mecaniciens]);

  // Filtrage combiné (Recherche textuelle + Spécialité)
  const filteredMecaniciens = useMemo(() => {
    return mecaniciens.filter((m) => {
      // 1. Filtre par spécialité
      if (
        selectedSpecialite !== 'ALL' &&
        (m.specialite || '').trim().toLowerCase() !== selectedSpecialite.toLowerCase()
      ) {
        return false;
      }

      // 2. Recherche textuelle
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();

      const specMatch = (m.specialite || '').toLowerCase().includes(term);
      const nomMatch = (m.utilisateur?.nom || '').toLowerCase().includes(term);
      const prenomMatch = (m.utilisateur?.prenom || '').toLowerCase().includes(term);
      const emailMatch = (m.utilisateur?.email || '').toLowerCase().includes(term);
      const telMatch = (m.utilisateur?.telephone || '').toLowerCase().includes(term);
      const fullName = `${m.utilisateur?.prenom || ''} ${m.utilisateur?.nom || ''}`.toLowerCase();
      const reverseName = `${m.utilisateur?.nom || ''} ${m.utilisateur?.prenom || ''}`.toLowerCase();

      return (
        specMatch ||
        nomMatch ||
        prenomMatch ||
        emailMatch ||
        telMatch ||
        fullName.includes(term) ||
        reverseName.includes(term)
      );
    });
  }, [mecaniciens, selectedSpecialite, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredMecaniciens.length / itemsPerPage) || 1;
  const paginatedMecaniciens = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredMecaniciens.slice(start, start + itemsPerPage);
  }, [filteredMecaniciens, currentPage, itemsPerPage]);

  // Statistiques rapides
  const stats = useMemo(() => {
    const total = mecaniciens.length;
    let activeWithReparations = 0;
    let totalReparations = 0;

    mecaniciens.forEach((m) => {
      const count = reparationsCountMap[m.id_mecanicien] || 0;
      if (count > 0) activeWithReparations += 1;
      totalReparations += count;
    });

    return {
      total,
      activeWithReparations,
      totalReparations,
      specialitesCount: availableSpecialites.length,
    };
  }, [mecaniciens, reparationsCountMap, availableSpecialites]);

  return (
    <div className="space-y-5">
      {/* Barre de métriques rapides */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-2xs flex items-center space-x-3.5">
          <div className="p-3 bg-brand-50 text-brand-600 rounded-xl">
            <UserCog className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Équipe Technique</p>
            <p className="text-xl font-bold text-slate-900">{stats.total} mécanicien{stats.total > 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-2xs flex items-center space-x-3.5">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Réparations Assignées</p>
            <p className="text-xl font-bold text-amber-700">{stats.totalReparations}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-2xs flex items-center space-x-3.5">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Spécialités d'Atelier</p>
            <p className="text-xl font-bold text-purple-700">{stats.specialitesCount}</p>
          </div>
        </div>
      </div>

      {/* Barre de recherche et filtres */}
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
            placeholder="Rechercher par nom, prénom, email ou spécialité..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-900 placeholder:text-slate-400"
          />
        </div>

        {/* Sélecteur de Spécialité */}
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <select
            value={selectedSpecialite}
            onChange={(e) => {
              setSelectedSpecialite(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full md:w-48 py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-800"
          >
            <option value="ALL">Toutes les spécialités</option>
            {availableSpecialites.map((spec) => (
              <option key={spec} value={spec}>
                {spec}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tableau des mécaniciens */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {filteredMecaniciens.length === 0 ? (
          <div className="p-12 text-center">
            <UserCog className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">Aucun mécanicien trouvé</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchTerm || selectedSpecialite !== 'ALL'
                ? "Aucun mécanicien ne correspond aux critères de recherche actuels."
                : "Aucun profil de mécanicien n'est enregistré dans l'atelier."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Mécanicien</th>
                  <th className="py-3 px-4">Spécialité</th>
                  <th className="py-3 px-4">Coordonnées</th>
                  <th className="py-3 px-4 text-center">Interventions</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedMecaniciens.map((meca) => {
                  const repCount = reparationsCountMap[meca.id_mecanicien] || 0;
                  const user = meca.utilisateur;

                  return (
                    <tr
                      key={meca.id_mecanicien}
                      onClick={() => onSelectMecanicien(meca.id_mecanicien)}
                      className="hover:bg-slate-50/90 transition-colors cursor-pointer group"
                    >
                      {/* Avatar & Nom */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-100 text-brand-700 font-bold flex items-center justify-center text-xs shadow-2xs flex-shrink-0 group-hover:scale-105 transition-transform">
                            {user?.prenom?.charAt(0)?.toUpperCase() || ''}
                            {user?.nom?.charAt(0)?.toUpperCase() || ''}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                              {user ? `${user.nom} ${user.prenom}` : `Mécanicien #${meca.id_mecanicien}`}
                            </span>
                            <div className="text-[10px] text-slate-400 font-mono">
                              ID: #{meca.id_mecanicien} • User #{meca.id_utilisateur}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Spécialité */}
                      <td className="py-3 px-4">
                        <MecanicienSpecialiteBadge specialite={meca.specialite} size="small" />
                      </td>

                      {/* Email & Téléphone */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          {user?.email && (
                            <div className="flex items-center space-x-1.5 text-slate-600 text-[11px]">
                              <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="truncate">{user.email}</span>
                            </div>
                          )}
                          {user?.telephone ? (
                            <div className="flex items-center space-x-1.5 text-slate-600 font-mono text-[11px]">
                              <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span>{user.telephone}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">Téléphone non renseigné</span>
                          )}
                        </div>
                      </td>

                      {/* Interventions assignées */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            repCount > 0
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-slate-50 text-slate-400 border-slate-200'
                          }`}
                        >
                          <Wrench className="w-3 h-3 mr-1" />
                          {repCount} intervention{repCount > 1 ? 's' : ''}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            type="button"
                            onClick={() => onSelectMecanicien(meca.id_mecanicien)}
                            className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                            title="Voir la fiche et les réparations"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditMecanicien(meca)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Modifier les coordonnées"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteMecanicien(meca)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Supprimer le profil mécanicien"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

export default MecanicienList;
