"""Routes de gestion des clients pour GarageFlow (/api/v1/clients).

Seul le rôle RESPONSABLE est autorisé à gérer les clients conformément
au diagramme de cas d'utilisation UML et au cahier des charges.
"""
from flask import Blueprint, request
from marshmallow import ValidationError as MarshmallowValidationError

from app.schemas.client_schema import (
    client_create_schema,
    client_update_schema,
    client_response_schema,
    clients_response_schema,
)
from app.services import client_service
from app.utils.responses import success_response, error_response
from app.utils.exceptions import APIError, ValidationError
from app.utils.decorators import roles_required

client_bp = Blueprint("clients", __name__)


@client_bp.errorhandler(APIError)
def handle_api_error(err: APIError):
    """Intercepte les exceptions métier pour produire une réponse JSON standardisée."""
    return error_response(
        code=err.code,
        message=err.message,
        status_code=err.status_code,
        details=err.details,
    )


@client_bp.route("", methods=["GET"], strict_slashes=False)
@roles_required("RESPONSABLE")
def list_clients():
    """Liste tous les clients (avec filtre de recherche textuelle optionnel).

    Route : GET /api/v1/clients[?search=terme]
    Rôle autorisé : RESPONSABLE
    """
    search_query = request.args.get("search")
    clients = client_service.list_clients(search=search_query)
    return success_response(
        data=clients_response_schema.dump(clients),
        status_code=200,
    )


@client_bp.route("", methods=["POST"], strict_slashes=False)
@roles_required("RESPONSABLE")
def create_client():
    """Crée un nouveau client.

    Route : POST /api/v1/clients
    Rôle autorisé : RESPONSABLE
    Corps attendu : {"nom": "...", "prenom": "...", "telephone": "...", "adresse": "..."}
    """
    json_data = request.get_json(silent=True)
    if json_data is None or not isinstance(json_data, dict):
        raise ValidationError(
            message="Données de requête invalides. Un objet JSON est requis.",
            details={"_schema": ["Invalid or missing JSON payload."]},
        )

    try:
        validated_data = client_create_schema.load(json_data)
    except MarshmallowValidationError as err:
        raise ValidationError(
            message="Données de création du client invalides.",
            details=err.messages,
        )

    client = client_service.create_client(validated_data)
    return success_response(
        data=client_response_schema.dump(client),
        message="Client créé avec succès.",
        status_code=201,
    )


@client_bp.route("/<int:id_client>", methods=["GET"], strict_slashes=False)
@roles_required("RESPONSABLE")
def get_client(id_client: int):
    """Récupère un client par son identifiant unique.

    Route : GET /api/v1/clients/<id_client>
    Rôle autorisé : RESPONSABLE
    """
    client = client_service.get_client_by_id(id_client)
    return success_response(
        data=client_response_schema.dump(client),
        status_code=200,
    )


@client_bp.route("/<int:id_client>", methods=["PUT", "PATCH"], strict_slashes=False)
@roles_required("RESPONSABLE")
def update_client(id_client: int):
    """Met à jour les informations d'un client.

    Route : PUT/PATCH /api/v1/clients/<id_client>
    Rôle autorisé : RESPONSABLE
    Rejette les charges utiles vides ({}) avec un code HTTP 422.
    """
    json_data = request.get_json(silent=True)
    if json_data is None or not isinstance(json_data, dict) or len(json_data) == 0:
        raise ValidationError(
            message="Le corps de la requête ne peut pas être vide pour une mise à jour.",
            details={"_schema": ["At least one field must be provided for update."]},
        )

    try:
        validated_data = client_update_schema.load(json_data)
    except MarshmallowValidationError as err:
        raise ValidationError(
            message="Données de mise à jour du client invalides.",
            details=err.messages,
        )

    if not validated_data:
        raise ValidationError(
            message="Aucun champ valide à mettre à jour.",
            details={"_schema": ["No valid fields provided for update."]},
        )

    updated_client = client_service.update_client(id_client, validated_data)
    return success_response(
        data=client_response_schema.dump(updated_client),
        message="Client mis à jour avec succès.",
        status_code=200,
    )


@client_bp.route("/<int:id_client>", methods=["DELETE"], strict_slashes=False)
@roles_required("RESPONSABLE")
def delete_client(id_client: int):
    """Supprime un client si aucun enregistrement associé n'existe.

    Route : DELETE /api/v1/clients/<id_client>
    Rôle autorisé : RESPONSABLE
    Renvoie HTTP 409 si des véhicules ou rendez-vous sont liés.
    """
    client_service.delete_client(id_client)
    return success_response(
        data={"id_client": id_client},
        message="Client supprimé avec succès.",
        status_code=200,
    )
