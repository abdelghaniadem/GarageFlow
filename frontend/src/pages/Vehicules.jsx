import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Car,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Shield,
  Info,
} from 'lucide-react';
import useAuth from '../hooks/useAuth';
import vehiculeService from '../services/vehiculeService';
import clientService from '../services/clientService';
import VehiculeList from '../components/vehicules/VehiculeList';
import VehiculeCreateModal from '../components/vehicules/VehiculeCreateModal';
import VehiculeDetailModal from '../components/vehicules/VehiculeDetailModal';
import { ROLES, ROLE_LABELS } from '../utils/constants';

export const Vehicules = () => {
  const { user } = useAuth();
  const isResponsable = user?.role === ROLES.RESPONSABLE;

  const [vehicules, setVehicules] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [notification, setNotification] = useState(null);

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedVehiculeId, setSelectedVehiculeId] = useState(null);

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
      // 1. Liste des véhicules (accessible aux deux profils)
      const vehPromise = vehiculeService.list();

      // 2. Liste des clients (uniquement pour RESPONSABLE afin d'enrichir l'affichage propriétaire)
      const promises = [vehPromise];
      if (isResponsable) {
        promises.push(clientService.list().catch(() => []));
      }

      const results = await Promise.all(promises);
      setVehicules(results[0] || []);
      if (isResponsable && results[1]) {
        setClients(results[1] || []);
      }
    } catch (err) {
      console.error('Erreur chargement parc de véhicules :', err);
      setErrorMessage(err.message || 'Impossible de charger la liste des véhicules.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isResponsable]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Carte de recherche rapide client O(1)
  const clientsMap = useMemo(() => {
    const map = {};
    clients.forEach((c) => {
      map[c.id_client] = c;
    });
    return map;
  }, [clients]);

  // Actions CRUD
  const handleVehiculeCreated = (newVehicule) => {
    setVehicules((prev) => [newVehicule, ...prev]);
    showToast(`Véhicule ${newVehicule.immatriculation} ajouté avec succès au parc.`);
  };

  const handleVehiculeUpdated = (updatedVehicule) => {
    setVehicules((prev) =>
      prev.map((v) => (v.id_vehicule === updatedVehicule.id_vehicule ? updatedVehicule : v))
    );
    showToast(`Véhicule ${updatedVehicule.immatriculation} mis à jour avec succès.`);
  };

  const handleVehiculeDeleted = (idVehicule) => {
    setVehicules((prev) => prev.filter((v) => v.id_vehicule !== idVehicule));
    showToast(`Véhicule #${idVehicule} supprimé avec succès.`);
  };

  const handleDirectDelete = async (vehicule) => {
    if (
      !window.confirm(
        `Supprimer définitivement le véhicule ${vehicule.immatriculation} (${vehicule.marque} ${vehicule.modele}) ?`
      )
    ) {
      return;
    }

    try {
      await vehiculeService.delete(vehicule.id_vehicule);
      handleVehiculeDeleted(vehicule.id_vehicule);
    } catch (err) {
      alert(`Erreur : ${err.message || 'Impossible de supprimer ce véhicule.'}`);
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

      {/* En-tête du Module Véhicules */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-brand-50 text-brand-600 rounded-xl border border-brand-100 shadow-sm">
            <Car className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Parc de Véhicules
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                <Shield className="w-3 h-3 mr-1 text-slate-400" />
                {user?.role ? ROLE_LABELS[user.role] : 'Atelier'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {isResponsable
                ? "Fiches techniques, immatriculations, kilométrages et propriétaires rattachés."
                : "Consultation des caractéristiques techniques et immatriculations du parc d'atelier."}
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
            title="Rafraîchir la liste des véhicules"
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
              <span>Nouveau Véhicule</span>
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

      {/* Contenu principal */}
      {isLoading ? (
        <div className="bg-white rounded-xl p-16 border border-slate-200 text-center flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          <p className="text-xs font-medium text-slate-500">
            Chargement des données du parc de véhicules...
          </p>
        </div>
      ) : (
        <VehiculeList
          vehicules={vehicules}
          clientsMap={clientsMap}
          onSelectVehicule={(id) => setSelectedVehiculeId(id)}
          onEditVehicule={(veh) => setSelectedVehiculeId(veh.id_vehicule)}
          onDeleteVehicule={handleDirectDelete}
          userRole={user?.role}
        />
      )}

      {/* Modale de création Véhicule (RESPONSABLE) */}
      {isCreateModalOpen && (
        <VehiculeCreateModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleVehiculeCreated}
        />
      )}

      {/* Modale de consultation / modification Véhicule */}
      {selectedVehiculeId && (
        <VehiculeDetailModal
          isOpen={Boolean(selectedVehiculeId)}
          idVehicule={selectedVehiculeId}
          onClose={() => setSelectedVehiculeId(null)}
          onUpdated={handleVehiculeUpdated}
          onDeleted={handleVehiculeDeleted}
          clientsMap={clientsMap}
          userRole={user?.role}
        />
      )}
    </div>
  );
};

export default Vehicules;
