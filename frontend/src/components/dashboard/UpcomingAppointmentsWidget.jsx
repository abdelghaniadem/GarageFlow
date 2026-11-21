import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Plus, Clock, User, Car, ArrowRight } from 'lucide-react';

/**
 * Widget affichant les prochains rendez-vous d'atelier pour le RESPONSABLE.
 */
export const UpcomingAppointmentsWidget = ({ rendezVous = [] }) => {
  const navigate = useNavigate();

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}`;
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    try {
      const parts = timeStr.split(':');
      return `${parts[0]}:${parts[1]}`;
    } catch {
      return timeStr;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between overflow-hidden h-full">
      {/* En-tête avec bouton d'ajout */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Prochains Rendez-vous
            </h2>
            <p className="text-xs text-slate-500">Planning des réceptions</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/rendez-vous')}
          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold transition-colors"
          title="Ajouter un rendez-vous"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nouveau</span>
        </button>
      </div>

      {/* Liste des rendez-vous */}
      <div className="p-4 space-y-2.5 flex-1 overflow-y-auto">
        {rendezVous.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2 stroke-1" />
            <p className="font-medium">Aucun rendez-vous à venir.</p>
          </div>
        ) : (
          rendezVous.map((rdv) => (
            <div
              key={rdv.id_rendezvous}
              onClick={() => navigate('/rendez-vous')}
              className="p-3 rounded-lg border border-slate-100 hover:border-slate-300 hover:bg-slate-50/80 cursor-pointer transition-all flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center space-x-3 overflow-hidden">
                {/* Badge Date/Heure */}
                <div className="bg-slate-100 text-slate-800 rounded-lg p-2 text-center min-w-[50px] flex-shrink-0">
                  <span className="block text-[11px] font-bold font-mono leading-none">
                    {formatDate(rdv.date_rendezvous)}
                  </span>
                  <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                    {formatTime(rdv.heure)}
                  </span>
                </div>

                <div className="overflow-hidden">
                  <p className="font-bold text-slate-900 truncate">
                    {rdv.client ? `${rdv.client.prenom} ${rdv.client.nom}` : 'Client n/d'}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate flex items-center space-x-1">
                    <Car className="w-3 h-3 text-slate-400 inline mr-1" />
                    <span>
                      {rdv.vehicule ? `${rdv.vehicule.marque} ${rdv.vehicule.modele}` : 'Véhicule'}
                    </span>
                    {rdv.motif && <span className="text-slate-400">• {rdv.motif}</span>}
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex-shrink-0">
                {rdv.statut}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Pied de carte avec redirection */}
      <div className="p-3 bg-slate-50/60 border-t border-slate-100 text-center">
        <button
          type="button"
          onClick={() => navigate('/rendez-vous')}
          className="text-xs font-semibold text-brand-600 hover:text-brand-700 inline-flex items-center space-x-1"
        >
          <span>Voir tous les rendez-vous</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default UpcomingAppointmentsWidget;
