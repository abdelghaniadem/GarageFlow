import React, { useState, useEffect } from 'react';
import {
  X,
  Package,
  DollarSign,
  Layers,
  Edit2,
  Trash2,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Boxes,
  TrendingUp,
} from 'lucide-react';
import pieceService from '../../services/pieceService';
import PieceStockBadge from './PieceStockBadge';
import { ROLES } from '../../utils/constants';

/**
 * Modale de consultation détaillée, modification et suppression d'une pièce détachée.
 * Accessible en lecture aux MÉCANICIENS et RESPONSABLES.
 * Modification et suppression réservées au RESPONSABLE.
 */
export const PieceDetailModal = ({
  isOpen,
  onClose,
  idPiece,
  onUpdated,
  onDeleted,
  onOpenStockManager,
  userRole,
}) => {
  const isResponsable = userRole === ROLES.RESPONSABLE;

  const [piece, setPiece] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  // Mode modification
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    nom: '',
    prix_unitaire: '',
    quantite_stock: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // État suppression
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConflictError, setDeleteConflictError] = useState(null);

  useEffect(() => {
    if (isOpen && idPiece) {
      const loadPieceData = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        setDeleteConflictError(null);
        setIsEditing(false);

        try {
          const pieceData = await pieceService.getById(idPiece);
          setPiece(pieceData);
          setFormData({
            nom: pieceData.nom || '',
            prix_unitaire: pieceData.prix_unitaire !== undefined ? String(pieceData.prix_unitaire) : '',
            quantite_stock: pieceData.quantite_stock !== undefined ? String(pieceData.quantite_stock) : '',
          });
        } catch (err) {
          console.error('Erreur chargement détails pièce :', err);
          setErrorMessage(err.message || 'Impossible de charger la fiche pièce détachée.');
        } finally {
          setIsLoading(false);
        }
      };

      loadPieceData();
    }
  }, [isOpen, idPiece]);

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const errors = {};
    if (!formData.nom.trim()) {
      errors.nom = 'La désignation de la pièce est obligatoire.';
    } else if (formData.nom.trim().length > 100) {
      errors.nom = 'Le nom ne peut pas dépasser 100 caractères.';
    }

    const prix = parseFloat(formData.prix_unitaire);
    if (isNaN(prix) || prix < 0) {
      errors.prix_unitaire = 'Le prix unitaire doit être un nombre positif ou nul.';
    }

    const stock = parseInt(formData.quantite_stock, 10);
    if (isNaN(stock) || stock < 0) {
      errors.quantite_stock = 'La quantité en stock doit être un entier positif ou nul.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveUpdate = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const payload = {
        nom: formData.nom.trim(),
        prix_unitaire: parseFloat(formData.prix_unitaire),
        quantite_stock: parseInt(formData.quantite_stock, 10),
      };

      const updated = await pieceService.update(idPiece, payload);
      setPiece(updated);
      setIsEditing(false);
      if (onUpdated) onUpdated(updated);
    } catch (err) {
      console.error('Erreur mise à jour pièce détachée :', err);
      if (err.details && typeof err.details === 'object') {
        setFormErrors(err.details);
      }
      setErrorMessage(err.message || 'Impossible de mettre à jour la pièce détachée.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Êtes-vous sûr de vouloir supprimer définitivement la pièce "${piece.nom}" du catalogue ?`
      )
    ) {
      return;
    }

    setIsDeleting(true);
    setDeleteConflictError(null);

    try {
      await pieceService.delete(idPiece);
      if (onDeleted) onDeleted(idPiece);
      onClose();
    } catch (err) {
      console.error('Erreur suppression pièce détachée :', err);
      // Le backend renvoie 409 Conflict si la pièce est consommée dans des réparations
      setDeleteConflictError(
        err.message ||
          'Impossible de supprimer cette pièce détachée : elle a déjà été consommée dans une ou plusieurs réparations.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const totalValue = piece ? (piece.prix_unitaire || 0) * (piece.quantite_stock || 0) : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* En-tête */}
        <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900 truncate max-w-[240px]">
                  {piece?.nom || 'Fiche Pièce Détachée'}
                </h3>
                {piece && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-200/80 text-slate-700">
                    REF-#{piece.id_piece}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">Spécifications catalogue & valorisation de stock</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isResponsable && !isLoading && !isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Modifier</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Corps */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-5">
          {isLoading ? (
            <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
              <p className="text-xs font-medium text-slate-500">Chargement de la fiche article...</p>
            </div>
          ) : errorMessage && !piece ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          ) : (
            <>
              {/* Alerte Conflit de suppression */}
              {deleteConflictError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs space-y-1">
                  <div className="flex items-center space-x-2 font-bold text-rose-900">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>Suppression impossible (Historique d'intervention)</span>
                  </div>
                  <p className="pl-6">{deleteConflictError}</p>
                </div>
              )}

              {/* Mode édition */}
              {isEditing ? (
                <form onSubmit={handleSaveUpdate} className="space-y-4 bg-slate-50/60 p-4 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                    Modifier les caractéristiques
                  </h4>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Désignation de la pièce *
                    </label>
                    <input
                      type="text"
                      name="nom"
                      value={formData.nom}
                      onChange={handleInputChange}
                      maxLength={100}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900"
                    />
                    {formErrors.nom && <p className="text-[11px] text-rose-600 mt-1">{formErrors.nom}</p>}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Prix unitaire HT (TND) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name="prix_unitaire"
                        value={formData.prix_unitaire}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-mono text-slate-900"
                      />
                      {formErrors.prix_unitaire && (
                        <p className="text-[11px] text-rose-600 mt-1">{formErrors.prix_unitaire}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Quantité en stock *
                      </label>
                      <input
                        type="number"
                        min="0"
                        name="quantite_stock"
                        value={formData.quantite_stock}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-mono text-slate-900"
                      />
                      {formErrors.quantite_stock && (
                        <p className="text-[11px] text-rose-600 mt-1">{formErrors.quantite_stock}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      disabled={isSaving}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-900/20 transition-all disabled:opacity-50"
                    >
                      {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Enregistrer les modifications</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* Mode consultation */
                <div className="space-y-4">
                  {/* Cartes métriques de stock */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Prix Unitaire HT
                      </span>
                      <p className="text-xl font-black text-slate-900 font-mono mt-1">
                        {Number(piece.prix_unitaire).toFixed(2)} TND
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Disponibilité
                      </span>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-xl font-black text-slate-900 font-mono">
                          {piece.quantite_stock}
                        </span>
                        <PieceStockBadge quantite={piece.quantite_stock} size="small" />
                      </div>
                    </div>
                  </div>

                  {/* Valorisation du stock */}
                  <div className="p-3.5 bg-brand-50/60 rounded-xl border border-brand-100 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="w-4 h-4 text-brand-600" />
                      <div>
                        <span className="text-[11px] font-semibold text-brand-900 uppercase tracking-wider block">
                          Valeur totale en stock
                        </span>
                        <span className="text-xs text-brand-700">
                          {piece.quantite_stock} unité(s) × {Number(piece.prix_unitaire).toFixed(2)} TND
                        </span>
                      </div>
                    </div>
                    <span className="text-base font-black text-brand-800 font-mono">
                      {totalValue.toFixed(2)} TND
                    </span>
                  </div>

                  {/* Action d'approvisionnement rapide pour le Responsable */}
                  {isResponsable && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          if (onOpenStockManager) {
                            onOpenStockManager(piece);
                          }
                        }}
                        className="w-full inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors"
                      >
                        <Boxes className="w-4 h-4 text-brand-400" />
                        <span>Ajuster / Approvisionner le stock</span>
                      </button>
                    </div>
                  )}

                  {/* Zone Danger : Suppression pour le Responsable */}
                  {isResponsable && (
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-800">Supprimer du catalogue</p>
                        <p className="text-[11px] text-slate-500">
                          Uniquement si la pièce n'a jamais été consommée.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span>Supprimer</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PieceDetailModal;
