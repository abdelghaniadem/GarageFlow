"""Schémas Marshmallow de validation et sérialisation pour l'entité Client.

Respecte scrupuleusement la table PostgreSQL 'client' :
- nom: varchar(50) NOT NULL
- prenom: varchar(50) NOT NULL
- telephone: varchar(20) NOT NULL
- adresse: varchar(150) NULLABLE
Aucun champ non présent dans la base physique (notamment pas d'email).
"""
import re
from marshmallow import Schema, fields, validate, pre_load, ValidationError as MarshmallowValidationError


def validate_phone_number(val: str):
    """Valide la structure du numéro de téléphone (contexte tunisien et international standard)."""
    if not val:
        return
    clean = re.sub(r'[\s\-_./()]', '', val)
    digits = clean[1:] if clean.startswith('+') else clean[2:] if clean.startswith('00') else clean
    if not digits.isdigit() or len(digits) < 8 or len(digits) > 15:
        raise MarshmallowValidationError(
            "Numéro de téléphone invalide. Pour la Tunisie, 8 chiffres sont attendus (ex: 98 123 456 ou +216 98 123 456)."
        )


class ClientCreateSchema(Schema):
    """Validation de la création d'un client."""

    nom = fields.String(
        required=True,
        validate=[
            validate.Length(min=1, max=50, error="Le nom doit contenir entre 1 et 50 caractères."),
        ],
        error_messages={"required": "Le nom du client est obligatoire."},
    )
    prenom = fields.String(
        required=True,
        validate=[
            validate.Length(min=1, max=50, error="Le prénom doit contenir entre 1 et 50 caractères."),
        ],
        error_messages={"required": "Le prénom du client est obligatoire."},
    )
    telephone = fields.String(
        required=True,
        validate=[
            validate.Length(min=1, max=20, error="Le numéro de téléphone doit contenir entre 1 et 20 caractères."),
            validate_phone_number,
        ],
        error_messages={"required": "Le numéro de téléphone est obligatoire."},
    )
    adresse = fields.String(
        allow_none=True,
        load_default=None,
        validate=[
            validate.Length(max=150, error="L'adresse ne peut pas dépasser 150 caractères."),
        ],
    )

    @pre_load
    def clean_strings(self, data, **kwargs):
        """Nettoie les chaînes en supprimant les espaces superflus."""
        if not isinstance(data, dict):
            return data
        cleaned = {}
        for k, v in data.items():
            if isinstance(v, str):
                cleaned[k] = re.sub(r'\s+', ' ', v).strip()
            else:
                cleaned[k] = v
        return cleaned


class ClientUpdateSchema(Schema):
    """Validation de la mise à jour partielle ou totale d'un client."""

    nom = fields.String(
        validate=[
            validate.Length(min=1, max=50, error="Le nom doit contenir entre 1 et 50 caractères."),
        ],
    )
    prenom = fields.String(
        validate=[
            validate.Length(min=1, max=50, error="Le prénom doit contenir entre 1 et 50 caractères."),
        ],
    )
    telephone = fields.String(
        validate=[
            validate.Length(min=1, max=20, error="Le numéro de téléphone doit contenir entre 1 et 20 caractères."),
            validate_phone_number,
        ],
    )
    adresse = fields.String(
        allow_none=True,
        validate=[
            validate.Length(max=150, error="L'adresse ne peut pas dépasser 150 caractères."),
        ],
    )

    @pre_load
    def clean_strings(self, data, **kwargs):
        if not isinstance(data, dict):
            return data
        cleaned = {}
        for k, v in data.items():
            if isinstance(v, str):
                cleaned[k] = re.sub(r'\s+', ' ', v).strip()
            else:
                cleaned[k] = v
        return cleaned


class ClientResponseSchema(Schema):
    """Sérialisation des données client renvoyées par l'API."""

    id_client = fields.Integer()
    nom = fields.String()
    prenom = fields.String()
    telephone = fields.String()
    adresse = fields.String(allow_none=True)


client_create_schema = ClientCreateSchema()
client_update_schema = ClientUpdateSchema()
client_response_schema = ClientResponseSchema()
clients_response_schema = ClientResponseSchema(many=True)
