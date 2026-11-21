"""Routes pour le tableau de bord de GarageFlow (/api/v1/dashboard).
"""
from flask import Blueprint
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt

from app.services.dashboard_service import get_dashboard_stats
from app.utils.responses import success_response, error_response
from app.utils.exceptions import APIError

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.errorhandler(APIError)
def handle_api_error(err: APIError):
    """Intercepte les erreurs métier et produit une réponse JSON cohérente."""
    return error_response(
        code=err.code,
        message=err.message,
        status_code=err.status_code,
        details=err.details,
    )


@dashboard_bp.route("/stats", methods=["GET"], strict_slashes=False)
@jwt_required()
def get_stats():
    """Récupère les indicateurs et statistiques du tableau de bord.

    Route : GET /api/v1/dashboard/stats
    Authentification : Requise (Bearer JWT)
    Contrôle d'accès :
    - RESPONSABLE : données globales, indicateurs financiers, alertes stock.
    - MECANICIEN : données limitées à ses réparations, indicateurs financiers masqués.

    Returns:
        JSON standardisé avec code 200 contenant les données du dashboard.
    """
    user_identity = get_jwt_identity()
    claims = get_jwt()
    user_role = claims.get("role", "MECANICIEN")

    stats = get_dashboard_stats(user_id=user_identity, user_role=user_role)

    return success_response(
        data=stats,
        message="Statistiques du tableau de bord récupérées avec succès.",
        status_code=200,
    )
