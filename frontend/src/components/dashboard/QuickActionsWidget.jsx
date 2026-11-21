import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Car,
  Wrench,
  UserPlus,
  CalendarPlus,
  FileText,
  Package,
  ClipboardList,
} from 'lucide-react';
import { ROLES } from '../../utils/constants';

/**
 * Section d'actions rapides contextuelle selon le rôle de l'utilisateur connecté.
 */
export const QuickActionsWidget = ({ role }) => {
  const navigate = useNavigate();
  const isResponsable = role === ROLES.RESPONSABLE;

  const responsableActions = [
    {
      label: 'Ajouter un client',
      icon: Users,
      path: '/clients',
      color: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-200',
    },
    {
      label: 'Ajouter un véhicule',
      icon: Car,
      path: '/vehicules',
      color: 'bg-sky-50 text-sky-700 hover:bg-sky-100 hover:border-sky-200',
    },
    {
      label: 'Nouvelle réparation',
      icon: Wrench,
      path: '/reparations',
      color: 'bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-200',
    },
    {
      label: 'Créer un rendez-vous',
      icon: CalendarPlus,
      path: '/rendez-vous',
      color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-200',
    },
    {
      label: 'Créer une facture',
      icon: FileText,
      path: '/factures',
      color: 'bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-200',
    },
    {
      label: 'Ajouter un mécanicien',
      icon: UserPlus,
      path: '/mecaniciens',
      color: 'bg-teal-50 text-teal-700 hover:bg-teal-100 hover:border-teal-200',
    },
  ];

  const mecanicienActions = [
    {
      label: 'Voir mes réparations',
      icon: ClipboardList,
      path: '/reparations',
      color: 'bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-200',
    },
    {
      label: 'Consulter les véhicules',
      icon: Car,
      path: '/vehicules',
      color: 'bg-sky-50 text-sky-700 hover:bg-sky-100 hover:border-sky-200',
    },
    {
      label: 'Consulter les pièces',
      icon: Package,
      path: '/pieces',
      color: 'bg-purple-50 text-purple-700 hover:bg-purple-100 hover:border-purple-200',
    },
  ];

  const actions = isResponsable ? responsableActions : mecanicienActions;

  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-xs">
      <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
        Actions Rapides d'Atelier
      </h2>

      <div className={`grid grid-cols-2 sm:grid-cols-3 ${isResponsable ? 'md:grid-cols-6' : 'md:grid-cols-3'} gap-3`}>
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.label}
              type="button"
              onClick={() => navigate(act.path)}
              className={`p-3 rounded-lg border border-slate-100 ${act.color} flex flex-col items-center justify-center text-center transition-all duration-150 group`}
            >
              <Icon className="w-5 h-5 mb-1.5 transition-transform group-hover:scale-110" />
              <span className="text-xs font-bold leading-tight">{act.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default QuickActionsWidget;
