import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Wrench, Mail, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import useAuth from '../hooks/useAuth';

export const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Emplacement de redirection après connexion
  const from = location.state?.from?.pathname || '/dashboard';

  const validate = () => {
    const errors = {};
    if (!email.trim()) {
      errors.email = "L'adresse email est requise.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Veuillez saisir une adresse email valide.";
    }

    if (!motDePasse) {
      errors.motDePasse = "Le mot de passe est requis.";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Appel du service auth avec le champ exact attendu par le backend : 'mot_de_passe'
      await login(email, motDePasse);
      navigate(from, { replace: true });
    } catch (err) {
      // Capture du message d'erreur standardisé émis par l'API Flask
      if (err.details && typeof err.details === 'object') {
        // En cas d'erreurs de validation Marshmallow (422)
        const detailsList = Object.entries(err.details)
          .map(([key, msgs]) => `${key}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
          .join(' | ');
        setErrorMessage(err.message ? `${err.message} (${detailsList})` : detailsList);
      } else {
        setErrorMessage(err.message || 'Identifiants invalides ou service indisponible.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden select-none">
      {/* Texture de fond subtile atelier */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

      {/* En-tête / Marque GarageFlow */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600 shadow-xl shadow-brand-600/30 mb-4 border border-brand-400/20">
          <Wrench className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Garage<span className="text-brand-400">Flow</span>
        </h1>
        <p className="mt-1.5 text-sm text-slate-400">
          Système Intégré de Gestion d'Atelier Automobile
        </p>
      </div>

      {/* Carte de connexion */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0 relative z-10">
        <div className="bg-slate-900/90 backdrop-blur-md py-8 px-6 sm:px-10 shadow-2xl rounded-2xl border border-slate-800">
          {/* Alerte message d'erreur */}
          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-200 text-xs flex items-start space-x-3">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Champ Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                Adresse email professionnelle
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (validationErrors.email) {
                      setValidationErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  placeholder="nom@garageflow.com"
                  disabled={isSubmitting}
                  className={`block w-full pl-10 pr-3 py-2.5 bg-slate-950/70 border rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-colors ${
                    validationErrors.email
                      ? 'border-rose-500 focus:ring-rose-500/30'
                      : 'border-slate-800 focus:border-brand-500 focus:ring-brand-500/20'
                  }`}
                />
              </div>
              {validationErrors.email && (
                <p className="mt-1.5 text-xs text-rose-400">{validationErrors.email}</p>
              )}
            </div>

            {/* Champ Mot de passe */}
            <div>
              <label
                htmlFor="mot_de_passe"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                Mot de passe
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="mot_de_passe"
                  name="mot_de_passe"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={motDePasse}
                  onChange={(e) => {
                    setMotDePasse(e.target.value);
                    if (validationErrors.motDePasse) {
                      setValidationErrors((prev) => ({ ...prev, motDePasse: undefined }));
                    }
                  }}
                  placeholder="••••••••••••"
                  disabled={isSubmitting}
                  className={`block w-full pl-10 pr-10 py-2.5 bg-slate-950/70 border rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-colors ${
                    validationErrors.motDePasse
                      ? 'border-rose-500 focus:ring-rose-500/30'
                      : 'border-slate-800 focus:border-brand-500 focus:ring-brand-500/20'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 focus:outline-none"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {validationErrors.motDePasse && (
                <p className="mt-1.5 text-xs text-rose-400">{validationErrors.motDePasse}</p>
              )}
            </div>

            {/* Bouton de connexion */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 active:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-brand-600/30 transition-all duration-150"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Authentification en cours...
                  </>
                ) : (
                  'Se connecter à l\'atelier'
                )}
              </button>
            </div>
          </form>

          {/* Note sur les accès sécurisés */}
          <div className="mt-6 pt-6 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-500">
              Accès réservé aux profils autorisés : <span className="text-slate-400">Responsable d'Atelier</span> et <span className="text-slate-400">Mécanicien</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
