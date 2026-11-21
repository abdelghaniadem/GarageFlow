import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Car,
  Wrench,
  Calendar,
  AlertTriangle,
  Receipt,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

import useAuth from '../hooks/useAuth';
import dashboardService from '../services/dashboardService';
import { ROLES } from '../utils/constants';

import DashboardHeader from '../components/dashboard/DashboardHeader';
import DashboardSkeleton from '../components/dashboard/DashboardSkeleton';
import KpiCard from '../components/dashboard/KpiCard';
import QuickActionsWidget from '../components/dashboard/QuickActionsWidget';
import RepairActivityChart from '../components/dashboard/RepairActivityChart';
import RepairStatusPieChart from '../components/dashboard/RepairStatusPieChart';
import RevenueChart from '../components/dashboard/RevenueChart';
import RecentRepairsWidget from '../components/dashboard/RecentRepairsWidget';
import UpcomingAppointmentsWidget from '../components/dashboard/UpcomingAppointmentsWidget';
import LowStockAlertsWidget from '../components/dashboard/LowStockAlertsWidget';

export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const isResponsable = user?.role === ROLES.RESPONSABLE;

  /**
   * Récupération des données du dashboard depuis l'API Flask
   */
  const loadStats = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);

    try {
      const data = await dashboardService.getStats();
      setStats(data);
    } catch (err) {
      console.error('Erreur lors du chargement des statistiques du tableau de bord :', err);
      setErrorMessage(
        err.message || 'Impossible de charger les statistiques du tableau de bord.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // État de chargement initial : Skeleton complet
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // État d'erreur avec bouton de réessai
  if (errorMessage && !stats) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-rose-200 shadow-sm text-center max-w-lg mx-auto my-12">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">
          Erreur de chargement du tableau de bord
        </h2>
        <p className="text-xs text-slate-600 mb-6">{errorMessage}</p>
        <button
          type="button"
          onClick={() => loadStats(false)}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-500 shadow-xs transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Réessayer</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none">
      {/* 1. En-tête dynamique du tableau de bord */}
      <DashboardHeader
        user={user}
        onRefresh={() => loadStats(true)}
        isRefreshing={isRefreshing}
        onQuickAction={() => navigate('/reparations')}
      />

      {/* 2. Actions Rapides contextuelles */}
      <QuickActionsWidget role={user?.role} />

      {/* 3. Cartes KPI interactives selon le rôle */}
      {isResponsable ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiCard
            title="Clients"
            value={stats?.clients_total}
            icon={Users}
            to="/clients"
            colorScheme="blue"
            subtitle="Fiches enregistrées"
          />
          <KpiCard
            title="Véhicules"
            value={stats?.vehicules_total}
            icon={Car}
            to="/vehicules"
            colorScheme="blue"
            subtitle="Parc d'atelier"
          />
          <KpiCard
            title="En cours"
            value={stats?.reparations_en_cours}
            icon={Wrench}
            to="/reparations"
            colorScheme="amber"
            subtitle="Réparations actives"
          />
          <KpiCard
            title="Aujourd'hui"
            value={stats?.rendez_vous_aujourd_hui}
            icon={Calendar}
            to="/rendez-vous"
            colorScheme="emerald"
            subtitle="Rendez-vous prévus"
          />
          <KpiCard
            title="Factures impayées"
            value={stats?.factures_impayees}
            icon={Receipt}
            to="/factures"
            colorScheme="rose"
            subtitle="En attente de paiement"
            badgeText={stats?.factures_impayees > 0 ? 'À régler' : null}
          />
          <KpiCard
            title="Stock faible"
            value={stats?.stock_faible}
            icon={AlertTriangle}
            to="/pieces"
            colorScheme="purple"
            subtitle={`Sous le seuil (≤ ${stats?.low_stock_threshold || 5})`}
            badgeText={stats?.stock_faible > 0 ? 'Alerte' : null}
          />
        </div>
      ) : (
        /* KPI Cards pour le rôle MECANICIEN */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Mes Réparations en cours"
            value={stats?.reparations_en_cours}
            icon={Wrench}
            to="/reparations"
            colorScheme="amber"
            subtitle="Interventions actives assignées"
          />
          <KpiCard
            title="Mes Réparations terminées"
            value={stats?.reparations_terminees}
            icon={CheckCircle2}
            to="/reparations"
            colorScheme="emerald"
            subtitle="Historique de mes travaux"
          />
          <KpiCard
            title="En attente d'intervention"
            value={stats?.reparations_en_attente}
            icon={Clock}
            to="/reparations"
            colorScheme="blue"
            subtitle="Ordres de travail à démarrer"
          />
          <KpiCard
            title="Alertes Pièces Détachées"
            value={stats?.stock_faible}
            icon={AlertTriangle}
            to="/pieces"
            colorScheme="rose"
            subtitle={`Stock critique (≤ ${stats?.low_stock_threshold || 5})`}
            badgeText={stats?.stock_faible > 0 ? 'Stock bas' : null}
          />
        </div>
      )}

      {/* 4. Graphiques & Visualisations de données */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RepairActivityChart activiteData={stats?.activite_reparations} />
        </div>
        <div>
          <RepairStatusPieChart statusData={stats?.reparations_par_statut} />
        </div>
      </div>

      {/* 5. Évolution du chiffre d'affaires (RESPONSABLE uniquement) */}
      {isResponsable && stats?.evolution_revenus && (
        <div>
          <RevenueChart evolutionData={stats?.evolution_revenus} />
        </div>
      )}

      {/* 6. Activités Récentes, Rendez-vous & Stocks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentRepairsWidget reparations={stats?.reparations_recentes} />
        </div>

        <div>
          {isResponsable ? (
            <UpcomingAppointmentsWidget rendezVous={stats?.rendez_vous_prochains} />
          ) : (
            <LowStockAlertsWidget
              stockAlertes={stats?.stock_alertes}
              lowStockThreshold={stats?.low_stock_threshold}
            />
          )}
        </div>
      </div>

      {/* 7. Section Alertes Stock pour le Responsable (si rendez-vous affiché au-dessus) */}
      {isResponsable && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-3">
            <LowStockAlertsWidget
              stockAlertes={stats?.stock_alertes}
              lowStockThreshold={stats?.low_stock_threshold}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
