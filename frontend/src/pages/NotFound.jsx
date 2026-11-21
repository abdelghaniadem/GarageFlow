import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export const NotFound = () => {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-center px-4 text-white">
      <div className="w-16 h-16 rounded-2xl bg-slate-800 text-brand-400 flex items-center justify-center mb-4 border border-slate-700 shadow-lg">
        <FileQuestion className="w-8 h-8" />
      </div>
      <span className="text-xs uppercase tracking-widest font-semibold text-brand-400 mb-1">
        Erreur 404
      </span>
      <h1 className="text-3xl font-extrabold text-white mb-2">Page Introuvable</h1>
      <p className="text-sm text-slate-400 max-w-md mb-6">
        La ressource demandée n'existe pas ou a été déplacée dans le système GarageFlow.
      </p>
      <Link
        to="/dashboard"
        className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-500 shadow-md shadow-brand-600/30 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Retour à l'accueil de l'atelier</span>
      </Link>
    </div>
  );
};

export default NotFound;
