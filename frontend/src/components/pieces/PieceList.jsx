import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Package,
  Boxes,
  Eye,
  Edit2,
  Trash2,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  ArrowUpDown,
  Info,
} from 'lucide-react';
import PieceStockBadge from './PieceStockBadge';
import { ROLES } from '../../utils/constants';

/**
 * Composant de liste et catalogue des pièces détachées avec recherche,
 * filtrage par disponibilité, tri multicritère et pagination.
 */
export const PieceList = ({
  pieces = [],
  onSelectPiece,
  onEditPiece,
  onAdjustStock,
  onDeletePiece,
  userRole,
}) => {
  const isResponsable = userRole === ROLES.RESPONSABLE;

  const [searchTerm, setSearchTerm] = useState('');
  const [filterDispo, setFilterDispo] = useState('ALL'); // 'ALL', 'EN_STOCK', 'STOCK_FAIBLE', 'RUPTURE'
  const [sortBy, setSortBy] = useState('NOM_ASC'); // 'NOM_ASC', 'NOM_DESC', 'PRIX_ASC', 'PRIX_DESC', 'STOCK_ASC', 'STOCK_DESC'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Filtrage et Tri combinés
  const processedPieces = useMemo(() => {
    let result = pieces.filter((p) => {
      // 1. Filtre par disponibilité
      const stock = p.quantite_stock || 0;
      if (filterDispo === 'RUPTURE' && stock > 0) return false;
      if (filterDispo === 'STOCK_FAIBLE' && (stock <= 0 || stock > 5)) return false;
      if (filterDispo === 'EN_STOCK' && stock <= 5) return false;

      // 2. Recherche textuelle (nom ou référence REF-#)
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      const nomMatch = (p.nom || '').toLowerCase().includes(term);
      const refMatch = `ref-#${p.id_piece}`.includes(term) || String(p.id_piece).includes(term);

      return nomMatch || refMatch;
    });

    // Tri
    result.sort((a, b) => {
      switch (sortBy) {
        case 'NOM_ASC':
          return (a.nom || '').localeCompare(b.nom || '');
        case 'NOM_DESC':
          return (b.nom || '').localeCompare(a.nom || '');
        case 'PRIX_ASC':
          return (Number(a.prix_unitaire) || 0) - (Number(b.prix_unitaire) || 0);
        case 'PRIX_DESC':
          return (Number(b.prix_unitaire) || 0) - (Number(a.prix_unitaire) || 0);
        case 'STOCK_ASC':
          return (a.quantite_stock || 0) - (b.quantite_stock || 0);
        case 'STOCK_DESC':
          return (b.quantite_stock || 0) - (a.quantite_stock || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [pieces, searchTerm, filterDispo, sortBy]);

  // Pagination
  const totalPages = Math.ceil(processedPieces.length / itemsPerPage) || 1;
  const paginatedPieces = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedPieces.slice(start, start + itemsPerPage);
  }, [processedPieces, currentPage, itemsPerPage]);

  // Statistiques rapides du catalogue
  const stats = useMemo(() => {
    const totalRef = pieces.length;
    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;
    let totalVal = 0;

    pieces.forEach((p) => {
      const q = p.quantite_stock || 0;
      const pu = Number(p.prix_unitaire) || 0;
      totalVal += q * pu;

      if (q <= 0) {
        outOfStock += 1;
      } else if (q <= 5) {
        lowStock += 1;
      } else {
        inStock += 1;
      }
    });

    return { totalRef, inStock, lowStock, outOfStock, totalVal };
  }, [pieces]);

  return (
    <div className="space-y-5">
      {/* Information Mécanicien */}
      {!isResponsable && (
        <div className="bg-sky-50 border border-sky-200 text-sky-800 rounded-xl p-3 text-xs flex items-center space-x-2.5">
          <Info className="w-4 h-4 text-sky-600 flex-shrink-0" />
          <span>
            <strong>Mode Consultation Mécanicien :</strong> Vous pouvez consulter le catalogue de pièces détachées et les disponibilités de stock pour préparer vos interventions.
          </span>
        </div>
      )}

      {/* Barre de métriques rapides */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-2xs flex items-center space-x-3">
          <div className="p-2.5 bg-brand-50 text-brand-600 rounded-xl">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-medium">Catalogue</p>
            <p className="text-lg font-bold text-slate-900">{stats.totalRef} réf.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-2xs flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-medium">En Stock</p>
            <p className="text-lg font-bold text-emerald-700">{stats.inStock}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-2xs flex items-center space-x-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-medium">Stock Faible (≤ 5)</p>
            <p className="text-lg font-bold text-amber-700">{stats.lowStock}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-2xs flex items-center space-x-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-medium">En Rupture</p>
            <p className="text-lg font-bold text-rose-700">{stats.outOfStock}</p>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-4 lg:col-span-1 bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-2xs flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 font-medium">Valeur Stock HT</p>
            <p className="text-lg font-bold text-indigo-700 font-mono">
              {stats.totalVal.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      </div>

      {/* Barre de recherche, filtres et tri */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Recherche */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Rechercher une pièce par nom ou référence (REF-#)..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 placeholder:text-slate-400 transition-all"
          />
        </div>

        <div className="flex items-center space-x-2.5 w-full md:w-auto">
          {/* Filtre disponibilité */}
          <div className="flex items-center space-x-1.5 flex-1 md:flex-initial">
            <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <select
              value={filterDispo}
              onChange={(e) => {
                setFilterDispo(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full md:w-40 py-2 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-800"
            >
              <option value="ALL">Toutes les pièces</option>
              <option value="EN_STOCK">En stock (&gt; 5)</option>
              <option value="STOCK_FAIBLE">Stock faible (≤ 5)</option>
              <option value="RUPTURE">En rupture (0)</option>
            </select>
          </div>

          {/* Tri */}
          <div className="flex items-center space-x-1.5 flex-1 md:flex-initial">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full md:w-44 py-2 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-800"
            >
              <option value="NOM_ASC">Nom (A → Z)</option>
              <option value="NOM_DESC">Nom (Z → A)</option>
              <option value="PRIX_ASC">Prix (croissant)</option>
              <option value="PRIX_DESC">Prix (décroissant)</option>
              <option value="STOCK_ASC">Stock (croissant)</option>
              <option value="STOCK_DESC">Stock (décroissant)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tableau du catalogue */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {processedPieces.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">Aucune pièce détachée trouvée</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchTerm || filterDispo !== 'ALL'
                ? "Aucun article ne correspond à vos critères de recherche actuels."
                : "Le catalogue d'atelier est actuellement vide. Enregistrez une première pièce."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Référence</th>
                  <th className="py-3 px-4">Désignation</th>
                  <th className="py-3 px-4">Prix unitaire HT</th>
                  <th className="py-3 px-4 text-center">Disponibilité</th>
                  <th className="py-3 px-4 text-center">Quantité Stock</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedPieces.map((piece) => (
                  <tr
                    key={piece.id_piece}
                    onClick={() => onSelectPiece(piece.id_piece)}
                    className="hover:bg-slate-50/90 transition-colors cursor-pointer group"
                  >
                    {/* Référence */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-mono font-bold text-slate-700">
                        REF-#{piece.id_piece}
                      </span>
                    </td>

                    {/* Désignation */}
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                        {piece.nom}
                      </span>
                    </td>

                    {/* Prix unitaire */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-mono font-semibold text-slate-800">
                        {Number(piece.prix_unitaire).toFixed(2)} TND
                      </span>
                    </td>

                    {/* Badge disponibilité */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <PieceStockBadge quantite={piece.quantite_stock} size="small" />
                    </td>

                    {/* Quantité numérique */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span
                        className={`font-mono font-bold text-xs ${
                          piece.quantite_stock <= 0
                            ? 'text-rose-600'
                            : piece.quantite_stock <= 5
                            ? 'text-amber-600'
                            : 'text-slate-800'
                        }`}
                      >
                        {piece.quantite_stock} unité{piece.quantite_stock > 1 ? 's' : ''}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end space-x-1">
                        <button
                          type="button"
                          onClick={() => onSelectPiece(piece.id_piece)}
                          className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                          title="Consulter la fiche article"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {isResponsable && (
                          <>
                            <button
                              type="button"
                              onClick={() => onAdjustStock(piece)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Ajuster ou approvisionner le stock"
                            >
                              <Boxes className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onEditPiece(piece)}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Modifier la pièce"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeletePiece(piece)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Supprimer la pièce"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pied de pagination */}
        {totalPages > 1 && (
          <div className="p-3 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Page {currentPage} sur {totalPages} ({processedPieces.length} article{processedPieces.length > 1 ? 's' : ''})
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

export default PieceList;
