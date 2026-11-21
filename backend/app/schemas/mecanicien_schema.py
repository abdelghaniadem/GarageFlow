"""Schémas Marshmallow de validation et sérialisation pour l'entité Mecanicien.

Respecte la table PostgreSQL 'mecanicien' et son lien 1:1 avec 'utilisateur' :
- id_mecanicien: Integer PK
- specialite: varchar(100) NOT NULL
- id_utilisateur: Integer NOT NULL, UNIQUE, FK -> utilisateur.id_utilisateur
"""
from marshmallow import (
    Schema,
    fields,
    validate,
    pre_load,
    ValidationError as MarshmallowValidationError,
)


class MecanicienCreateSchema(Schema):
    """Validation de la création d'un profil mécanicien.

    Supporte l'association à un utilisateur existant (via id_utilisateur)
    ou la création simultanée d'un compte utilisateur (nom, prenom, email, mot_de_passe).
    """

    specialite = fields.String(
        required=True,
        validate=[
            validate.Length(min=1, max=100, error="La spécialité doit contenir entre 1 et 100 caractères."),
        ],
        error_messages={"required": "La spécialité du mécanicien est obligatoire."},
    )
    id_utilisateur = fields.Integer(
        allow_none=True,
        validate=[
            validate.Range(min=1, error="L'identifiant utilisateur doit être un entier positif."),
        ],
    )
    # Données du compte utilisateur en cas de création simultanée
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
    email = fields.Email(
        validate=[
            validate.Length(max=120, error="L'adresse email ne peut pas dépasser 120 caractères."),
        ],
    )
    mot_de_passe = fields.String(
        validate=[
            validate.Length(min=1, error="Le mot de passe ne peut pas être vide."),
        ],
    )
    telephone = fields.String(
        allow_none=True,
        validate=[
            validate.Length(max=20, error="Le numéro de téléphone ne peut pas dépasser 20 caractères."),
        ],
    )

    @pre_load
    def clean_strings(self, data, **kwargs):
        """Nettoie les chaînes en supprimant les espaces superflus et normalise l'email."""
        if not isinstance(data, dict):
            return data
        cleaned = {}
        for k, v in data.items():
            if isinstance(v, str):
                cleaned[k] = v.strip()
            else:
                cleaned[k] = v
        if "email" in cleaned and isinstance(cleaned["email"], str):
            cleaned["email"] = cleaned["email"].lower()
        return cleaned


class MecanicienUpdateSchema(Schema):
    """Validation de la mise à jour d'un mécanicien."""

    specialite = fields.String(
        validate=[
            validate.Length(min=1, max=100, error="La spécialité doit contenir entre 1 et 100 caractères."),
        ],
    )
    id_utilisateur = fields.Integer(
        validate=[
            validate.Range(min=1, error="L'identifiant utilisateur doit être un entier positif."),
        ],
    )
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
        allow_none=True,
        validate=[
            validate.Length(max=20, error="Le numéro de téléphone ne peut pas dépasser 20 caractères."),
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


class UtilisateurNestedSchema(Schema):
    """Sérialisation sécurisée des données utilisateur associées (sans mot de passe)."""

    id_utilisateur = fields.Integer()
    nom = fields.String()
    prenom = fields.String()
    email = fields.String()
    role = fields.String()
    telephone = fields.String(allow_none=True)


class MecanicienResponseSchema(Schema):
    """Sérialisation des données mécanicien renvoyées par l'API."""

    id_mecanicien = fields.Integer()
    specialite = fields.String()
    id_utilisateur = fields.Integer()
    utilisateur = fields.Nested(UtilisateurNestedSchema, allow_none=True)


mecanicien_create_schema = MecanicienCreateSchema()
mecanicien_update_schema = MecanicienUpdateSchema()
mecanicien_response_schema = MecanicienResponseSchema()
mecaniciens_response_schema = MecanicienResponseSchema(many=True)
