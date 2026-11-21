"""Routes de gestion des mécaniciens pour GarageFlow (/api/v1/mecaniciens).

La gestion administrative des mécaniciens est réservée au rôle RESPONSABLE
conformément à l'architecture de sécurité du projet.
"""
from flask import Blueprint, request
from marshmallow import ValidationError as MarshmallowValidationError

from app.schemas.mecanicien_schema import (
    mecanicien_create_schema,
    mecanicien_update_schema,
    mecanicien_response_schema,
    mecaniciens_response_schema,
)
from app.services import mecanicien_service
from app.utils.responses import success_response, error_response
from app.utils.exceptions import APIError, ValidationError
from app.utils.decorators import roles_required

mecanicien_bp = Blueprint("mecaniciens", __name__)


@mecanicien_bp.errorhandler(APIError)
def handle_api_error(err: APIError):
    """Intercepte les exceptions métier pour produire une réponse JSON standardisée."""
    return error_response(
        code=err.code,
        message=err.message,
        status_code=err.status_code,
        details=err.details,
    )


@mecanicien_bp.route("", methods=["GET"], strict_slashes=False)
@roles_required("RESPONSABLE")
def list_mecaniciens():
    """Liste tous les mécaniciens avec filtres optionnels.

    Route : GET /api/v1/mecaniciens[?specialite=...&search=...]
    Rôle autorisé : RESPONSABLE
    """
    specialite = request.args.get("specialite")
    search = request.args.get("search")

    mecaniciens = mecanicien_service.list_mecaniciens(
        specialite=specialite,
        search=search,
    )
    return success_response(
        data=mecaniciens_response_schema.dump(mecaniciens),
        status_code=200,
    )


@mecanicien_bp.route("", methods=["POST"], strict_slashes=False)
@roles_required("RESPONSABLE")
def create_mecanicien():
    """Crée un nouveau profil mécanicien.

    Route : POST /api/v1/mecaniciens
    Rôle autorisé : RESPONSABLE
    Format attendu :
      - Association : {"specialite": "...", "id_utilisateur": ...}
      OU
      - Création complète : {"specialite": "...", "nom": "...", "prenom": "...", "email": "...", "mot_de_passe": "..."}
    """
    json_data = request.get_json(silent=True)
    if json_data is None or not isinstance(json_data, dict):
        raise ValidationError(
            message="Données de requête invalides. Un objet JSON est requis.",
            details={"_schema": ["Invalid or missing JSON payload."]},
        )

    try:
        validated_data = mecanicien_create_schema.load(json_data)
    except MarshmallowValidationError as err:
        raise ValidationError(
            message="Données de création du mécanicien invalides.",
            details=err.messages,
        )

    mecanicien = mecanicien_service.create_mecanicien(validated_data)
    return success_response(
        data=mecanicien_response_schema.dump(mecanicien),
        message="Mécanicien créé avec succès.",
        status_code=201,
    )


@mecanicien_bp.route("/<int:id_mecanicien>", methods=["GET"], strict_slashes=False)
@roles_required("RESPONSABLE")
def get_mecanicien(id_mecanicien: int):
    """Récupère les détails d'un mécanicien par son identifiant unique.

    Route : GET /api/v1/mecaniciens/<id_mecanicien>
    Rôle autorisé : RESPONSABLE
    """
    mecanicien = mecanicien_service.get_mecanicien_by_id(id_mecanicien)
    return success_response(
        data=mecanicien_response_schema.dump(mecanicien),
        status_code=200,
    )


@mecanicien_bp.route("/<int:id_mecanicien>", methods=["PUT", "PATCH"], strict_slashes=False)
@roles_required("RESPONSABLE")
def update_mecanicien(id_mecanicien: int):
    """Met à jour les informations d'un mécanicien.

    Route : PUT/PATCH /api/v1/mecaniciens/<id_mecanicien>
    Rôle autorisé : RESPONSABLE
    Rejette les charges utiles vides ({}) avec HTTP 422.
    Interdit la réassignation de l'utilisateur associé.
    """
    json_data = request.get_json(silent=True)
    if json_data is None or not isinstance(json_data, dict) or len(json_data) == 0:
        raise ValidationError(
            message="Le corps de la requête ne peut pas être vide pour une mise à jour.",
            details={"_schema": ["At least one field must be provided for update."]},
        )

    try:
        validated_data = mecanicien_update_schema.load(json_data)
    except MarshmallowValidationError as err:
        raise ValidationError(
            message="Données de mise à jour du mécanicien invalides.",
            details=err.messages,
        )

    if not validated_data:
        raise ValidationError(
            message="Aucun champ valide à mettre à jour.",
            details={"_schema": ["No valid fields provided for update."]},
        )

    updated_mecanicien = mecanicien_service.update_mecanicien(id_mecanicien, validated_data)
    return success_response(
        data=mecanicien_response_schema.dump(updated_mecanicien),
        message="Mécanicien mis à jour avec succès.",
        status_code=200,
    )


@mecanicien_bp.route("/<int:id_mecanicien>", methods=["DELETE"], strict_slashes=False)
@roles_required("RESPONSABLE")
def delete_mecanicien(id_mecanicien: int):
    """Supprime un profil mécanicien s'il ne possède aucune réparation liée.

    Route : DELETE /api/v1/mecaniciens/<id_mecanicien>
    Rôle autorisé : RESPONSABLE
    Renvoie HTTP 409 si des réparations sont rattachées.
    """
    mecanicien_service.delete_mecanicien(id_mecanicien)
    return success_response(
        data={"id_mecanicien": id_mecanicien},
        message="Mécanicien supprimé avec succès.",
        status_code=200,
    )
