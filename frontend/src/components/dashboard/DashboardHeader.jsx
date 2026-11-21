import React from 'react';
import { RefreshCw, Calendar as CalendarIcon, Shield, PlusCircle, Wrench } from 'lucide-react';
import { ROLE_LABELS, ROLE_BADGE_CLASSES, ROLES } from '../../utils/constants';

/**
 * En-tête dynamique du tableau de bord.
 * Affiche le message de bienvenue avec le prénom réel de l'utilisateur connecté,
 * la date courante en français, et le bouton de rafraîchissement d'indicateurs.
 */
export const DashboardHeader = ({
  user,
  onRefresh,
  isRefreshing,
  onQuickAction,
}) => {
  // Formatage de la date en français (ex : Samedi 21 novembre 2026)
  const todayFormatted = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  // Capitalisation du premier caractère
  const capitalizedDate = todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1);

  const isResponsable = user?.role === ROLES.RESPONSABLE;

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 rounded-2xl p-6 sm:p-7 text-white shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
      {/* Texture de fond subtile */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px] opacity-30 pointer-events-none" />

      {/* Partie gauche : Titre et message personnalisé */}
      <div className="relative z-10">
        <div className="flex items-center space-x-2 text-brand-400 text-xs font-semibold uppercase tracking-wider mb-1.5">
          <CalendarIcon className="w-3.5 h-3.5 text-brand-400" />
          <span>{capitalizedDate}</span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-300">Atelier GarageFlow</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center">
          Bonjour, {user?.prenom || 'Bienvenue'} <span className="ml-2 inline-block animate-bounce">👋</span>
        </h1>

        <p className="text-sm text-slate-300 mt-1 max-w-xl">
          {isResponsable
            ? "Voici un aperçu en temps réel de l'activité, des réparations et des flux d'atelier aujourd'hui."
            : "Voici un récapitulatif de vos réparations assignées et des pièces disponibles en atelier."}
        </p>
      </div>

      {/* Partie droite : Badges et Actions rapides */}
      <div className="relative z-10 flex flex-wrap items-center gap-3 self-start md:self-auto">
        {/* Badge rôle */}
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/80 text-xs">
          <Shield className="w-3.5 h-3.5 text-brand-400" />
          <span className="text-slate-300 font-medium">Profil :</span>
          <span
            className={`font-semibold px-2 py-0.5 rounded-md text-[11px] ${
              user?.role ? ROLE_BADGE_CLASSES[user.role] : 'bg-slate-700 text-slate-200'
            }`}
          >
            {user?.role ? ROLE_LABELS[user.role] : 'Utilisateur'}
          </span>
        </div>

        {/* Bouton de rafraîchissement avec animation de rotation */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Actualiser les données"
          className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-850 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors shadow-xs disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-brand-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Actualiser</span>
        </button>

        {/* Bouton Action rapide principale */}
        {isResponsable && onQuickAction && (
          <button
            type="button"
            onClick={onQuickAction}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white text-xs font-semibold shadow-md shadow-brand-900/40 transition-all duration-150"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nouvelle Réparation</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default DashboardHeader;
