"""Schémas Marshmallow de validation et sérialisation pour l'entité Réparation.

Respecte scrupuleusement la table PostgreSQL 'reparation' :
- id_reparation: Integer PK
- description: Text NOT NULL
- date_reparation: Date NOT NULL
- diagnostic: Text NULLABLE
- travail_effectue: Text NULLABLE
- statut: varchar(30) NOT NULL
- cout: Numeric(10, 2) NULLABLE, >= 0
- kilometrage: Integer NULLABLE, >= 0
- id_vehicule: Integer NOT NULL, FK -> vehicule.id_vehicule
- id_mecanicien: Integer NOT NULL, FK -> mecanicien.id_mecanicien
"""
from marshmallow import (
    Schema,
    fields,
    validate,
    pre_load,
    ValidationError as MarshmallowValidationError,
)

ALLOWED_STATUSES = [
    "EN_ATTENTE",
    "EN_DIAGNOSTIC",
    "EN_REPARATION",
    "EN_COURS",
    "TERMINEE",
    "LIVREE",
    "ANNULEE",
]


def _normalize_status(val: str) -> str:
    cleaned = val.strip().upper().replace(" ", "_")
    cleaned = cleaned.replace("É", "E").replace("È", "E")
    return cleaned


class ReparationCreateSchema(Schema):
    """Validation de la création d'une fiche de réparation."""

    description = fields.String(
        required=True,
        validate=[
            validate.Length(min=1, error="La description de la réparation est obligatoire."),
        ],
        error_messages={"required": "La description est obligatoire."},
    )
    date_reparation = fields.Date(
        required=True,
        error_messages={"required": "La date de réparation est obligatoire."},
    )
    diagnostic = fields.String(
        allow_none=True,
        load_default=None,
    )
    travail_effectue = fields.String(
        allow_none=True,
        load_default=None,
    )
    statut = fields.String(
        required=True,
        validate=[
            validate.OneOf(
                choices=ALLOWED_STATUSES,
                error=f"Statut invalide. Les statuts autorisés sont : {', '.join(ALLOWED_STATUSES)}.",
            ),
        ],
        error_messages={"required": "Le statut est obligatoire."},
    )
    cout = fields.Decimal(
        as_string=False,
        allow_none=True,
        load_default=None,
        validate=[
            validate.Range(min=0, error="Le coût ne peut pas être négatif."),
        ],
    )
    kilometrage = fields.Integer(
        allow_none=True,
        load_default=None,
        validate=[
            validate.Range(min=0, error="Le kilométrage ne peut pas être négatif."),
        ],
    )
    id_vehicule = fields.Integer(
        required=True,
        validate=[
            validate.Range(min=1, error="L'identifiant du véhicule doit être un entier positif."),
        ],
        error_messages={"required": "L'identifiant du véhicule est obligatoire."},
    )
    id_mecanicien = fields.Integer(
        required=True,
        validate=[
            validate.Range(min=1, error="L'identifiant du mécanicien doit être un entier positif."),
        ],
        error_messages={"required": "L'identifiant du mécanicien est obligatoire."},
    )

    @pre_load
    def clean_strings(self, data, **kwargs):
        """Nettoie les chaînes en supprimant les espaces superflus et normalise le statut."""
        if not isinstance(data, dict):
            return data
        cleaned = {}
        for k, v in data.items():
            if isinstance(v, str):
                cleaned[k] = v.strip()
            else:
                cleaned[k] = v
        if "statut" in cleaned and isinstance(cleaned["statut"], str):
            cleaned["statut"] = _normalize_status(cleaned["statut"])
        return cleaned


class ReparationUpdateSchema(Schema):
    """Validation de la mise à jour partielle ou totale d'une réparation."""

    description = fields.String(
        validate=[
            validate.Length(min=1, error="La description ne peut pas être vide."),
        ],
    )
    date_reparation = fields.Date()
    diagnostic = fields.String(allow_none=True)
    travail_effectue = fields.String(allow_none=True)
    statut = fields.String(
        validate=[
            validate.OneOf(
                choices=ALLOWED_STATUSES,
                error=f"Statut invalide. Les statuts autorisés sont : {', '.join(ALLOWED_STATUSES)}.",
            ),
        ],
    )
    cout = fields.Decimal(
        as_string=False,
        allow_none=True,
        validate=[
            validate.Range(min=0, error="Le coût ne peut pas être négatif."),
        ],
    )
    kilometrage = fields.Integer(
        allow_none=True,
        validate=[
            validate.Range(min=0, error="Le kilométrage ne peut pas être négatif."),
        ],
    )
    id_vehicule = fields.Integer(
        validate=[
            validate.Range(min=1, error="L'identifiant du véhicule doit être un entier positif."),
        ],
    )
    id_mecanicien = fields.Integer(
        validate=[
            validate.Range(min=1, error="L'identifiant du mécanicien doit être un entier positif."),
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
        if "statut" in cleaned and isinstance(cleaned["statut"], str):
            cleaned["statut"] = _normalize_status(cleaned["statut"])
        return cleaned


class ReparationResponseSchema(Schema):
    """Sérialisation des données de réparation renvoyées par l'API."""

    id_reparation = fields.Integer()
    description = fields.String()
    date_reparation = fields.Date()
    diagnostic = fields.String(allow_none=True)
    travail_effectue = fields.String(allow_none=True)
    statut = fields.String()
    cout = fields.Float(allow_none=True)
    kilometrage = fields.Integer(allow_none=True)
    id_vehicule = fields.Integer()
    id_mecanicien = fields.Integer()


reparation_create_schema = ReparationCreateSchema()
reparation_update_schema = ReparationUpdateSchema()
reparation_response_schema = ReparationResponseSchema()
reparations_response_schema = ReparationResponseSchema(many=True)
