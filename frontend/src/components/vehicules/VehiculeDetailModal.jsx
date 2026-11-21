import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Car,
  User,
  Phone,
  MapPin,
  Calendar,
  Gauge,
  Edit2,
  Trash2,
  AlertCircle,
  Loader2,
  Wrench,
  ChevronRight,
  Shield,
} from 'lucide-react';
import vehiculeService from '../../services/vehiculeService';
import clientService from '../../services/clientService';
import VehiculeStatusBadge from './VehiculeStatusBadge';
import { ROLES } from '../../utils/constants';
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
 * Modale de consultation et modification d'un véhicule.
 * Accessible en lecture à RESPONSABLE et MECANICIEN.
 * Modifications et suppression réservées au RESPONSABLE.
 */
export const VehiculeDetailModal = ({
  isOpen,
  onClose,
  idVehicule,
  onUpdated,
  onDeleted,
  clientsMap = {},
  userRole,
}) => {
  const navigate = useNavigate();
  const isResponsable = userRole === ROLES.RESPONSABLE;

  const [vehicule, setVehicule] = useState(null);
  const [client, setClient] = useState(null);
  const [clientsList, setClientsList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  // Mode modification
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    marque: '',
    modele: '',
    immatriculation: '',
    id_client: '',
    annee: '',
    kilometrage: '',
    etat: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Suppression
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConflictError, setDeleteConflictError] = useState(null);

  useEffect(() => {
    if (isOpen && idVehicule) {
      const loadVehiculeData = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        setDeleteConflictError(null);
        setIsEditing(false);

        try {
          const vehData = await vehiculeService.getById(idVehicule);
          setVehicule(vehData);
          setFormData({
            marque: vehData.marque || '',
            modele: vehData.modele || '',
            immatriculation: vehData.immatriculation || '',
            id_client: String(vehData.id_client || ''),
            annee: vehData.annee ? String(vehData.annee) : '',
            kilometrage: vehData.kilometrage ? String(vehData.kilometrage) : '',
            etat: vehData.etat || '',
          });

          // Résolution du client
          if (clientsMap[vehData.id_client]) {
            setClient(clientsMap[vehData.id_client]);
          } else if (isResponsable && vehData.id_client) {
            try {
              const clientData = await clientService.getById(vehData.id_client);
              setClient(clientData);
            } catch (err) {
              console.warn('Client non accessible :', err);
            }
          }

          // Si responsable, charger la liste des clients pour réassignation potentielle
          if (isResponsable) {
            clientService
              .list()
              .then((list) => setClientsList(list || []))
              .catch(() => {});
          }
        } catch (err) {
          console.error('Erreur chargement détails véhicule :', err);
          setErrorMessage(err.message || 'Impossible de charger la fiche véhicule.');
        } finally {
          setIsLoading(false);
        }
      };

      loadVehiculeData();
    }
  }, [isOpen, idVehicule, isResponsable, clientsMap]);

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const val = name === 'immatriculation' ? value.toUpperCase() : value;
    setFormData((prev) => ({ ...prev, [name]: val }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const errors = {};
    if (!formData.marque.trim()) errors.marque = 'La marque est obligatoire.';
    if (!formData.modele.trim()) errors.modele = 'Le modèle est obligatoire.';
    
    const plateCheck = validateTunisianPlate(formData.immatriculation);
    if (!plateCheck.isValid) {
      errors.immatriculation = plateCheck.error;
    }

    if (!formData.id_client) errors.id_client = 'Le propriétaire est obligatoire.';

    if (formData.annee) {
      const anneeNum = parseInt(formData.annee, 10);
      if (isNaN(anneeNum) || anneeNum < 1900 || anneeNum > 2100) {
        errors.annee = "L'année doit être comprise entre 1900 et 2100.";
      }
    }

    if (formData.kilometrage) {
      const kmNum = parseInt(formData.kilometrage, 10);
      if (isNaN(kmNum) || kmNum < 0) {
        errors.kilometrage = 'Le kilométrage doit être positif ou nul.';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveUpdate = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    setErrorMessage(null);

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

      const updated = await vehiculeService.update(idVehicule, payload);
      setVehicule(updated);
      setIsEditing(false);
      if (onUpdated) onUpdated(updated);
    } catch (err) {
      console.error('Erreur mise à jour véhicule :', err);
      if (err.details && typeof err.details === 'object') {
        setFormErrors(err.details);
      }
      setErrorMessage(err.message || 'Impossible de mettre à jour le véhicule.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Êtes-vous sûr de vouloir supprimer définitivement le véhicule ${vehicule.immatriculation} (${vehicule.marque} ${vehicule.modele}) ?`
      )
    ) {
      return;
    }

    setIsDeleting(true);
    setDeleteConflictError(null);

    try {
      await vehiculeService.delete(idVehicule);
      if (onDeleted) onDeleted(idVehicule);
      onClose();
    } catch (err) {
      console.error('Erreur suppression véhicule :', err);
      // Le backend renvoie 409 Conflict si des réparations ou rendez-vous sont liés
      setDeleteConflictError(
        err.message ||
          'Impossible de supprimer ce véhicule : des ordres de réparation ou rendez-vous y sont associés.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGoToReparations = () => {
    onClose();
    navigate(`/reparations?search=${encodeURIComponent(vehicule.immatriculation)}`);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* En-tête */}
        <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">
                  {vehicule ? `${vehicule.marque} ${vehicule.modele}` : 'Fiche Véhicule'}
                </h3>
                {vehicule && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-200/80 text-slate-700">
                    ID #{vehicule.id_vehicule}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">Spécifications techniques et historique d'atelier</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isResponsable && !isLoading && !isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Modifier</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Corps */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {isLoading ? (
            <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
              <p className="text-xs font-medium text-slate-500">Chargement de la fiche technique...</p>
            </div>
          ) : errorMessage && !vehicule ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          ) : (
            <>
              {/* Alerte Conflit de suppression */}
              {deleteConflictError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs space-y-1">
                  <div className="flex items-center space-x-2 font-bold text-rose-900">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>Suppression impossible (Intégrité de l'atelier)</span>
                  </div>
                  <p className="pl-6">{deleteConflictError}</p>
                </div>
              )}

              {/* Mode édition */}
              {isEditing ? (
                <form onSubmit={handleSaveUpdate} className="space-y-4 bg-slate-50/60 p-4 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                    Modifier les caractéristiques
                  </h4>

                  {/* Réassignation Propriétaire */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Propriétaire (Client) *
                    </label>
                    <select
                      name="id_client"
                      value={formData.id_client}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900"
                    >
                      <option value="">Sélectionner un client...</option>
                      {clientsList.map((c) => (
                        <option key={c.id_client} value={c.id_client}>
                          {c.nom} {c.prenom} — {c.telephone}
                        </option>
                      ))}
                    </select>
                    {formErrors.id_client && (
                      <p className="text-[11px] text-rose-600 mt-1">{formErrors.id_client}</p>
                    )}
                  </div>

                  {/* Immatriculation */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Numéro d'immatriculation (Tunisie) *
                      </label>
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => {
                            const cur = formData.immatriculation || '';
                            if (!cur.includes('تونس')) {
                              setFormData((prev) => ({
                                ...prev,
                                immatriculation: cur ? `${cur.trim()} تونس ` : ' تونس ',
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
                            const cur = formData.immatriculation || '';
                            if (!cur.toUpperCase().includes('TU')) {
                              setFormData((prev) => ({
                                ...prev,
                                immatriculation: cur ? `${cur.trim()} TU ` : ' TU ',
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
                      onChange={handleInputChange}
                      placeholder="Ex: 215 تونس 4589 ou 215 TU 4589"
                      maxLength={30}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-mono font-bold uppercase tracking-wider text-slate-900"
                    />
                    {formErrors.immatriculation && (
                      <p className="text-[11px] text-rose-600 mt-1">{formErrors.immatriculation}</p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">
                      Format ordinaire : <strong>123 تونس 4567</strong> ou <strong>123 TU 4567</strong>.
                    </p>
                  </div>

                  {/* Marque & Modèle */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Marque *
                      </label>
                      <input
                        type="text"
                        name="marque"
                        value={formData.marque}
                        onChange={handleInputChange}
                        maxLength={50}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900"
                      />
                      {formErrors.marque && (
                        <p className="text-[11px] text-rose-600 mt-1">{formErrors.marque}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Modèle *
                      </label>
                      <input
                        type="text"
                        name="modele"
                        value={formData.modele}
                        onChange={handleInputChange}
                        maxLength={50}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900"
                      />
                      {formErrors.modele && (
                        <p className="text-[11px] text-rose-600 mt-1">{formErrors.modele}</p>
                      )}
                    </div>
                  </div>

                  {/* Année & Kilométrage */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Année (1900..2100)
                      </label>
                      <input
                        type="number"
                        name="annee"
                        value={formData.annee}
                        onChange={handleInputChange}
                        min={1900}
                        max={2100}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-mono text-slate-900"
                      />
                      {formErrors.annee && (
                        <p className="text-[11px] text-rose-600 mt-1">{formErrors.annee}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Kilométrage (km)
                      </label>
                      <input
                        type="number"
                        name="kilometrage"
                        value={formData.kilometrage}
                        onChange={handleInputChange}
                        min={0}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-mono text-slate-900"
                      />
                      {formErrors.kilometrage && (
                        <p className="text-[11px] text-rose-600 mt-1">{formErrors.kilometrage}</p>
                      )}
                    </div>
                  </div>

                  {/* État */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      État général
                    </label>
                    <input
                      type="text"
                      name="etat"
                      value={formData.etat}
                      onChange={handleInputChange}
                      maxLength={30}
                      list="detail-etat-suggestions"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900"
                    />
                    <datalist id="detail-etat-suggestions">
                      {ETAT_SUGGESTIONS.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                    {formErrors.etat && (
                      <p className="text-[11px] text-rose-600 mt-1">{formErrors.etat}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      disabled={isSaving}
                      className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md shadow-brand-900/20 transition-all disabled:opacity-50"
                    >
                      {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Enregistrer les modifications</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* Mode consultation */
                <div className="space-y-5">
                  {/* Plaque d'immatriculation en évidence */}
                  <div className="flex items-center justify-between p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                        Immatriculation
                      </span>
                      <div className="inline-flex items-stretch border-2 border-slate-900 rounded bg-white shadow-xs overflow-hidden">
                        <div className="bg-blue-700 text-white px-2 flex flex-col items-center justify-center text-[10px] font-bold leading-none select-none">
                          <span>★</span>
                          <span className="text-[9px] font-bold">F</span>
                        </div>
                        <div className="px-3 py-1 text-sm font-black font-mono tracking-widest text-slate-900">
                          {vehicule.immatriculation}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                        État actuel
                      </span>
                      <VehiculeStatusBadge etat={vehicule.etat} />
                    </div>
                  </div>

                  {/* Fiche technique */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-white border border-slate-200 rounded-xl">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Marque
                      </span>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">{vehicule.marque}</p>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Modèle
                      </span>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">{vehicule.modele}</p>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Année
                      </span>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5 flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{vehicule.annee || 'Non renseignée'}</span>
                      </p>
                    </div>

                    <div className="sm:col-span-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Kilométrage relevé
                        </span>
                        <p className="text-base font-black font-mono text-slate-900 mt-0.5 flex items-center space-x-1.5">
                          <Gauge className="w-4 h-4 text-brand-600" />
                          <span>
                            {vehicule.kilometrage ? `${vehicule.kilometrage.toLocaleString()} km` : 'Non renseigné'}
                          </span>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleGoToReparations}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 rounded-xl text-xs font-bold transition-colors"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Voir les réparations</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Fiche Propriétaire */}
                  <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                    <div className="flex items-center space-x-2 mb-2">
                      <User className="w-4 h-4 text-slate-700" />
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Propriétaire du véhicule
                      </h4>
                    </div>

                    {client ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-[11px] text-slate-400 font-medium">Nom complet :</span>
                          <p className="font-bold text-slate-900">
                            {client.nom} {client.prenom}
                          </p>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 font-medium">Téléphone :</span>
                          <p className="font-mono font-semibold text-slate-800 flex items-center space-x-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{client.telephone}</span>
                          </p>
                        </div>
                        {client.adresse && (
                          <div className="sm:col-span-2">
                            <span className="text-[11px] text-slate-400 font-medium">Adresse :</span>
                            <p className="text-slate-700 flex items-center space-x-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>{client.adresse}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic">
                        Client ID #{vehicule.id_client} rattaché.
                      </p>
                    )}
                  </div>

                  {/* Suppression réservée au RESPONSABLE */}
                  {isResponsable && (
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-800">Supprimer ce véhicule</p>
                        <p className="text-[11px] text-slate-500">
                          Uniquement possible si aucune réparation ni rendez-vous n'est associé.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span>Supprimer</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VehiculeDetailModal;
