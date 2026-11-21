import api from './api';

/**
 * Service pour la gestion des mécaniciens et des pièces détachées.
 */
export const mecanicienService = {
  /**
   * Liste les mécaniciens d'atelier (Réservé au RESPONSABLE).
   * @returns {Promise<Array>}
   */
  async list() {
    const response = await api.get('/mecaniciens');
    return response.data.data;
  },

  /**
   * Récupère un mécanicien par son ID.
   * @param {number|string} id
   * @returns {Promise<Object>}
   */
  async getById(id) {
    const response = await api.get(`/mecaniciens/${id}`);
    return response.data.data;
  },
};

export const pieceService = {
  /**
   * Liste le catalogue de pièces détachées (Accessible à RESPONSABLE et MECANICIEN).
   * @param {Object} [params] - { search, stock_faible, stock_min, etc. }
   * @returns {Promise<Array>}
   */
  async list(params = {}) {
    const response = await api.get('/pieces', { params });
    return response.data.data;
  },

  /**
   * Récupère une pièce par son ID.
   * @param {number|string} id
   * @returns {Promise<Object>}
   */
  async getById(id) {
    const response = await api.get(`/pieces/${id}`);
    return response.data.data;
  },
};

export default { mecanicienService, pieceService };
