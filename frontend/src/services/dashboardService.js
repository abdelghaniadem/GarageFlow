import api from './api';

/**
 * Service pour la récupération des statistiques du tableau de bord.
 * Connecté à l'endpoint backend GET /api/v1/dashboard/stats
 */
export const dashboardService = {
  /**
   * Récupère l'ensemble des indicateurs, graphiques et listes d'activité du dashboard.
   * @returns {Promise<Object>}
   */
  async getStats() {
    const response = await api.get('/dashboard/stats');
    // Le backend renvoie { success: true, data: { ... }, message: "..." }
    return response.data.data;
  },
};

export default dashboardService;
