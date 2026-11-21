import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import authService from '../services/authService';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem('garageflow_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('garageflow_token'));
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Restaure la session au rechargement de la page en appelant GET /auth/me
   */
  const restoreSession = useCallback(async () => {
    const storedToken = localStorage.getItem('garageflow_token');
    if (!storedToken) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return;
    }

    try {
      const userProfile = await authService.getMe();
      setUser(userProfile);
      setToken(storedToken);
      localStorage.setItem('garageflow_user', JSON.stringify(userProfile));
    } catch (error) {
      console.warn('Session expirée ou invalide lors de la vérification initiale:', error.message);
      authService.logout();
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();

    // Écoute des événements d'expiration de session déclenchés par l'intercepteur Axios
    const handleAuthExpired = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('garageflow:auth-expired', handleAuthExpired);
    return () => {
      window.removeEventListener('garageflow:auth-expired', handleAuthExpired);
    };
  }, [restoreSession]);

  /**
   * Connexion de l'utilisateur
   * @param {string} email
   * @param {string} mot_de_passe
   */
  const login = async (email, mot_de_passe) => {
    const authData = await authService.login(email, mot_de_passe);
    const { access_token, user: userData } = authData;

    localStorage.setItem('garageflow_token', access_token);
    localStorage.setItem('garageflow_user', JSON.stringify(userData));
    setToken(access_token);
    setUser(userData);
    return userData;
  };

  /**
   * Déconnexion de l'utilisateur
   */
  const logout = useCallback(() => {
    authService.logout();
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      role: user?.role || null,
      isAuthenticated: Boolean(token && user),
      isLoading,
      login,
      logout,
      refreshProfile: restoreSession,
    }),
    [user, token, isLoading, logout, restoreSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
