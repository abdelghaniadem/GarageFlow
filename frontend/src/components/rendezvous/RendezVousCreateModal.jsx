import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  Clock,
  User,
  Car,
  FileText,
  AlertCircle,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import rendezVousService from '../../services/rendezVousService';
import { RENDEZ_VOUS_STATUSES } from '../../utils/constants';

/**
 * Modal de planification d'un nouveau rendez-vous d'atelier.
 * Réservé exclusivement au profil RESPONSABLE.
 */
export const RendezVousCreateModal = ({
  isOpen,
  onClose,
  onSuccess,
  clients = [],
  vehicules = [],
  existingRendezVous = [],
}) => {
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedVehiculeId, setSelectedVehiculeId] = useState('');
  const [dateRendezVous, setDateRendezVous] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [heure, setHeure] = useState('09:00');
  const [motif, setMotif] = useState('');
  const [statut, setStatut] = useState(RENDEZ_VOUS_STATUSES.PLANIFIE);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Réinitialisation du formulaire à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setSelectedClientId('');
      setSelectedVehiculeId('');
      setDateRendezVous(new Date().toISOString().split('T')[0]);
      setHeure('09:00');
      setMotif('');
      setStatut(RENDEZ_VOUS_STATUSES.PLANIFIE);
      setErrorMessage(null);
      setFieldErrors({});
    }
  }, [isOpen]);

  // Véhicules appartenant STRICTEMENT au client sélectionné
  const availableVehicules = useMemo(() => {
    if (!selectedClientId) return [];
    return vehicules.filter((v) => String(v.id_client) === String(selectedClientId));
  }, [selectedClientId, vehicules]);

  // Si le client sélectionné change, on réinitialise ou ajuste le véhicule
  const handleClientChange = (clientId) => {
    setSelectedClientId(clientId);
    setFieldErrors((prev) => ({ ...prev, id_client: null, id_vehicule: null }));

    // Si le client a exactement 1 véhicule, on le présélectionne automatiquement
    const clientVehicules = vehicules.filter((v) => String(v.id_client) === String(clientId));
    if (clientVehicules.length === 1) {
      setSelectedVehiculeId(String(clientVehicules[0].id_vehicule));
    } else {
      setSelectedVehiculeId('');
    }
  };

  // Détection de conflit de créneau d'atelier (avertissement préventif)
  const slotConflict = useMemo(() => {
    if (!dateRendezVous || !heure) return null;
    const formattedTime = heure.length === 5 ? `${heure}:00` : heure;
    const conflict = existingRendezVous.find((r) => {
      if (r.date_rendezvous !== dateRendezVous) return false;
      const rHeure = (r.heure || '').slice(0, 5);
      const inputHeure = heure.slice(0, 5);
      return rHeure === inputHeure && (r.statut || '').toUpperCase() !== 'ANNULE';
    });
    return conflict || null;
  }, [dateRendezVous, heure, existingRendezVous]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    // Validations locales
    const errors = {};
    if (!selectedClientId) {
      errors.id_client = 'Veuillez sélectionner un client.';
    }
    if (!selectedVehiculeId) {
      errors.id_vehicule = 'Veuillez sélectionner un véhicule appartenant au client.';
    }
    if (!dateRendezVous) {
      errors.date_rendezvous = 'La date du rendez-vous est obligatoire.';
    }
    if (!heure) {
      errors.heure = 'L\'heure du rendez-vous est obligatoire.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        id_client: Number(selectedClientId),
        id_vehicule: Number(selectedVehiculeId),
        date_rendezvous: dateRendezVous,
        heure: heure.length === 5 ? heure : heure.slice(0, 5),
        motif: motif.trim() ? motif.trim() : null,
        statut: statut,
      };

      const newRdv = await rendezVousService.create(payload);
      onSuccess(newRdv);
      onClose();
    } catch (err) {
      console.error('Erreur planification rendez-vous :', err);
      if (err.status === 422 || err.details) {
        setErrorMessage(
          err.message || 'Données invalides ou incohérentes pour la planification.'
        );
        if (err.details && typeof err.details === 'object') {
          setFieldErrors(err.details);
        }
      } else {
        setErrorMessage(err.message || 'Impossible de planifier le rendez-vous.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Planifier un rendez-vous
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Attribution du créneau d'atelier pour le véhicule du client
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-150 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message d'erreur global */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Avertissement de conflit préventif */}
        {slotConflict && (
          <div className="mx-6 mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Créneau d'atelier déjà sollicité</span>
              Un rendez-vous (#{slotConflict.id_rendezvous}) est déjà prévu le {dateRendezVous} à {heure}.
              Vous pouvez néanmoins valider si plusieurs ponts d'atelier sont disponibles.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Sélection du client */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Client concerné <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={selectedClientId}
                onChange={(e) => handleClientChange(e.target.value)}
                className={`w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border ${
                  fieldErrors.id_client
                    ? 'border-rose-500 focus:ring-rose-500'
                    : 'border-slate-200 dark:border-slate-700 focus:border-brand-500'
                } rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30`}
              >
                <option value="">-- Sélectionner un client --</option>
                {clients.map((c) => (
                  <option key={c.id_client} value={c.id_client}>
                    {c.prenom} {c.nom} {c.telephone ? `(${c.telephone})` : ''}
                  </option>
                ))}
              </select>
            </div>
            {fieldErrors.id_client && (
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                {Array.isArray(fieldErrors.id_client) ? fieldErrors.id_client[0] : fieldErrors.id_client}
              </p>
            )}
          </div>

          {/* Sélection du véhicule (strictement lié au client) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Véhicule du client <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={selectedVehiculeId}
                onChange={(e) => {
                  setSelectedVehiculeId(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, id_vehicule: null }));
                }}
                disabled={!selectedClientId}
                className={`w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border ${
                  fieldErrors.id_vehicule
                    ? 'border-rose-500 focus:ring-rose-500'
                    : 'border-slate-200 dark:border-slate-700 focus:border-brand-500'
                } rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <option value="">
                  {!selectedClientId
                    ? '-- Sélectionnez d\'abord un client --'
                    : availableVehicules.length === 0
                    ? '-- Aucun véhicule enregistré pour ce client --'
                    : '-- Sélectionner un véhicule du client --'}
                </option>
                {availableVehicules.map((v) => (
                  <option key={v.id_vehicule} value={v.id_vehicule}>
                    {v.marque} {v.modele} [{v.immatriculation}]
                  </option>
                ))}
              </select>
            </div>
            {fieldErrors.id_vehicule && (
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                {Array.isArray(fieldErrors.id_vehicule)
                  ? fieldErrors.id_vehicule[0]
                  : fieldErrors.id_vehicule}
              </p>
            )}
          </div>

          {/* Date et Heure */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Date du rendez-vous <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={dateRendezVous}
                onChange={(e) => setDateRendezVous(e.target.value)}
                className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border ${
                  fieldErrors.date_rendezvous
                    ? 'border-rose-500'
                    : 'border-slate-200 dark:border-slate-700'
                } rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30`}
              />
              {fieldErrors.date_rendezvous && (
                <p className="mt-1 text-xs text-rose-600">
                  {Array.isArray(fieldErrors.date_rendezvous)
                    ? fieldErrors.date_rendezvous[0]
                    : fieldErrors.date_rendezvous}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Heure <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                value={heure}
                onChange={(e) => setHeure(e.target.value)}
                step="900"
                className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border ${
                  fieldErrors.heure
                    ? 'border-rose-500'
                    : 'border-slate-200 dark:border-slate-700'
                } rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30`}
              />
              {fieldErrors.heure && (
                <p className="mt-1 text-xs text-rose-600">
                  {Array.isArray(fieldErrors.heure) ? fieldErrors.heure[0] : fieldErrors.heure}
                </p>
              )}
            </div>
          </div>

          {/* Motif / Raison de la visite */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Motif de l'intervention ou observation
            </label>
            <textarea
              rows={3}
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Ex: Révision générale, bruit anormal au freinage, vidange + filtres..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>

          {/* Statut initial */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Statut initial du rendez-vous
            </label>
            <select
              value={statut}
              onChange={(e) => setStatut(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              <option value={RENDEZ_VOUS_STATUSES.PLANIFIE}>Planifié (créneau réservé)</option>
              <option value={RENDEZ_VOUS_STATUSES.CONFIRME}>Confirmé par le client</option>
              <option value={RENDEZ_VOUS_STATUSES.EN_ATTENTE}>En attente de confirmation</option>
            </select>
          </div>

          {/* Boutons d'action */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-700/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedClientId || !selectedVehiculeId}
              className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4" />
                  <span>Confirmer le rendez-vous</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RendezVousCreateModal;
