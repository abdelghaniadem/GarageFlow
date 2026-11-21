import React, { useState, useMemo } from 'react';
import {
  Search,
  User,
  Phone,
  MapPin,
  Car,
  ChevronRight,
  Eye,
  Edit2,
  Trash2,
  Users,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

/**
 * Composant de liste des clients avec recherche, statistiques et actions.
 */
export const ClientList = ({
  clients = [],
  vehiculesCountMap = {},
  onSelectClient,
  onEditClient,
  onDeleteClient,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Filtrage par recherche
  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return clients;
    const term = searchTerm.toLowerCase().trim();

    return clients.filter((c) => {
      const nomMatch = (c.nom || '').toLowerCase().includes(term);
      const prenomMatch = (c.prenom || '').toLowerCase().includes(term);
      const telMatch = (c.telephone || '').toLowerCase().includes(term);
      const adrMatch = (c.adresse || '').toLowerCase().includes(term);
      const fullName = `${c.prenom || ''} ${c.nom || ''}`.toLowerCase();
      const reverseName = `${c.nom || ''} ${c.prenom || ''}`.toLowerCase();

      return (
        nomMatch ||
        prenomMatch ||
        telMatch ||
        adrMatch ||
        fullName.includes(term) ||
        reverseName.includes(term)
      );
    });
  }, [clients, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage) || 1;
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredClients.slice(start, start + itemsPerPage);
  }, [filteredClients, currentPage, itemsPerPage]);

  // Statistiques rapides
  const stats = useMemo(() => {
    const totalClients = clients.length;
    let clientsWithVehicles = 0;
    let totalVehicles = 0;

    clients.forEach((c) => {
      const count = vehiculesCountMap[c.id_client] || 0;
      if (count > 0) clientsWithVehicles += 1;
      totalVehicles += count;
    });

    return {
      total: totalClients,
      withVehicles: clientsWithVehicles,
      totalVehicles,
    };
  }, [clients, vehiculesCountMap]);

  return (
    <div className="space-y-5">
      {/* Barre de métriques rapides */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-2xs flex items-center space-x-3.5">
          <div className="p-3 bg-brand-50 text-brand-600 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Clients Enregistrés</p>
            <p className="text-xl font-bold text-slate-900">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-2xs flex items-center space-x-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Clients Actifs (avec véhicules)</p>
            <p className="text-xl font-bold text-emerald-700">{stats.withVehicles}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-2xs flex items-center space-x-3.5">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Car className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Véhicules Rattachés</p>
            <p className="text-xl font-bold text-amber-700">{stats.totalVehicles}</p>
          </div>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Rechercher par nom, prénom, téléphone ou adresse..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-900 placeholder:text-slate-400"
          />
        </div>
        <div className="text-xs text-slate-500 whitespace-nowrap self-end sm:self-center font-medium">
          {filteredClients.length} résultat{filteredClients.length > 1 ? 's' : ''}
        </div>
      </div>

      {/* Tableau des clients */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {filteredClients.length === 0 ? (
          <div className="p-12 text-center">
            <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">Aucun client trouvé</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchTerm
                ? "Aucun client ne correspond à votre recherche. Essayez avec un autre nom ou numéro."
                : "Le répertoire des clients est actuellement vide. Créez un premier profil client."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Téléphone</th>
                  <th className="py-3 px-4">Adresse</th>
                  <th className="py-3 px-4 text-center">Véhicules</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedClients.map((client) => {
                  const vehCount = vehiculesCountMap[client.id_client] || 0;
                  return (
                    <tr
                      key={client.id_client}
                      onClick={() => onSelectClient(client.id_client)}
                      className="hover:bg-slate-50/90 transition-colors cursor-pointer group"
                    >
                      {/* Nom & Prénom */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-brand-50 border border-brand-100 text-brand-700 font-bold flex items-center justify-center text-xs shadow-2xs flex-shrink-0 group-hover:scale-105 transition-transform">
                            {client.prenom?.charAt(0)?.toUpperCase() || ''}
                            {client.nom?.charAt(0)?.toUpperCase() || ''}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                              {client.nom} {client.prenom}
                            </span>
                            <div className="text-[10px] text-slate-400 font-mono">
                              ID: #{client.id_client}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Téléphone */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5 text-slate-700 font-medium font-mono text-[11px]">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{client.telephone}</span>
                        </div>
                      </td>

                      {/* Adresse */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="flex items-center space-x-1.5 text-slate-600 truncate">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate" title={client.adresse || 'Non renseignée'}>
                            {client.adresse || <em className="text-slate-400">Non renseignée</em>}
                          </span>
                        </div>
                      </td>

                      {/* Véhicules rattachés */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            vehCount > 0
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-slate-50 text-slate-400 border-slate-200'
                          }`}
                        >
                          <Car className="w-3 h-3 mr-1" />
                          {vehCount} véhicule{vehCount > 1 ? 's' : ''}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            type="button"
                            onClick={() => onSelectClient(client.id_client)}
                            className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                            title="Voir la fiche et les véhicules"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditClient(client)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Modifier les coordonnées"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteClient(client)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Supprimer le client"
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

export default ClientList;
