import React, { useState } from 'react';
import { X, UserPlus, AlertCircle, Loader2, Mail, Lock, Phone, Wrench, User } from 'lucide-react';
import mecanicienService from '../../services/mecanicienService';

const SPECIALITE_SUGGESTIONS = [
  'Moteur & Transmission',
  'Électronique & Diagnostic',
  'Freinage & Liaison au sol',
  'Carrosserie & Peinture',
  'Climatisation & Chauffage',
  'Entretien Général & Révision',
];

/**
 * Modale de création d'un profil mécanicien et de son compte utilisateur.
 * Réservé au profil RESPONSABLE.
 */
export const MecanicienCreateModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    mot_de_passe: '',
    specialite: 'Moteur & Transmission',
    telephone: '',
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

    if (!formData.email.trim()) {
      errors.email = "L'adresse email est obligatoire.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = "Format d'adresse email invalide.";
    } else if (formData.email.trim().length > 120) {
      errors.email = "L'email ne peut pas dépasser 120 caractères.";
    }

    if (!formData.mot_de_passe) {
      errors.mot_de_passe = 'Le mot de passe initial est obligatoire.';
    } else if (formData.mot_de_passe.length < 6) {
      errors.mot_de_passe = 'Le mot de passe doit comporter au moins 6 caractères.';
    }

    if (!formData.specialite.trim()) {
      errors.specialite = 'La spécialité est obligatoire.';
    } else if (formData.specialite.trim().length > 100) {
      errors.specialite = 'La spécialité ne peut pas dépasser 100 caractères.';
    }

    if (formData.telephone && formData.telephone.length > 20) {
      errors.telephone = 'Le numéro de téléphone ne peut pas dépasser 20 caractères.';
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
        prenom: formData.prenom.trim(),
        email: formData.email.trim().toLowerCase(),
        mot_de_passe: formData.mot_de_passe,
        specialite: formData.specialite.trim(),
        telephone: formData.telephone.trim() || null,
      };

      const newMecanicien = await mecanicienService.create(payload);
      onSuccess(newMecanicien);
      onClose();
    } catch (err) {
      console.error('Erreur création mécanicien :', err);
      if (err.details && typeof err.details === 'object') {
        setFormErrors(err.details);
      }
      setApiError(err.message || 'Impossible de créer le mécanicien.');
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
              <h3 className="text-base font-bold text-slate-900">Nouveau Mécanicien</h3>
              <p className="text-xs text-slate-500">Créer un compte utilisateur et un profil technique</p>
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

        {/* Alerte Erreur API */}
        {apiError && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
            <span>{apiError}</span>
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nom & Prénom */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nom de famille <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="nom"
                value={formData.nom}
                onChange={handleChange}
                placeholder="Ex: Martin"
                maxLength={50}
                className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                  formErrors.nom
                    ? 'border-rose-300 focus:ring-rose-400/20 text-rose-900'
                    : 'border-slate-200 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900'
                }`}
              />
              {formErrors.nom && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{formErrors.nom}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Prénom <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="prenom"
                value={formData.prenom}
                onChange={handleChange}
                placeholder="Ex: Thomas"
                maxLength={50}
                className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                  formErrors.prenom
                    ? 'border-rose-300 focus:ring-rose-400/20 text-rose-900'
                    : 'border-slate-200 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900'
                }`}
              />
              {formErrors.prenom && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{formErrors.prenom}</p>
              )}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Adresse email (Identifiant de connexion) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Ex: thomas.martin@garageflow.fr"
                maxLength={120}
                className={`w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                  formErrors.email
                    ? 'border-rose-300 focus:ring-rose-400/20 text-rose-900'
                    : 'border-slate-200 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900'
                }`}
              />
            </div>
            {formErrors.email && (
              <p className="text-[11px] text-rose-600 mt-1 font-medium">{formErrors.email}</p>
            )}
          </div>

          {/* Mot de passe initial */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mot de passe initial <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                name="mot_de_passe"
                value={formData.mot_de_passe}
                onChange={handleChange}
                placeholder="••••••••"
                className={`w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                  formErrors.mot_de_passe
                    ? 'border-rose-300 focus:ring-rose-400/20 text-rose-900'
                    : 'border-slate-200 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900'
                }`}
              />
            </div>
            {formErrors.mot_de_passe && (
              <p className="text-[11px] text-rose-600 mt-1 font-medium">
                {formErrors.mot_de_passe}
              </p>
            )}
          </div>

          {/* Spécialité */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Spécialité d'atelier <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Wrench className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                name="specialite"
                value={formData.specialite}
                onChange={handleChange}
                placeholder="Ex: Moteur & Transmission"
                maxLength={100}
                list="specialite-suggestions"
                className={`w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                  formErrors.specialite
                    ? 'border-rose-300 focus:ring-rose-400/20 text-rose-900'
                    : 'border-slate-200 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900'
                }`}
              />
              <datalist id="specialite-suggestions">
                {SPECIALITE_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            {formErrors.specialite && (
              <p className="text-[11px] text-rose-600 mt-1 font-medium">
                {formErrors.specialite}
              </p>
            )}
          </div>

          {/* Téléphone */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Numéro de téléphone <span className="text-slate-400 font-normal">(optionnel)</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                name="telephone"
                value={formData.telephone}
                onChange={handleChange}
                placeholder="Ex: 06 98 76 54 32"
                maxLength={20}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-mono text-slate-900"
              />
            </div>
            {formErrors.telephone && (
              <p className="text-[11px] text-rose-600 mt-1 font-medium">{formErrors.telephone}</p>
            )}
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
                  <span>Création en cours...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Créer le mécanicien</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MecanicienCreateModal;
