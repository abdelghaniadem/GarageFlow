import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Receipt,
  AlertCircle,
  Loader2,
  Calendar,
  User,
  Car,
  Wrench,
  DollarSign,
  Package,
  Info,
  CheckCircle2,
} from 'lucide-react';
import factureService from '../../services/factureService';
import reparationService from '../../services/reparationService';
import { FACTURE_STATUSES } from '../../utils/constants';

/**
 * Modal d'émission d'une nouvelle facture pour une réparation éligible.
 * Réservé exclusivement au profil RESPONSABLE.
 */
export const FactureCreateModal = ({
  isOpen,
  onClose,
  onSuccess,
  reparations = [],
  vehiculesMap = {},
  clientsMap = {},
  existingFactures = [],
}) => {
  const [selectedReparationId, setSelectedReparationId] = useState('');
  const [dateFacture, setDateFacture] = useState(new Date().toISOString().split('T')[0]);
  const [statutPaiement, setStatutPaiement] = useState(FACTURE_STATUSES.EN_ATTENTE);

  const [pieces, setPieces] = useState([]);
  const [isLoadingPieces, setIsLoadingPieces] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Liste des identifiants de réparations déjà facturées (contrainte 1:1)
  const invoicedReparationIds = useMemo(() => {
    const set = new Set();
    existingFactures.forEach((f) => {
      if (f.id_reparation) {
        set.add(Number(f.id_reparation));
      }
    });
    return set;
  }, [existingFactures]);

  // Réparations éligibles (non encore facturées)
  const eligibleReparations = useMemo(() => {
    return reparations.filter((r) => !invoicedReparationIds.has(Number(r.id_reparation)));
  }, [reparations, invoicedReparationIds]);

  // Réparation actuellement sélectionnée
  const selectedReparation = useMemo(() => {
    if (!selectedReparationId) return null;
    return reparations.find((r) => String(r.id_reparation) === String(selectedReparationId)) || null;
  }, [selectedReparationId, reparations]);

  // Véhicule et client associés
  const associatedVehicule = useMemo(() => {
    if (!selectedReparation?.id_vehicule) return null;
    return vehiculesMap[selectedReparation.id_vehicule] || null;
  }, [selectedReparation, vehiculesMap]);

  const associatedClient = useMemo(() => {
    if (!associatedVehicule?.id_client) return null;
    return clientsMap[associatedVehicule.id_client] || null;
  }, [associatedVehicule, clientsMap]);

  // Réinitialisation du formulaire à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setSelectedReparationId('');
      setDateFacture(new Date().toISOString().split('T')[0]);
      setStatutPaiement(FACTURE_STATUSES.EN_ATTENTE);
      setPieces([]);
      setErrorMessage(null);
      setFieldErrors({});
    }
  }, [isOpen]);

  // Chargement des pièces associées à la réparation sélectionnée
  useEffect(() => {
    if (selectedReparationId) {
      const loadPieces = async () => {
        setIsLoadingPieces(true);
        try {
          const piecesData = await reparationService.listPieces(selectedReparationId);
          setPieces(piecesData || []);
        } catch (err) {
          console.error('Erreur chargement pièces réparation :', err);
          setPieces([]);
        } finally {
          setIsLoadingPieces(false);
        }
      };
      loadPieces();
    } else {
      setPieces([]);
    }
  }, [selectedReparationId]);

  // Calculs prévisionnels des montants
  const coutMainOeuvre = Number(selectedReparation?.cout || 0);
  const coutPieces = useMemo(() => {
    return pieces.reduce((total, p) => {
      const unit = Number(p.prix_unitaire || 0);
      const qty = Number(p.quantite || 0);
      return total + unit * qty;
    }, 0);
  }, [pieces]);
  const montantTotalEstime = coutMainOeuvre + coutPieces;

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    // Validations locales
    const errors = {};
    if (!selectedReparationId) {
      errors.id_reparation = 'Veuillez sélectionner une réparation.';
    }

    if (!dateFacture) {
      errors.date_facture = 'La date de facturation est obligatoire.';
    } else if (selectedReparation?.date_reparation && dateFacture < selectedReparation.date_reparation) {
      errors.date_facture = `La date de facturation (${dateFacture}) ne peut pas être antérieure à la réparation (${selectedReparation.date_reparation}).`;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        id_reparation: Number(selectedReparationId),
        date_facture: dateFacture,
        statut_paiement: statutPaiement,
      };

      const newFacture = await factureService.create(payload);
      onSuccess(newFacture);
      onClose();
    } catch (err) {
      console.error('Erreur création facture :', err);
      if (err.status === 409) {
        setErrorMessage(
          'Une facture existe déjà pour cette réparation. Chaque réparation ne peut avoir qu\'une seule facture.'
        );
      } else if (err.status === 422 || err.details) {
        setErrorMessage(err.message || 'Données invalides pour la facturation.');
        if (err.details && typeof err.details === 'object') {
          setFieldErrors(err.details);
        }
      } else {
        setErrorMessage(err.message || 'Impossible d\'émettre la facture.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shadow-xs">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Émettre une nouvelle facture
              </h2>
              <p className="text-xs text-slate-500">
                Le montant total est calculé automatiquement à partir de la réparation
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
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

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Sélection de la réparation */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Sélectionner la réparation à facturer <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedReparationId}
              onChange={(e) => setSelectedReparationId(e.target.value)}
              className={`w-full px-3.5 py-2.5 bg-white border ${
                fieldErrors.id_reparation
                  ? 'border-rose-500 focus:ring-rose-500'
                  : 'border-slate-300 focus:border-brand-500'
              } rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30`}
            >
              <option value="" className="bg-white text-slate-900">-- Choisir une réparation terminée ou en cours --</option>
              {eligibleReparations.map((rep) => {
                const veh = vehiculesMap[rep.id_vehicule];
                const cl = veh ? clientsMap[veh.id_client] : null;
                const clientLabel = cl ? ` | ${cl.prenom} ${cl.nom}` : '';
                const immatLabel = veh ? ` | ${veh.immatriculation}` : '';
                return (
                  <option key={rep.id_reparation} value={rep.id_reparation} className="bg-white text-slate-900">
                    Fiche #{rep.id_reparation} - {rep.description} ({rep.statut}){immatLabel}{clientLabel}
                  </option>
                );
              })}
            </select>
            {fieldErrors.id_reparation && (
              <p className="mt-1 text-xs text-rose-600">
                {Array.isArray(fieldErrors.id_reparation) ? fieldErrors.id_reparation[0] : fieldErrors.id_reparation}
              </p>
            )}
            {eligibleReparations.length === 0 && (
              <p className="mt-1.5 text-xs text-amber-700 flex items-center font-medium">
                <Info className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                Toutes les réparations existantes ont déjà été facturées.
              </p>
            )}
          </div>

          {/* Fiche récapitulative de la réparation choisie */}
          {selectedReparation && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Info Client */}
                <div className="flex items-start space-x-2.5">
                  <User className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <span className="text-slate-400 font-medium block">Client</span>
                    {associatedClient ? (
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {associatedClient.prenom} {associatedClient.nom}{' '}
                        <span className="text-slate-400 font-normal">({associatedClient.telephone})</span>
                      </p>
                    ) : (
                      <p className="text-slate-400 italic">Non déterminé</p>
                    )}
                  </div>
                </div>

                {/* Info Véhicule */}
                <div className="flex items-start space-x-2.5">
                  <Car className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <span className="text-slate-400 font-medium block">Véhicule</span>
                    {associatedVehicule ? (
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {associatedVehicule.marque} {associatedVehicule.modele}{' '}
                        <span className="font-mono text-slate-500 font-normal">
                          [{associatedVehicule.immatriculation}]
                        </span>
                      </p>
                    ) : (
                      <p className="text-slate-400 italic">Non déterminé</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Récapitulatif financier prévisionnel */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-700/60">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-500 dark:text-slate-400">Coût main-d'œuvre :</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {coutMainOeuvre.toFixed(2)} TND
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-slate-500 dark:text-slate-400">
                    Coût pièces consommées ({pieces.length} pièce(s)) :
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {isLoadingPieces ? (
                      <Loader2 className="w-3 h-3 animate-spin inline text-slate-400" />
                    ) : (
                      `${coutPieces.toFixed(2)} TND`
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span>Montant total calculé :</span>
                  <span className="text-brand-600 dark:text-brand-400">
                    {montantTotalEstime.toFixed(2)} TND
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 italic">
                  * Conformément aux règles comptables du backend, le montant total est immuable et calculé automatiquement par l'API.
                </p>
              </div>
            </div>
          )}

          {/* Date de la facture et Statut initial */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Date d'émission <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={dateFacture}
                onChange={(e) => setDateFacture(e.target.value)}
                min={selectedReparation?.date_reparation || undefined}
                className={`w-full px-3 py-2 bg-white border ${
                  fieldErrors.date_facture
                    ? 'border-rose-500 focus:ring-rose-500'
                    : 'border-slate-300 focus:border-brand-500'
                } rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30`}
              />
              {fieldErrors.date_facture && (
                <p className="mt-1 text-xs text-rose-600">
                  {Array.isArray(fieldErrors.date_facture)
                    ? fieldErrors.date_facture[0]
                    : fieldErrors.date_facture}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Statut de paiement initial
              </label>
              <select
                value={statutPaiement}
                onChange={(e) => setStatutPaiement(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              >
                <option value={FACTURE_STATUSES.EN_ATTENTE} className="bg-white text-slate-900">En attente de paiement</option>
                <option value={FACTURE_STATUSES.PAYEE} className="bg-white text-slate-900">Payée (règlement immédiat)</option>
                <option value={FACTURE_STATUSES.PARTIELLE} className="bg-white text-slate-900">Partiellement payée</option>
              </select>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-sm font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedReparationId}
              className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Émission en cours...</span>
                </>
              ) : (
                <>
                  <Receipt className="w-4 h-4" />
                  <span>Émettre la facture</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FactureCreateModal;
