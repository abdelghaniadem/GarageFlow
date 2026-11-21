import api from './api';

/**
 * Service pour la gestion des mécaniciens GarageFlow.
 * Endpoints : /api/v1/mecaniciens (Réservé au profil RESPONSABLE)
 *
 * Schéma Mécanicien PostgreSQL / Marshmallow :
 * - id_mecanicien : integer (PK)
 * - specialite : string (1..100) [REQUIS]
 * - id_utilisateur : integer (FK -> utilisateur.id_utilisateur, UNIQUE)
 * - utilisateur : { id_utilisateur, nom, prenom, email, role, telephone }
 */
export const mecanicienService = {
  /**
   * Récupère la liste des mécaniciens avec filtres optionnels.
   * @param {Object} [params] - { specialite, search }
   * @returns {Promise<Array>}
   */
  async list(params = {}) {
    const response = await api.get('/mecaniciens', { params });
    return response.data.data;
  },

  /**
   * Récupère un mécanicien par son identifiant unique.
   * @param {number|string} idMecanicien
   * @returns {Promise<Object>}
   */
  async getById(idMecanicien) {
    const response = await api.get(`/mecaniciens/${idMecanicien}`);
    return response.data.data;
  },

  /**
   * Crée un nouveau profil mécanicien.
   * Supporte la création simultanée du compte utilisateur (nom, prenom, email, mot_de_passe, specialite, telephone).
   * @param {Object} data - { specialite, nom, prenom, email, mot_de_passe, telephone? }
   * @returns {Promise<Object>}
   */
  async create(data) {
    const response = await api.post('/mecaniciens', data);
    return response.data.data;
  },

  /**
   * Met à jour un mécanicien existant.
   * Permet de modifier la spécialité et les informations de base du compte (nom, prenom, telephone).
   * @param {number|string} idMecanicien
   * @param {Object} data - { specialite?, nom?, prenom?, telephone? }
   * @returns {Promise<Object>}
   */
  async update(idMecanicien, data) {
    const response = await api.put(`/mecaniciens/${idMecanicien}`, data);
    return response.data.data;
  },

  /**
   * Supprime un mécanicien.
   * Rejette avec HTTP 409 Conflict si des réparations lui sont encore associées.
   * @param {number|string} idMecanicien
   * @returns {Promise<Object>}
   */
  async delete(idMecanicien) {
    const response = await api.delete(`/mecaniciens/${idMecanicien}`);
    return response.data.data;
  },

  /**
   * Récupère les réparations assignées à un mécanicien.
   * Utilise l'endpoint /api/v1/reparations?id_mecanicien=<idMecanicien>
   * @param {number|string} idMecanicien
   * @returns {Promise<Array>}
   */
  async getReparations(idMecanicien) {
    const response = await api.get('/reparations', {
      params: { id_mecanicien: idMecanicien },
    });
    return response.data.data;
  },
};

export default mecanicienService;
