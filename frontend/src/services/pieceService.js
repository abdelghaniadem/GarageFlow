import api from './api';

/**
 * Service pour la gestion des pièces détachées et du stock GarageFlow.
 * Endpoints : /api/v1/pieces
 *
 * Schéma Pièce Détachée PostgreSQL / Marshmallow :
 * - id_piece : integer (PK)
 * - nom : string (1..100) [REQUIS, UNIQUE insensible à la casse]
 * - prix_unitaire : decimal (>= 0) [REQUIS]
 * - quantite_stock : integer (>= 0) [REQUIS]
 *
 * Permissions :
 * - GET : Accessible par RESPONSABLE et MECANICIEN
 * - POST / PUT / DELETE : Réservé exclusivement à RESPONSABLE
 */
export const pieceService = {
  /**
   * Récupère la liste des pièces détachées avec filtres optionnels.
   * @param {Object} [params] - { search, stock_faible, stock_min, stock_max, prix_min, prix_max, seuil }
   * @returns {Promise<Array>}
   */
  async list(params = {}) {
    const response = await api.get('/pieces', { params });
    return response.data.data;
  },

  /**
   * Récupère une pièce détachée par son identifiant unique.
   * @param {number|string} idPiece
   * @returns {Promise<Object>}
   */
  async getById(idPiece) {
    const response = await api.get(`/pieces/${idPiece}`);
    return response.data.data;
  },

  /**
   * Crée une nouvelle pièce détachée dans le catalogue.
   * Réservé au profil RESPONSABLE.
   * @param {Object} data - { nom, prix_unitaire, quantite_stock }
   * @returns {Promise<Object>}
   */
  async create(data) {
    const response = await api.post('/pieces', data);
    return response.data.data;
  },

  /**
   * Met à jour une pièce détachée existante.
   * Réservé au profil RESPONSABLE.
   * @param {number|string} idPiece
   * @param {Object} data - { nom?, prix_unitaire?, quantite_stock? }
   * @returns {Promise<Object>}
   */
  async update(idPiece, data) {
    const response = await api.put(`/pieces/${idPiece}`, data);
    return response.data.data;
  },

  /**
   * Supprime une pièce détachée du catalogue.
   * Rejette avec HTTP 409 Conflict si la pièce a été consommée dans une réparation.
   * Réservé au profil RESPONSABLE.
   * @param {number|string} idPiece
   * @returns {Promise<Object>}
   */
  async delete(idPiece) {
    const response = await api.delete(`/pieces/${idPiece}`);
    return response.data.data;
  },

  /**
   * Ajuste la quantité en stock d'une pièce détachée.
   * Réservé au profil RESPONSABLE.
   * @param {number|string} idPiece
   * @param {number} newQuantity
   * @returns {Promise<Object>}
   */
  async adjustStock(idPiece, newQuantity) {
    return this.update(idPiece, { quantite_stock: newQuantity });
  },
};

export default pieceService;
