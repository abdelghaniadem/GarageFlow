import axios from 'axios';

/**
 * Client Axios centralisé pour GarageFlow.
 * Base URL configurable via la variable d'environnement VITE_API_BASE_URL.
 * Préfixe par défaut : /api/v1
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 15000,
});

/**
 * Intercepteur de requête : attache automatiquement le jeton JWT
 * s'il est présent dans le stockage local.
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('garageflow_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Intercepteur de réponse : uniformise le format des erreurs
 * conformément au contrat JSON standardisé de l'API Flask GarageFlow :
 * {
 *   "success": false,
 *   "error": {
 *     "code": "...",
 *     "message": "...",
 *     "details": ...
 *   }
 * }
 */
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const responseData = error.response?.data;
    const apiError = responseData?.error;

    // Construction d'un message lisible et structuré
    let formattedMessage = 'Une erreur inattendue est survenue.';
    let errorCode = 'NETWORK_OR_UNKNOWN_ERROR';
    let errorDetails = null;

    if (apiError) {
      formattedMessage = apiError.message || formattedMessage;
      errorCode = apiError.code || errorCode;
      errorDetails = apiError.details || null;
    } else if (responseData?.message) {
      formattedMessage = responseData.message;
    } else if (error.message) {
      formattedMessage = error.message;
    }

    // Gestion spécifique de l'expiration / invalidation de session (401)
    if (error.response?.status === 401) {
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      if (!isLoginRequest) {
        // En cas de token expiré ou corrompu sur une requête protégée, on nettoie
        localStorage.removeItem('garageflow_token');
        localStorage.removeItem('garageflow_user');
        window.dispatchEvent(new CustomEvent('garageflow:auth-expired'));
      }
    }

    const enhancedError = new Error(formattedMessage);
    enhancedError.code = errorCode;
    enhancedError.details = errorDetails;
    enhancedError.status = error.response?.status || 500;
    enhancedError.rawResponse = responseData;

    return Promise.reject(enhancedError);
  }
);

export default api;
