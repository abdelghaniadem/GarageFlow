import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Receipt,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Clock,
  TrendingUp,
  AlertTriangle,
  Loader2,
  Shield,
} from 'lucide-react';
import useAuth from '../hooks/useAuth';
import factureService from '../services/factureService';
import reparationService from '../services/reparationService';
import vehiculeService from '../services/vehiculeService';
import clientService from '../services/clientService';
import FactureList from '../components/factures/FactureList';
import FactureCreateModal from '../components/factures/FactureCreateModal';
import FactureDetailModal from '../components/factures/FactureDetailModal';
import { ROLES, FACTURE_STATUSES } from '../utils/constants';

/**
 * Page principale de gestion de la facturation et comptabilité atelier GarageFlow.
 * Réservée strictement au profil RESPONSABLE.
 */
export const Factures = () => {
  const { user } = useAuth();
  const isResponsable = user?.role === ROLES.RESPONSABLE;

  const [factures, setFactures] = useState([]);
  const [reparations, setReparations] = useState([]);
  const [vehicules, setVehicules] = useState([]);
  const [clients, setClients] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [notification, setNotification] = useState(null);

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedFactureId, setSelectedFactureId] = useState(null);

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
      const [facturesData, repData, vehData, clData] = await Promise.all([
        factureService.list(),
        reparationService.list().catch(() => []),
        vehiculeService.list().catch(() => []),
        clientService.list().catch(() => []),
      ]);

      setFactures(facturesData || []);
      setReparations(repData || []);
      setVehicules(vehData || []);
      setClients(clData || []);
    } catch (err) {
      console.error('Erreur chargement données factures :', err);
      setErrorMessage(err.message || 'Impossible de récupérer la liste des factures.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Indexation rapide des entités associées
  const reparationsMap = useMemo(() => {
    const map = {};
    reparations.forEach((r) => {
      map[r.id_reparation] = r;
    });
    return map;
  }, [reparations]);

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

  // Statistiques financières KPI
  const stats = useMemo(() => {
    let totalFacture = 0;
    let totalPaye = 0;
    let totalEnAttente = 0;
    let countEnAttente = 0;
    let countImpayees = 0;

    factures.forEach((f) => {
      const amount = Number(f.montant_total || 0);
      totalFacture += amount;
      const st = (f.statut_paiement || '').toUpperCase();
      if (st === FACTURE_STATUSES.PAYEE) {
        totalPaye += amount;
      } else if (st === FACTURE_STATUSES.EN_ATTENTE) {
        totalEnAttente += amount;
        countEnAttente += 1;
      } else if (st === FACTURE_STATUSES.IMPAYEE || st === FACTURE_STATUSES.NON_PAYEE) {
        countImpayees += 1;
      }
    });

    return {
      totalFacture,
      totalPaye,
      totalEnAttente,
      countEnAttente,
      countImpayees,
      totalCount: factures.length,
    };
  }, [factures]);

  // Action rapide : passer une facture en "PAYEE"
  const handleQuickPay = async (idFacture) => {
    try {
      await factureService.updateStatut(idFacture, FACTURE_STATUSES.PAYEE);
      showToast(`Facture #FAC-${String(idFacture).padStart(4, '0')} marquée comme payée avec succès.`);
      loadData(true);
    } catch (err) {
      console.error('Erreur validation paiement facture :', err);
      showToast(err.message || 'Impossible de mettre à jour le statut de paiement.', 'error');
    }
  };

  const handleCreateSuccess = (newFacture) => {
    showToast(`Facture #FAC-${String(newFacture.id_facture).padStart(4, '0')} émise avec succès.`);
    loadData(true);
  };

  const handleDetailUpdated = () => {
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
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Facturation & Règlements
              </h1>
              <p className="text-xs text-slate-500">
                Émission, suivi comptable et encaissement des réparations d'atelier
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
            title="Rafraîchir les données"
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs"
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
              Émettre une facture
            </button>
          )}
        </div>
      </div>

      {/* Cartes KPI Synthèse Financière */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Facturé */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">
              Total facturé
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-slate-900 mt-2 font-mono">
            {stats.totalFacture.toLocaleString('fr-TN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            TND
          </p>
          <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
            <span>{stats.totalCount} facture(s) émise(s)</span>
          </div>
        </div>

        {/* Total Encaissé */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">
              Total encaissé (Payé)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-emerald-700 mt-2 font-mono">
            {stats.totalPaye.toLocaleString('fr-TN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            TND
          </p>
          <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
            <span>
              {stats.totalFacture > 0
                ? `${Math.round((stats.totalPaye / stats.totalFacture) * 100)}% encaissé`
                : '0% encaissé'}
            </span>
          </div>
        </div>

        {/* En attente de règlement */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">
              En attente de paiement
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-amber-700 mt-2 font-mono">
            {stats.totalEnAttente.toLocaleString('fr-TN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            TND
          </p>
          <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
            <span>{stats.countEnAttente} facture(s) en attente</span>
          </div>
        </div>

        {/* Factures impayées ou partielles */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">
              Factures impayées / litiges
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-rose-700 mt-2 font-mono">
            {stats.countImpayees}
          </p>
          <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
            <span>Nécessitent un suivi client</span>
          </div>
        </div>
      </div>

      {/* Message d'erreur de chargement */}
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
          <p className="text-sm font-medium">Chargement des factures et du grand livre comptable...</p>
        </div>
      ) : (
        <FactureList
          factures={factures}
          reparationsMap={reparationsMap}
          vehiculesMap={vehiculesMap}
          clientsMap={clientsMap}
          onSelectFacture={(id) => setSelectedFactureId(id)}
          onQuickPay={handleQuickPay}
          onCreateFacture={() => setIsCreateModalOpen(true)}
        />
      )}

      {/* Modale d'émission de facture */}
      <FactureCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
        reparations={reparations}
        vehiculesMap={vehiculesMap}
        clientsMap={clientsMap}
        existingFactures={factures}
      />

      {/* Modale de consultation détaillée de facture */}
      <FactureDetailModal
        idFacture={selectedFactureId}
        isOpen={Boolean(selectedFactureId)}
        onClose={() => setSelectedFactureId(null)}
        onUpdated={handleDetailUpdated}
      />
    </div>
  );
};

export default Factures;
