import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import LoadingSpinner from './LoadingSpinner';

/**
 * Gardien de route protégée avec vérification de rôle (RBAC).
 * 
 * @param {Array<string>} [allowedRoles] - Rôles autorisés (ex: ['RESPONSABLE', 'MECANICIEN'])
 * @param {React.ReactNode} [children] - Composant enfant optionnel si non utilisé avec Outlet
 */
export const ProtectedRoute = ({ allowedRoles, children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!isAuthenticated) {
    // Redirige l'utilisateur non authentifié vers /login avec mémorisation de l'emplacement voulu
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Vérification des permissions par rôle
  if (allowedRoles && (!user?.role || !allowedRoles.includes(user.role))) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children ? children : <Outlet />;
};

export default ProtectedRoute;
