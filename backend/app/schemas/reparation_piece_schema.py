"""Schémas Marshmallow de validation et sérialisation pour ReparationPiece.

Gère l'association entre une fiche d'intervention (reparation) et les pièces détachées
consommées lors de l'opération, ainsi que l'instantané historique du prix unitaire.
"""
from marshmallow import (
    Schema,
    fields,
    validate,
    pre_load,
    ValidationError as MarshmallowValidationError,
)


class ReparationPieceCreateSchema(Schema):
    """Validation de l'ajout d'une pièce détachée à une réparation."""

    id_piece = fields.Integer(
        required=True,
        validate=[
            validate.Range(min=1, error="L'identifiant de la pièce doit être un entier positif."),
        ],
        error_messages={"required": "L'identifiant de la pièce est obligatoire."},
    )
    quantite = fields.Integer(
        required=True,
        validate=[
            validate.Range(min=1, error="La quantité doit être un entier supérieur ou égal à 1."),
        ],
        error_messages={"required": "La quantité est obligatoire."},
    )
    id_reparation = fields.Integer(
        allow_none=True,
        validate=[
            validate.Range(min=1, error="L'identifiant de la réparation doit être un entier positif."),
        ],
    )


class ReparationPieceUpdateSchema(Schema):
    """Validation de la mise à jour de la quantité d'une pièce associée."""

    quantite = fields.Integer(
        required=True,
        validate=[
            validate.Range(min=1, error="La quantité doit être un entier supérieur ou égal à 1."),
        ],
        error_messages={"required": "La quantité est obligatoire."},
    )


class ReparationPieceResponseSchema(Schema):
    """Sérialisation des données d'une pièce associée à une réparation."""

    id_reparation = fields.Integer()
    id_piece = fields.Integer()
    quantite = fields.Integer()
    prix_unitaire = fields.Float()
    nom_piece = fields.Method("get_nom_piece")
    sous_total = fields.Method("get_sous_total")

    def get_nom_piece(self, obj):
        if hasattr(obj, "piece") and obj.piece:
            return obj.piece.nom
        return None

    def get_sous_total(self, obj):
        if obj.prix_unitaire is not None and obj.quantite is not None:
            return round(float(obj.prix_unitaire) * obj.quantite, 2)
        return None


reparation_piece_create_schema = ReparationPieceCreateSchema()
reparation_piece_update_schema = ReparationPieceUpdateSchema()
reparation_piece_response_schema = ReparationPieceResponseSchema()
reparation_pieces_response_schema = ReparationPieceResponseSchema(many=True)
