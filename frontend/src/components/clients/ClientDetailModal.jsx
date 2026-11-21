import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Phone,
  MapPin,
  Car,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Calendar,
  Gauge,
  Shield,
  ChevronRight,
} from 'lucide-react';
import clientService from '../../services/clientService';
import vehiculeService from '../../services/vehiculeService';
import { validateTunisianPhone } from '../../utils/tunisia';

/**
 * Modale de consultation détaillée et modification d'un client.
 * Affiche également la liste en temps réel des véhicules associés.
 */
export const ClientDetailModal = ({
  isOpen,
  onClose,
  idClient,
  onUpdated,
  onDeleted,
  onAddVehicleForClient,
  onSelectVehicle,
}) => {
  const [client, setClient] = useState(null);
  const [vehicules, setVehicules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  // Mode édition
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    adresse: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // État suppression
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConflictError, setDeleteConflictError] = useState(null);

  // Chargement des détails client et de ses véhicules
  useEffect(() => {
    if (isOpen && idClient) {
      const loadClientData = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        setDeleteConflictError(null);
        setIsEditing(false);

        try {
          const [clientData, vehiculesData] = await Promise.all([
            clientService.getById(idClient),
            vehiculeService.list({ id_client: idClient }),
          ]);

          setClient(clientData);
          setVehicules(vehiculesData || []);
          setFormData({
            nom: clientData.nom || '',
            prenom: clientData.prenom || '',
            telephone: clientData.telephone || '',
            adresse: clientData.adresse || '',
          });
        } catch (err) {
          console.error('Erreur chargement détails client :', err);
          setErrorMessage(err.message || 'Impossible de charger le dossier client.');
        } finally {
          setIsLoading(false);
        }
      };

      loadClientData();
    }
  }, [isOpen, idClient]);

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const errors = {};
    if (!formData.nom.trim()) errors.nom = 'Le nom est obligatoire.';
    if (!formData.prenom.trim()) errors.prenom = 'Le prénom est obligatoire.';
    
    const phoneVal = validateTunisianPhone(formData.telephone);
    if (!phoneVal.isValid) {
      errors.telephone = phoneVal.error;
    }

    if (formData.adresse && formData.adresse.length > 150) {
      errors.adresse = "L'adresse ne peut pas dépasser 150 caractères.";
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
      const phoneVal = validateTunisianPhone(formData.telephone);
      const payload = {
        nom: formData.nom.trim(),
        prenom: formData.prenom.trim(),
        telephone: phoneVal.normalized || formData.telephone.trim(),
        adresse: formData.adresse.trim() || null,
      };

      const updated = await clientService.update(idClient, payload);
      setClient(updated);
      setIsEditing(false);
      if (onUpdated) onUpdated(updated);
    } catch (err) {
      console.error('Erreur mise à jour client :', err);
      if (err.details && typeof err.details === 'object') {
        setFormErrors(err.details);
      }
      setErrorMessage(err.message || 'Impossible de mettre à jour le client.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Êtes-vous sûr de vouloir supprimer définitivement le client "${client.nom} ${client.prenom}" ?`
      )
    ) {
      return;
    }

    setIsDeleting(true);
    setDeleteConflictError(null);

    try {
      await clientService.delete(idClient);
      if (onDeleted) onDeleted(idClient);
      onClose();
    } catch (err) {
      console.error('Erreur suppression client :', err);
      // Le backend renvoie 409 Conflict si des véhicules ou rendez-vous existent
      setDeleteConflictError(
        err.message ||
          'Impossible de supprimer ce client : des véhicules ou rendez-vous sont encore rattachés à son dossier.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* En-tête */}
        <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 text-brand-700 font-bold flex items-center justify-center text-sm shadow-2xs">
              {client ? `${client.prenom?.charAt(0) || ''}${client.nom?.charAt(0) || ''}` : <User className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">
                  {client ? `${client.prenom} ${client.nom}` : 'Fiche Client'}
                </h3>
                {client && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-200/80 text-slate-700">
                    ID #{client.id_client}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">Coordonnées personnelles & véhicules rattachés</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {!isLoading && !isEditing && (
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

        {/* Corps de la modale */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {isLoading ? (
            <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
              <p className="text-xs font-medium text-slate-500">Chargement de la fiche client...</p>
            </div>
          ) : errorMessage && !client ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          ) : (
            <>
              {/* Alerte conflit de suppression */}
              {deleteConflictError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs space-y-1">
                  <div className="flex items-center space-x-2 font-bold text-rose-900">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>Suppression impossible (Intégrité référentielle)</span>
                  </div>
                  <p className="pl-6">{deleteConflictError}</p>
                </div>
              )}

              {/* Mode édition */}
              {isEditing ? (
                <form onSubmit={handleSaveUpdate} className="space-y-4 bg-slate-50/60 p-4 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                    Modifier les coordonnées
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nom de famille *
                      </label>
                      <input
                        type="text"
                        name="nom"
                        value={formData.nom}
                        onChange={handleInputChange}
                        maxLength={50}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900"
                      />
                      {formErrors.nom && <p className="text-[11px] text-rose-600 mt-1">{formErrors.nom}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Prénom *
                      </label>
                      <input
                        type="text"
                        name="prenom"
                        value={formData.prenom}
                        onChange={handleInputChange}
                        maxLength={50}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900"
                      />
                      {formErrors.prenom && <p className="text-[11px] text-rose-600 mt-1">{formErrors.prenom}</p>}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Numéro de téléphone *
                      </label>
                      <span className="text-[10px] text-slate-400">8 chiffres (ex: 98 123 456 ou +216 98 123 456)</span>
                    </div>
                    <input
                      type="tel"
                      name="telephone"
                      value={formData.telephone}
                      onChange={handleInputChange}
                      placeholder="Ex: 98 123 456 ou +216 98 123 456"
                      maxLength={20}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-mono text-slate-900"
                    />
                    {formErrors.telephone && (
                      <p className="text-[11px] text-rose-600 mt-1">{formErrors.telephone}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Adresse postale (max 150 caractères)
                    </label>
                    <textarea
                      name="adresse"
                      rows={2}
                      value={formData.adresse}
                      onChange={handleInputChange}
                      maxLength={150}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none text-slate-900"
                    />
                    {formErrors.adresse && (
                      <p className="text-[11px] text-rose-600 mt-1">{formErrors.adresse}</p>
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
                /* Mode consultation : Coordonnées */
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Nom complet
                    </span>
                    <p className="text-sm font-bold text-slate-900">
                      {client.nom} {client.prenom}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Téléphone principal
                    </span>
                    <div className="flex items-center space-x-1.5 text-slate-800 text-sm font-mono font-medium">
                      <Phone className="w-3.5 h-3.5 text-brand-600" />
                      <span>{client.telephone}</span>
                    </div>
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Adresse de facturation / domicile
                    </span>
                    <div className="flex items-start space-x-1.5 text-slate-700 text-xs">
                      <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                      <span>{client.adresse || <em className="text-slate-400">Aucune adresse renseignée</em>}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Section Véhicules associés */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Car className="w-4 h-4 text-slate-700" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Véhicules associés ({vehicules.length})
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (onAddVehicleForClient) {
                        onAddVehicleForClient(client);
                      }
                    }}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Rattacher un véhicule</span>
                  </button>
                </div>

                {vehicules.length === 0 ? (
                  <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center space-y-2">
                    <Car className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs text-slate-500 font-medium">
                      Aucun véhicule n'est rattaché à ce client actuellement.
                    </p>
                    <button
                      type="button"
                      onClick={() => onAddVehicleForClient && onAddVehicleForClient(client)}
                      className="inline-flex items-center space-x-1 text-xs text-brand-600 font-bold hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Ajouter le premier véhicule</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {vehicules.map((veh) => (
                      <div
                        key={veh.id_vehicule}
                        onClick={() => onSelectVehicle && onSelectVehicle(veh.id_vehicule)}
                        className="p-3 bg-white border border-slate-200 rounded-xl hover:border-brand-300 hover:shadow-xs transition-all cursor-pointer group"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="inline-block px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-[11px] font-black font-mono tracking-wider text-slate-800">
                              {veh.immatriculation}
                            </div>
                            <h5 className="text-xs font-bold text-slate-900 mt-1 group-hover:text-brand-600 transition-colors">
                              {veh.marque} {veh.modele}
                            </h5>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                        </div>

                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                          <span className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>{veh.annee || 'N/A'}</span>
                          </span>
                          <span className="flex items-center space-x-1 font-mono">
                            <Gauge className="w-3 h-3 text-slate-400" />
                            <span>{veh.kilometrage ? `${veh.kilometrage.toLocaleString()} km` : 'N/A'}</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Zone Danger : Suppression du client */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">Supprimer ce dossier client</p>
                  <p className="text-[11px] text-slate-500">
                    Uniquement possible s'il ne possède aucun véhicule ni rendez-vous rattaché.
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientDetailModal;
