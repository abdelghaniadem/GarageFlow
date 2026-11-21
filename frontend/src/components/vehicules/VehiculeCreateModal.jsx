import React, { useState, useEffect } from 'react';
import { X, Car, AlertCircle, Loader2, User, Gauge, Calendar, Shield } from 'lucide-react';
import vehiculeService from '../../services/vehiculeService';
import clientService from '../../services/clientService';
import { validateTunisianPlate } from '../../utils/tunisia';

const ETAT_SUGGESTIONS = [
  'Neuf',
  'Excellent état',
  'Bon état',
  'État passable',
  'À réparer',
  'En panne',
  'Accidenté',
];

/**
 * Modale de création d'un véhicule.
 * Réservé au profil RESPONSABLE.
 */
export const VehiculeCreateModal = ({
  isOpen,
  onClose,
  onSuccess,
  initialClientId = null,
}) => {
  const [formData, setFormData] = useState({
    marque: '',
    modele: '',
    immatriculation: '',
    id_client: initialClientId ? String(initialClientId) : '',
    annee: '',
    kilometrage: '',
    etat: 'Bon état',
  });

  const [clients, setClients] = useState([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);

  // Charger la liste des clients pour le sélecteur
  useEffect(() => {
    if (isOpen) {
      const loadClients = async () => {
        setIsLoadingClients(true);
        try {
          const clientsList = await clientService.list();
          setClients(clientsList || []);
        } catch (err) {
          console.error('Erreur chargement clients pour modal véhicule :', err);
        } finally {
          setIsLoadingClients(false);
        }
      };
      loadClients();
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialClientId) {
      setFormData((prev) => ({ ...prev, id_client: String(initialClientId) }));
    }
  }, [initialClientId]);

  if (!isOpen) return null;

  const validate = () => {
    const errors = {};
    if (!formData.marque.trim()) {
      errors.marque = 'La marque est obligatoire.';
    } else if (formData.marque.trim().length > 50) {
      errors.marque = 'La marque ne peut pas dépasser 50 caractères.';
    }

    if (!formData.modele.trim()) {
      errors.modele = 'Le modèle est obligatoire.';
    } else if (formData.modele.trim().length > 50) {
      errors.modele = 'Le modèle ne peut pas dépasser 50 caractères.';
    }

    const plateCheck = validateTunisianPlate(formData.immatriculation);
    if (!plateCheck.isValid) {
      errors.immatriculation = plateCheck.error;
    }

    if (!formData.id_client) {
      errors.id_client = 'Veuillez sélectionner le client propriétaire.';
    }

    if (formData.annee) {
      const anneeNum = parseInt(formData.annee, 10);
      if (isNaN(anneeNum) || anneeNum < 1900 || anneeNum > 2100) {
        errors.annee = "L'année doit être comprise entre 1900 et 2100.";
      }
    }

    if (formData.kilometrage) {
      const kmNum = parseInt(formData.kilometrage, 10);
      if (isNaN(kmNum) || kmNum < 0) {
        errors.kilometrage = 'Le kilométrage doit être un nombre positif ou nul.';
      }
    }

    if (formData.etat && formData.etat.length > 30) {
      errors.etat = "L'état ne peut pas dépasser 30 caractères.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Immatriculation en majuscules automatique
    const val = name === 'immatriculation' ? value.toUpperCase() : value;
    setFormData((prev) => ({ ...prev, [name]: val }));
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
      const plateCheck = validateTunisianPlate(formData.immatriculation);
      const payload = {
        marque: formData.marque.trim(),
        modele: formData.modele.trim(),
        immatriculation: plateCheck.normalized || formData.immatriculation.trim(),
        id_client: parseInt(formData.id_client, 10),
        annee: formData.annee ? parseInt(formData.annee, 10) : null,
        kilometrage: formData.kilometrage ? parseInt(formData.kilometrage, 10) : null,
        etat: formData.etat.trim() || null,
      };

      const newVehicule = await vehiculeService.create(payload);
      onSuccess(newVehicule);
      onClose();
    } catch (err) {
      console.error('Erreur création véhicule :', err);
      if (err.details && typeof err.details === 'object') {
        setFormErrors(err.details);
      }
      setApiError(err.message || 'Impossible de créer le véhicule.');
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
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Nouveau Véhicule</h3>
              <p className="text-xs text-slate-500">Ajouter un véhicule et l'associer à un client</p>
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
          {/* Client propriétaire */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Propriétaire (Client) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                name="id_client"
                value={formData.id_client}
                onChange={handleChange}
                disabled={Boolean(initialClientId) || isLoadingClients}
                className={`w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                  formErrors.id_client
                    ? 'border-rose-300 focus:ring-rose-400/20 text-rose-900'
                    : 'border-slate-200 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900'
                }`}
              >
                <option value="">Sélectionner un client...</option>
                {clients.map((c) => (
                  <option key={c.id_client} value={c.id_client}>
                    {c.nom} {c.prenom} — {c.telephone}
                  </option>
                ))}
              </select>
            </div>
            {formErrors.id_client && (
              <p className="text-[11px] text-rose-600 mt-1 font-medium">{formErrors.id_client}</p>
            )}
          </div>

          {/* Immatriculation */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Numéro d'immatriculation (Tunisie) <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => {
                    const current = formData.immatriculation || '';
                    if (!current.includes('تونس')) {
                      setFormData((prev) => ({
                        ...prev,
                        immatriculation: current ? `${current.trim()} تونس ` : ' تونس ',
                      }));
                    }
                  }}
                  className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                  title="Insérer le mot تونس"
                >
                  + تونس
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const current = formData.immatriculation || '';
                    if (!current.toUpperCase().includes('TU')) {
                      setFormData((prev) => ({
                        ...prev,
                        immatriculation: current ? `${current.trim()} TU ` : ' TU ',
                      }));
                    }
                  }}
                  className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                  title="Insérer le format TU"
                >
                  + TU
                </button>
              </div>
            </div>
            <input
              type="text"
              name="immatriculation"
              value={formData.immatriculation}
              onChange={handleChange}
              placeholder="Ex: 215 تونس 4589 ou 215 TU 4589"
              maxLength={30}
              className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 font-mono uppercase tracking-wider font-bold transition-all ${
                formErrors.immatriculation
                  ? 'border-rose-300 focus:ring-rose-400/20 text-rose-900'
                  : 'border-slate-200 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900'
              }`}
            />
            {formErrors.immatriculation && (
              <p className="text-[11px] text-rose-600 mt-1 font-medium">
                {formErrors.immatriculation}
              </p>
            )}
            <p className="text-[10px] text-slate-400 mt-1">
              Format ordinaire : <strong>123 تونس 4567</strong> ou <strong>123 TU 4567</strong>.
            </p>
          </div>

          {/* Marque & Modèle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Marque <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="marque"
                value={formData.marque}
                onChange={handleChange}
                placeholder="Ex: Renault"
                maxLength={50}
                className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                  formErrors.marque
                    ? 'border-rose-300 focus:ring-rose-400/20 text-rose-900'
                    : 'border-slate-200 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900'
                }`}
              />
              {formErrors.marque && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{formErrors.marque}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Modèle <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="modele"
                value={formData.modele}
                onChange={handleChange}
                placeholder="Ex: Clio IV"
                maxLength={50}
                className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                  formErrors.modele
                    ? 'border-rose-300 focus:ring-rose-400/20 text-rose-900'
                    : 'border-slate-200 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900'
                }`}
              />
              {formErrors.modele && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{formErrors.modele}</p>
              )}
            </div>
          </div>

          {/* Année & Kilométrage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Année de mise en circulation
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  name="annee"
                  value={formData.annee}
                  onChange={handleChange}
                  placeholder="Ex: 2018"
                  min={1900}
                  max={2100}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-mono text-slate-900"
                />
              </div>
              {formErrors.annee && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{formErrors.annee}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kilométrage actuel (km)
              </label>
              <div className="relative">
                <Gauge className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  name="kilometrage"
                  value={formData.kilometrage}
                  onChange={handleChange}
                  placeholder="Ex: 85000"
                  min={0}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-mono text-slate-900"
                />
              </div>
              {formErrors.kilometrage && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">
                  {formErrors.kilometrage}
                </p>
              )}
            </div>
          </div>

          {/* État du véhicule */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              État général
            </label>
            <input
              type="text"
              name="etat"
              value={formData.etat}
              onChange={handleChange}
              placeholder="Ex: Bon état, À réparer..."
              maxLength={30}
              list="etat-suggestions"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900"
            />
            <datalist id="etat-suggestions">
              {ETAT_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {formErrors.etat && (
              <p className="text-[11px] text-rose-600 mt-1 font-medium">{formErrors.etat}</p>
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
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Car className="w-4 h-4" />
                  <span>Enregistrer le véhicule</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VehiculeCreateModal;
