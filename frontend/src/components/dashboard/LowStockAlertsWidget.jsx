import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ArrowRight, Package } from 'lucide-react';

/**
 * Widget interactif d'alertes de stock faible.
 * Affiche les pièces sous le seuil d'alerte ou un message de succès vert si tout est en ordre.
 */
export const LowStockAlertsWidget = ({ stockAlertes = [], lowStockThreshold = 5 }) => {
  const navigate = useNavigate();

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'RUPTURE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
            Rupture
          </span>
        );
      case 'CRITIQUE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
            Critique
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-yellow-100 text-yellow-800 border border-yellow-200">
            Faible
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs flex flex-col justify-between overflow-hidden h-full">
      {/* En-tête */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Alertes Stock
            </h2>
            <p className="text-xs text-slate-500">Seuil d'alerte : ≤ {lowStockThreshold} unités</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/pieces')}
          className="inline-flex items-center text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
        >
          <span>Gérer le stock</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </button>
      </div>

      {/* Contenu : Liste d'alertes ou État de succès propre */}
      <div className="p-4 space-y-2 flex-1 overflow-y-auto">
        {stockAlertes.length === 0 ? (
          <div className="py-8 text-center text-emerald-600 flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-2 border border-emerald-100">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="font-bold text-sm text-slate-800">Tout va bien !</p>
            <p className="text-xs text-slate-500 mt-0.5">Aucun stock faible détecté dans l'atelier.</p>
          </div>
        ) : (
          stockAlertes.map((piece) => (
            <div
              key={piece.id_piece}
              onClick={() => navigate('/pieces')}
              className="p-3 rounded-lg border border-slate-100 hover:border-slate-300 hover:bg-slate-50/80 cursor-pointer transition-all flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center space-x-2.5 overflow-hidden">
                <div className="p-1.5 rounded-md bg-slate-100 text-slate-600 flex-shrink-0">
                  <Package className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <p className="font-bold text-slate-900 truncate">{piece.nom}</p>
                  <p className="text-[11px] text-slate-400">
                    Prix : {piece.prix_unitaire.toFixed(2)} TND
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 flex-shrink-0">
                <div className="text-right">
                  <span className={`font-mono font-bold ${piece.quantite_stock <= 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                    {piece.quantite_stock} restant(s)
                  </span>
                </div>
                {getSeverityBadge(piece.severite)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pied */}
      <div className="p-3 bg-slate-50/60 border-t border-slate-100 text-center">
        <button
          type="button"
          onClick={() => navigate('/pieces')}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center space-x-1"
        >
          <span>Consulter le catalogue des pièces détachées</span>
        </button>
      </div>
    </div>
  );
};

export default LowStockAlertsWidget;
