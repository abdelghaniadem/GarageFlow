import React from 'react';
import { Wrench } from 'lucide-react';

/**
 * Composant de chargement avec identité visuelle GarageFlow.
 */
export const LoadingSpinner = ({ fullScreen = false, message = 'Chargement en cours...' }) => {
  const content = (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <div className="relative flex items-center justify-center">
        {/* Anneau rotatif */}
        <div className="w-12 h-12 border-4 border-slate-200 border-t-brand-600 rounded-full animate-spin" />
        {/* Clé au centre */}
        <Wrench className="w-5 h-5 text-brand-600 absolute animate-pulse" />
      </div>
      <p className="text-sm font-medium text-slate-600">{message}</p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 text-slate-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2.5 bg-brand-600 rounded-xl shadow-lg">
              <Wrench className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">
              Garage<span className="text-brand-400">Flow</span>
            </span>
          </div>
          <div className="w-10 h-10 border-3 border-slate-700 border-t-brand-500 rounded-full animate-spin" />
          <p className="text-xs uppercase tracking-wider text-slate-400">Vérification de la session...</p>
        </div>
      </div>
    );
  }

  return content;
};

export default LoadingSpinner;
