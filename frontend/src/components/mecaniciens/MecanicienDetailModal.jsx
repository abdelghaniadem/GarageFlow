import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Mail,
  Phone,
  Wrench,
  Calendar,
  Edit2,
  Trash2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Shield,
  Clock,
  Sparkles,
} from 'lucide-react';
import mecanicienService from '../../services/mecanicienService';
import ReparationStatusBadge from '../reparations/ReparationStatusBadge';
import MecanicienSpecialiteBadge from './MecanicienSpecialiteBadge';

const SPECIALITE_SUGGESTIONS = [
  'Moteur & Transmission',
  'Électronique & Diagnostic',
  'Freinage & Liaison au sol',
  'Carrosserie & Peinture',
  'Climatisation & Chauffage',
  'Entretien Général & Révision',
];

/**
 * Modale de consultation détaillée et de modification d'un profil mécanicien.
 * Affiche la liste complète des réparations qui lui sont assignées avec passerelle interactive.
 */
export const MecanicienDetailModal = ({
  isOpen,
  onClose,
  idMecanicien,
  onUpdated,
  onDeleted,
  onSelectReparation,
}) => {
  const [mecanicien, setMecanicien] = useState(null);
  const [reparations, setReparations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  // Mode édition
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    specialite: '',
    telephone: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // État suppression
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConflictError, setDeleteConflictError] = useState(null);

  useEffect(() => {
    if (isOpen && idMecanicien) {
      const loadMecanicienData = async () => {
        setIsLoading(true);
        setErrorMessage(null);
        setDeleteConflictError(null);
        setIsEditing(false);

        try {
          const [mecaData, repData] = await Promise.all([
            mecanicienService.getById(idMecanicien),
            mecanicienService.getReparations(idMecanicien).catch(() => []),
          ]);

          setMecanicien(mecaData);
          setReparations(repData || []);
          setFormData({
            nom: mecaData.utilisateur?.nom || '',
            prenom: mecaData.utilisateur?.prenom || '',
            specialite: mecaData.specialite || '',
            telephone: mecaData.utilisateur?.telephone || '',
          });
        } catch (err) {
          console.error('Erreur chargement détails mécanicien :', err);
          setErrorMessage(err.message || 'Impossible de charger la fiche mécanicien.');
        } finally {
          setIsLoading(false);
        }
      };

      loadMecanicienData();
    }
  }, [isOpen, idMecanicien]);

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
    if (!formData.specialite.trim()) errors.specialite = 'La spécialité est obligatoire.';
    if (formData.telephone && formData.telephone.length > 20) {
      errors.telephone = 'Le numéro de téléphone ne peut pas dépasser 20 caractères.';
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
      const payload = {
        nom: formData.nom.trim(),
        prenom: formData.prenom.trim(),
        specialite: formData.specialite.trim(),
        telephone: formData.telephone.trim() || null,
      };

      const updated = await mecanicienService.update(idMecanicien, payload);
      setMecanicien(updated);
      setIsEditing(false);
      if (onUpdated) onUpdated(updated);
    } catch (err) {
      console.error('Erreur mise à jour mécanicien :', err);
      if (err.details && typeof err.details === 'object') {
        setFormErrors(err.details);
      }
      setErrorMessage(err.message || 'Impossible de mettre à jour le mécanicien.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Êtes-vous sûr de vouloir supprimer définitivement le mécanicien ${mecanicien?.utilisateur?.prenom} ${mecanicien?.utilisateur?.nom} ?`
      )
    ) {
      return;
    }

    setIsDeleting(true);
    setDeleteConflictError(null);

    try {
      await mecanicienService.delete(idMecanicien);
      if (onDeleted) onDeleted(idMecanicien);
      onClose();
    } catch (err) {
      console.error('Erreur suppression mécanicien :', err);
      // Le backend renvoie 409 Conflict si des réparations sont associées
      setDeleteConflictError(
        err.message ||
          'Impossible de supprimer ce mécanicien : des interventions ou ordres de travail lui sont rattachés.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const user = mecanicien?.utilisateur;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* En-tête */}
        <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 text-brand-700 font-bold flex items-center justify-center text-sm shadow-2xs">
              {user ? `${user.prenom?.charAt(0) || ''}${user.nom?.charAt(0) || ''}` : <User className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">
                  {user ? `${user.prenom} ${user.nom}` : 'Fiche Mécanicien'}
                </h3>
                {mecanicien && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-200/80 text-slate-700">
                    ID #{mecanicien.id_mecanicien}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">Profil d'atelier & historique des réparations</p>
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

        {/* Corps */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {isLoading ? (
            <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
              <p className="text-xs font-medium text-slate-500">Chargement de la fiche mécanicien...</p>
            </div>
          ) : errorMessage && !mecanicien ? (
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
                    <span>Suppression impossible (Historique d'atelier)</span>
                  </div>
                  <p className="pl-6">{deleteConflictError}</p>
                </div>
              )}

              {/* Mode édition */}
              {isEditing ? (
                <form onSubmit={handleSaveUpdate} className="space-y-4 bg-slate-50/60 p-4 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                    Modifier les informations
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
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Spécialité technique *
                    </label>
                    <input
                      type="text"
                      name="specialite"
                      value={formData.specialite}
                      onChange={handleInputChange}
                      maxLength={100}
                      list="edit-specialite-suggestions"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900"
                    />
                    <datalist id="edit-specialite-suggestions">
                      {SPECIALITE_SUGGESTIONS.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                    {formErrors.specialite && (
                      <p className="text-[11px] text-rose-600 mt-1">{formErrors.specialite}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      name="telephone"
                      value={formData.telephone}
                      onChange={handleInputChange}
                      maxLength={20}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-mono text-slate-900"
                    />
                    {formErrors.telephone && (
                      <p className="text-[11px] text-rose-600 mt-1">{formErrors.telephone}</p>
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
                /* Mode consultation : Profil */
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Spécialité principale
                    </span>
                    <div>
                      <MecanicienSpecialiteBadge specialite={mecanicien.specialite} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Compte d'accès
                    </span>
                    <p className="text-xs font-mono font-medium text-slate-800">
                      ID Utilisateur #{mecanicien.id_utilisateur} (Rôle {user?.role || 'MECANICIEN'})
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Email de connexion
                    </span>
                    <div className="flex items-center space-x-1.5 text-slate-800 text-xs">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{user?.email || 'Non renseigné'}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Numéro de contact
                    </span>
                    <div className="flex items-center space-x-1.5 text-slate-800 text-xs font-mono">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{user?.telephone || <em className="text-slate-400 font-sans">Non renseigné</em>}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Section Réparations assignées */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Wrench className="w-4 h-4 text-slate-700" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Réparations assignées ({reparations.length})
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Ordres de travail pris en charge par ce mécanicien
                  </span>
                </div>

                {reparations.length === 0 ? (
                  <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center space-y-1">
                    <Wrench className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs text-slate-500 font-medium">
                      Aucune intervention n'est actuellement assignée à ce mécanicien.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {reparations.map((rep) => (
                      <div
                        key={rep.id_reparation}
                        onClick={() => onSelectReparation && onSelectReparation(rep.id_reparation)}
                        className="p-3 bg-white border border-slate-200 rounded-xl hover:border-brand-300 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between gap-3 text-xs group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                              REP-#{rep.id_reparation}
                            </span>
                            <span className="text-slate-400">•</span>
                            <span className="text-[11px] text-slate-500 flex items-center space-x-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>{rep.date_reparation || 'Date non définie'}</span>
                            </span>
                          </div>
                          <p className="text-slate-600 truncate mt-0.5">{rep.description}</p>
                        </div>

                        <div className="flex items-center space-x-3 flex-shrink-0">
                          <ReparationStatusBadge statut={rep.statut} size="small" />
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Zone Danger : Suppression du profil */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">Supprimer ce profil mécanicien</p>
                  <p className="text-[11px] text-slate-500">
                    Uniquement possible si aucune réparation n'a jamais été assignée à ce mécanicien.
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

export default MecanicienDetailModal;
