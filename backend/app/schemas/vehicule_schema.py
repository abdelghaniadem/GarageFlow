"""Schémas Marshmallow de validation et sérialisation pour l'entité Véhicule.

Respecte scrupuleusement la table PostgreSQL 'vehicule' :
- id_vehicule: Integer PK
- marque: varchar(50) NOT NULL
- modele: varchar(50) NOT NULL
- immatriculation: varchar(30) NOT NULL, UNIQUE
- annee: Integer NULLABLE
- kilometrage: Integer NULLABLE
- etat: varchar(30) NULLABLE
- id_client: Integer NOT NULL, FK -> client.id_client
"""
import re
from marshmallow import (
    Schema,
    fields,
    validate,
    pre_load,
    ValidationError as MarshmallowValidationError,
)


def validate_license_plate(val: str):
    """Valide que l'immatriculation correspond à un format tunisien admis.
    Rejette les formats étrangers arbitraires.
    """
    if not val or not isinstance(val, str):
        return
    cleaned = re.sub(r'\s+', ' ', val).strip()
    upper = cleaned.upper()

    # 1. Format tunisien ordinaire arabe : "123 تونس 4567"
    if re.match(r'^\d{1,3}\s*(?:تونس|\-تونس\-)\s*\d{1,4}$', cleaned):
        return
    # 2. Format tunisien ordinaire latin : "123 TU 4567", "123-TU-4567", "180-TUN-5544"
    if re.match(r'^\d{1,3}\s*[-]?\s*(?:TU|TUN)\s*[-]?\s*\d{1,4}$', upper):
        return
    # 3. Format numérique tiret toléré (ex: 200-4713 en base)
    if re.match(r'^\d{1,3}\s*[-]\s*\d{1,4}$', upper):
        return
    # 4. Ancienne série TU (ex: TU-1234 en base)
    if re.match(r'^TU\s*[-]?\s*\d{1,5}$', upper):
        return
    # 5. Régimes suspensifs et séries spéciales tunisiennes (RS, IT, CD, CMD, MD)
    if re.match(r'^\d{1,6}\s*[-]?\s*(?:RS|IT|CD|CMD|MD)$', upper):
        return

    raise MarshmallowValidationError(
        "Format d'immatriculation tunisien requis (ex: 215 تونس 4589 ou 205 TU 4589). Les plaques étrangères ne sont pas admises."
    )


class VehiculeCreateSchema(Schema):
    """Validation de la création d'un véhicule."""

    marque = fields.String(
        required=True,
        validate=[
            validate.Length(min=1, max=50, error="La marque doit contenir entre 1 et 50 caractères."),
        ],
        error_messages={"required": "La marque du véhicule est obligatoire."},
    )
    modele = fields.String(
        required=True,
        validate=[
            validate.Length(min=1, max=50, error="Le modèle doit contenir entre 1 et 50 caractères."),
        ],
        error_messages={"required": "Le modèle du véhicule est obligatoire."},
    )
    immatriculation = fields.String(
        required=True,
        validate=[
            validate.Length(min=1, max=30, error="L'immatriculation doit contenir entre 1 et 30 caractères."),
            validate_license_plate,
        ],
        error_messages={"required": "L'immatriculation du véhicule est obligatoire."},
    )
    annee = fields.Integer(
        allow_none=True,
        load_default=None,
        validate=[
            validate.Range(min=1900, max=2100, error="L'année doit être comprise entre 1900 et 2100."),
        ],
    )
    kilometrage = fields.Integer(
        allow_none=True,
        load_default=None,
        validate=[
            validate.Range(min=0, error="Le kilométrage doit être un entier positif ou nul."),
        ],
    )
    etat = fields.String(
        allow_none=True,
        load_default=None,
        validate=[
            validate.Length(max=30, error="L'état ne peut pas dépasser 30 caractères."),
        ],
    )
    id_client = fields.Integer(
        required=True,
        validate=[
            validate.Range(min=1, error="L'identifiant du client doit être un entier positif."),
        ],
        error_messages={"required": "L'identifiant du client est obligatoire."},
    )

    @pre_load
    def clean_strings(self, data, **kwargs):
        """Nettoie les chaînes en supprimant les espaces superflus et met l'immatriculation en majuscules."""
        if not isinstance(data, dict):
            return data
        cleaned = {}
        for k, v in data.items():
            if isinstance(v, str):
                cleaned[k] = re.sub(r'\s+', ' ', v).strip()
            else:
                cleaned[k] = v
        if "immatriculation" in cleaned and isinstance(cleaned["immatriculation"], str):
            cleaned["immatriculation"] = cleaned["immatriculation"].upper()
        return cleaned


class VehiculeUpdateSchema(Schema):
    """Validation de la mise à jour partielle ou totale d'un véhicule."""

    marque = fields.String(
        validate=[
            validate.Length(min=1, max=50, error="La marque doit contenir entre 1 et 50 caractères."),
        ],
    )
    modele = fields.String(
        validate=[
            validate.Length(min=1, max=50, error="Le modèle doit contenir entre 1 et 50 caractères."),
        ],
    )
    immatriculation = fields.String(
        validate=[
            validate.Length(min=1, max=30, error="L'immatriculation doit contenir entre 1 et 30 caractères."),
            validate_license_plate,
        ],
    )
    annee = fields.Integer(
        allow_none=True,
        validate=[
            validate.Range(min=1900, max=2100, error="L'année doit être comprise entre 1900 et 2100."),
        ],
    )
    kilometrage = fields.Integer(
        allow_none=True,
        validate=[
            validate.Range(min=0, error="Le kilométrage doit être un entier positif ou nul."),
        ],
    )
    etat = fields.String(
        allow_none=True,
        validate=[
            validate.Length(max=30, error="L'état ne peut pas dépasser 30 caractères."),
        ],
    )
    id_client = fields.Integer(
        validate=[
            validate.Range(min=1, error="L'identifiant du client doit être un entier positif."),
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
        if "immatriculation" in cleaned and isinstance(cleaned["immatriculation"], str):
            cleaned["immatriculation"] = cleaned["immatriculation"].upper()
        return cleaned


class VehiculeResponseSchema(Schema):
    """Sérialisation des données véhicule renvoyées par l'API."""

    id_vehicule = fields.Integer()
    marque = fields.String()
    modele = fields.String()
    immatriculation = fields.String()
    annee = fields.Integer(allow_none=True)
    kilometrage = fields.Integer(allow_none=True)
    etat = fields.String(allow_none=True)
    id_client = fields.Integer()


vehicule_create_schema = VehiculeCreateSchema()
vehicule_update_schema = VehiculeUpdateSchema()
vehicule_response_schema = VehiculeResponseSchema()
vehicules_response_schema = VehiculeResponseSchema(many=True)
