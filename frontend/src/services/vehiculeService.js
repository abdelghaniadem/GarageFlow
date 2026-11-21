import api from './api';

/**
 * Service pour la gestion des véhicules GarageFlow.
 * Endpoints : /api/v1/vehicules
 *
 * Schéma Véhicule PostgreSQL / Marshmallow :
 * - id_vehicule : integer (PK)
 * - marque : string (1..50) [REQUIS]
 * - modele : string (1..50) [REQUIS]
 * - immatriculation : string (1..30) [REQUIS, UNIQUE, AUTO-MAJUSCULES]
 * - annee : integer (1900..2100) [OPTIONNEL]
 * - kilometrage : integer (>= 0) [OPTIONNEL]
 * - etat : string (max 30) [OPTIONNEL]
 * - id_client : integer (FK -> client.id_client) [REQUIS]
 * (NOTE : La table PostgreSQL ne possède aucun champ motorisation)
 *
 * Permissions :
 * - GET : Accessible par RESPONSABLE et MECANICIEN
 * - POST / PUT / DELETE : Réservé exclusivement à RESPONSABLE
 */
export const vehiculeService = {
  /**
   * Récupère la liste des véhicules avec filtres optionnels.
   * @param {Object} [params] - { search, id_client, immatriculation }
   * @returns {Promise<Array>}
   */
  async list(params = {}) {
    const response = await api.get('/vehicules', { params });
    return response.data.data;
  },

  /**
   * Récupère un véhicule par son identifiant unique.
   * @param {number|string} idVehicule
   * @returns {Promise<Object>}
   */
  async getById(idVehicule) {
    const response = await api.get(`/vehicules/${idVehicule}`);
    return response.data.data;
  },

  /**
   * Crée un nouveau véhicule rattaché à un client.
   * Réservé au profil RESPONSABLE.
   * @param {Object} data - { marque, modele, immatriculation, id_client, annee?, kilometrage?, etat? }
   * @returns {Promise<Object>}
   */
  async create(data) {
    const response = await api.post('/vehicules', data);
    return response.data.data;
  },

  /**
   * Met à jour un véhicule existant.
   * Réservé au profil RESPONSABLE.
   * @param {number|string} idVehicule
   * @param {Object} data - { marque?, modele?, immatriculation?, id_client?, annee?, kilometrage?, etat? }
   * @returns {Promise<Object>}
   */
  async update(idVehicule, data) {
    const response = await api.put(`/vehicules/${idVehicule}`, data);
    return response.data.data;
  },

  /**
   * Supprime un véhicule.
   * Rejette avec HTTP 409 Conflict si des réparations ou des rendez-vous sont associés.
   * Réservé au profil RESPONSABLE.
   * @param {number|string} idVehicule
   * @returns {Promise<Object>}
   */
  async delete(idVehicule) {
    const response = await api.delete(`/vehicules/${idVehicule}`);
    return response.data.data;
  },
};

export default vehiculeService;
