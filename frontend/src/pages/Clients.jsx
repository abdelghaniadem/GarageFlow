import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Shield,
  Car,
} from 'lucide-react';
import useAuth from '../hooks/useAuth';
import clientService from '../services/clientService';
import vehiculeService from '../services/vehiculeService';
import ClientList from '../components/clients/ClientList';
import ClientCreateModal from '../components/clients/ClientCreateModal';
import ClientDetailModal from '../components/clients/ClientDetailModal';
import VehiculeCreateModal from '../components/vehicules/VehiculeCreateModal';
import VehiculeDetailModal from '../components/vehicules/VehiculeDetailModal';
import { ROLES, ROLE_LABELS } from '../utils/constants';

export const Clients = () => {
  const { user } = useAuth();
  const isResponsable = user?.role === ROLES.RESPONSABLE;

  const [clients, setClients] = useState([]);
  const [vehicules, setVehicules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [notification, setNotification] = useState(null);

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [editingClient, setEditingClient] = useState(null);

  // Modale création véhicule rapide depuis fiche client
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [preselectedClientId, setPreselectedClientId] = useState(null);

  // Modale consultation véhicule direct
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
      const [clientsData, vehiculesData] = await Promise.all([
        clientService.list(),
        vehiculeService.list().catch(() => []),
      ]);

      setClients(clientsData || []);
      setVehicules(vehiculesData || []);
    } catch (err) {
      console.error('Erreur chargement clients :', err);
      setErrorMessage(err.message || 'Impossible de récupérer la liste des clients.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Carte du nombre de véhicules par client
  const vehiculesCountMap = useMemo(() => {
    const map = {};
    vehicules.forEach((v) => {
      if (v.id_client) {
        map[v.id_client] = (map[v.id_client] || 0) + 1;
      }
    });
    return map;
  }, [vehicules]);

  // Map des clients pour consultations véhicules
  const clientsMap = useMemo(() => {
    const map = {};
    clients.forEach((c) => {
      map[c.id_client] = c;
    });
    return map;
  }, [clients]);

  // Actions CRUD
  const handleClientCreated = (newClient) => {
    setClients((prev) => [newClient, ...prev]);
    showToast(`Client ${newClient.prenom} ${newClient.nom} créé avec succès.`);
  };

  const handleClientUpdated = (updatedClient) => {
    setClients((prev) =>
      prev.map((c) => (c.id_client === updatedClient.id_client ? updatedClient : c))
    );
    showToast(`Fiche client #${updatedClient.id_client} mise à jour avec succès.`);
  };

  const handleClientDeleted = (idClient) => {
    setClients((prev) => prev.filter((c) => c.id_client !== idClient));
    showToast(`Client #${idClient} supprimé.`);
  };

  const handleDirectDelete = async (client) => {
    const vehCount = vehiculesCountMap[client.id_client] || 0;
    if (vehCount > 0) {
      alert(
        `Suppression impossible : ce client possède encore ${vehCount} véhicule(s) associé(s). Veuillez d'abord supprimer ou réassigner ses véhicules.`
      );
      return;
    }

    if (!window.confirm(`Supprimer définitivement le client "${client.nom} ${client.prenom}" ?`)) {
      return;
    }

    try {
      await clientService.delete(client.id_client);
      handleClientDeleted(client.id_client);
    } catch (err) {
      alert(`Erreur : ${err.message || 'Impossible de supprimer ce client.'}`);
    }
  };

  const handleOpenAddVehicle = (client) => {
    setPreselectedClientId(client.id_client);
    setIsAddVehicleOpen(true);
  };

  const handleVehicleCreated = (newVehicule) => {
    setVehicules((prev) => [newVehicule, ...prev]);
    showToast(`Véhicule ${newVehicule.immatriculation} rattaché avec succès.`);
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

      {/* En-tête du Module Clients */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-brand-50 text-brand-600 rounded-xl border border-brand-100 shadow-sm">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Gestion des Clients
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                <Shield className="w-3 h-3 mr-1 text-slate-400" />
                {user?.role ? ROLE_LABELS[user.role] : 'Atelier'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Répertoire des clients particuliers et professionnels, coordonnées et véhicules associés.
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
            title="Rafraîchir la liste des clients"
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
              <span>Nouveau Client</span>
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
            Chargement des profils clients et des véhicules associés...
          </p>
        </div>
      ) : (
        <ClientList
          clients={clients}
          vehiculesCountMap={vehiculesCountMap}
          onSelectClient={(id) => setSelectedClientId(id)}
          onEditClient={(client) => setSelectedClientId(client.id_client)}
          onDeleteClient={handleDirectDelete}
        />
      )}

      {/* Modale de création Client */}
      {isCreateModalOpen && (
        <ClientCreateModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleClientCreated}
        />
      )}

      {/* Modale de consultation / modification Client */}
      {selectedClientId && (
        <ClientDetailModal
          isOpen={Boolean(selectedClientId)}
          idClient={selectedClientId}
          onClose={() => setSelectedClientId(null)}
          onUpdated={handleClientUpdated}
          onDeleted={handleClientDeleted}
          onAddVehicleForClient={handleOpenAddVehicle}
          onSelectVehicle={(idVeh) => setSelectedVehiculeId(idVeh)}
        />
      )}

      {/* Modale création rapide de véhicule pour un client */}
      {isAddVehicleOpen && (
        <VehiculeCreateModal
          isOpen={isAddVehicleOpen}
          onClose={() => {
            setIsAddVehicleOpen(false);
            setPreselectedClientId(null);
          }}
          onSuccess={handleVehicleCreated}
          initialClientId={preselectedClientId}
        />
      )}

      {/* Modale consultation directe d'un véhicule cliqué depuis fiche client */}
      {selectedVehiculeId && (
        <VehiculeDetailModal
          isOpen={Boolean(selectedVehiculeId)}
          idVehicule={selectedVehiculeId}
          onClose={() => setSelectedVehiculeId(null)}
          onUpdated={() => loadData(false)}
          onDeleted={() => {
            setSelectedVehiculeId(null);
            loadData(false);
          }}
          clientsMap={clientsMap}
          userRole={user?.role}
        />
      )}
    </div>
  );
};

export default Clients;
