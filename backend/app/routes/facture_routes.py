"""Routes de gestion des factures pour GarageFlow (/api/v1/factures).

Conformément au diagramme de cas d'utilisation UML (UC9 - Gérer les factures) :
- Seul le rôle RESPONSABLE est habilité à émettre, consulter et gérer les factures.
- Le rôle MECANICIEN ne possède aucun droit d'accès à la facturation (HTTP 403).
"""
from datetime import date
from flask import Blueprint, request
from marshmallow import ValidationError as MarshmallowValidationError

from app.schemas.facture_schema import (
    facture_create_schema,
    facture_update_schema,
    facture_response_schema,
    factures_response_schema,
    facture_detail_response_schema,
)
from app.services import facture_service
from app.utils.responses import success_response, error_response
from app.utils.exceptions import APIError, ValidationError
from app.utils.decorators import roles_required

facture_bp = Blueprint("factures", __name__)


@facture_bp.errorhandler(APIError)
def handle_api_error(err: APIError):
    """Intercepte les exceptions métier pour produire une réponse JSON standardisée."""
    return error_response(
        code=err.code,
        message=err.message,
        status_code=err.status_code,
        details=err.details,
    )


@facture_bp.route("", methods=["GET"], strict_slashes=False)
@roles_required("RESPONSABLE")
def list_factures():
    """Liste toutes les factures avec filtres multicritères optionnels.

    Route : GET /api/v1/factures[?statut=...&id_reparation=...&date=...&date_debut=...&date_fin=...&id_vehicule=...&id_client=...]
    Rôle autorisé : RESPONSABLE
    """
    # 1. Filtre statut_paiement
    statut_arg = request.args.get("statut_paiement") or request.args.get("statut")

    # 2. Filtre id_reparation
    reparation_arg = request.args.get("id_reparation")
    id_reparation = None
    if reparation_arg is not None and reparation_arg.strip():
        try:
            id_reparation = int(reparation_arg.strip())
        except ValueError:
            raise ValidationError(
                message="Paramètre id_reparation invalide.",
                details={"id_reparation": ["Doit être un entier positif."]},
            )

    # 3. Filtre date exacte
    date_arg = request.args.get("date_facture") or request.args.get("date")
    parsed_date = None
    if date_arg is not None and date_arg.strip():
        try:
            parsed_date = date.fromisoformat(date_arg.strip())
        except ValueError:
            raise ValidationError(
                message="Format de date invalide pour date_facture.",
                details={"date_facture": ["La date doit être au format AAAA-MM-JJ (ISO 8601)."]},
            )

    # 4. Filtre date début
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

    # 5. Filtre date fin
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

    # 6. Filtre véhicule
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

    # 7. Filtre client
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

    factures = facture_service.list_factures(
        statut_paiement=statut_arg,
        id_reparation=id_reparation,
        date_facture=parsed_date,
        date_debut=parsed_debut,
        date_fin=parsed_fin,
        id_vehicule=id_vehicule,
        id_client=id_client,
    )

    return success_response(
        data=factures_response_schema.dump(factures),
        status_code=200,
    )


@facture_bp.route("", methods=["POST"], strict_slashes=False)
@roles_required("RESPONSABLE")
def create_facture():
    """Émet une nouvelle facture pour une réparation existante.

    Route : POST /api/v1/factures
    Rôle autorisé : RESPONSABLE
    Corps attendu : {"id_reparation": ..., "date_facture": "YYYY-MM-DD" (opt), "statut_paiement": "..." (opt)}
    Le montant total est calculé automatiquement à partir de la main-d'œuvre et des pièces.
    """
    json_data = request.get_json(silent=True)
    if json_data is None or not isinstance(json_data, dict):
        raise ValidationError(
            message="Données de requête invalides. Un objet JSON est requis.",
            details={"_schema": ["Invalid or missing JSON payload."]},
        )

    try:
        validated_data = facture_create_schema.load(json_data)
    except MarshmallowValidationError as err:
        raise ValidationError(
            message="Données de création de la facture invalides.",
            details=err.messages,
        )

    facture = facture_service.create_facture(validated_data)
    return success_response(
        data=facture_detail_response_schema.dump(facture),
        message="Facture émise avec succès.",
        status_code=201,
    )


@facture_bp.route("/<int:id_facture>", methods=["GET"], strict_slashes=False)
@roles_required("RESPONSABLE")
def get_facture(id_facture: int):
    """Récupère le détail complet d'une facture par son identifiant.

    Route : GET /api/v1/factures/<id_facture>
    Rôle autorisé : RESPONSABLE
    """
    facture = facture_service.get_facture_by_id(id_facture)
    return success_response(
        data=facture_detail_response_schema.dump(facture),
        status_code=200,
    )


@facture_bp.route("/<int:id_facture>", methods=["PATCH"], strict_slashes=False)
@roles_required("RESPONSABLE")
def update_statut_paiement(id_facture: int):
    """Met à jour le statut de paiement d'une facture.

    Route : PATCH /api/v1/factures/<id_facture>
    Rôle autorisé : RESPONSABLE
    Corps attendu : {"statut_paiement": "PAYEE"}
    Le montant total et la réparation associée ne peuvent pas être modifiés.
    """
    json_data = request.get_json(silent=True)
    if json_data is None or not isinstance(json_data, dict) or len(json_data) == 0:
        raise ValidationError(
            message="Le corps de la requête ne peut pas être vide pour une mise à jour.",
            details={"_schema": ["At least one field must be provided for update."]},
        )

    try:
        validated_data = facture_update_schema.load(json_data)
    except MarshmallowValidationError as err:
        raise ValidationError(
            message="Données de mise à jour de la facture invalides.",
            details=err.messages,
        )

    updated_facture = facture_service.update_statut_paiement(id_facture, validated_data)
    return success_response(
        data=facture_detail_response_schema.dump(updated_facture),
        message="Statut de paiement mis à jour avec succès.",
        status_code=200,
    )


@facture_bp.route("/<int:id_facture>", methods=["DELETE"], strict_slashes=False)
@roles_required("RESPONSABLE")
def delete_facture(id_facture: int):
    """Interdiction formelle de suppression d'une facture pour intégrité comptable.

    Route : DELETE /api/v1/factures/<id_facture>
    Rôle autorisé : RESPONSABLE
    Renvoie toujours un code HTTP 409 Conflict si la facture existe, ou 404 si inexistante.
    """
    facture_service.delete_facture(id_facture)
