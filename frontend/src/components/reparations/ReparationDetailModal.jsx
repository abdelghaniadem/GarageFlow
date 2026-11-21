import React, { useState, useEffect } from 'react';
import {
  X,
  Wrench,
  Car,
  User,
  Calendar,
  DollarSign,
  Gauge,
  ClipboardList,
  Save,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileText,
} from 'lucide-react';
import reparationService from '../../services/reparationService';
import vehiculeService from '../../services/vehiculeService';
import clientService from '../../services/clientService';
import mecanicienService from '../../services/mecanicienService';
import ReparationStatusBadge from './ReparationStatusBadge';
import ReparationPiecesManager from './ReparationPiecesManager';
import { ROLES } from '../../utils/constants';

/**
 * Modal complet de consultation et mise à jour détaillée d'une réparation.
 */
export const ReparationDetailModal = ({
  idReparation,
  isOpen,
  onClose,
  onUpdated,
  onDeleted,
  userRole,
}) => {
  const isResponsable = userRole === ROLES.RESPONSABLE;

  const [reparation, setReparation] = useState(null);
  const [vehicule, setVehicule] = useState(null);
  const [client, setClient] = useState(null);
  const [mecanicien, setMecanicien] = useState(null);

  const [pieces, setPieces] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Formulaire d'observations modifiables
  const [diagnostic, setDiagnostic] = useState('');
  const [travailEffectue, setTravailEffectue] = useState('');
  const [coutMainOeuvre, setCoutMainOeuvre] = useState('');
  const [kilometrage, setKilometrage] = useState('');
  const [selectedStatut, setSelectedStatut] = useState('');

  // Chargement des données détaillées de la réparation
  useEffect(() => {
    if (isOpen && idReparation) {
      const loadDetails = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        setSuccessMessage(null);
        try {
          const repData = await reparationService.getById(idReparation);
          setReparation(repData);
          setDiagnostic(repData.diagnostic || '');
          setTravailEffectue(repData.travail_effectue || '');
          setCoutMainOeuvre(repData.cout !== null && repData.cout !== undefined ? String(repData.cout) : '');
          setKilometrage(repData.kilometrage !== null && repData.kilometrage !== undefined ? String(repData.kilometrage) : '');
          setSelectedStatut(repData.statut || 'EN_ATTENTE');

          // Chargement du véhicule et du mécanicien
          const promises = [];
          if (repData.id_vehicule) {
            promises.push(
              vehiculeService.getById(repData.id_vehicule).then(async (v) => {
                setVehicule(v);
                if (v && v.id_client && isResponsable) {
                  try {
                    const c = await clientService.getById(v.id_client);
                    setClient(c);
                  } catch {
                    // Ignore si non disponible
                  }
                }
              }).catch(() => setVehicule(null))
            );
          }
          if (repData.id_mecanicien && isResponsable) {
            promises.push(
              mecanicienService.getById(repData.id_mecanicien).then((m) => {
                setMecanicien(m);
              }).catch(() => setMecanicien(null))
            );
          }

          await Promise.all(promises);
        } catch (err) {
          console.error('Erreur chargement détails réparation :', err);
          setErrorMessage(err.message || 'Impossible de charger la fiche de réparation.');
        } finally {
          setIsLoading(false);
        }
      };
      loadDetails();
    }
  }, [isOpen, idReparation, isResponsable]);

  if (!isOpen) return null;

  // Mise à jour rapide du statut
  const handleStatutChange = async (newStatut) => {
    if (!newStatut || newStatut === reparation?.statut) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updated = await reparationService.update(idReparation, { statut: newStatut });
      setReparation(updated);
      setSelectedStatut(updated.statut);
      setSuccessMessage(`Statut mis à jour vers : ${updated.statut}`);
      if (onUpdated) onUpdated(updated);
    } catch (err) {
      setErrorMessage(err.message || 'Erreur lors du changement de statut.');
    } finally {
      setIsSaving(false);
    }
  };

  // Enregistrement des observations (diagnostic, travaux, coût, kilométrage)
  const handleSaveObservations = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        diagnostic: diagnostic.trim() || null,
        travail_effectue: travailEffectue.trim() || null,
        cout: coutMainOeuvre ? parseFloat(coutMainOeuvre) : null,
        kilometrage: kilometrage ? parseInt(kilometrage, 10) : null,
        statut: selectedStatut,
      };

      const updated = await reparationService.update(idReparation, payload);
      setReparation(updated);
      setSuccessMessage('Observations et informations enregistrées avec succès.');
      if (onUpdated) onUpdated(updated);
    } catch (err) {
      setErrorMessage(err.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setIsSaving(false);
    }
  };

  // Suppression de la réparation (RESPONSABLE uniquement)
  const handleDelete = async () => {
    if (!window.confirm(`Confirmez-vous la suppression définitive de l'ordre de réparation #${idReparation} ?`)) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      await reparationService.delete(idReparation);
      if (onDeleted) onDeleted(idReparation);
      onClose();
    } catch (err) {
      setErrorMessage(err.message || 'Impossible de supprimer cette réparation (facture ou pièces rattachées).');
      setIsSaving(false);
    }
  };

  const coutPiecesTotal = pieces.reduce((acc, p) => acc + (p.sous_total || 0), 0);
  const coutMainOeuvreNum = parseFloat(coutMainOeuvre) || 0;
  const coutTotalGlobal = coutMainOeuvreNum + coutPiecesTotal;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* En-tête de la fiche de réparation */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-brand-600 text-white">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Ordre de Réparation #{idReparation}
                </h2>
                {reparation && <ReparationStatusBadge statut={reparation.statut} size="small" />}
              </div>
              <p className="text-xs text-slate-400">
                Intervention du {reparation?.date_reparation || '—'}
              </p>
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

        {/* Corps modal scrollable */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
          {/* Notifications */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
              <p>Chargement des détails de l'intervention...</p>
            </div>
          ) : (
            <>
              {/* Grille d'informations : Véhicule, Client, Mécanicien */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Carte Véhicule */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center space-x-2 text-slate-500 font-semibold mb-2 uppercase text-[10px] tracking-wider">
                    <Car className="w-3.5 h-3.5 text-brand-600" />
                    <span>Véhicule</span>
                  </div>
                  {vehicule ? (
                    <div>
                      <p className="font-bold text-slate-900 text-sm">
                        {vehicule.marque} {vehicule.modele}
                      </p>
                      <p className="font-mono text-xs font-semibold text-brand-600 mt-0.5">
                        {vehicule.immatriculation}
                      </p>
                      <div className="text-[11px] text-slate-500 mt-2 space-y-0.5">
                        <p>Année : {vehicule.annee || 'n/d'}</p>
                        <p>État : {vehicule.etat || 'Normal'}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-400">Véhicule #{reparation?.id_vehicule}</p>
                  )}
                </div>

                {/* Carte Client */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center space-x-2 text-slate-500 font-semibold mb-2 uppercase text-[10px] tracking-wider">
                    <User className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Client</span>
                  </div>
                  {client ? (
                    <div>
                      <p className="font-bold text-slate-900 text-sm">
                        {client.prenom} {client.nom}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5 font-mono">
                        {client.telephone}
                      </p>
                      {client.adresse && (
                        <p className="text-[11px] text-slate-500 mt-2 truncate">
                          {client.adresse}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-slate-400">
                      {isResponsable ? 'Informations client non disponibles' : 'Détails client restreints'}
                    </p>
                  )}
                </div>

                {/* Carte Mécanicien en charge */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center space-x-2 text-slate-500 font-semibold mb-2 uppercase text-[10px] tracking-wider">
                    <Wrench className="w-3.5 h-3.5 text-amber-600" />
                    <span>Mécanicien affecté</span>
                  </div>
                  {mecanicien ? (
                    <div>
                      <p className="font-bold text-slate-900 text-sm">
                        {mecanicien.utilisateur
                          ? `${mecanicien.utilisateur.prenom} ${mecanicien.utilisateur.nom}`
                          : `Mécanicien #${mecanicien.id_mecanicien}`}
                      </p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                        {mecanicien.specialite}
                      </span>
                    </div>
                  ) : (
                    <p className="text-slate-400">Mécanicien #{reparation?.id_mecanicien}</p>
                  )}
                </div>
              </div>

              {/* Barre de changement rapide de statut */}
              <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-300">
                    Cycle de vie de l'intervention :
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Statut actuel : <strong className="text-white">{reparation?.statut}</strong>
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {['EN_ATTENTE', 'EN_COURS', 'TERMINEE', 'ANNULEE'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      disabled={isSaving || reparation?.statut === st}
                      onClick={() => handleStatutChange(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        reparation?.statut === st
                          ? 'bg-brand-600 text-white ring-2 ring-brand-400/50'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40'
                      }`}
                    >
                      {st === 'EN_ATTENTE' && 'Mettre En attente'}
                      {st === 'EN_COURS' && 'Démarrer l\'intervention'}
                      {st === 'TERMINEE' && 'Clôturer (Terminée)'}
                      {st === 'ANNULEE' && 'Annuler'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description initiale du problème */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Description du problème / Motif d'entrée
                </span>
                <p className="text-slate-800 font-medium whitespace-pre-wrap">
                  {reparation?.description}
                </p>
              </div>

              {/* Formulaire des observations techniques & Main d'œuvre */}
              <form onSubmit={handleSaveObservations} className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-brand-600" />
                    <span>Observations & Travaux Réalisés</span>
                  </h3>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold disabled:opacity-50 shadow-xs transition-colors"
                  >
                    {isSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Enregistrer</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                      Diagnostic technique
                    </label>
                    <textarea
                      rows="3"
                      value={diagnostic}
                      onChange={(e) => setDiagnostic(e.target.value)}
                      placeholder="Constats après diagnostic d'atelier..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                      Travaux réalisés / Opérations
                    </label>
                    <textarea
                      rows="3"
                      value={travailEffectue}
                      onChange={(e) => setTravailEffectue(e.target.value)}
                      placeholder="Détail des réparations et remplacements..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                      Statut
                    </label>
                    <select
                      value={selectedStatut}
                      onChange={(e) => setSelectedStatut(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    >
                      <option value="EN_ATTENTE">En attente</option>
                      <option value="EN_COURS">En cours</option>
                      <option value="EN_DIAGNOSTIC">Diagnostic</option>
                      <option value="EN_REPARATION">En réparation</option>
                      <option value="TERMINEE">Terminée</option>
                      <option value="LIVREE">Livrée</option>
                      <option value="ANNULEE">Annulée</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                      Coût Main d'œuvre (TND)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={coutMainOeuvre}
                      onChange={(e) => setCoutMainOeuvre(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                      Kilométrage relevé
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={kilometrage}
                      onChange={(e) => setKilometrage(e.target.value)}
                      placeholder="Kilométrage véhicule"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    />
                  </div>
                </div>
              </form>

              {/* Gestion des pièces détachées */}
              <div className="pt-2 border-t border-slate-200">
                <ReparationPiecesManager
                  idReparation={idReparation}
                  onPiecesUpdated={(updatedPieces) => setPieces(updatedPieces)}
                />
              </div>

              {/* Bilan financier de l'intervention */}
              <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-850 rounded-xl text-white flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                      Montant Total Calculé de l'intervention
                    </span>
                    <div className="flex items-center space-x-3 text-xs text-slate-300 mt-0.5">
                      <span>Main d'œuvre : {coutMainOeuvreNum.toFixed(2)} TND</span>
                      <span>+</span>
                      <span>Pièces : {coutPiecesTotal.toFixed(2)} TND</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-2xl font-black text-emerald-400 font-mono">
                    {coutTotalGlobal.toFixed(2)} TND
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Pied de modal avec actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div>
            {isResponsable && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Supprimer la fiche</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors shadow-xs"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReparationDetailModal;
