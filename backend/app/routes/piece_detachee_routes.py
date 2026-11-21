"""Routes de gestion des pièces détachées pour GarageFlow (/api/v1/pieces).

Conformément au diagramme de cas d'utilisation UML et au cahier des charges :
- Rôle RESPONSABLE : Accès complet (CRUD - UC7 Gérer les pièces détachées).
- Rôle MECANICIEN : Consultation du catalogue et des stocks disponibles (lecture seule).
"""
from flask import Blueprint, request, current_app
from marshmallow import ValidationError as MarshmallowValidationError

from app.schemas.piece_detachee_schema import (
    piece_detachee_create_schema,
    piece_detachee_update_schema,
    piece_detachee_response_schema,
    pieces_detachees_response_schema,
)
from app.services import piece_detachee_service
from app.utils.responses import success_response, error_response
from app.utils.exceptions import APIError, ValidationError
from app.utils.decorators import roles_required

piece_detachee_bp = Blueprint("pieces_detachees", __name__)


@piece_detachee_bp.errorhandler(APIError)
def handle_api_error(err: APIError):
    """Intercepte les exceptions métier pour produire une réponse JSON standardisée."""
    return error_response(
        code=err.code,
        message=err.message,
        status_code=err.status_code,
        details=err.details,
    )


@piece_detachee_bp.route("", methods=["GET"], strict_slashes=False)
@roles_required("RESPONSABLE", "MECANICIEN")
def list_pieces():
    """Liste toutes les pièces détachées avec filtres optionnels de recherche, stock et prix.

    Route : GET /api/v1/pieces[?search=...&stock_faible=...&stock_min=...&stock_max=...&prix_min=...&prix_max=...]
    Rôles autorisés : RESPONSABLE, MECANICIEN
    """
    search = request.args.get("search")

    stock_faible_arg = request.args.get("stock_faible")
    stock_faible = None
    if stock_faible_arg is not None:
        stock_faible = stock_faible_arg.strip().lower() in ("true", "1", "yes")

    stock_min_arg = request.args.get("stock_min")
    stock_min = None
    if stock_min_arg is not None and stock_min_arg.strip():
        try:
            stock_min = int(stock_min_arg.strip())
        except ValueError:
            raise ValidationError(
                message="Paramètre stock_min invalide.",
                details={"stock_min": ["Doit être un nombre entier valide."]},
            )

    stock_max_arg = request.args.get("stock_max")
    stock_max = None
    if stock_max_arg is not None and stock_max_arg.strip():
        try:
            stock_max = int(stock_max_arg.strip())
        except ValueError:
            raise ValidationError(
                message="Paramètre stock_max invalide.",
                details={"stock_max": ["Doit être un nombre entier valide."]},
            )

    prix_min_arg = request.args.get("prix_min")
    prix_min = None
    if prix_min_arg is not None and prix_min_arg.strip():
        try:
            prix_min = float(prix_min_arg.strip())
        except ValueError:
            raise ValidationError(
                message="Paramètre prix_min invalide.",
                details={"prix_min": ["Doit être un nombre décimal valide."]},
            )

    prix_max_arg = request.args.get("prix_max")
    prix_max = None
    if prix_max_arg is not None and prix_max_arg.strip():
        try:
            prix_max = float(prix_max_arg.strip())
        except ValueError:
            raise ValidationError(
                message="Paramètre prix_max invalide.",
                details={"prix_max": ["Doit être un nombre décimal valide."]},
            )

    # Seuil dynamique configuré avec prise en charge du paramètre seuil optionnel
    configured_threshold = current_app.config.get("LOW_STOCK_THRESHOLD", 5)
    seuil_arg = request.args.get("seuil") or request.args.get("seuil_stock_faible")
    seuil_stock_faible = configured_threshold
    if seuil_arg is not None and seuil_arg.strip():
        try:
            seuil_stock_faible = int(seuil_arg.strip())
        except ValueError:
            raise ValidationError(
                message="Paramètre seuil invalide.",
                details={"seuil": ["Doit être un nombre entier valide."]},
            )

    pieces = piece_detachee_service.list_pieces(
        search=search,
        stock_faible=stock_faible,
        seuil_stock_faible=seuil_stock_faible,
        stock_min=stock_min,
        stock_max=stock_max,
        prix_min=prix_min,
        prix_max=prix_max,
    )
    return success_response(
        data=pieces_detachees_response_schema.dump(pieces),
        status_code=200,
    )


