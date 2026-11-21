"""Routes de gestion des réparations pour GarageFlow (/api/v1/reparations).

Conformément au diagramme de cas d'utilisation UML et au cahier des charges :
- Rôle RESPONSABLE : Accès complet (CRUD - UC4 Gérer les réparations).
- Rôle MECANICIEN : Consultation et mise à jour de ses propres réparations uniquement
  (UC10 Mettre à jour l'état d'une réparation / UC11 Consulter les réparations assignées).
"""
from datetime import date
from flask import Blueprint, request
from flask_jwt_extended import get_jwt, get_jwt_identity
from marshmallow import ValidationError as MarshmallowValidationError

from app.schemas.reparation_schema import (
    reparation_create_schema,
    reparation_update_schema,
    reparation_response_schema,
    reparations_response_schema,
)
from app.schemas.reparation_piece_schema import (
    reparation_piece_create_schema,
    reparation_piece_update_schema,
    reparation_piece_response_schema,
    reparation_pieces_response_schema,
)
from app.services import reparation_service
from app.services import reparation_piece_service
from app.utils.responses import success_response, error_response
from app.utils.exceptions import APIError, ValidationError
from app.utils.decorators import roles_required

reparation_bp = Blueprint("reparations", __name__)


@reparation_bp.errorhandler(APIError)
def handle_api_error(err: APIError):
    """Intercepte les exceptions métier pour produire une réponse JSON standardisée."""
    return error_response(
        code=err.code,
        message=err.message,
        status_code=err.status_code,
        details=err.details,
    )


@reparation_bp.route("", methods=["GET"], strict_slashes=False)
@roles_required("RESPONSABLE", "MECANICIEN")
def list_reparations():
    """Liste les réparations avec filtres optionnels.

    Route : GET /api/v1/reparations[?id_vehicule=...&id_mecanicien=...&statut=...&date=...]
    Rôles autorisés : RESPONSABLE, MECANICIEN (filtré sur son propre id si MECANICIEN)
    """
    claims = get_jwt()
    user_role = claims.get("role")
    raw_user_id = get_jwt_identity()
    user_id = int(raw_user_id) if raw_user_id is not None else None

    # Extraction et validation du filtre véhicule
    vehicule_arg = request.args.get("id_vehicule")
    id_vehicule = None
    if vehicule_arg is not None and vehicule_arg.strip():
        try:
            id_vehicule = int(vehicule_arg.strip())
        except ValueError:
            raise ValidationError(
                message="Paramètre id_vehicule invalide.",
                details={"id_vehicule": ["Doit être un nombre entier valide."]},
            )

    # Extraction et validation du filtre mécanicien
    mecanicien_arg = request.args.get("id_mecanicien")
    id_mecanicien = None
    if mecanicien_arg is not None and mecanicien_arg.strip():
        try:
            id_mecanicien = int(mecanicien_arg.strip())
        except ValueError:
            raise ValidationError(
                message="Paramètre id_mecanicien invalide.",
                details={"id_mecanicien": ["Doit être un nombre entier valide."]},
            )

    statut = request.args.get("statut")

    # Extraction et validation du filtre date
    date_arg = request.args.get("date") or request.args.get("date_reparation")
    parsed_date = None
    if date_arg is not None and date_arg.strip():
        try:
            parsed_date = date.fromisoformat(date_arg.strip())
        except ValueError:
            raise ValidationError(
                message="Format de date invalide.",
                details={"date": ["La date doit être au format AAAA-MM-JJ (ISO 8601)."]},
            )

    reparations = reparation_service.list_reparations(
        id_vehicule=id_vehicule,
        id_mecanicien=id_mecanicien,
        statut=statut,
        date_reparation=parsed_date,
        user_role=user_role,
        user_id=user_id,
    )
    return success_response(
        data=reparations_response_schema.dump(reparations),
        status_code=200,
    )


@reparation_bp.route("", methods=["POST"], strict_slashes=False)
@roles_required("RESPONSABLE")
def create_reparation():
    """Crée une nouvelle fiche de réparation.

    Route : POST /api/v1/reparations
    Rôle autorisé : RESPONSABLE (UC4 Gérer les réparations)
    Corps attendu : {"description": "...", "date_reparation": "YYYY-MM-DD", "statut": "...", "id_vehicule": ..., "id_mecanicien": ...}
    """
    json_data = request.get_json(silent=True)
    if json_data is None or not isinstance(json_data, dict):
        raise ValidationError(
            message="Données de requête invalides. Un objet JSON est requis.",
            details={"_schema": ["Invalid or missing JSON payload."]},
        )

    try:
        validated_data = reparation_create_schema.load(json_data)
    except MarshmallowValidationError as err:
        raise ValidationError(
            message="Données de création de la réparation invalides.",
            details=err.messages,
        )

    reparation = reparation_service.create_reparation(validated_data)
    return success_response(
        data=reparation_response_schema.dump(reparation),
        message="Réparation créée avec succès.",
        status_code=201,
    )


