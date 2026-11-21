import React, { useState } from 'react';
import { X, PackagePlus, AlertCircle, Loader2, Tag, DollarSign, Layers } from 'lucide-react';
import pieceService from '../../services/pieceService';

/**
 * Modale de création d'une nouvelle pièce détachée dans le catalogue.
 * Réservé au profil RESPONSABLE.
 *
 * Champs supportés par le backend :
 * - nom : string (1..100, obligatoire, unique)
 * - prix_unitaire : float / decimal (>= 0, obligatoire)
 * - quantite_stock : integer (>= 0, obligatoire)
 */
export const PieceCreateModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    nom: '',
    prix_unitaire: '',
    quantite_stock: '10',
  });

  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);

  if (!isOpen) return null;

  const validate = () => {
    const errors = {};
    if (!formData.nom.trim()) {
      errors.nom = 'La désignation de la pièce est obligatoire.';
    } else if (formData.nom.trim().length > 100) {
      errors.nom = 'Le nom ne peut pas dépasser 100 caractères.';
    }

    if (formData.prix_unitaire === '' || formData.prix_unitaire === null) {
      errors.prix_unitaire = 'Le prix unitaire est obligatoire.';
    } else {
      const prix = parseFloat(formData.prix_unitaire);
      if (isNaN(prix) || prix < 0) {
        errors.prix_unitaire = 'Le prix unitaire doit être un nombre positif ou nul.';
      }
    }

    if (formData.quantite_stock === '' || formData.quantite_stock === null) {
      errors.quantite_stock = 'La quantité en stock est obligatoire.';
    } else {
      const stock = parseInt(formData.quantite_stock, 10);
      if (isNaN(stock) || stock < 0) {
        errors.quantite_stock = 'La quantité en stock doit être un entier positif ou nul.';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        nom: formData.nom.trim(),
        prix_unitaire: parseFloat(formData.prix_unitaire),
        quantite_stock: parseInt(formData.quantite_stock, 10),
      };

      const newPiece = await pieceService.create(payload);
      onSuccess(newPiece);
      onClose();
    } catch (err) {
      console.error('Erreur création pièce détachée :', err);
      if (err.details && typeof err.details === 'object') {
        setFormErrors(err.details);
      }
      setApiError(err.message || 'Impossible de créer la pièce détachée.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* En-tête */}
        <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Nouvelle Pièce Détachée</h3>
              <p className="text-xs text-slate-500">Ajouter une référence au catalogue d'atelier</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message d'erreur API */}
        {apiError && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
            <span>{apiError}</span>
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nom / Désignation */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Désignation de la pièce <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                name="nom"
                value={formData.nom}
                onChange={handleChange}
                placeholder="Ex: Filtre à huile Purflux LS932, Plaquettes de frein avant..."
                maxLength={100}
                className={`w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                  formErrors.nom
                    ? 'border-rose-300 focus:ring-rose-400/20 text-rose-900'
                    : 'border-slate-200 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900'
                }`}
              />
            </div>
            {formErrors.nom && (
              <p className="text-[11px] text-rose-600 mt-1 font-medium">{formErrors.nom}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Prix unitaire */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Prix unitaire HT (TND) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="prix_unitaire"
                  value={formData.prix_unitaire}
                  onChange={handleChange}
                  placeholder="Ex: 24.50"
                  className={`w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 font-mono transition-all ${
                    formErrors.prix_unitaire
                      ? 'border-rose-300 focus:ring-rose-400/20 text-rose-900'
                      : 'border-slate-200 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900'
                  }`}
                />
              </div>
              {formErrors.prix_unitaire && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">
                  {formErrors.prix_unitaire}
                </p>
              )}
            </div>

            {/* Quantité initiale en stock */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Stock initial (unités) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Layers className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="0"
                  name="quantite_stock"
                  value={formData.quantite_stock}
                  onChange={handleChange}
                  placeholder="Ex: 10"
                  className={`w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 font-mono transition-all ${
                    formErrors.quantite_stock
                      ? 'border-rose-300 focus:ring-rose-400/20 text-rose-900'
                      : 'border-slate-200 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900'
                  }`}
                />
              </div>
              {formErrors.quantite_stock && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">
                  {formErrors.quantite_stock}
                </p>
              )}
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-900/20 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <PackagePlus className="w-4 h-4" />
                  <span>Créer la pièce</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PieceCreateModal;
