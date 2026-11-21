import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  Clock,
  User,
  Car,
  FileText,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Save,
  RotateCcw,
  Shield,
  Check,
  Ban,
  Wrench,
  Award,
} from 'lucide-react';
import rendezVousService from '../../services/rendezVousService';
import RendezVousStatusBadge from './RendezVousStatusBadge';
import {
  RENDEZ_VOUS_STATUSES,
  RENDEZ_VOUS_STATUS_LABELS,
} from '../../utils/constants';

/**
 * Modal de consultation détaillée, modification et suppression d'un rendez-vous d'atelier.
 * Réservé exclusivement au profil RESPONSABLE.
 */
export const RendezVousDetailModal = ({
  idRendezVous,
  isOpen,
  onClose,
  onUpdated,
  onDeleted,
  clients = [],
  vehicules = [],
}) => {
  const [rdv, setRdv] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Formulaire d'édition
  const [editDate, setEditDate] = useState('');
  const [editHeure, setEditHeure] = useState('');
  const [editMotif, setEditMotif] = useState('');
  const [editStatut, setEditStatut] = useState('');
  const [editClientId, setEditClientId] = useState('');
  const [editVehiculeId, setEditVehiculeId] = useState('');

  // Chargement des données du rendez-vous
  useEffect(() => {
    if (isOpen && idRendezVous) {
      const loadRdv = async () => {
        setIsLoading(true);
        setIsEditing(false);
        setShowDeleteConfirm(false);
        setErrorMessage(null);
        setSuccessMessage(null);
        try {
          const data = await rendezVousService.getById(idRendezVous);
          setRdv(data);
          setEditDate(data.date_rendezvous || '');
          setEditHeure(data.heure ? data.heure.slice(0, 5) : '');
          setEditMotif(data.motif || '');
          setEditStatut(data.statut || RENDEZ_VOUS_STATUSES.PLANIFIE);
          setEditClientId(String(data.id_client || ''));
          setEditVehiculeId(String(data.id_vehicule || ''));
        } catch (err) {
          console.error('Erreur chargement rendez-vous :', err);
          setErrorMessage(err.message || 'Impossible de récupérer le rendez-vous.');
        } finally {
          setIsLoading(false);
        }
      };
      loadRdv();
    }
  }, [isOpen, idRendezVous]);

  // Véhicules autorisés lors de l'édition (filtrés sur le client choisi)
  const clientVehicules = useMemo(() => {
    if (!editClientId) return [];
    return vehicules.filter((v) => String(v.id_client) === String(editClientId));
  }, [editClientId, vehicules]);

  if (!isOpen) return null;

  // Mise à jour rapide du statut (ex: Confirmer, Passer en atelier, Terminer, Annuler)
  const handleQuickStatusChange = async (newStatut) => {
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const updated = await rendezVousService.update(rdv.id_rendezvous, {
        statut: newStatut,
      });
      setRdv(updated);
      setEditStatut(updated.statut);
      setSuccessMessage(
        `Statut du rendez-vous mis à jour : ${RENDEZ_VOUS_STATUS_LABELS[newStatut] || newStatut}`
      );
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error('Erreur mise à jour rapide statut :', err);
      setErrorMessage(err.message || 'Impossible de mettre à jour le statut.');
    } finally {
      setIsSaving(false);
    }
  };

  // Sauvegarde des modifications du formulaire
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        date_rendezvous: editDate,
        heure: editHeure.length === 5 ? editHeure : editHeure.slice(0, 5),
        motif: editMotif.trim() ? editMotif.trim() : null,
        statut: editStatut,
        id_client: Number(editClientId),
        id_vehicule: Number(editVehiculeId),
      };

      const updated = await rendezVousService.update(rdv.id_rendezvous, payload);
      setRdv(updated);
      setIsEditing(false);
      setSuccessMessage('Rendez-vous mis à jour avec succès.');
      if (onUpdated) onUpdated();
    } catch (err) {
      console.error('Erreur modification rendez-vous :', err);
      setErrorMessage(err.message || 'Impossible de modifier le rendez-vous.');
    } finally {
      setIsSaving(false);
    }
  };

  // Suppression
  const handleDelete = async () => {
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await rendezVousService.delete(rdv.id_rendezvous);
      if (onDeleted) onDeleted(rdv.id_rendezvous);
      onClose();
    } catch (err) {
      console.error('Erreur suppression rendez-vous :', err);
      if (err.status === 409) {
        setErrorMessage(
          'Impossible de supprimer un rendez-vous honoré ou terminé afin de préserver l\'historique d\'atelier.'
        );
      } else {
        setErrorMessage(err.message || 'Impossible de supprimer le rendez-vous.');
      }
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const isProtectedFromDeletion = ['TERMINE', 'HONORE'].includes((rdv?.statut || '').toUpperCase());

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
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Rendez-vous #{rdv?.id_rendezvous || ''}
                </h2>
                {rdv && <RendezVousStatusBadge statut={rdv.statut} size="small" />}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {rdv?.date_rendezvous} à {rdv?.heure ? rdv.heure.slice(0, 5) : '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            {!isEditing && rdv && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                title="Modifier les informations"
                className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-150 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Corps de la modal */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-2 text-brand-600" />
              <p className="text-sm">Chargement du rendez-vous...</p>
            </div>
          ) : rdv ? (
            <>
              {/* Messages d'alerte */}
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium">{errorMessage}</div>
                </div>
              )}

              {successMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <div className="flex-1 font-medium">{successMessage}</div>
                </div>
              )}

              {isEditing ? (
                /* FORMULAIRE D'ÉDITION */
                <form onSubmit={handleSaveEdit} className="space-y-4">
                  {/* Client & Véhicule */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Client
                      </label>
                      <select
                        value={editClientId}
                        onChange={(e) => {
                          setEditClientId(e.target.value);
                          // Auto réajustement du véhicule
                          const vList = vehicules.filter(
                            (v) => String(v.id_client) === String(e.target.value)
                          );
                          if (vList.length > 0) {
                            setEditVehiculeId(String(vList[0].id_vehicule));
                          } else {
                            setEditVehiculeId('');
                          }
                        }}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                      >
                        {clients.map((c) => (
                          <option key={c.id_client} value={c.id_client}>
                            {c.prenom} {c.nom}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Véhicule du client
                      </label>
                      <select
                        value={editVehiculeId}
                        onChange={(e) => setEditVehiculeId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                      >
                        {clientVehicules.map((v) => (
                          <option key={v.id_vehicule} value={v.id_vehicule}>
                            {v.marque} {v.modele} [{v.immatriculation}]
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Date & Heure */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Heure
                      </label>
                      <input
                        type="time"
                        value={editHeure}
                        onChange={(e) => setEditHeure(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                      />
                    </div>
                  </div>

                  {/* Motif */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Motif d'intervention
                    </label>
                    <textarea
                      rows={3}
                      value={editMotif}
                      onChange={(e) => setEditMotif(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    />
                  </div>

                  {/* Statut */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Statut
                    </label>
                    <select
                      value={editStatut}
                      onChange={(e) => setEditStatut(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                    >
                      <option value={RENDEZ_VOUS_STATUSES.PLANIFIE}>Planifié</option>
                      <option value={RENDEZ_VOUS_STATUSES.CONFIRME}>Confirmé</option>
                      <option value={RENDEZ_VOUS_STATUSES.EN_ATTENTE}>En attente</option>
                      <option value={RENDEZ_VOUS_STATUSES.EN_COURS}>En atelier</option>
                      <option value={RENDEZ_VOUS_STATUSES.TERMINE}>Terminé</option>
                      <option value={RENDEZ_VOUS_STATUSES.HONORE}>Honoré</option>
                      <option value={RENDEZ_VOUS_STATUSES.NON_HONORE}>Non honoré</option>
                      <option value={RENDEZ_VOUS_STATUSES.ABSENT}>Absent</option>
                      <option value={RENDEZ_VOUS_STATUSES.ANNULE}>Annulé</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      disabled={isSaving}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium flex items-center space-x-1.5 shadow-xs"
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      <span>Enregistrer</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* VUE CONSULTATION */
                <div className="space-y-4">
                  {/* Coordonnées Client & Véhicule */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        <User className="w-3.5 h-3.5" />
                        <span>Client</span>
                      </div>
                      {rdv.client ? (
                        <div className="text-xs space-y-0.5">
                          <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                            {rdv.client.prenom} {rdv.client.nom}
                          </p>
                          <p className="text-slate-600 dark:text-slate-300">
                            Tél : {rdv.client.telephone || 'Non renseigné'}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">Client #{rdv.id_client}</p>
                      )}
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                        <Car className="w-3.5 h-3.5" />
                        <span>Véhicule</span>
                      </div>
                      {rdv.vehicule ? (
                        <div className="text-xs space-y-0.5">
                          <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                            {rdv.vehicule.marque} {rdv.vehicule.modele}
                          </p>
                          <p className="font-mono text-slate-600 dark:text-slate-300 font-semibold">
                            {rdv.vehicule.immatriculation}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">Véhicule #{rdv.id_vehicule}</p>
                      )}
                    </div>
                  </div>

                  {/* Motif */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Motif du rendez-vous</span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                      {rdv.motif || <span className="text-slate-400 italic">Aucun motif renseigné</span>}
                    </p>
                  </div>

                  {/* Actions rapides de changement de statut */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-700 space-y-2">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Actions rapides de planification :
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {rdv.statut !== RENDEZ_VOUS_STATUSES.CONFIRME && (
                        <button
                          type="button"
                          onClick={() => handleQuickStatusChange(RENDEZ_VOUS_STATUSES.CONFIRME)}
                          disabled={isSaving}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-xs font-medium transition-colors flex items-center space-x-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>Confirmer</span>
                        </button>
                      )}

                      {rdv.statut !== RENDEZ_VOUS_STATUSES.EN_COURS && (
                        <button
                          type="button"
                          onClick={() => handleQuickStatusChange(RENDEZ_VOUS_STATUSES.EN_COURS)}
                          disabled={isSaving}
                          className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 text-xs font-medium transition-colors flex items-center space-x-1"
                        >
                          <Wrench className="w-3 h-3" />
                          <span>Passer en atelier</span>
                        </button>
                      )}

                      {rdv.statut !== RENDEZ_VOUS_STATUSES.HONORE && (
                        <button
                          type="button"
                          onClick={() => handleQuickStatusChange(RENDEZ_VOUS_STATUSES.HONORE)}
                          disabled={isSaving}
                          className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 text-xs font-medium transition-colors flex items-center space-x-1"
                        >
                          <Award className="w-3 h-3" />
                          <span>Marquer honoré</span>
                        </button>
                      )}

                      {rdv.statut !== RENDEZ_VOUS_STATUSES.ANNULE && (
                        <button
                          type="button"
                          onClick={() => handleQuickStatusChange(RENDEZ_VOUS_STATUSES.ANNULE)}
                          disabled={isSaving}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 text-xs font-medium transition-colors flex items-center space-x-1"
                        >
                          <Ban className="w-3 h-3" />
                          <span>Annuler</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Suppression */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div className="text-[11px] text-slate-400 flex items-center">
                      <Shield className="w-3.5 h-3.5 mr-1" />
                      {isProtectedFromDeletion
                        ? 'Protection d\'historique : les rendez-vous honorés ou terminés ne peuvent pas être supprimés (409).'
                        : 'Suppression possible pour les rendez-vous planifiés ou annulés.'}
                    </div>

                    {showDeleteConfirm ? (
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={isDeleting}
                          className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition-colors flex items-center space-x-1"
                        >
                          {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          <span>Confirmer suppression</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowDeleteConfirm(false)}
                          className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs hover:bg-slate-100"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                          isProtectedFromDeletion
                            ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                            : 'text-rose-600 hover:text-rose-700 hover:bg-rose-50'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default RendezVousDetailModal;
