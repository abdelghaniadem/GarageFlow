import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  CheckCheck,
  CalendarDays,
  Loader2,
  Shield,
  Award,
} from 'lucide-react';
import useAuth from '../hooks/useAuth';
import rendezVousService from '../services/rendezVousService';
import clientService from '../services/clientService';
import vehiculeService from '../services/vehiculeService';
import RendezVousList from '../components/rendezvous/RendezVousList';
import RendezVousCreateModal from '../components/rendezvous/RendezVousCreateModal';
import RendezVousDetailModal from '../components/rendezvous/RendezVousDetailModal';
import { ROLES, RENDEZ_VOUS_STATUSES } from '../utils/constants';

/**
 * Page principale de gestion et planification des rendez-vous d'atelier.
 * Réservée strictement au profil RESPONSABLE.
 */
export const RendezVous = () => {
  const { user } = useAuth();
  const isResponsable = user?.role === ROLES.RESPONSABLE;

  const [rendezVous, setRendezVous] = useState([]);
  const [clients, setClients] = useState([]);
  const [vehicules, setVehicules] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [notification, setNotification] = useState(null);

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRdvId, setSelectedRdvId] = useState(null);

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  // Chargement des données
  const loadData = useCallback(async (isManual = false) => {
    if (isManual) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const [rdvData, clData, vehData] = await Promise.all([
        rendezVousService.list(),
        clientService.list().catch(() => []),
        vehiculeService.list().catch(() => []),
      ]);

      setRendezVous(rdvData || []);
      setClients(clData || []);
      setVehicules(vehData || []);
    } catch (err) {
      console.error('Erreur chargement rendez-vous :', err);
      setErrorMessage(err.message || 'Impossible de récupérer la liste des rendez-vous.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Indexation rapide
  const clientsMap = useMemo(() => {
    const map = {};
    clients.forEach((c) => {
      map[c.id_client] = c;
    });
    return map;
  }, [clients]);

  const vehiculesMap = useMemo(() => {
    const map = {};
    vehicules.forEach((v) => {
      map[v.id_vehicule] = v;
    });
    return map;
  }, [vehicules]);

  // Statistiques rapides KPI
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const inSevenDays = new Date();
    inSevenDays.setDate(inSevenDays.getDate() + 7);
    const inSevenDaysStr = inSevenDays.toISOString().split('T')[0];

    let countToday = 0;
    let countWeek = 0;
    let countConfirmed = 0;
    let countPending = 0;

    rendezVous.forEach((r) => {
      const d = r.date_rendezvous;
      const st = (r.statut || '').toUpperCase();

      if (d === todayStr) countToday += 1;
      if (d >= todayStr && d <= inSevenDaysStr) countWeek += 1;
      if (st === RENDEZ_VOUS_STATUSES.CONFIRME) countConfirmed += 1;
      if (st === RENDEZ_VOUS_STATUSES.EN_ATTENTE || st === RENDEZ_VOUS_STATUSES.PLANIFIE) {
        countPending += 1;
      }
    });

    return {
      countToday,
      countWeek,
      countConfirmed,
      countPending,
      totalCount: rendezVous.length,
    };
  }, [rendezVous]);

  // Suppression directe depuis la liste
  const handleDeleteDirect = async (rdvItem) => {
    const isProtected = ['TERMINE', 'HONORE'].includes((rdvItem.statut || '').toUpperCase());
    if (isProtected) {
      showToast(
        'Impossible de supprimer un rendez-vous honoré ou terminé afin de préserver l\'historique d\'atelier.',
        'error'
      );
      return;
    }

    if (
      !window.confirm(
        `Confirmez-vous la suppression du rendez-vous #${rdvItem.id_rendezvous} du ${rdvItem.date_rendezvous} ?`
      )
    ) {
      return;
    }

    try {
      await rendezVousService.delete(rdvItem.id_rendezvous);
      showToast(`Rendez-vous #${rdvItem.id_rendezvous} supprimé avec succès.`);
      loadData(true);
    } catch (err) {
      console.error('Erreur suppression rendez-vous :', err);
      showToast(err.message || 'Impossible de supprimer le rendez-vous.', 'error');
    }
  };

  const handleCreateSuccess = (newRdv) => {
    showToast(`Rendez-vous #${newRdv.id_rendezvous} planifié avec succès.`);
    loadData(true);
  };

  const handleDetailUpdated = () => {
    loadData(true);
  };

  const handleDetailDeleted = (id) => {
    showToast(`Rendez-vous #${id} supprimé avec succès.`);
    setSelectedRdvId(null);
    loadData(true);
  };

  return (
    <div className="space-y-6">
      {/* Toast de notification */}
      {notification && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center space-x-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium animate-in fade-in slide-in-from-bottom-5 duration-200 ${
            notification.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-800'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* En-tête de page */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-md shadow-brand-900/20">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Planning des Rendez-vous
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Planification des réceptions d'atelier, révisions et interventions
              </p>
            </div>
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            title="Rafraîchir les rendez-vous"
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-brand-600' : ''}`} />
          </button>

          {isResponsable && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-sm shadow-brand-900/30 transition-all hover:shadow-md"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouveau rendez-vous
            </button>
          )}
        </div>
      </div>

      {/* Cartes KPI Synthèse */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Aujourd'hui */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Rendez-vous aujourd'hui
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {stats.countToday}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">À accueillir à l'atelier</p>
        </div>

        {/* 7 prochains jours */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Cette semaine
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">
            {stats.countWeek}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Sur les 7 prochains jours</p>
        </div>

        {/* Confirmés */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Confirmés par les clients
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            {stats.countConfirmed}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Créneaux d'atelier validés</p>
        </div>

        {/* En attente */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              En attente / À confirmer
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
            {stats.countPending}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Planifiés ou à reconfirmer</p>
        </div>
      </div>

      {/* Message d'erreur */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-start space-x-2.5">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{errorMessage}</div>
        </div>
      )}

      {/* Chargement initial */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <Loader2 className="w-8 h-8 animate-spin mb-3 text-brand-600" />
          <p className="text-sm font-medium">Chargement du planning de rendez-vous...</p>
        </div>
      ) : (
        <RendezVousList
          rendezVous={rendezVous}
          clientsMap={clientsMap}
          vehiculesMap={vehiculesMap}
          onSelectRdv={(id) => setSelectedRdvId(id)}
          onDeleteRdv={handleDeleteDirect}
          onCreateRdv={() => setIsCreateModalOpen(true)}
        />
      )}

      {/* Modale de création de rendez-vous */}
      <RendezVousCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
        clients={clients}
        vehicules={vehicules}
        existingRendezVous={rendezVous}
      />

      {/* Modale de consultation détaillée & modification */}
      <RendezVousDetailModal
        idRendezVous={selectedRdvId}
        isOpen={Boolean(selectedRdvId)}
        onClose={() => setSelectedRdvId(null)}
        onUpdated={handleDetailUpdated}
        onDeleted={handleDetailDeleted}
        clients={clients}
        vehicules={vehicules}
      />
    </div>
  );
};

export default RendezVous;