@reparation_bp.route("/<int:id_reparation>", methods=["GET"], strict_slashes=False)
@roles_required("RESPONSABLE", "MECANICIEN")
def get_reparation(id_reparation: int):
    """Récupère les détails d'une réparation par son identifiant.

    Route : GET /api/v1/reparations/<id_reparation>
    Rôles autorisés : RESPONSABLE, MECANICIEN (seulement si assignée au mécanicien connecté)
    """
    claims = get_jwt()
    user_role = claims.get("role")
    raw_user_id = get_jwt_identity()
    user_id = int(raw_user_id) if raw_user_id is not None else None

    reparation = reparation_service.get_reparation_by_id(
        id_reparation=id_reparation,
        user_role=user_role,
        user_id=user_id,
    )
    return success_response(
        data=reparation_response_schema.dump(reparation),
        status_code=200,
    )


@reparation_bp.route("/<int:id_reparation>", methods=["PUT", "PATCH"], strict_slashes=False)
@roles_required("RESPONSABLE", "MECANICIEN")
def update_reparation(id_reparation: int):
    """Met à jour une réparation existante.

    Route : PUT/PATCH /api/v1/reparations/<id_reparation>
    Rôles autorisés : RESPONSABLE, MECANICIEN (seulement les siennes, sans réassigner mécanicien ou véhicule)
    Rejette les charges utiles vides ({}) avec HTTP 422.
    """
    json_data = request.get_json(silent=True)
    if json_data is None or not isinstance(json_data, dict) or len(json_data) == 0:
        raise ValidationError(
            message="Le corps de la requête ne peut pas être vide pour une mise à jour.",
            details={"_schema": ["At least one field must be provided for update."]},
        )

    try:
        validated_data = reparation_update_schema.load(json_data)
    except MarshmallowValidationError as err:
        raise ValidationError(
            message="Données de mise à jour de la réparation invalides.",
            details=err.messages,
        )

    if not validated_data:
        raise ValidationError(
            message="Aucun champ valide à mettre à jour.",
            details={"_schema": ["No valid fields provided for update."]},
        )

    claims = get_jwt()
    user_role = claims.get("role")
    raw_user_id = get_jwt_identity()
    user_id = int(raw_user_id) if raw_user_id is not None else None

    updated_reparation = reparation_service.update_reparation(
        id_reparation=id_reparation,
        data=validated_data,
        user_role=user_role,
        user_id=user_id,
    )
    return success_response(
        data=reparation_response_schema.dump(updated_reparation),
        message="Réparation mise à jour avec succès.",
        status_code=200,
    )


@reparation_bp.route("/<int:id_reparation>", methods=["DELETE"], strict_slashes=False)
@roles_required("RESPONSABLE")
def delete_reparation(id_reparation: int):
    """Supprime une réparation si aucune facture ni pièce n'y est rattachée.

    Route : DELETE /api/v1/reparations/<id_reparation>
    Rôle autorisé : RESPONSABLE (UC4 Gérer les réparations)
    Renvoie HTTP 409 si une facture ou des pièces sont liées.
    """
    reparation_service.delete_reparation(id_reparation)
    return success_response(
        data={"id_reparation": id_reparation},
        message="Réparation supprimée avec succès.",
        status_code=200,
    )


# ============================================================================
# Endpoints: Gestion des pièces consommées pour une réparation
# ============================================================================

@reparation_bp.route("/<int:id_reparation>/pieces", methods=["GET"], strict_slashes=False)
@roles_required("RESPONSABLE", "MECANICIEN")
def list_reparation_pieces(id_reparation: int):
    """Liste les pièces détachées associées à une réparation donnée.

    Route : GET /api/v1/reparations/<id_reparation>/pieces
    Rôles autorisés : RESPONSABLE, MECANICIEN (uniquement ses réparations assignées)
    """
    claims = get_jwt()
    user_role = claims.get("role")
    raw_user_id = get_jwt_identity()
    user_id = int(raw_user_id) if raw_user_id is not None else None

    pieces = reparation_piece_service.list_reparation_pieces(
        id_reparation=id_reparation,
        user_role=user_role,
        user_id=user_id,
    )
    return success_response(
        data=reparation_pieces_response_schema.dump(pieces),
        status_code=200,
    )


