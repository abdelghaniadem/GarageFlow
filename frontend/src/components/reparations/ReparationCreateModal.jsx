import React, { useState, useEffect } from 'react';
import { X, Wrench, AlertCircle, Loader2, Calendar, User, Car } from 'lucide-react';
import reparationService from '../../services/reparationService';
import vehiculeService from '../../services/vehiculeService';
import clientService from '../../services/clientService';
import mecanicienService from '../../services/mecanicienService';

/**
 * Modal de création d'une réparation (Réservé au profil RESPONSABLE).
 */
export const ReparationCreateModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    description: '',
    date_reparation: new Date().toISOString().split('T')[0],
    statut: 'EN_ATTENTE',
    id_vehicule: '',
    id_mecanicien: '',
    diagnostic: '',
    travail_effectue: '',
    cout: '',
    kilometrage: '',
  });

  const [clients, setClients] = useState([]);
  const [vehicules, setVehicules] = useState([]);
  const [mecaniciens, setMecaniciens] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');

  const [isLoadingReferences, setIsLoadingReferences] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Charger les données référentielles à l'ouverture
  useEffect(() => {
    if (isOpen) {
      const loadRefs = async () => {
        setIsLoadingReferences(true);
        setErrorMessage(null);
        try {
          const [clientsData, vehiculesData, mecaniciensData] = await Promise.all([
            clientService.list(),
            vehiculeService.list(),
            mecanicienService.list(),
          ]);
          setClients(clientsData || []);
          setVehicules(vehiculesData || []);
          setMecaniciens(mecaniciensData || []);
        } catch (err) {
          console.error('Erreur chargement référentiels :', err);
          setErrorMessage(err.message || 'Impossible de charger la liste des clients ou véhicules.');
        } finally {
          setIsLoadingReferences(false);
        }
      };
      loadRefs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filtrage des véhicules si un client spécifique est sélectionné
  const filteredVehicules = selectedClientId
    ? vehicules.filter((v) => String(v.id_client) === String(selectedClientId))
    : vehicules;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleVehicleChange = (e) => {
    const vehId = e.target.value;
    setFormData((prev) => ({ ...prev, id_vehicule: vehId }));

    // Synchronisation automatique du client lié au véhicule
    if (vehId) {
      const foundVeh = vehicules.find((v) => String(v.id_vehicule) === String(vehId));
      if (foundVeh && foundVeh.id_client) {
        setSelectedClientId(String(foundVeh.id_client));
        // Si le véhicule possède un kilométrage enregistré, on le préremplit
        if (foundVeh.kilometrage && !formData.kilometrage) {
          setFormData((prev) => ({ ...prev, kilometrage: String(foundVeh.kilometrage) }));
        }
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.description.trim()) {
      setErrorMessage('La description de la panne ou intervention est obligatoire.');
      return;
    }
    if (!formData.id_vehicule) {
      setErrorMessage('Veuillez sélectionner un véhicule.');
      return;
    }
    if (!formData.id_mecanicien) {
      setErrorMessage('Veuillez affecter un mécanicien.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        description: formData.description.trim(),
        date_reparation: formData.date_reparation,
        statut: formData.statut,
        id_vehicule: parseInt(formData.id_vehicule, 10),
        id_mecanicien: parseInt(formData.id_mecanicien, 10),
        diagnostic: formData.diagnostic.trim() || null,
        travail_effectue: formData.travail_effectue.trim() || null,
        cout: formData.cout ? parseFloat(formData.cout) : null,
        kilometrage: formData.kilometrage ? parseInt(formData.kilometrage, 10) : null,
      };

      const created = await reparationService.create(payload);
      if (onSuccess) {
        onSuccess(created);
      }
      onClose();
    } catch (err) {
      if (err.details && typeof err.details === 'object') {
        const detailsList = Object.entries(err.details)
          .map(([key, msgs]) => `${key}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
          .join(' | ');
        setErrorMessage(err.message ? `${err.message} (${detailsList})` : detailsList);
      } else {
        setErrorMessage(err.message || 'Erreur lors de la création de la réparation.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* En-tête de la modale */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-brand-600 text-white">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Créer un Ordre de Réparation</h2>
              <p className="text-xs text-slate-400">Nouvelle fiche d'intervention d'atelier</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps du formulaire */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isLoadingReferences && (
            <div className="p-3 bg-sky-50 rounded-lg text-brand-700 flex items-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
              <span>Chargement des clients, véhicules et mécaniciens...</span>
            </div>
          )}

          {/* Section 1 : Sélection Client & Véhicule */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Client (Optionnel pour filtrer)
              </label>
              <div className="relative">
                <select
                  value={selectedClientId}
                  onChange={(e) => {
                    setSelectedClientId(e.target.value);
                    setFormData((prev) => ({ ...prev, id_vehicule: '' }));
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                >
                  <option value="">-- Tous les clients --</option>
                  {clients.map((c) => (
                    <option key={c.id_client} value={c.id_client}>
                      {c.prenom} {c.nom} ({c.telephone})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Véhicule concerné *
              </label>
              <select
                name="id_vehicule"
                value={formData.id_vehicule}
                onChange={handleVehicleChange}
                required
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              >
                <option value="">-- Sélectionner un véhicule --</option>
                {filteredVehicules.map((v) => (
                  <option key={v.id_vehicule} value={v.id_vehicule}>
                    {v.immatriculation} — {v.marque} {v.modele}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 2 : Mécanicien & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Mécanicien assigné *
              </label>
              <select
                name="id_mecanicien"
                value={formData.id_mecanicien}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              >
                <option value="">-- Choisir un mécanicien --</option>
                {mecaniciens.map((m) => {
                  const nomComplet = m.utilisateur
                    ? `${m.utilisateur.prenom} ${m.utilisateur.nom}`
                    : `Mécanicien #${m.id_mecanicien}`;
                  return (
                    <option key={m.id_mecanicien} value={m.id_mecanicien}>
                      {nomComplet} ({m.specialite})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Date d'intervention *
              </label>
              <input
                type="date"
                name="date_reparation"
                value={formData.date_reparation}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
          </div>

          {/* Section 3 : Description de l'intervention */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1">
              Description de l'intervention / Problème constaté *
            </label>
            <textarea
              name="description"
              rows="2"
              value={formData.description}
              onChange={handleChange}
              placeholder="Ex : Révision des 60 000 km, claquement frein avant droit..."
              required
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>

          {/* Section 4 : Statut & Valeurs chiffrées */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Statut initial
              </label>
              <select
                name="statut"
                value={formData.statut}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              >
                <option value="EN_ATTENTE">En attente</option>
                <option value="EN_COURS">En cours</option>
                <option value="EN_DIAGNOSTIC">Diagnostic</option>
                <option value="EN_REPARATION">En réparation</option>
                <option value="TERMINEE">Terminée</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Coût main-d'œuvre (TND)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="cout"
                value={formData.cout}
                onChange={handleChange}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Kilométrage actuel
              </label>
              <input
                type="number"
                min="0"
                name="kilometrage"
                value={formData.kilometrage}
                onChange={handleChange}
                placeholder="Ex : 124500"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
          </div>

          {/* Section 5 : Diagnostic & Travail initial */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Diagnostic initial (Optionnel)
              </label>
              <textarea
                name="diagnostic"
                rows="2"
                value={formData.diagnostic}
                onChange={handleChange}
                placeholder="Constats préliminaires..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Travaux prévus (Optionnel)
              </label>
              <textarea
                name="travail_effectue"
                rows="2"
                value={formData.travail_effectue}
                onChange={handleChange}
                placeholder="Opérations planifiées..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
          </div>

          {/* Pied de formulaire */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center space-x-2 px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white font-semibold shadow-md shadow-brand-900/20 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Création en cours...</span>
                </>
              ) : (
                <span>Créer l'ordre de réparation</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReparationCreateModal;
