"""Routes de gestion des rendez-vous pour GarageFlow (/api/v1/rendez-vous).

Conformément au diagramme de cas d'utilisation UML (UC8 - Gérer les rendez-vous) :
- Seul le rôle RESPONSABLE est habilité à planifier, modifier, supprimer et consulter les rendez-vous.
- Le rôle MECANICIEN n'a aucun droit d'accès à la gestion des rendez-vous (HTTP 403 Forbidden).
"""
from datetime import date
from flask import Blueprint, request
from marshmallow import ValidationError as MarshmallowValidationError

from app.schemas.rendez_vous_schema import (
    rendez_vous_create_schema,
    rendez_vous_update_schema,
    rendez_vous_response_schema,
    rendez_vous_list_response_schema,
)
from app.services import rendez_vous_service
from app.utils.responses import success_response, error_response
from app.utils.exceptions import APIError, ValidationError
from app.utils.decorators import roles_required

rendez_vous_bp = Blueprint("rendez_vous", __name__)


@rendez_vous_bp.errorhandler(APIError)
def handle_api_error(err: APIError):
    """Intercepte les exceptions métier pour produire une réponse JSON standardisée."""
    return error_response(
        code=err.code,
        message=err.message,
        status_code=err.status_code,
        details=err.details,
    )


@rendez_vous_bp.route("", methods=["GET"], strict_slashes=False)
@roles_required("RESPONSABLE")
def list_rendez_vous():
    """Liste tous les rendez-vous avec filtres multicritères optionnels.

    Route : GET /api/v1/rendez-vous[?id_client=...&id_vehicule=...&statut=...&date=...&date_debut=...&date_fin=...]
    Rôle autorisé : RESPONSABLE
    """
    # 1. Filtre client
    client_arg = request.args.get("id_client")
    id_client = None
    if client_arg is not None and client_arg.strip():
        try:
            id_client = int(client_arg.strip())
        except ValueError:
            raise ValidationError(
                message="Paramètre id_client invalide.",
                details={"id_client": ["Doit être un entier positif."]},
            )

    # 2. Filtre véhicule
    vehicule_arg = request.args.get("id_vehicule")
    id_vehicule = None
    if vehicule_arg is not None and vehicule_arg.strip():
        try:
            id_vehicule = int(vehicule_arg.strip())
        except ValueError:
            raise ValidationError(
                message="Paramètre id_vehicule invalide.",
                details={"id_vehicule": ["Doit être un entier positif."]},
            )

    # 3. Filtre statut
    statut_arg = request.args.get("statut")

    # 4. Filtre date exacte
    date_arg = request.args.get("date_rendezvous") or request.args.get("date")
    parsed_date = None
    if date_arg is not None and date_arg.strip():
        try:
            parsed_date = date.fromisoformat(date_arg.strip())
        except ValueError:
            raise ValidationError(
                message="Format de date invalide pour date_rendezvous.",
                details={"date_rendezvous": ["La date doit être au format AAAA-MM-JJ (ISO 8601)."]},
            )

    # 5. Filtre date début
    debut_arg = request.args.get("date_debut")
    parsed_debut = None
    if debut_arg is not None and debut_arg.strip():
        try:
            parsed_debut = date.fromisoformat(debut_arg.strip())
        except ValueError:
            raise ValidationError(
                message="Format de date invalide pour date_debut.",
                details={"date_debut": ["La date doit être au format AAAA-MM-JJ (ISO 8601)."]},
            )

    # 6. Filtre date fin
    fin_arg = request.args.get("date_fin")
    parsed_fin = None
    if fin_arg is not None and fin_arg.strip():
        try:
            parsed_fin = date.fromisoformat(fin_arg.strip())
        except ValueError:
            raise ValidationError(
                message="Format de date invalide pour date_fin.",
                details={"date_fin": ["La date doit être au format AAAA-MM-JJ (ISO 8601)."]},
            )

    rdvs = rendez_vous_service.list_rendez_vous(
        id_client=id_client,
        id_vehicule=id_vehicule,
        statut=statut_arg,
        date_rendezvous=parsed_date,
        date_debut=parsed_debut,
        date_fin=parsed_fin,
    )

    return success_response(
        data=rendez_vous_list_response_schema.dump(rdvs),
        status_code=200,
    )


