import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/common/ProtectedRoute';
import PublicRoute from '../components/common/PublicRoute';
import AppLayout from '../components/layout/AppLayout';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { ROLES } from '../utils/constants';

// Lazy loading des pages pour le code splitting et l'optimisation des performances
const Login = lazy(() => import('../pages/Login'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const Clients = lazy(() => import('../pages/Clients'));
const Vehicules = lazy(() => import('../pages/Vehicules'));
const Mecaniciens = lazy(() => import('../pages/Mecaniciens'));
const Reparations = lazy(() => import('../pages/Reparations'));
const PiecesDetachees = lazy(() => import('../pages/PiecesDetachees'));
const Factures = lazy(() => import('../pages/Factures'));
const RendezVous = lazy(() => import('../pages/RendezVous'));
const Unauthorized = lazy(() => import('../pages/Unauthorized'));
const NotFound = lazy(() => import('../pages/NotFound'));

export const AppRoutes = () => {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 text-slate-100">
          <LoadingSpinner fullScreen message="Chargement du module GarageFlow..." />
        </div>
      }
    >
      <Routes>
        {/* Route publique : Login (redirection vers dashboard si déjà connecté) */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        {/* Routes protégées dans le Layout de l'application */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Modules accessibles à tous les profils authentifiés (RESPONSABLE & MECANICIEN) */}
          <Route path="/dashboard" element={<Dashboard />} />

          <Route
            path="/vehicules"
            element={
              <ProtectedRoute allowedRoles={[ROLES.RESPONSABLE, ROLES.MECANICIEN]}>
                <Vehicules />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reparations"
            element={
              <ProtectedRoute allowedRoles={[ROLES.RESPONSABLE, ROLES.MECANICIEN]}>
                <Reparations />
              </ProtectedRoute>
            }
          />

          <Route
            path="/pieces"
            element={
              <ProtectedRoute allowedRoles={[ROLES.RESPONSABLE, ROLES.MECANICIEN]}>
                <PiecesDetachees />
              </ProtectedRoute>
            }
          />

          {/* Modules réservés exclusivement au profil RESPONSABLE */}
          <Route
            path="/clients"
            element={
              <ProtectedRoute allowedRoles={[ROLES.RESPONSABLE]}>
                <Clients />
              </ProtectedRoute>
            }
          />

          <Route
            path="/mecaniciens"
            element={
              <ProtectedRoute allowedRoles={[ROLES.RESPONSABLE]}>
                <Mecaniciens />
              </ProtectedRoute>
            }
          />

          <Route
            path="/rendez-vous"
            element={
              <ProtectedRoute allowedRoles={[ROLES.RESPONSABLE]}>
                <RendezVous />
              </ProtectedRoute>
            }
          />

          <Route
            path="/factures"
            element={
              <ProtectedRoute allowedRoles={[ROLES.RESPONSABLE]}>
                <Factures />
              </ProtectedRoute>
            }
          />

          {/* Page d'accès refusé (403) */}
          <Route path="/unauthorized" element={<Unauthorized />} />
        </Route>

        {/* Page 404 Not Found pour toute route inconnue */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
