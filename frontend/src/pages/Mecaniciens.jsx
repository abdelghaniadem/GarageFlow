import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  UserCog,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Shield,
  Wrench,
} from 'lucide-react';
import useAuth from '../hooks/useAuth';
import mecanicienService from '../services/mecanicienService';
import reparationService from '../services/reparationService';
import MecanicienList from '../components/mecaniciens/MecanicienList';
import MecanicienCreateModal from '../components/mecaniciens/MecanicienCreateModal';
import MecanicienDetailModal from '../components/mecaniciens/MecanicienDetailModal';
import ReparationDetailModal from '../components/reparations/ReparationDetailModal';
import { ROLES, ROLE_LABELS } from '../utils/constants';

export const Mecaniciens = () => {
  const { user } = useAuth();
  const isResponsable = user?.role === ROLES.RESPONSABLE;

  const [mecaniciens, setMecaniciens] = useState([]);
  const [reparations, setReparations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [notification, setNotification] = useState(null);

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedMecanicienId, setSelectedMecanicienId] = useState(null);
  const [selectedReparationId, setSelectedReparationId] = useState(null);

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  const loadData = useCallback(async (isManual = false) => {
    if (isManual) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const [mecaniciensData, reparationsData] = await Promise.all([
        mecanicienService.list(),
        reparationService.list().catch(() => []),
      ]);

      setMecaniciens(mecaniciensData || []);
      setReparations(reparationsData || []);
    } catch (err) {
      console.error('Erreur chargement mécaniciens :', err);
      setErrorMessage(err.message || 'Impossible de récupérer la liste des mécaniciens.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Carte du nombre de réparations assignées par mécanicien
  const reparationsCountMap = useMemo(() => {
    const map = {};
    reparations.forEach((r) => {
      if (r.id_mecanicien) {
        map[r.id_mecanicien] = (map[r.id_mecanicien] || 0) + 1;
      }
    });
    return map;
  }, [reparations]);

  // Actions CRUD
  const handleMecanicienCreated = (newMeca) => {
    setMecaniciens((prev) => [newMeca, ...prev]);
    showToast(
      `Mécanicien ${newMeca.utilisateur?.prenom} ${newMeca.utilisateur?.nom} (${newMeca.specialite}) créé avec succès.`
    );
  };

  const handleMecanicienUpdated = (updatedMeca) => {
    setMecaniciens((prev) =>
      prev.map((m) => (m.id_mecanicien === updatedMeca.id_mecanicien ? updatedMeca : m))
    );
    showToast(`Profil mécanicien #${updatedMeca.id_mecanicien} mis à jour avec succès.`);
  };

  const handleMecanicienDeleted = (idMecanicien) => {
    setMecaniciens((prev) => prev.filter((m) => m.id_mecanicien !== idMecanicien));
    showToast(`Mécanicien #${idMecanicien} supprimé avec succès.`);
  };

  const handleDirectDelete = async (meca) => {
    const repCount = reparationsCountMap[meca.id_mecanicien] || 0;
    if (repCount > 0) {
      alert(
        `Suppression impossible : ce mécanicien a ${repCount} réparation(s) assignée(s). Veuillez d'abord réassigner ou archiver ces réparations.`
      );
      return;
    }

    if (
      !window.confirm(
        `Supprimer définitivement le mécanicien ${meca.utilisateur?.prenom} ${meca.utilisateur?.nom} ?`
      )
    ) {
      return;
    }

    try {
      await mecanicienService.delete(meca.id_mecanicien);
      handleMecanicienDeleted(meca.id_mecanicien);
    } catch (err) {
      alert(`Erreur : ${err.message || 'Impossible de supprimer ce mécanicien.'}`);
    }
  };

  return (
    <div className="space-y-6 select-none">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center space-x-3 text-xs shadow-md transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          )}
          <span className="font-semibold">{notification.message}</span>
        </div>
      )}

      {/* En-tête du Module Mécaniciens */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-brand-50 text-brand-600 rounded-xl border border-brand-100 shadow-sm">
            <UserCog className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Gestion des Mécaniciens
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                <Shield className="w-3 h-3 mr-1 text-slate-400" />
                {user?.role ? ROLE_LABELS[user.role] : 'Atelier'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Équipe technique d'atelier, spécialités, comptes d'accès et réparations assignées.
            </p>
          </div>
        </div>

        {/* Boutons d'action Header */}
        <div className="flex items-center space-x-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50"
            title="Rafraîchir la liste des mécaniciens"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>

          {isResponsable && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-900/20 transition-all duration-150"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau Mécanicien</span>
            </button>
          )}
        </div>
      </div>

      {/* Message d'erreur de chargement */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => loadData(false)}
            className="px-3 py-1 bg-white border border-rose-300 rounded text-rose-800 font-semibold hover:bg-rose-100"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Contenu principal */}
      {isLoading ? (
        <div className="bg-white rounded-xl p-16 border border-slate-200 text-center flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          <p className="text-xs font-medium text-slate-500">
            Chargement des profils mécaniciens et des interventions assignées...
          </p>
        </div>
      ) : (
        <MecanicienList
          mecaniciens={mecaniciens}
          reparationsCountMap={reparationsCountMap}
          onSelectMecanicien={(id) => setSelectedMecanicienId(id)}
          onEditMecanicien={(meca) => setSelectedMecanicienId(meca.id_mecanicien)}
          onDeleteMecanicien={handleDirectDelete}
        />
      )}

      {/* Modale de création Mécanicien (RESPONSABLE) */}
      {isCreateModalOpen && (
        <MecanicienCreateModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleMecanicienCreated}
        />
      )}

      {/* Modale de consultation / modification Mécanicien */}
      {selectedMecanicienId && (
        <MecanicienDetailModal
          isOpen={Boolean(selectedMecanicienId)}
          idMecanicien={selectedMecanicienId}
          onClose={() => setSelectedMecanicienId(null)}
          onUpdated={handleMecanicienUpdated}
          onDeleted={handleMecanicienDeleted}
          onSelectReparation={(idRep) => setSelectedReparationId(idRep)}
        />
      )}

      {/* Modale consultation détaillée de la réparation sélectionnée depuis la fiche mécanicien */}
      {selectedReparationId && (
        <ReparationDetailModal
          isOpen={Boolean(selectedReparationId)}
          idReparation={selectedReparationId}
          onClose={() => setSelectedReparationId(null)}
          onUpdated={() => loadData(false)}
          onDeleted={() => {
            setSelectedReparationId(null);
            loadData(false);
          }}
          userRole={user?.role}
        />
      )}
    </div>
  );
};

export default Mecaniciens;