@rendez_vous_bp.route("", methods=["POST"], strict_slashes=False)
@roles_required("RESPONSABLE")
def create_rendez_vous():
    """Crée un nouveau rendez-vous d'atelier.

    Route : POST /api/v1/rendez-vous
    Rôle autorisé : RESPONSABLE
    Corps attendu : {"date_rendezvous": "YYYY-MM-DD", "heure": "HH:MM", "id_client": ..., "id_vehicule": ..., "motif": "...", "statut": "..."}
    """
    json_data = request.get_json(silent=True)
    if json_data is None or not isinstance(json_data, dict):
        raise ValidationError(
            message="Données de requête invalides. Un objet JSON est requis.",
            details={"_schema": ["Invalid or missing JSON payload."]},
        )

    try:
        validated_data = rendez_vous_create_schema.load(json_data)
    except MarshmallowValidationError as err:
        raise ValidationError(
            message="Données de création du rendez-vous invalides.",
            details=err.messages,
        )

    rdv = rendez_vous_service.create_rendez_vous(validated_data)
    return success_response(
        data=rendez_vous_response_schema.dump(rdv),
        message="Rendez-vous créé avec succès.",
        status_code=201,
    )


@rendez_vous_bp.route("/<int:id_rendezvous>", methods=["GET"], strict_slashes=False)
@roles_required("RESPONSABLE")
def get_rendez_vous(id_rendezvous: int):
    """Récupère un rendez-vous par son identifiant unique.

    Route : GET /api/v1/rendez-vous/<id_rendezvous>
    Rôle autorisé : RESPONSABLE
    """
    rdv = rendez_vous_service.get_rendez_vous_by_id(id_rendezvous)
    return success_response(
        data=rendez_vous_response_schema.dump(rdv),
        status_code=200,
    )


@rendez_vous_bp.route("/<int:id_rendezvous>", methods=["PUT", "PATCH"], strict_slashes=False)
@roles_required("RESPONSABLE")
def update_rendez_vous(id_rendezvous: int):
    """Met à jour les informations d'un rendez-vous.

    Route : PUT / PATCH /api/v1/rendez-vous/<id_rendezvous>
    Rôle autorisé : RESPONSABLE
    Rejette les charges utiles vides ({}) avec HTTP 422.
    """
    json_data = request.get_json(silent=True)
    if json_data is None or not isinstance(json_data, dict) or len(json_data) == 0:
        raise ValidationError(
            message="Le corps de la requête ne peut pas être vide pour une mise à jour.",
            details={"_schema": ["At least one field must be provided for update."]},
        )

    try:
        validated_data = rendez_vous_update_schema.load(json_data)
    except MarshmallowValidationError as err:
        raise ValidationError(
            message="Données de mise à jour du rendez-vous invalides.",
            details=err.messages,
        )

    updated_rdv = rendez_vous_service.update_rendez_vous(id_rendezvous, validated_data)
    return success_response(
        data=rendez_vous_response_schema.dump(updated_rdv),
        message="Rendez-vous mis à jour avec succès.",
        status_code=200,
    )


@rendez_vous_bp.route("/<int:id_rendezvous>", methods=["DELETE"], strict_slashes=False)
@roles_required("RESPONSABLE")
def delete_rendez_vous(id_rendezvous: int):
    """Supprime un rendez-vous d'atelier.

    Route : DELETE /api/v1/rendez-vous/<id_rendezvous>
    Rôle autorisé : RESPONSABLE
    Renvoie HTTP 409 si le rendez-vous est déjà terminé ou honoré (protection d'historique).
    """
    rendez_vous_service.delete_rendez_vous(id_rendezvous)
    return success_response(
        data={"id_rendezvous": id_rendezvous},
        message="Rendez-vous supprimé avec succès.",
        status_code=200,
    )
