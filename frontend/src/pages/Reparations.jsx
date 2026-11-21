import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ClipboardList,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Wrench,
  Loader2,
  Shield,
} from 'lucide-react';
import useAuth from '../hooks/useAuth';
import reparationService from '../services/reparationService';
import vehiculeService from '../services/vehiculeService';
import clientService from '../services/clientService';
import mecanicienService from '../services/mecanicienService';
import ReparationList from '../components/reparations/ReparationList';
import ReparationCreateModal from '../components/reparations/ReparationCreateModal';
import ReparationDetailModal from '../components/reparations/ReparationDetailModal';
import { ROLES, ROLE_LABELS } from '../utils/constants';

export const Reparations = () => {
  const { user } = useAuth();
  const isResponsable = user?.role === ROLES.RESPONSABLE;

  const [reparations, setReparations] = useState([]);
  const [vehicules, setVehicules] = useState([]);
  const [clients, setClients] = useState([]);
  const [mecaniciens, setMecaniciens] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [notification, setNotification] = useState(null);

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedReparationId, setSelectedReparationId] = useState(null);

  // Chargement complet des données
  const loadData = useCallback(async (isManual = false) => {
    if (isManual) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      // 1. Récupération des réparations (filtrées par le backend pour mécanicien)
      const repPromise = reparationService.list();
      // 2. Récupération des véhicules (accessible aux deux rôles)
      const vehPromise = vehiculeService.list();

      // 3. Récupération des clients et mécaniciens (seulement si RESPONSABLE)
      const promises = [repPromise, vehPromise];
      if (isResponsable) {
        promises.push(clientService.list().catch(() => []));
        promises.push(mecanicienService.list().catch(() => []));
      }

      const results = await Promise.all(promises);
      setReparations(results[0] || []);
      setVehicules(results[1] || []);
      if (isResponsable) {
        setClients(results[2] || []);
        setMecaniciens(results[3] || []);
      }
    } catch (err) {
      console.error('Erreur chargement données réparations :', err);
      setErrorMessage(err.message || 'Impossible de récupérer la liste des réparations.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isResponsable]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Construction des dictionnaires de recherche O(1)
  const vehiculesMap = useMemo(() => {
    const map = {};
    vehicules.forEach((v) => {
      map[v.id_vehicule] = v;
    });
    return map;
  }, [vehicules]);

  const clientsMap = useMemo(() => {
    const map = {};
    clients.forEach((c) => {
      map[c.id_client] = c;
    });
    return map;
  }, [clients]);

  const mecaniciensMap = useMemo(() => {
    const map = {};
    mecaniciens.forEach((m) => {
      map[m.id_mecanicien] = m;
    });
    return map;
  }, [mecaniciens]);

  // Notification temporaire
  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  // Suppression d'une réparation
  const handleDeleteReparation = async (idReparation) => {
    if (!window.confirm(`Supprimer définitivement l'ordre de réparation #${idReparation} ?`)) {
      return;
    }

    try {
      await reparationService.delete(idReparation);
      setReparations((prev) => prev.filter((r) => r.id_reparation !== idReparation));
      showToast(`Réparation #${idReparation} supprimée avec succès.`);
    } catch (err) {
      alert(`Erreur : ${err.message || 'Impossible de supprimer cette réparation.'}`);
    }
  };

  // Après création
  const handleCreated = (newRep) => {
    setReparations((prev) => [newRep, ...prev]);
    showToast(`Nouvelle réparation créée (Réf: REP-#${newRep.id_reparation}).`);
  };

  // Après mise à jour
  const handleUpdated = (updatedRep) => {
    setReparations((prev) =>
      prev.map((r) => (r.id_reparation === updatedRep.id_reparation ? updatedRep : r))
    );
    showToast(`Réparation #${updatedRep.id_reparation} mise à jour avec succès.`);
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

      {/* En-tête du Module Réparations */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-brand-50 text-brand-600 rounded-xl border border-brand-100 shadow-sm">
            <ClipboardList className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Gestion des Réparations
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                <Shield className="w-3 h-3 mr-1 text-slate-400" />
                {user?.role ? ROLE_LABELS[user.role] : 'Atelier'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {isResponsable
                ? "Ordres de travail, assignations mécaniciens, statuts et pièces consommées."
                : "Vos réparations assignées : mise à jour des diagnostics, statuts et pièces d'atelier."}
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
            title="Rafraîchir la liste"
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
              <span>Nouvelle Réparation</span>
            </button>
          )}
        </div>
      </div>

      {/* Message d'erreur initial */}
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

      {/* Contenu principal : Liste et filtres */}
      {isLoading ? (
        <div className="bg-white rounded-xl p-16 border border-slate-200 text-center flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          <p className="text-xs font-medium text-slate-500">
            Chargement des ordres de réparation et des références d'atelier...
          </p>
        </div>
      ) : (
        <ReparationList
          reparations={reparations}
          vehiculesMap={vehiculesMap}
          clientsMap={clientsMap}
          mecaniciensMap={mecaniciensMap}
          onSelectReparation={(id) => setSelectedReparationId(id)}
          onDeleteReparation={handleDeleteReparation}
          userRole={user?.role}
        />
      )}

      {/* Modale de création d'ordre de réparation (RESPONSABLE) */}
      {isCreateModalOpen && (
        <ReparationCreateModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleCreated}
        />
      )}

      {/* Modale de consultation et mise à jour détaillée */}
      {selectedReparationId && (
        <ReparationDetailModal
          idReparation={selectedReparationId}
          isOpen={Boolean(selectedReparationId)}
          onClose={() => setSelectedReparationId(null)}
          onUpdated={handleUpdated}
          onDeleted={(id) => {
            setReparations((prev) => prev.filter((r) => r.id_reparation !== id));
            showToast(`Réparation #${id} supprimée.`);
          }}
          userRole={user?.role}
        />
      )}
    </div>
  );
};

export default Reparations;
