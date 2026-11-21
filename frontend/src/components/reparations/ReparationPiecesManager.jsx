import React, { useState, useEffect, useCallback } from 'react';
import { Package, Plus, Trash2, Edit2, Check, X, AlertCircle, Loader2 } from 'lucide-react';
import reparationService from '../../services/reparationService';
import pieceService from '../../services/pieceService';

/**
 * Gestionnaire complet des pièces détachées associées à une réparation.
 * Utilise les routes /api/v1/reparations/<id>/pieces
 */
export const ReparationPiecesManager = ({
  idReparation,
  onPiecesUpdated,
  readOnly = false,
}) => {
  const [piecesAssociees, setPiecesAssociees] = useState([]);
  const [cataloguePieces, setCataloguePieces] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Formulaire d'ajout
  const [selectedPieceId, setSelectedPieceId] = useState('');
  const [quantiteInput, setQuantiteInput] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  // Édition de quantité
  const [editingPieceId, setEditingPieceId] = useState(null);
  const [editQuantite, setEditQuantite] = useState(1);

  // Chargement des pièces associées et du catalogue disponible
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [assocData, catalogueData] = await Promise.all([
        reparationService.listPieces(idReparation),
        pieceService.list(),
      ]);
      setPiecesAssociees(assocData || []);
      setCataloguePieces(catalogueData || []);
      if (onPiecesUpdated) {
        onPiecesUpdated(assocData || []);
      }
    } catch (err) {
      console.error('Erreur chargement pièces :', err);
      setErrorMessage(err.message || 'Impossible de charger les pièces.');
    } finally {
      setIsLoading(false);
    }
  }, [idReparation, onPiecesUpdated]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Ajout d'une pièce à la réparation
  const handleAddPiece = async (e) => {
    e.preventDefault();
    if (!selectedPieceId) return;
    const qty = parseInt(quantiteInput, 10);
    if (isNaN(qty) || qty <= 0) {
      setErrorMessage('La quantité doit être un entier supérieur ou égal à 1.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await reparationService.addPiece(idReparation, {
        id_piece: parseInt(selectedPieceId, 10),
        quantite: qty,
      });
      setSelectedPieceId('');
      setQuantiteInput(1);
      setIsAdding(false);
      await loadData();
    } catch (err) {
      setErrorMessage(err.message || "Erreur lors de l'ajout de la pièce.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mise à jour de la quantité
  const handleSaveEdit = async (idPiece) => {
    const qty = parseInt(editQuantite, 10);
    if (isNaN(qty) || qty <= 0) {
      setErrorMessage('La quantité doit être supérieure ou égale à 1.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await reparationService.updatePiece(idReparation, idPiece, qty);
      setEditingPieceId(null);
      await loadData();
    } catch (err) {
      setErrorMessage(err.message || 'Erreur mise à jour de la quantité.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Suppression d'une pièce associée
  const handleRemovePiece = async (idPiece) => {
    if (!window.confirm('Voulez-vous retirer cette pièce de l\'intervention ? Le stock sera réintégré.')) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await reparationService.removePiece(idReparation, idPiece);
      await loadData();
    } catch (err) {
      setErrorMessage(err.message || 'Erreur lors du retrait de la pièce.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPiecesCout = piecesAssociees.reduce((acc, p) => acc + (p.sous_total || 0), 0);

  // Filtrer les pièces du catalogue déjà associées pour ne pas créer de doublons
  const idsAssociees = new Set(piecesAssociees.map((p) => p.id_piece));
  const availableCatalog = cataloguePieces.filter((p) => !idsAssociees.has(p.id_piece));

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Pièces Détachées Consommées
            </h3>
            <p className="text-xs text-slate-500">
              {piecesAssociees.length} référence(s) utilisée(s)
            </p>
          </div>
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={() => setIsAdding((prev) => !prev)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold transition-colors"
          >
            {isAdding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{isAdding ? 'Annuler' : 'Ajouter une pièce'}</span>
          </button>
        )}
      </div>

      {/* Message d'erreur */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Formulaire d'ajout rapide */}
      {isAdding && !readOnly && (
        <form
          onSubmit={handleAddPiece}
          className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs"
        >
          <div className="font-semibold text-slate-800">Ajouter une pièce du stock :</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Pièce détachée disponible
              </label>
              <select
                value={selectedPieceId}
                onChange={(e) => setSelectedPieceId(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              >
                <option value="">-- Sélectionner une pièce du catalogue --</option>
                {availableCatalog.map((p) => (
                  <option
                    key={p.id_piece}
                    value={p.id_piece}
                    disabled={p.quantite_stock <= 0}
                  >
                    {p.nom} — {p.prix_unitaire ? `${Number(p.prix_unitaire).toFixed(2)} TND` : '0 TND'} (Stock : {p.quantite_stock})
                    {p.quantite_stock <= 0 ? ' [RUPTURE]' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Quantité
              </label>
              <input
                type="number"
                min="1"
                value={quantiteInput}
                onChange={(e) => setQuantiteInput(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedPieceId}
              className="inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold disabled:opacity-50 shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <span>Ajouter à la réparation</span>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Liste des pièces */}
      {isLoading ? (
        <div className="p-6 text-center text-slate-400 text-xs flex items-center justify-center space-x-2">
          <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
          <span>Chargement des pièces...</span>
        </div>
      ) : piecesAssociees.length === 0 ? (
        <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
          <Package className="w-6 h-6 mx-auto mb-1 stroke-1 text-slate-300" />
          <p>Aucune pièce détachée associée à cette intervention.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200/90 rounded-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Pièce</th>
                <th className="py-2.5 px-3 text-right">Prix Unitaire</th>
                <th className="py-2.5 px-3 text-center">Quantité</th>
                <th className="py-2.5 px-3 text-right">Sous-total</th>
                {!readOnly && <th className="py-2.5 px-3 text-center w-24">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {piecesAssociees.map((p) => {
                const isEditing = editingPieceId === p.id_piece;
                return (
                  <tr key={p.id_piece} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {p.nom_piece || `Pièce #${p.id_piece}`}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                      {p.prix_unitaire !== undefined ? `${Number(p.prix_unitaire).toFixed(2)} TND` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          min="1"
                          value={editQuantite}
                          onChange={(e) => setEditQuantite(e.target.value)}
                          className="w-16 px-1.5 py-0.5 text-center border border-slate-300 rounded text-xs"
                          autoFocus
                        />
                      ) : (
                        <span className="font-bold text-slate-800">{p.quantite}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold font-mono text-slate-900">
                      {p.sous_total !== undefined ? `${Number(p.sous_total).toFixed(2)} TND` : '—'}
                    </td>
                    {!readOnly && (
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(p.id_piece)}
                                disabled={isSubmitting}
                                title="Valider"
                                className="p-1 rounded text-emerald-600 hover:bg-emerald-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingPieceId(null)}
                                title="Annuler"
                                className="p-1 rounded text-slate-400 hover:bg-slate-100"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPieceId(p.id_piece);
                                  setEditQuantite(p.quantite);
                                }}
                                title="Modifier la quantité"
                                className="p-1 rounded text-slate-400 hover:text-brand-600 hover:bg-slate-100"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemovePiece(p.id_piece)}
                                disabled={isSubmitting}
                                title="Retirer la pièce"
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50/80 border-t border-slate-200">
              <tr>
                <td colSpan="3" className="py-2.5 px-3 font-semibold text-slate-700 text-right">
                  Total Pièces Détachées :
                </td>
                <td className="py-2.5 px-3 text-right font-extrabold text-brand-700 font-mono text-sm">
                  {totalPiecesCout.toFixed(2)} TND
                </td>
                {!readOnly && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default ReparationPiecesManager;