@reparation_bp.route("/<int:id_reparation>/pieces", methods=["POST"], strict_slashes=False)
@roles_required("RESPONSABLE", "MECANICIEN")
def add_piece_to_reparation(id_reparation: int):
    """Associe une pièce détachée à une réparation et décrémente le stock disponible.

    Route : POST /api/v1/reparations/<id_reparation>/pieces
    Rôles autorisés : RESPONSABLE, MECANICIEN (uniquement ses réparations assignées)
    Corps attendu : {"id_piece": 1, "quantite": 2}
    """
    json_data = request.get_json(silent=True)
    if json_data is None or not isinstance(json_data, dict):
        raise ValidationError(
            message="Données de requête invalides. Un objet JSON est requis.",
            details={"_schema": ["Invalid or missing JSON payload."]},
        )

    try:
        validated_data = reparation_piece_create_schema.load(json_data)
    except MarshmallowValidationError as err:
        raise ValidationError(
            message="Données d'association de la pièce invalides.",
            details=err.messages,
        )

    claims = get_jwt()
    user_role = claims.get("role")
    raw_user_id = get_jwt_identity()
    user_id = int(raw_user_id) if raw_user_id is not None else None

    assoc = reparation_piece_service.add_piece_to_reparation(
        id_reparation=id_reparation,
        data=validated_data,
        user_role=user_role,
        user_id=user_id,
    )
    return success_response(
        data=reparation_piece_response_schema.dump(assoc),
        message="Pièce détachée associée à la réparation avec succès.",
        status_code=201,
    )


@reparation_bp.route("/<int:id_reparation>/pieces/<int:id_piece>", methods=["GET"], strict_slashes=False)
@roles_required("RESPONSABLE", "MECANICIEN")
def get_reparation_piece(id_reparation: int, id_piece: int):
    """Consulte les détails d'une pièce consommée spécifique.

    Route : GET /api/v1/reparations/<id_reparation>/pieces/<id_piece>
    Rôles autorisés : RESPONSABLE, MECANICIEN (uniquement ses réparations assignées)
    """
    claims = get_jwt()
    user_role = claims.get("role")
    raw_user_id = get_jwt_identity()
    user_id = int(raw_user_id) if raw_user_id is not None else None

    assoc = reparation_piece_service.get_reparation_piece(
        id_reparation=id_reparation,
        id_piece=id_piece,
        user_role=user_role,
        user_id=user_id,
    )
    return success_response(
        data=reparation_piece_response_schema.dump(assoc),
        status_code=200,
    )


@reparation_bp.route("/<int:id_reparation>/pieces/<int:id_piece>", methods=["PATCH", "PUT"], strict_slashes=False)
@roles_required("RESPONSABLE", "MECANICIEN")
def update_reparation_piece(id_reparation: int, id_piece: int):
    """Met à jour la quantité d'une pièce consommée en appliquant strictement le différentiel au stock.

    Route : PATCH/PUT /api/v1/reparations/<id_reparation>/pieces/<id_piece>
    Rôles autorisés : RESPONSABLE, MECANICIEN (uniquement ses réparations assignées)
    Corps attendu : {"quantite": 5}
    """
    json_data = request.get_json(silent=True)
    if json_data is None or not isinstance(json_data, dict) or len(json_data) == 0:
        raise ValidationError(
            message="Le corps de la requête ne peut pas être vide pour une mise à jour.",
            details={"_schema": ["At least one field must be provided for update."]},
        )

    try:
        validated_data = reparation_piece_update_schema.load(json_data)
    except MarshmallowValidationError as err:
        raise ValidationError(
            message="Données de mise à jour de la quantité invalides.",
            details=err.messages,
        )

    claims = get_jwt()
    user_role = claims.get("role")
    raw_user_id = get_jwt_identity()
    user_id = int(raw_user_id) if raw_user_id is not None else None

    assoc = reparation_piece_service.update_reparation_piece_quantity(
        id_reparation=id_reparation,
        id_piece=id_piece,
        data=validated_data,
        user_role=user_role,
        user_id=user_id,
    )
    return success_response(
        data=reparation_piece_response_schema.dump(assoc),
        message="Quantité de la pièce mise à jour avec succès.",
        status_code=200,
    )


@reparation_bp.route("/<int:id_reparation>/pieces/<int:id_piece>", methods=["DELETE"], strict_slashes=False)
@roles_required("RESPONSABLE", "MECANICIEN")
def remove_piece_from_reparation(id_reparation: int, id_piece: int):
    """Retire une pièce d'une réparation et réintègre intégralement sa quantité dans le stock.

    Route : DELETE /api/v1/reparations/<id_reparation>/pieces/<id_piece>
    Rôles autorisés : RESPONSABLE, MECANICIEN (uniquement ses réparations assignées)
    """
    claims = get_jwt()
    user_role = claims.get("role")
    raw_user_id = get_jwt_identity()
    user_id = int(raw_user_id) if raw_user_id is not None else None

    reparation_piece_service.remove_piece_from_reparation(
        id_reparation=id_reparation,
        id_piece=id_piece,
        user_role=user_role,
        user_id=user_id,
    )
    return success_response(
        data={"id_reparation": id_reparation, "id_piece": id_piece},
        message="Pièce détachée retirée de la réparation avec succès.",
        status_code=200,
    )
