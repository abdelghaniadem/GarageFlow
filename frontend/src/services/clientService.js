import api from './api';

/**
 * Service pour la gestion des clients.
 * Endpoint : /api/v1/clients (Accessible uniquement au RESPONSABLE)
 */
export const clientService = {
  /**
   * Liste les clients.
   * @param {Object} [params] - { search, nom, prenom, telephone }
   * @returns {Promise<Array>}
   */
  async list(params = {}) {
    const response = await api.get('/clients', { params });
    return response.data.data;
  },

  /**
   * Récupère un client par son ID.
   * @param {number|string} id
   * @returns {Promise<Object>}
   */
  async getById(id) {
    const response = await api.get(`/clients/${id}`);
    return response.data.data;
  },

  /**
   * Crée un nouveau client.
   * Réservé au profil RESPONSABLE.
   * @param {Object} data - { nom, prenom, telephone, adresse? }
   * @returns {Promise<Object>}
   */
  async create(data) {
    const response = await api.post('/clients', data);
    return response.data.data;
  },

  /**
   * Met à jour les informations d'un client.
   * Réservé au profil RESPONSABLE.
   * @param {number|string} id
   * @param {Object} data - { nom?, prenom?, telephone?, adresse? }
   * @returns {Promise<Object>}
   */
  async update(id, data) {
    const response = await api.put(`/clients/${id}`, data);
    return response.data.data;
  },

  /**
   * Supprime un client.
   * Rejette avec HTTP 409 Conflict si des véhicules sont rattachés.
   * Réservé au profil RESPONSABLE.
   * @param {number|string} id
   * @returns {Promise<Object>}
   */
  async delete(id) {
    const response = await api.delete(`/clients/${id}`);
    return response.data.data;
  },
};

export default clientService;
