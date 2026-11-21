"""Schémas Marshmallow de validation et sérialisation pour l'entité RendezVous.

Respecte scrupuleusement la table PostgreSQL 'rendez_vous' :
- id_rendezvous: Integer PK
- date_rendezvous: Date NOT NULL
- heure: Time NOT NULL
- motif: Text NULLABLE
- statut: varchar(30) NOT NULL
- id_client: Integer NOT NULL, FK -> client.id_client
- id_vehicule: Integer NOT NULL, FK -> vehicule.id_vehicule
"""
from marshmallow import (
    Schema,
    fields,
    validate,
    pre_load,
    ValidationError as MarshmallowValidationError,
)

ALLOWED_APPOINTMENT_STATUSES = [
    "PLANIFIE",
    "CONFIRME",
    "EN_ATTENTE",
    "EN_COURS",
    "TERMINE",
    "ANNULE",
    "HONORE",
    "NON_HONORE",
    "ABSENT",
]

# Table de normalisation des variantes féminines et orthographiques
STATUS_NORMALIZATION_MAP = {
    "PLANIFIEE": "PLANIFIE",
    "CONFIRMEE": "CONFIRME",
    "TERMINEE": "TERMINE",
    "ANNULEE": "ANNULE",
    "HONOREE": "HONORE",
    "NON_HONOREE": "NON_HONORE",
}


def _normalize_appointment_status(val: str) -> str:
    """Normalise un statut de rendez-vous en majuscules, sans accents ni espaces superflus."""
    if not val or not isinstance(val, str):
        return val
    cleaned = val.strip().upper().replace(" ", "_")
    cleaned = cleaned.replace("É", "E").replace("È", "E")
    return STATUS_NORMALIZATION_MAP.get(cleaned, cleaned)


class RendezVousCreateSchema(Schema):
    """Validation de la création d'un rendez-vous d'atelier."""

    date_rendezvous = fields.Date(
        required=True,
        error_messages={
            "required": "La date du rendez-vous est obligatoire.",
            "invalid": "Format de date invalide. Format attendu : AAAA-MM-JJ.",
        },
    )
    heure = fields.Time(
        required=True,
        error_messages={
            "required": "L'heure du rendez-vous est obligatoire.",
            "invalid": "Format d'heure invalide. Format attendu : HH:MM ou HH:MM:SS.",
        },
    )
    motif = fields.String(
        allow_none=True,
        load_default=None,
    )
    statut = fields.String(
        load_default="PLANIFIE",
        validate=[
            validate.OneOf(
                ALLOWED_APPOINTMENT_STATUSES,
                error=f"Statut invalide. Les statuts autorisés sont : {', '.join(ALLOWED_APPOINTMENT_STATUSES)}.",
            ),
        ],
    )
    id_client = fields.Integer(
        required=True,
        validate=[
            validate.Range(min=1, error="L'identifiant du client doit être un entier positif."),
        ],
        error_messages={"required": "L'identifiant du client est obligatoire."},
    )
    id_vehicule = fields.Integer(
        required=True,
        validate=[
            validate.Range(min=1, error="L'identifiant du véhicule doit être un entier positif."),
        ],
        error_messages={"required": "L'identifiant du véhicule est obligatoire."},
    )

    @pre_load
    def clean_payload(self, data, **kwargs):
        """Nettoie les chaînes et normalise le statut avant validation."""
        if not isinstance(data, dict):
            return data
        cleaned = {}
        for k, v in data.items():
            if isinstance(v, str):
                cleaned[k] = v.strip()
            else:
                cleaned[k] = v

        if "statut" in cleaned and isinstance(cleaned["statut"], str):
            cleaned["statut"] = _normalize_appointment_status(cleaned["statut"])

        return cleaned


class RendezVousUpdateSchema(Schema):
    """Validation de la mise à jour partielle ou totale d'un rendez-vous."""

    date_rendezvous = fields.Date(
        error_messages={"invalid": "Format de date invalide. Format attendu : AAAA-MM-JJ."}
    )
    heure = fields.Time(
        error_messages={"invalid": "Format d'heure invalide. Format attendu : HH:MM ou HH:MM:SS."}
    )
    motif = fields.String(allow_none=True)
    statut = fields.String(
        validate=[
            validate.OneOf(
                ALLOWED_APPOINTMENT_STATUSES,
                error=f"Statut invalide. Les statuts autorisés sont : {', '.join(ALLOWED_APPOINTMENT_STATUSES)}.",
            ),
        ]
    )
    id_client = fields.Integer(
        validate=[
            validate.Range(min=1, error="L'identifiant du client doit être un entier positif."),
        ]
    )
    id_vehicule = fields.Integer(
        validate=[
            validate.Range(min=1, error="L'identifiant du véhicule doit être un entier positif."),
        ]
    )

    @pre_load
    def clean_payload(self, data, **kwargs):
        """Nettoie les chaînes et normalise le statut avant validation."""
        if not isinstance(data, dict):
            return data
        cleaned = {}
        for k, v in data.items():
            if isinstance(v, str):
                cleaned[k] = v.strip()
            else:
                cleaned[k] = v

        if "statut" in cleaned and isinstance(cleaned["statut"], str):
            cleaned["statut"] = _normalize_appointment_status(cleaned["statut"])

        return cleaned


class RendezVousResponseSchema(Schema):
    """Sérialisation des données d'un rendez-vous renvoyé par l'API."""

    id_rendezvous = fields.Integer()
    date_rendezvous = fields.Date()
    heure = fields.Method("get_heure")
    motif = fields.String(allow_none=True)
    statut = fields.String()
    id_client = fields.Integer()
    id_vehicule = fields.Integer()
    client = fields.Method("get_client")
    vehicule = fields.Method("get_vehicule")

    def get_heure(self, obj):
        if hasattr(obj, "heure") and obj.heure:
            return obj.heure.strftime("%H:%M:%S")
        return None

    def get_client(self, obj):
        if hasattr(obj, "client") and obj.client:
            return {
                "id_client": obj.client.id_client,
                "nom": obj.client.nom,
                "prenom": obj.client.prenom,
                "telephone": obj.client.telephone,
            }
        return None

    def get_vehicule(self, obj):
        if hasattr(obj, "vehicule") and obj.vehicule:
            return {
                "id_vehicule": obj.vehicule.id_vehicule,
                "immatriculation": obj.vehicule.immatriculation,
                "marque": obj.vehicule.marque,
                "modele": obj.vehicule.modele,
            }
        return None


rendez_vous_create_schema = RendezVousCreateSchema()
rendez_vous_update_schema = RendezVousUpdateSchema()
rendez_vous_response_schema = RendezVousResponseSchema()
rendez_vous_list_response_schema = RendezVousResponseSchema(many=True)
