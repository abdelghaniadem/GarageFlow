import React, { useState, useEffect } from 'react';
import {
  X,
  Receipt,
  Printer,
  AlertCircle,
  CheckCircle2,
  Calendar,
  User,
  Car,
  Wrench,
  DollarSign,
  Package,
  Clock,
  Shield,
  Trash2,
  Loader2,
  FileText,
  AlertTriangle,
  Info,
} from 'lucide-react';
import factureService from '../../services/factureService';
import clientService from '../../services/clientService';
import vehiculeService from '../../services/vehiculeService';
import FactureStatusBadge from './FactureStatusBadge';
import { FACTURE_STATUSES, FACTURE_STATUS_LABELS } from '../../utils/constants';

/**
 * Modal de consultation détaillée et gestion d'une facture GarageFlow.
 * Permet au RESPONSABLE de consulter l'historique financier, modifier le statut de paiement,
 * imprimer la facture et vérifier l'intégrité comptable.
 */
export const FactureDetailModal = ({
  idFacture,
  isOpen,
  onClose,
  onUpdated,
}) => {
  const [facture, setFacture] = useState(null);
  const [client, setClient] = useState(null);
  const [vehicule, setVehicule] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [selectedStatut, setSelectedStatut] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);

  useEffect(() => {
    if (isOpen && idFacture) {
      const loadDetails = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        setSuccessMessage(null);
        setShowDeleteWarning(false);
        try {
          const data = await factureService.getById(idFacture);
          setFacture(data);
          setSelectedStatut(data.statut_paiement || FACTURE_STATUSES.EN_ATTENTE);

          // Récupération des informations véhicule et client si présentes dans réparation
          if (data.reparation) {
            const rep = data.reparation;
            if (rep.id_vehicule) {
              try {
                const vehData = await vehiculeService.getById(rep.id_vehicule);
                setVehicule(vehData);
                if (vehData && vehData.id_client) {
                  const clientData = await clientService.getById(vehData.id_client);
                  setClient(clientData);
                }
              } catch (err) {
                console.warn('Impossible de charger le véhicule ou le client lié :', err);
              }
            }
          }
        } catch (err) {
          console.error('Erreur chargement détail facture :', err);
          setErrorMessage(err.message || 'Impossible de récupérer les détails de la facture.');
        } finally {
          setIsLoading(false);
        }
      };
      loadDetails();
    }
  }, [isOpen, idFacture]);

  if (!isOpen) return null;

  const handleUpdateStatus = async (newStatus) => {
    if (!newStatus || newStatus === facture?.statut_paiement) return;
    setIsUpdatingStatus(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const updated = await factureService.updateStatut(facture.id_facture, newStatus);
      setFacture((prev) => ({
        ...prev,
        statut_paiement: updated.statut_paiement || newStatus,
      }));
      setSelectedStatut(updated.statut_paiement || newStatus);
      setSuccessMessage(`Statut de paiement mis à jour : ${FACTURE_STATUS_LABELS[newStatus] || newStatus}`);
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error('Erreur mise à jour statut facture :', err);
      setErrorMessage(err.message || 'Impossible de mettre à jour le statut de paiement.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDeleteAttempt = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await factureService.delete(facture.id_facture);
    } catch (err) {
      // Le backend retourne systématiquement HTTP 409 Conflict pour respecter le droit fiscal et comptable
      setErrorMessage(
        err.message ||
          'La suppression d\'une facture est strictement interdite pour préserver l\'intégrité de l\'historique comptable et fiscal.'
      );
      setShowDeleteWarning(false);
    }
  };

  const formattedId = facture ? `#FAC-${String(facture.id_facture).padStart(4, '0')}` : '';
  const coutMO = Number(facture?.cout_main_oeuvre || 0);
  const coutPieces = Number(facture?.cout_pieces || 0);
  const montantTotal = Number(facture?.montant_total || 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 print:border-none print:shadow-none print:max-w-none">
        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 print:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shadow-xs">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-900 font-mono">
                  Facture {formattedId}
                </h2>
                {facture && <FactureStatusBadge statut={facture.statut_paiement} size="small" />}
              </div>
              <p className="text-xs text-slate-500">
                Émise le {facture?.date_facture || '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              title="Imprimer la facture"
              className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-medium transition-colors"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              Imprimer
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Corps de la modale */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh] print:max-h-none print:p-8">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-2 text-brand-600" />
              <p className="text-sm">Chargement des données de facturation...</p>
            </div>
          ) : facture ? (
            <>
              {/* Notifications */}
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start space-x-2 print:hidden">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium">{errorMessage}</div>
                </div>
              )}

              {successMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center space-x-2 print:hidden">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 font-medium">{successMessage}</div>
                </div>
              )}

              {/* En-tête imprimable GarageFlow */}
              <div className="hidden print:flex items-center justify-between pb-6 border-b border-slate-300 mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">GarageFlow</h1>
                  <p className="text-xs text-slate-500">Atelier de réparation & entretien automobile</p>
                  <p className="text-xs text-slate-500">contact@garageflow.tn | +216 71 123 456</p>
                </div>
                <div className="text-right">
                  <h2 className="text-xl font-bold font-mono text-slate-900">FACTURE {formattedId}</h2>
                  <p className="text-xs text-slate-600">Date d'émission : {facture.date_facture}</p>
                  <p className="text-xs text-slate-600">Statut : {FACTURE_STATUS_LABELS[facture.statut_paiement] || facture.statut_paiement}</p>
                </div>
              </div>

              {/* Bloc Coordonnées Client et Véhicule */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Client */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    <User className="w-4 h-4" />
                    <span>Client / Facturé à</span>
                  </div>
                  {client ? (
                    <div className="text-xs space-y-1">
                      <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                        {client.prenom} {client.nom}
                      </p>
                      <p className="text-slate-600 dark:text-slate-300">Tél : {client.telephone}</p>
                      <p className="text-slate-500 dark:text-slate-400">
                        Adresse : {client.adresse || 'Non renseignée'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Informations client non disponibles</p>
                  )}
                </div>

                {/* Véhicule */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    <Car className="w-4 h-4" />
                    <span>Véhicule concerné</span>
                  </div>
                  {vehicule ? (
                    <div className="text-xs space-y-1">
                      <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                        {vehicule.marque} {vehicule.modele}
                      </p>
                      <p className="font-mono text-slate-600 dark:text-slate-300">
                        Immatriculation : <span className="font-semibold">{vehicule.immatriculation}</span>
                      </p>
                      <p className="text-slate-500 dark:text-slate-400">
                        Kilométrage atelier :{' '}
                        {facture.reparation?.kilometrage
                          ? `${Number(facture.reparation.kilometrage).toLocaleString()} km`
                          : vehicule.kilometrage
                          ? `${Number(vehicule.kilometrage).toLocaleString()} km`
                          : 'Non renseigné'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Informations véhicule non disponibles</p>
                  )}
                </div>
              </div>

              {/* Réparation associée */}
              {facture.reparation && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <Wrench className="w-4 h-4" />
                      <span>Fiche d'intervention #{facture.reparation.id_reparation}</span>
                    </div>
                    <span className="text-xs text-slate-400">
                      Intervention le {facture.reparation.date_reparation || '—'}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200 mb-2">
                    {facture.reparation.description}
                  </p>
                  {facture.reparation.diagnostic && (
                    <div className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-750 mb-2">
                      <span className="font-semibold text-slate-700 dark:text-slate-200 block mb-0.5">
                        Diagnostic atelier :
                      </span>
                      {facture.reparation.diagnostic}
                    </div>
                  )}
                  {facture.reparation.travail_effectue && (
                    <div className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-750">
                      <span className="font-semibold text-slate-700 dark:text-slate-200 block mb-0.5">
                        Travaux réalisés :
                      </span>
                      {facture.reparation.travail_effectue}
                    </div>
                  )}
                </div>
              )}

              {/* Tableau détaillé des pièces consommées */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center">
                    <Package className="w-4 h-4 mr-1.5 text-slate-400" />
                    Détail des pièces détachées
                  </h3>
                  <span className="text-xs text-slate-400">
                    {(facture.pieces || []).length} référence(s)
                  </span>
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold">
                        <th className="py-2.5 px-3">Désignation</th>
                        <th className="py-2.5 px-3 text-center">Quantité</th>
                        <th className="py-2.5 px-3 text-right">Prix Unitaire</th>
                        <th className="py-2.5 px-3 text-right">Sous-total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {(facture.pieces || []).length > 0 ? (
                        facture.pieces.map((piece, index) => (
                          <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-750/30">
                            <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                              {piece.nom_piece || `Pièce #${piece.id_piece}`}
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-300">
                              {piece.quantite}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-300 font-mono">
                              {Number(piece.prix_unitaire || 0).toFixed(2)} TND
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 dark:text-white">
                              {Number(piece.sous_total || 0).toFixed(2)} TND
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="py-4 text-center text-slate-400 italic">
                            Aucune pièce détachée enregistrée pour cette réparation.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Décomposition financière & Total */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>Main-d'œuvre atelier :</span>
                  <span className="font-mono font-medium">{coutMO.toFixed(2)} TND</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>Fournitures & pièces détachées :</span>
                  <span className="font-mono font-medium">{coutPieces.toFixed(2)} TND</span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-base font-bold text-slate-900 dark:text-white">
                  <span>Total Net à Payer (TTC) :</span>
                  <span className="text-brand-600 dark:text-brand-400 font-mono text-lg">
                    {montantTotal.toLocaleString('fr-TN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    TND
                  </span>
                </div>
              </div>

              {/* Note technique sur l'absence de PDF backend */}
              <div className="p-3 rounded-lg bg-sky-50/70 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-[11px] text-sky-800 dark:text-sky-300 flex items-start space-x-2 print:hidden">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-sky-600" />
                <div>
                  <span className="font-semibold block">Génération de facture</span>
                  L'API backend GarageFlow ne propose pas d'endpoint dédié à la génération serveur de fichiers PDF (/api/v1/factures/:id/pdf). L'impression et l'export PDF s'effectuent via la fonction d'impression intégrée au navigateur (Ctrl+P / bouton Imprimer).
                </div>
              </div>

              {/* Section Gestion du statut de paiement (Réservé RESPONSABLE) */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3 print:hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Gestion du statut de règlement
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Mettre à jour l'état de paiement pour la comptabilité d'atelier
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <select
                      value={selectedStatut}
                      onChange={(e) => setSelectedStatut(e.target.value)}
                      disabled={isUpdatingStatus}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    >
                      <option value={FACTURE_STATUSES.EN_ATTENTE} className="bg-white text-slate-900">En attente</option>
                      <option value={FACTURE_STATUSES.PAYEE} className="bg-white text-slate-900">Payée</option>
                      <option value={FACTURE_STATUSES.IMPAYEE} className="bg-white text-slate-900">Impayée</option>
                      <option value={FACTURE_STATUSES.PARTIELLE} className="bg-white text-slate-900">Partiellement payée</option>
                      <option value={FACTURE_STATUSES.ANNULEE} className="bg-white text-slate-900">Annulée</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(selectedStatut)}
                      disabled={isUpdatingStatus || selectedStatut === facture.statut_paiement}
                      className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                    >
                      {isUpdatingStatus ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>Mettre à jour</span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Bouton de test de suppression avec explicitation de la règle comptable */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                  <div className="text-[11px] text-slate-400 flex items-center">
                    <Shield className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    Intégrité comptable : suppression d'une facture formellement bloquée (HTTP 409).
                  </div>

                  {showDeleteWarning ? (
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={handleDeleteAttempt}
                        className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition-colors"
                      >
                        Confirmer (tester refus API)
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteWarning(false)}
                        className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowDeleteWarning(true)}
                      className="inline-flex items-center px-2.5 py-1 rounded text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-medium transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Supprimer la facture
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default FactureDetailModal;
