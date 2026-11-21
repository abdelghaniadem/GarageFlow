"""Schémas Marshmallow de validation et sérialisation pour l'entité PieceDetachee.

Respecte scrupuleusement la table PostgreSQL 'piece_detachee' :
- id_piece: Integer PK
- nom: varchar(100) NOT NULL
- prix_unitaire: Numeric(10, 2) NOT NULL, >= 0
- quantite_stock: Integer NOT NULL, >= 0
"""
from marshmallow import (
    Schema,
    fields,
    validate,
    pre_load,
    ValidationError as MarshmallowValidationError,
)


class PieceDetacheeCreateSchema(Schema):
    """Validation de la création d'une pièce détachée."""

    nom = fields.String(
        required=True,
        validate=[
            validate.Length(min=1, max=100, error="Le nom de la pièce doit contenir entre 1 et 100 caractères."),
        ],
        error_messages={"required": "Le nom de la pièce est obligatoire."},
    )
    prix_unitaire = fields.Decimal(
        as_string=False,
        required=True,
        validate=[
            validate.Range(min=0, error="Le prix unitaire ne peut pas être négatif."),
        ],
        error_messages={"required": "Le prix unitaire est obligatoire."},
    )
    quantite_stock = fields.Integer(
        required=True,
        validate=[
            validate.Range(min=0, error="La quantité en stock ne peut pas être négative."),
        ],
        error_messages={"required": "La quantité en stock est obligatoire."},
    )

    @pre_load
    def clean_strings(self, data, **kwargs):
        """Nettoie les chaînes en supprimant les espaces superflus."""
        if not isinstance(data, dict):
            return data
        cleaned = {}
        for k, v in data.items():
            if isinstance(v, str):
                cleaned[k] = v.strip()
            else:
                cleaned[k] = v
        return cleaned


class PieceDetacheeUpdateSchema(Schema):
    """Validation de la mise à jour partielle ou totale d'une pièce détachée."""

    nom = fields.String(
        validate=[
            validate.Length(min=1, max=100, error="Le nom de la pièce doit contenir entre 1 et 100 caractères."),
        ],
    )
    prix_unitaire = fields.Decimal(
        as_string=False,
        validate=[
            validate.Range(min=0, error="Le prix unitaire ne peut pas être négatif."),
        ],
    )
    quantite_stock = fields.Integer(
        validate=[
            validate.Range(min=0, error="La quantité en stock ne peut pas être négative."),
        ],
    )

    @pre_load
    def clean_strings(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        cleaned = {}
        for k, v in data.items():
            if isinstance(v, str):
                cleaned[k] = v.strip()
            else:
                cleaned[k] = v
        return cleaned


class PieceDetacheeResponseSchema(Schema):
    """Sérialisation des données d'une pièce détachée renvoyée par l'API."""

    id_piece = fields.Integer()
    nom = fields.String()
    prix_unitaire = fields.Float()
    quantite_stock = fields.Integer()


piece_detachee_create_schema = PieceDetacheeCreateSchema()
piece_detachee_update_schema = PieceDetacheeUpdateSchema()
piece_detachee_response_schema = PieceDetacheeResponseSchema()
pieces_detachees_response_schema = PieceDetacheeResponseSchema(many=True)
