import React, { useState } from 'react';
import { X, UserPlus, AlertCircle, Loader2, Phone, MapPin, User } from 'lucide-react';
import clientService from '../../services/clientService';
import { validateTunisianPhone } from '../../utils/tunisia';

/**
 * Modale de création d'un client.
 * Réservé au profil RESPONSABLE.
 *
 * Champs :
 * - nom: string (1-50, obligatoire)
 * - prenom: string (1-50, obligatoire)
 * - telephone: string (1-20, obligatoire)
 * - adresse: string (max 150, facultatif)
 * (NOTE: Pas d'email dans la table client PostgreSQL)
 */
export const ClientCreateModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    adresse: '',
  });

  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);

  if (!isOpen) return null;

  const validate = () => {
    const errors = {};
    if (!formData.nom.trim()) {
      errors.nom = 'Le nom de famille est obligatoire.';
    } else if (formData.nom.trim().length > 50) {
      errors.nom = 'Le nom ne peut pas dépasser 50 caractères.';
    }

    if (!formData.prenom.trim()) {
      errors.prenom = 'Le prénom est obligatoire.';
    } else if (formData.prenom.trim().length > 50) {
      errors.prenom = 'Le prénom ne peut pas dépasser 50 caractères.';
    }

    const phoneValidation = validateTunisianPhone(formData.telephone);
    if (!phoneValidation.isValid) {
      errors.telephone = phoneValidation.error;
    }

    if (formData.adresse && formData.adresse.length > 150) {
      errors.adresse = "L'adresse ne peut pas dépasser 150 caractères.";
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
      const phoneValidation = validateTunisianPhone(formData.telephone);
      const payload = {
        nom: formData.nom.trim(),
        prenom: formData.prenom.trim(),
        telephone: phoneValidation.normalized || formData.telephone.trim(),
        adresse: formData.adresse.trim() || null,
      };

      const newClient = await clientService.create(payload);
      onSuccess(newClient);
      onClose();
    } catch (err) {
      console.error('Erreur création client :', err);
      if (err.details && typeof err.details === 'object') {
        setFormErrors(err.details);
      }
      setApiError(err.message || 'Impossible de créer le client.');
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
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Nouveau Client</h3>
              <p className="text-xs text-slate-500">Ajouter un profil client à la base atelier</p>
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

        {/* Message d'erreur global API */}
        {apiError && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
            <span>{apiError}</span>
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nom */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nom de famille <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="nom"
                  value={formData.nom}
                  onChange={handleChange}
                  placeholder="Ex: Ben Salem"
                  maxLength={50}
                  className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 transition-all ${
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

            {/* Prénom */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Prénom <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="prenom"
                  value={formData.prenom}
                  onChange={handleChange}
                  placeholder="Ex: Mohamed"
                  maxLength={50}
                  className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                    formErrors.prenom
                      ? 'border-rose-300 focus:ring-rose-400/20 text-rose-900'
                      : 'border-slate-200 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900'
                  }`}
                />
              </div>
              {formErrors.prenom && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{formErrors.prenom}</p>
              )}
            </div>
          </div>

          {/* Téléphone */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Numéro de téléphone <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-500 font-normal">8 chiffres (ex: 98 123 456 ou +216 98 123 456)</span>
            </div>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                name="telephone"
                value={formData.telephone}
                onChange={handleChange}
                placeholder="Ex: 98 123 456 ou +216 98 123 456"
                maxLength={20}
                className={`w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 transition-all font-mono ${
                  formErrors.telephone
                    ? 'border-rose-300 focus:ring-rose-400/20 text-rose-900'
                    : 'border-slate-200 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900'
                }`}
              />
            </div>
            {formErrors.telephone && (
              <p className="text-[11px] text-rose-600 mt-1 font-medium">{formErrors.telephone}</p>
            )}
          </div>

          {/* Adresse postale */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Adresse postale <span className="text-slate-400 font-normal">(optionnel)</span>
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <textarea
                name="adresse"
                rows={2}
                value={formData.adresse}
                onChange={handleChange}
                placeholder="Ex: 15 Avenue Habib Bourguiba, Tunis"
                maxLength={150}
                className={`w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 transition-all resize-none ${
                  formErrors.adresse
                    ? 'border-rose-300 focus:ring-rose-400/20 text-rose-900'
                    : 'border-slate-200 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900'
                }`}
              />
            </div>
            <div className="flex justify-between items-center mt-1">
              {formErrors.adresse ? (
                <p className="text-[11px] text-rose-600 font-medium">{formErrors.adresse}</p>
              ) : (
                <span />
              )}
              <span className="text-[10px] text-slate-400">{formData.adresse.length}/150</span>
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
                  <UserPlus className="w-4 h-4" />
                  <span>Enregistrer le client</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClientCreateModal;
