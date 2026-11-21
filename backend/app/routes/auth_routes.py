"""Routes d'authentification pour GarageFlow (/api/v1/auth).
"""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import ValidationError as MarshmallowValidationError

from app.schemas.auth_schema import login_schema
from app.services.auth_service import login as auth_login, get_current_user_profile
from app.utils.responses import success_response, error_response
from app.utils.exceptions import APIError, ValidationError, AuthenticationError

auth_bp = Blueprint("auth", __name__)


@auth_bp.errorhandler(APIError)
def handle_api_error(err: APIError):
    """Intercepte les exceptions métier de l'API et produit une réponse JSON cohérente."""
    return error_response(
        code=err.code,
        message=err.message,
        status_code=err.status_code,
        details=err.details,
    )


@auth_bp.route("/login", methods=["POST"])
def login():
    """Authentification d'un utilisateur et émission d'un jeton JWT.

    Route : POST /api/v1/auth/login
    Format attendu : JSON {"email": "...", "mot_de_passe": "..."}

    Returns:
        JSON standardisé avec code 200 en succès, 401 si identifiants invalides, 422 si validation échoue.
    """
    json_data = request.get_json(silent=True)
    if json_data is None or not isinstance(json_data, dict):
        raise ValidationError(
            message="Données de requête invalides. Un corps JSON est requis.",
            details={"_schema": ["Invalid or missing JSON payload."]},
        )

    try:
        validated_data = login_schema.load(json_data)
    except MarshmallowValidationError as err:
        raise ValidationError(
            message="Données de connexion invalides.",
            details=err.messages,
        )

    auth_result = auth_login(
        email=validated_data["email"],
        password=validated_data["mot_de_passe"],
    )

    return success_response(
        data=auth_result,
        message="Connexion réussie.",
        status_code=200,
    )


@auth_bp.route("/me", methods=["GET"], strict_slashes=False)
@jwt_required()
def get_me():
    """Récupère les informations du profil de l'utilisateur connecté via son jeton JWT.

    Route : GET /api/v1/auth/me
    Authentification : Requise (Bearer JWT)

    Returns:
        JSON standardisé avec code 200 en succès contenant le profil utilisateur,
        401 si non authentifié ou jeton invalide/expiré,
        404 si l'utilisateur lié à l'identité JWT n'existe plus en base.
    """
    user_identity = get_jwt_identity()
    user_profile = get_current_user_profile(user_identity)
    return success_response(
        data=user_profile,
        message="Profil utilisateur récupéré avec succès.",
        status_code=200,
    )
