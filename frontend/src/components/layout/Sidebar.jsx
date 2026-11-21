import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Car,
  UserCog,
  ClipboardList,
  Package,
  Receipt,
  Calendar,
  LogOut,
  Wrench,
  Shield,
  X,
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { ROLES, ROLE_LABELS, ROLE_BADGE_CLASSES } from '../../utils/constants';

/**
 * Configuration complète de la navigation avec permissions de rôles.
 * Seules les entrées correspondant au rôle de l'utilisateur connecté seront affichées.
 */
export const NAV_ITEMS = [
  {
    path: '/dashboard',
    label: 'Tableau de bord',
    icon: LayoutDashboard,
    roles: [ROLES.RESPONSABLE, ROLES.MECANICIEN],
    category: 'Vue d\'ensemble',
  },
  {
    path: '/vehicules',
    label: 'Véhicules',
    icon: Car,
    roles: [ROLES.RESPONSABLE, ROLES.MECANICIEN],
    category: 'Atelier',
  },
  {
    path: '/reparations',
    label: 'Réparations',
    icon: ClipboardList,
    roles: [ROLES.RESPONSABLE, ROLES.MECANICIEN],
    category: 'Atelier',
  },
  {
    path: '/pieces',
    label: 'Pièces détachées',
    icon: Package,
    roles: [ROLES.RESPONSABLE, ROLES.MECANICIEN],
    category: 'Atelier',
  },
  {
    path: '/clients',
    label: 'Clients',
    icon: Users,
    roles: [ROLES.RESPONSABLE],
    category: 'Gestion',
  },
  {
    path: '/rendez-vous',
    label: 'Rendez-vous',
    icon: Calendar,
    roles: [ROLES.RESPONSABLE],
    category: 'Gestion',
  },
  {
    path: '/factures',
    label: 'Factures',
    icon: Receipt,
    roles: [ROLES.RESPONSABLE],
    category: 'Gestion',
  },
  {
    path: '/mecaniciens',
    label: 'Mécaniciens',
    icon: UserCog,
    roles: [ROLES.RESPONSABLE],
    category: 'Administration',
  },
];

export const Sidebar = ({ onCloseMobile }) => {
  const { user, logout } = useAuth();
  const userRole = user?.role;

  // Filtrage strict selon le rôle retourné par le backend
  const filteredNavItems = NAV_ITEMS.filter((item) => item.roles.includes(userRole));

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 text-slate-200 flex flex-col h-full select-none">
      {/* En-tête Sidebar : Logo & Marque GarageFlow */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800/80">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center shadow-md shadow-brand-900/40">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white flex items-center">
              Garage<span className="text-brand-400">Flow</span>
            </span>
            <span className="block text-[10px] font-medium text-slate-400 tracking-wider uppercase -mt-0.5">
              Gestion d'Atelier
            </span>
          </div>
        </div>

        {/* Bouton de fermeture mobile */}
        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Fermer le menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Rôle Actif Badge Card */}
      <div className="px-4 py-3 mx-4 mt-4 rounded-xl bg-slate-850 border border-slate-800/90 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Shield className="w-4 h-4 text-brand-400" />
          <span className="text-xs text-slate-300 font-medium">Profil actif</span>
        </div>
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
            userRole ? ROLE_BADGE_CLASSES[userRole] : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}
        >
          {userRole ? ROLE_LABELS[userRole] : 'Non défini'}
        </span>
      </div>

      {/* Navigation principale */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-900/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`
              }
            >
              <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      {/* Profil utilisateur & Déconnexion en bas de la barre latérale */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-brand-400 uppercase flex-shrink-0">
              {user?.prenom?.[0] || 'U'}
              {user?.nom?.[0] || ''}
            </div>
            <div className="truncate">
              <p className="text-xs font-medium text-slate-200 truncate">
                {user?.prenom} {user?.nom}
              </p>
              <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            title="Se déconnecter"
            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition-colors ml-2 flex-shrink-0"
            aria-label="Se déconnecter"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
