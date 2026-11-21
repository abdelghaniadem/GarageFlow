"""Schémas Marshmallow pour l'authentification.
"""
from marshmallow import Schema, fields, validate, pre_load


class LoginSchema(Schema):
    """Validation de la requête de connexion."""

    email = fields.Email(
        required=True,
        validate=[
            validate.Length(max=120, error="L'adresse email ne peut pas dépasser 120 caractères."),
        ],
        error_messages={"required": "L'adresse email est obligatoire."},
    )
    mot_de_passe = fields.String(
        required=True,
        validate=[
            validate.Length(min=1, error="Le mot de passe ne peut pas être vide."),
        ],
        error_messages={"required": "Le mot de passe est obligatoire."},
    )

    @pre_load
    def clean_email(self, data, **kwargs):
        if isinstance(data, dict) and "email" in data and isinstance(data["email"], str):
            data["email"] = data["email"].strip().lower()
        return data


login_schema = LoginSchema()
