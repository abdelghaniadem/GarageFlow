import React, { useState } from 'react';
import {
  X,
  Package,
  Plus,
  Minus,
  Sliders,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import pieceService from '../../services/pieceService';
import PieceStockBadge from './PieceStockBadge';

/**
 * Modale de gestion et d'ajustement rapide du stock pour une pièce.
 * Permet l'approvisionnement (+), le déstockage (-) ou la correction directe d'inventaire (=).
 * Réservé au profil RESPONSABLE.
 */
export const PieceStockManager = ({ isOpen, onClose, piece, onStockUpdated }) => {
  const [operationType, setOperationType] = useState('ADD'); // 'ADD', 'SUBTRACT', 'SET'
  const [amountInput, setAmountInput] = useState('10');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  if (!isOpen || !piece) return null;

  const currentStock = piece.quantite_stock || 0;
  const numAmount = parseInt(amountInput, 10) || 0;

  // Calcul prévisionnel du nouveau stock
  let projectedStock = currentStock;
  if (operationType === 'ADD') {
    projectedStock = currentStock + numAmount;
  } else if (operationType === 'SUBTRACT') {
    projectedStock = currentStock - numAmount;
  } else if (operationType === 'SET') {
    projectedStock = numAmount;
  }

  const isInvalid = projectedStock < 0 || isNaN(numAmount) || numAmount < 0;

  const handleQuickAdd = (increment) => {
    if (operationType === 'SET') {
      setAmountInput(String(Math.max(0, currentStock + increment)));
    } else {
      setAmountInput(String(increment));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isInvalid) {
      setErrorMessage('La quantité finale en stock ne peut pas être négative.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await pieceService.adjustStock(piece.id_piece, projectedStock);
      if (onStockUpdated) {
        onStockUpdated(updated);
      }
      onClose();
    } catch (err) {
      console.error('Erreur ajustement stock :', err);
      setErrorMessage(err.message || "Impossible d'ajuster le stock de cette pièce.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* En-tête */}
        <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Gestion du Stock</h3>
              <p className="text-xs text-slate-500">Approvisionnement & ajustement d'inventaire</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Détails de la pièce ciblée */}
        <div className="px-6 py-3.5 bg-slate-50/40 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-mono font-bold text-slate-500">
                REF-#{piece.id_piece}
              </span>
              <h4 className="text-xs font-bold text-slate-900 truncate max-w-[200px]">
                {piece.nom}
              </h4>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Prix unitaire : {Number(piece.prix_unitaire).toFixed(2)} TND
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block mb-0.5">État actuel</span>
            <PieceStockBadge quantite={piece.quantite_stock} size="small" />
          </div>
        </div>

        {/* Message d'erreur */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Sélecteur d'opération */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Type d'opération
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setOperationType('ADD');
                  setAmountInput('10');
                }}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold flex flex-col items-center justify-center transition-all border ${
                  operationType === 'ADD'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Plus className="w-4 h-4 mb-1" />
                <span>Entrée (+)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOperationType('SUBTRACT');
                  setAmountInput('5');
                }}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold flex flex-col items-center justify-center transition-all border ${
                  operationType === 'SUBTRACT'
                    ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Minus className="w-4 h-4 mb-1" />
                <span>Sortie (-)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOperationType('SET');
                  setAmountInput(String(currentStock));
                }}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold flex flex-col items-center justify-center transition-all border ${
                  operationType === 'SET'
                    ? 'bg-brand-50 text-brand-800 border-brand-300 shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Sliders className="w-4 h-4 mb-1" />
                <span>Inventaire (=)</span>
              </button>
            </div>
          </div>

          {/* Saisie de la quantité */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {operationType === 'ADD' && 'Quantité reçue / approvisionnée'}
              {operationType === 'SUBTRACT' && 'Quantité retirée / mise au rebut'}
              {operationType === 'SET' && 'Nouveau stock réel comptabilisé'}
            </label>
            <input
              type="number"
              min={0}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-mono font-bold text-slate-900"
            />

            {/* Raccourcis d'incréments */}
            <div className="flex items-center space-x-1.5 mt-2">
              <span className="text-[10px] text-slate-400 font-medium mr-1">Raccourcis :</span>
              {[5, 10, 25, 50].map((inc) => (
                <button
                  key={inc}
                  type="button"
                  onClick={() => handleQuickAdd(inc)}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-mono font-semibold transition-colors"
                >
                  +{inc}
                </button>
              ))}
            </div>
          </div>

          {/* Prévisualisation dynamique */}
          <div className="p-3.5 bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                Stock actuel
              </span>
              <span className="text-base font-bold font-mono text-slate-700">{currentStock}</span>
            </div>

            <ArrowRight className="w-5 h-5 text-slate-400" />

            <div className="text-right">
              <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                Nouveau stock calculé
              </span>
              <span
                className={`text-lg font-black font-mono ${
                  projectedStock < 0
                    ? 'text-rose-600'
                    : projectedStock <= 5
                    ? 'text-amber-600'
                    : 'text-emerald-600'
                }`}
              >
                {projectedStock} unité{projectedStock > 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isInvalid}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-900/20 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mise à jour...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmer le stock ({projectedStock})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PieceStockManager;
