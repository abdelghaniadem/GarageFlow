import api from './api';

/**
 * Service d'authentification pour GarageFlow.
 * Respecte scrupuleusement les contrats d'API backend :
 * - POST /api/v1/auth/login attend {"email": "...", "mot_de_passe": "..."}
 * - GET /api/v1/auth/me retourne les informations de l'utilisateur connecté
 */
export const authService = {
  /**
   * Authentifie un utilisateur avec ses identifiants.
   * @param {string} email
   * @param {string} mot_de_passe
   * @returns {Promise<{ access_token: string, user: Object }>}
   */
  async login(email, mot_de_passe) {
    const response = await api.post('/auth/login', {
      email: email.trim().toLowerCase(),
      mot_de_passe,
    });
    // Structure retournée par le backend : { success: true, data: { access_token, user }, message: "..." }
    return response.data.data;
  },

  /**
   * Récupère le profil de l'utilisateur actuellement connecté via son token JWT.
   * @returns {Promise<Object>}
   */
  async getMe() {
    const response = await api.get('/auth/me');
    // Structure retournée par le backend : { success: true, data: { id_utilisateur, nom, prenom, email, role, ... }, message: "..." }
    return response.data.data;
  },

  /**
   * Supprime les jetons et informations en cache local lors de la déconnexion.
   */
  logout() {
    localStorage.removeItem('garageflow_token');
    localStorage.removeItem('garageflow_user');
  },
};

export default authService;
