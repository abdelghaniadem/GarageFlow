"""Routes de gestion des véhicules pour GarageFlow (/api/v1/vehicules).

Conformément au diagramme de cas d'utilisation UML et au cahier des charges :
- Rôle RESPONSABLE : Accès complet (CRUD - UC5 Gérer les véhicules).
- Rôle MECANICIEN : Accès en lecture seule (UC12 Consulter les véhicules).
"""
from flask import Blueprint, request
from marshmallow import ValidationError as MarshmallowValidationError

from app.schemas.vehicule_schema import (
    vehicule_create_schema,
    vehicule_update_schema,
    vehicule_response_schema,
    vehicules_response_schema,
)
from app.services import vehicule_service
from app.utils.responses import success_response, error_response
from app.utils.exceptions import APIError, ValidationError
from app.utils.decorators import roles_required

vehicule_bp = Blueprint("vehicules", __name__)


@vehicule_bp.errorhandler(APIError)
def handle_api_error(err: APIError):
    """Intercepte les exceptions métier pour produire une réponse JSON standardisée."""
    return error_response(
        code=err.code,
        message=err.message,
        status_code=err.status_code,
        details=err.details,
    )


@vehicule_bp.route("", methods=["GET"], strict_slashes=False)
@roles_required("RESPONSABLE", "MECANICIEN")
def list_vehicules():
    """Liste les véhicules avec filtres optionnels par client, immatriculation ou recherche textuelle.

    Route : GET /api/v1/vehicules[?id_client=...&immatriculation=...&search=...]
    Rôles autorisés : RESPONSABLE, MECANICIEN (UC12 Consulter les véhicules)
    """
    client_id_arg = request.args.get("id_client")
    id_client = None
    if client_id_arg is not None and client_id_arg.strip():
        try:
            id_client = int(client_id_arg.strip())
        except ValueError:
            raise ValidationError(
                message="Paramètre id_client invalide.",
                details={"id_client": ["Doit être un nombre entier valide."]},
            )

    immatriculation = request.args.get("immatriculation")
    search = request.args.get("search")

    vehicules = vehicule_service.list_vehicules(
        id_client=id_client,
        immatriculation=immatriculation,
        search=search,
    )
    return success_response(
        data=vehicules_response_schema.dump(vehicules),
        status_code=200,
    )


@vehicule_bp.route("", methods=["POST"], strict_slashes=False)
@roles_required("RESPONSABLE")
def create_vehicule():
    """Crée un nouveau véhicule rattaché à un client existant.

    Route : POST /api/v1/vehicules
    Rôle autorisé : RESPONSABLE (UC5 Gérer les véhicules)
    Corps attendu : {"marque": "...", "modele": "...", "immatriculation": "...", "id_client": ..., ...}
    """
    json_data = request.get_json(silent=True)
    if json_data is None or not isinstance(json_data, dict):
        raise ValidationError(
            message="Données de requête invalides. Un objet JSON est requis.",
            details={"_schema": ["Invalid or missing JSON payload."]},
        )

    try:
        validated_data = vehicule_create_schema.load(json_data)
    except MarshmallowValidationError as err:
        raise ValidationError(
            message="Données de création du véhicule invalides.",
            details=err.messages,
        )

    vehicule = vehicule_service.create_vehicule(validated_data)
    return success_response(
        data=vehicule_response_schema.dump(vehicule),
        message="Véhicule créé avec succès.",
        status_code=201,
    )


@vehicule_bp.route("/<int:id_vehicule>", methods=["GET"], strict_slashes=False)
@roles_required("RESPONSABLE", "MECANICIEN")
def get_vehicule(id_vehicule: int):
    """Récupère les détails d'un véhicule par son identifiant.

    Route : GET /api/v1/vehicules/<id_vehicule>
    Rôles autorisés : RESPONSABLE, MECANICIEN (UC12 Consulter les véhicules)
    """
    vehicule = vehicule_service.get_vehicule_by_id(id_vehicule)
    return success_response(
        data=vehicule_response_schema.dump(vehicule),
        status_code=200,
    )


@vehicule_bp.route("/<int:id_vehicule>", methods=["PUT", "PATCH"], strict_slashes=False)
@roles_required("RESPONSABLE")
def update_vehicule(id_vehicule: int):
    """Met à jour un véhicule existant.

    Route : PUT/PATCH /api/v1/vehicules/<id_vehicule>
    Rôle autorisé : RESPONSABLE (UC5 Gérer les véhicules)
    Rejette les charges utiles vides ({}) avec HTTP 422.
    """
    json_data = request.get_json(silent=True)
    if json_data is None or not isinstance(json_data, dict) or len(json_data) == 0:
        raise ValidationError(
            message="Le corps de la requête ne peut pas être vide pour une mise à jour.",
            details={"_schema": ["At least one field must be provided for update."]},
        )

    try:
        validated_data = vehicule_update_schema.load(json_data)
    except MarshmallowValidationError as err:
        raise ValidationError(
            message="Données de mise à jour du véhicule invalides.",
            details=err.messages,
        )

    if not validated_data:
        raise ValidationError(
            message="Aucun champ valide à mettre à jour.",
            details={"_schema": ["No valid fields provided for update."]},
        )

    updated_vehicule = vehicule_service.update_vehicule(id_vehicule, validated_data)
    return success_response(
        data=vehicule_response_schema.dump(updated_vehicule),
        message="Véhicule mis à jour avec succès.",
        status_code=200,
    )


@vehicule_bp.route("/<int:id_vehicule>", methods=["DELETE"], strict_slashes=False)
@roles_required("RESPONSABLE")
def delete_vehicule(id_vehicule: int):
    """Supprime un véhicule s'il ne possède ni réparation ni rendez-vous rattaché.

    Route : DELETE /api/v1/vehicules/<id_vehicule>
    Rôle autorisé : RESPONSABLE (UC5 Gérer les véhicules)
    Renvoie HTTP 409 si des réparations ou rendez-vous sont liés.
    """
    vehicule_service.delete_vehicule(id_vehicule)
    return success_response(
        data={"id_vehicule": id_vehicule},
        message="Véhicule supprimé avec succès.",
        status_code=200,
    )
