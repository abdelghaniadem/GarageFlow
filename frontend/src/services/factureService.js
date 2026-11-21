import api from './api';

/**
 * Service pour la gestion des factures GarageFlow.
 * Endpoints : /api/v1/factures (Réservé au profil RESPONSABLE)
 *
 * Schéma Facture PostgreSQL / Marshmallow :
 * - id_facture : integer (PK)
 * - date_facture : date (AAAA-MM-JJ) [REQUIS]
 * - montant_total : decimal [CALCULÉ AUTOMATIQUEMENT par le backend]
 * - statut_paiement : string [REQUIS, ex: 'EN_ATTENTE', 'PAYEE', 'ANNULEE']
 * - id_reparation : integer [REQUIS, FK -> reparation.id_reparation, UNIQUE]
 *
 * Règles métier :
 * - Montant total = main d'œuvre (reparation.cout) + pièces (reparation_piece.quantite * prix_unitaire).
 * - Une seule facture par réparation (relation 1:1 stricte).
 * - Suppression d'une facture formellement interdite (renvoie toujours HTTP 409 Conflict).
 * - Mise à jour autorisée uniquement sur le statut_paiement (PATCH).
 */
export const factureService = {
  /**
   * Récupère la liste des factures avec filtres multicritères optionnels.
   * @param {Object} [params] - { statut_paiement, id_reparation, date_facture, date_debut, date_fin, id_vehicule, id_client }
   * @returns {Promise<Array>}
   */
  async list(params = {}) {
    const response = await api.get('/factures', { params });
    return response.data.data;
  },

  /**
   * Récupère le détail complet d'une facture par son identifiant.
   * Inclut le détail des pièces consommées et de la réparation.
   * @param {number|string} idFacture
   * @returns {Promise<Object>}
   */
  async getById(idFacture) {
    const response = await api.get(`/factures/${idFacture}`);
    return response.data.data;
  },

  /**
   * Émet une nouvelle facture pour une réparation existante.
   * Le montant total est calculé automatiquement par le backend.
   * @param {Object} data - { id_reparation, date_facture?, statut_paiement? }
   * @returns {Promise<Object>}
   */
  async create(data) {
    const response = await api.post('/factures', data);
    return response.data.data;
  },

  /**
   * Met à jour le statut de paiement d'une facture.
   * @param {number|string} idFacture
   * @param {string} statutPaiement - 'EN_ATTENTE', 'PAYEE', 'ANNULEE', etc.
   * @returns {Promise<Object>}
   */
  async updateStatut(idFacture, statutPaiement) {
    const response = await api.patch(`/factures/${idFacture}`, {
      statut_paiement: statutPaiement,
    });
    return response.data.data;
  },

  /**
   * Tente de supprimer une facture.
   * Le backend renverra une erreur 409 Conflict conformément aux règles comptables.
   * @param {number|string} idFacture
   * @returns {Promise<Object>}
   */
  async delete(idFacture) {
    const response = await api.delete(`/factures/${idFacture}`);
    return response.data.data;
  },
};

export default factureService;