@piece_detachee_bp.route("", methods=["POST"], strict_slashes=False)
@roles_required("RESPONSABLE")
def create_piece():
    """Crée une nouvelle pièce détachée dans le catalogue.

    Route : POST /api/v1/pieces
    Rôle autorisé : RESPONSABLE (UC7 Gérer les pièces détachées)
    Corps attendu : {"nom": "...", "prix_unitaire": 15.50, "quantite_stock": 20}
    """
    json_data = request.get_json(silent=True)
    if json_data is None or not isinstance(json_data, dict):
        raise ValidationError(
            message="Données de requête invalides. Un objet JSON est requis.",
            details={"_schema": ["Invalid or missing JSON payload."]},
        )

    try:
        validated_data = piece_detachee_create_schema.load(json_data)
    except MarshmallowValidationError as err:
        raise ValidationError(
            message="Données de création de la pièce détachée invalides.",
            details=err.messages,
        )

    piece = piece_detachee_service.create_piece(validated_data)
    return success_response(
        data=piece_detachee_response_schema.dump(piece),
        message="Pièce détachée créée avec succès.",
        status_code=201,
    )


@piece_detachee_bp.route("/<int:id_piece>", methods=["GET"], strict_slashes=False)
@roles_required("RESPONSABLE", "MECANICIEN")
def get_piece(id_piece: int):
    """Récupère les détails d'une pièce détachée par son identifiant unique.

    Route : GET /api/v1/pieces/<id_piece>
    Rôles autorisés : RESPONSABLE, MECANICIEN
    """
    piece = piece_detachee_service.get_piece_by_id(id_piece)
    return success_response(
        data=piece_detachee_response_schema.dump(piece),
        status_code=200,
    )


@piece_detachee_bp.route("/<int:id_piece>", methods=["PUT", "PATCH"], strict_slashes=False)
@roles_required("RESPONSABLE")
def update_piece(id_piece: int):
    """Met à jour une pièce détachée existante.

    Route : PUT/PATCH /api/v1/pieces/<id_piece>
    Rôle autorisé : RESPONSABLE (UC7 Gérer les pièces détachées)
    Rejette les charges utiles vides ({}) avec HTTP 422.
    """
    json_data = request.get_json(silent=True)
    if json_data is None or not isinstance(json_data, dict) or len(json_data) == 0:
        raise ValidationError(
            message="Le corps de la requête ne peut pas être vide pour une mise à jour.",
            details={"_schema": ["At least one field must be provided for update."]},
        )

    try:
        validated_data = piece_detachee_update_schema.load(json_data)
    except MarshmallowValidationError as err:
        raise ValidationError(
            message="Données de mise à jour de la pièce détachée invalides.",
            details=err.messages,
        )

    if not validated_data:
        raise ValidationError(
            message="Aucun champ valide à mettre à jour.",
            details={"_schema": ["No valid fields provided for update."]},
        )

    updated_piece = piece_detachee_service.update_piece(
        id_piece=id_piece,
        data=validated_data,
    )
    return success_response(
        data=piece_detachee_response_schema.dump(updated_piece),
        message="Pièce détachée mise à jour avec succès.",
        status_code=200,
    )


@piece_detachee_bp.route("/<int:id_piece>", methods=["DELETE"], strict_slashes=False)
@roles_required("RESPONSABLE")
def delete_piece(id_piece: int):
    """Supprime une pièce détachée si aucune réparation ne l'a consommée.

    Route : DELETE /api/v1/pieces/<id_piece>
    Rôle autorisé : RESPONSABLE (UC7 Gérer les pièces détachées)
    Renvoie HTTP 409 si des réparations sont liées.
    """
    piece_detachee_service.delete_piece(id_piece)
    return success_response(
        data={"id_piece": id_piece},
        message="Pièce détachée supprimée avec succès.",
        status_code=200,
    )
