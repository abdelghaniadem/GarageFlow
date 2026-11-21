import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import useAuth from '../hooks/useAuth';
import { ROLE_LABELS } from '../utils/constants';

export const Unauthorized = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4 border border-rose-200">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Accès Non Autorisé (403)</h1>
      <p className="text-sm text-slate-600 max-w-md mb-4">
        Votre profil actuel (<strong className="text-slate-800">{user?.role ? ROLE_LABELS[user.role] : 'Non défini'}</strong>)
        ne dispose pas des privilèges nécessaires pour accéder à cette section de l'atelier.
      </p>
      <Link
        to="/dashboard"
        className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-500 shadow-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Retour au Tableau de bord</span>
      </Link>
    </div>
  );
};

export default Unauthorized;
