import React from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, LogOut, ShieldCheck, Car } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { NAV_ITEMS } from './Sidebar';
import { ROLE_LABELS, ROLE_BADGE_CLASSES } from '../../utils/constants';

export const Navbar = ({ onToggleMobile }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Trouve l'item de navigation correspondant à la route courante
  const currentItem = NAV_ITEMS.find((item) =>
    location.pathname.startsWith(item.path)
  );
  const pageTitle = currentItem ? currentItem.label : 'GarageFlow';

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 shadow-xs">
      {/* Côté gauche : Bouton mobile menu + Titre de page */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        <button
          type="button"
          onClick={onToggleMobile}
          className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2">
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">{pageTitle}</h1>
          <span className="hidden sm:inline-block text-xs text-slate-400">• Atelier Automobile</span>
        </div>
      </div>

      {/* Côté droit : Statut système + Profil + Déconnexion */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Badge atelier en ligne */}
        <div className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Atelier Connecté</span>
        </div>

        {/* Détails utilisateur */}
        <div className="flex items-center space-x-3 pl-2 sm:border-l sm:border-slate-200">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-slate-800 leading-tight">
              {user?.prenom} {user?.nom}
            </p>
            <span
              className={`inline-block text-[10px] font-medium px-2 py-0.2 rounded-full border mt-0.5 ${
                user?.role ? ROLE_BADGE_CLASSES[user.role] : 'bg-slate-100 text-slate-600'
              }`}
            >
              {user?.role ? ROLE_LABELS[user.role] : 'Utilisateur'}
            </span>
          </div>

          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors"
            title="Se déconnecter"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
