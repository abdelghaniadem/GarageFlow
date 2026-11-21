import api from './api';

/**
 * Service pour la gestion des réparations et des pièces associées.
 * Endpoints :
 * - /api/v1/reparations
 * - /api/v1/reparations/<id>/pieces
 */
export const reparationService = {
  /**
   * Liste les réparations avec filtres optionnels.
   * Pour un MECANICIEN, le backend restreint automatiquement aux siennes.
   * @param {Object} [params] - { id_vehicule, id_mecanicien, statut, date }
   * @returns {Promise<Array>}
   */
  async list(params = {}) {
    const response = await api.get('/reparations', { params });
    return response.data.data;
  },

  /**
   * Récupère une réparation par son ID.
   * @param {number|string} id
   * @returns {Promise<Object>}
   */
  async getById(id) {
    const response = await api.get(`/reparations/${id}`);
    return response.data.data;
  },

  /**
   * Crée une nouvelle réparation (Réservé au RESPONSABLE).
   * @param {Object} data - { description, date_reparation, statut, id_vehicule, id_mecanicien, diagnostic, travail_effectue, cout, kilometrage }
   * @returns {Promise<Object>}
   */
  async create(data) {
    const response = await api.post('/reparations', data);
    return response.data.data;
  },

  /**
   * Met à jour une réparation existante.
   * Pour un MECANICIEN, la réassignation de véhicule/mécanicien est interdite par le backend.
   * @param {number|string} id
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async update(id, data) {
    const response = await api.put(`/reparations/${id}`, data);
    return response.data.data;
  },

  /**
   * Supprime une réparation (Réservé au RESPONSABLE).
   * @param {number|string} id
   * @returns {Promise<Object>}
   */
  async delete(id) {
    const response = await api.delete(`/reparations/${id}`);
    return response.data.data;
  },

  /**
   * Liste les pièces détachées associées à une réparation.
   * @param {number|string} idReparation
   * @returns {Promise<Array>}
   */
  async listPieces(idReparation) {
    const response = await api.get(`/reparations/${idReparation}/pieces`);
    return response.data.data;
  },

  /**
   * Associe une pièce détachée à une réparation (décrémente le stock).
   * @param {number|string} idReparation
   * @param {Object} data - { id_piece, quantite }
   * @returns {Promise<Object>}
   */
  async addPiece(idReparation, data) {
    const response = await api.post(`/reparations/${idReparation}/pieces`, data);
    return response.data.data;
  },

  /**
   * Met à jour la quantité d'une pièce associée (applique le différentiel de stock).
   * @param {number|string} idReparation
   * @param {number|string} idPiece
   * @param {number} quantite
   * @returns {Promise<Object>}
   */
  async updatePiece(idReparation, idPiece, quantite) {
    const response = await api.patch(`/reparations/${idReparation}/pieces/${idPiece}`, {
      quantite,
    });
    return response.data.data;
  },

  /**
   * Retire une pièce d'une réparation (réintègre la quantité au stock).
   * @param {number|string} idReparation
   * @param {number|string} idPiece
   * @returns {Promise<Object>}
   */
  async removePiece(idReparation, idPiece) {
    const response = await api.delete(`/reparations/${idReparation}/pieces/${idPiece}`);
    return response.data.data;
  },
};

export default reparationService;
