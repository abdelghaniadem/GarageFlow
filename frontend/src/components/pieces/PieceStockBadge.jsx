import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Package } from 'lucide-react';

/**
 * Badge visuel d'état des stocks pour les pièces détachées.
 * Gère 3 états clairs : En stock, Stock faible (<= seuil), Rupture (0).
 */
export const PieceStockBadge = ({ quantite, seuil = 5, size = 'normal' }) => {
  const qte = typeof quantite === 'number' ? quantite : 0;
  const isSmall = size === 'small';

  if (qte <= 0) {
    return (
      <span
        className={`inline-flex items-center font-bold uppercase tracking-wider rounded-full border shadow-2xs whitespace-nowrap bg-rose-50 text-rose-800 border-rose-200 ${
          isSmall ? 'px-2 py-0.5 text-[10px] space-x-1' : 'px-2.5 py-1 text-xs space-x-1.5'
        }`}
      >
        <AlertCircle className={isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        <span>Rupture</span>
      </span>
    );
  }

  if (qte <= seuil) {
    return (
      <span
        className={`inline-flex items-center font-semibold rounded-full border shadow-2xs whitespace-nowrap bg-amber-50 text-amber-800 border-amber-200 ${
          isSmall ? 'px-2 py-0.5 text-[10px] space-x-1' : 'px-2.5 py-1 text-xs space-x-1.5'
        }`}
      >
        <AlertTriangle className={isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        <span>Stock Faible</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border shadow-2xs whitespace-nowrap bg-emerald-50 text-emerald-800 border-emerald-200 ${
        isSmall ? 'px-2 py-0.5 text-[10px] space-x-1' : 'px-2.5 py-1 text-xs space-x-1.5'
      }`}
    >
      <CheckCircle2 className={isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>En Stock</span>
    </span>
  );
};

export default PieceStockBadge;
