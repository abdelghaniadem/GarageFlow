import api from './api';

/**
 * Service pour la gestion des rendez-vous d'atelier GarageFlow.
 * Endpoints : /api/v1/rendez-vous (Réservé au profil RESPONSABLE)
 *
 * Schéma RendezVous PostgreSQL / Marshmallow :
 * - id_rendezvous : integer (PK)
 * - date_rendezvous : date (AAAA-MM-JJ) [REQUIS]
 * - heure : time (HH:MM ou HH:MM:SS) [REQUIS]
 * - motif : text [NULLABLE]
 * - statut : string [REQUIS, ex: 'PLANIFIE', 'CONFIRME', 'EN_ATTENTE', 'EN_COURS', 'TERMINE', 'ANNULE', 'HONORE']
 * - id_client : integer [REQUIS, FK -> client.id_client]
 * - id_vehicule : integer [REQUIS, FK -> vehicule.id_vehicule, doit appartenir au client]
 *
 * Règles métier :
 * - Le véhicule sélectionné doit obligatoirement appartenir au client choisi (rejet 422 si incohérent).
 * - Interdiction de supprimer un rendez-vous déjà 'TERMINE' ou 'HONORE' pour préserver l'historique d'atelier (409 Conflict).
 * - Mise à jour partielle ou totale via PUT / PATCH.
 */
export const rendezVousService = {
  /**
   * Récupère la liste des rendez-vous avec filtres multicritères optionnels.
   * @param {Object} [params] - { id_client, id_vehicule, statut, date_rendezvous, date_debut, date_fin }
   * @returns {Promise<Array>}
   */
  async list(params = {}) {
    const response = await api.get('/rendez-vous', { params });
    return response.data.data;
  },

  /**
   * Récupère un rendez-vous par son identifiant.
   * Inclut les informations imbriquées du client et du véhicule.
   * @param {number|string} id
   * @returns {Promise<Object>}
   */
  async getById(id) {
    const response = await api.get(`/rendez-vous/${id}`);
    return response.data.data;
  },

  /**
   * Crée un nouveau rendez-vous d'atelier.
   * @param {Object} data - { date_rendezvous, heure, id_client, id_vehicule, motif?, statut? }
   * @returns {Promise<Object>}
   */
  async create(data) {
    const response = await api.post('/rendez-vous', data);
    return response.data.data;
  },

  /**
   * Met à jour un rendez-vous existant.
   * @param {number|string} id
   * @param {Object} data - { date_rendezvous?, heure?, id_client?, id_vehicule?, motif?, statut? }
   * @returns {Promise<Object>}
   */
  async update(id, data) {
    const response = await api.put(`/rendez-vous/${id}`, data);
    return response.data.data;
  },

  /**
   * Supprime un rendez-vous d'atelier.
   * Si le rendez-vous est déjà 'TERMINE' ou 'HONORE', le backend renvoie 409 Conflict.
   * @param {number|string} id
   * @returns {Promise<Object>}
   */
  async delete(id) {
    const response = await api.delete(`/rendez-vous/${id}`);
    return response.data.data;
  },
};

export default rendezVousService;
