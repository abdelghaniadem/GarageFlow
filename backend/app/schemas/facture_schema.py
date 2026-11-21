"""Schémas Marshmallow de validation et sérialisation pour l'entité Facture.

Respecte scrupuleusement la table PostgreSQL 'facture' :
- id_facture: Integer PK
- date_facture: Date NOT NULL
- montant_total: Numeric(10, 2) NOT NULL
- statut_paiement: varchar(30) NOT NULL
- id_reparation: Integer NOT NULL, FK -> reparation.id_reparation (UNIQUE)
"""
from datetime import date
from marshmallow import (
    Schema,
    fields,
    validate,
    pre_load,
    ValidationError as MarshmallowValidationError,
)

ALLOWED_PAYMENT_STATUSES = [
    "EN_ATTENTE",
    "PAYEE",
    "ANNULEE",
    "IMPAYEE",
    "PARTIELLE",
    "PARTIELLEMENT_PAYEE",
    "NON_PAYEE",
]


def _normalize_payment_status(val: str) -> str:
    """Normalise une chaîne de statut de paiement en majuscules sans accents ni espaces."""
    if not val or not isinstance(val, str):
        return val
    cleaned = val.strip().upper().replace(" ", "_")
    cleaned = cleaned.replace("É", "E").replace("È", "E")
    return cleaned


class FactureCreateSchema(Schema):
    """Validation de la création d'une facture.
    
    Le montant total est calculé automatiquement côté serveur et ne peut pas être
    fixé manuellement par le client.
    """

    id_reparation = fields.Integer(
        required=True,
        validate=[
            validate.Range(min=1, error="L'identifiant de la réparation doit être un entier positif."),
        ],
        error_messages={"required": "L'identifiant de la réparation est obligatoire."},
    )
    date_facture = fields.Date(
        load_default=date.today,
        error_messages={"invalid": "Format de date invalide. Format attendu : AAAA-MM-JJ."},
    )
    statut_paiement = fields.String(
        load_default="EN_ATTENTE",
        validate=[
            validate.OneOf(
                ALLOWED_PAYMENT_STATUSES,
                error=f"Statut de paiement invalide. Les statuts autorisés sont : {', '.join(ALLOWED_PAYMENT_STATUSES)}.",
            ),
        ],
    )

    @pre_load
    def clean_payload(self, data, **kwargs):
        """Nettoie les champs textuels et normalise le statut de paiement."""
        if not isinstance(data, dict):
            return data
        cleaned = {}
        for k, v in data.items():
            if isinstance(v, str):
                cleaned[k] = v.strip()
            else:
                cleaned[k] = v

        if "statut_paiement" in cleaned and isinstance(cleaned["statut_paiement"], str):
            cleaned["statut_paiement"] = _normalize_payment_status(cleaned["statut_paiement"])

        # Si le client fournit un montant_total dans le corps, on le retire pour garantir
        # que le calcul reste strictement automatisé et inviolable.
        cleaned.pop("montant_total", None)
        return cleaned


class FactureUpdateSchema(Schema):
    """Validation de la mise à jour du statut de paiement d'une facture.
    
    Seul le statut de paiement peut être mis à jour.
    Toute tentative de modifier le montant total ou la réparation associée est rejetée.
    """

    statut_paiement = fields.String(
        required=True,
        validate=[
            validate.OneOf(
                ALLOWED_PAYMENT_STATUSES,
                error=f"Statut de paiement invalide. Les statuts autorisés sont : {', '.join(ALLOWED_PAYMENT_STATUSES)}.",
            ),
        ],
        error_messages={"required": "Le statut de paiement est obligatoire."},
    )

    @pre_load
    def validate_and_clean_update(self, data, **kwargs):
        """Rejette les tentatives de modification interdites et nettoie le statut."""
        if not isinstance(data, dict):
            return data

        # Interdiction stricte de modifier manuellement le montant total
        if "montant_total" in data:
            raise MarshmallowValidationError(
                {"montant_total": ["Le montant total est calculé automatiquement et ne peut pas être modifié manuellement."]}
            )

        # Interdiction stricte de modifier la réparation associée
        if "id_reparation" in data:
            raise MarshmallowValidationError(
                {"id_reparation": ["La réparation associée à une facture ne peut pas être modifiée."]}
            )

        # Interdiction stricte de modifier la date d'émission
        if "date_facture" in data:
            raise MarshmallowValidationError(
                {"date_facture": ["La date de la facture ne peut pas être modifiée après son émission."]}
            )

        cleaned = {}
        for k, v in data.items():
            if isinstance(v, str):
                cleaned[k] = v.strip()
            else:
                cleaned[k] = v

        if "statut_paiement" in cleaned and isinstance(cleaned["statut_paiement"], str):
            cleaned["statut_paiement"] = _normalize_payment_status(cleaned["statut_paiement"])

        return cleaned


class FactureResponseSchema(Schema):
    """Sérialisation des données d'une facture renvoyée par l'API."""

    id_facture = fields.Integer()
    date_facture = fields.Date()
    montant_total = fields.Float()
    statut_paiement = fields.String()
    id_reparation = fields.Integer()
    cout_main_oeuvre = fields.Method("get_cout_main_oeuvre")
    cout_pieces = fields.Method("get_cout_pieces")

    def get_cout_main_oeuvre(self, obj):
        if hasattr(obj, "reparation") and obj.reparation and obj.reparation.cout is not None:
            return round(float(obj.reparation.cout), 2)
        return 0.0

    def get_cout_pieces(self, obj):
        if hasattr(obj, "reparation") and obj.reparation and obj.reparation.reparation_pieces:
            total_pieces = sum(
                float(rp.prix_unitaire) * rp.quantite
                for rp in obj.reparation.reparation_pieces
                if rp.prix_unitaire is not None and rp.quantite is not None
            )
            return round(total_pieces, 2)
        return 0.0


class FactureDetailResponseSchema(FactureResponseSchema):
    """Sérialisation détaillée d'une facture incluant les pièces et la réparation."""

    pieces = fields.Method("get_pieces")
    reparation = fields.Method("get_reparation")

    def get_pieces(self, obj):
        if not hasattr(obj, "reparation") or not obj.reparation or not obj.reparation.reparation_pieces:
            return []
        pieces_list = []
        for rp in obj.reparation.reparation_pieces:
            p_unit = float(rp.prix_unitaire) if rp.prix_unitaire is not None else 0.0
            qty = rp.quantite if rp.quantite is not None else 0
            pieces_list.append({
                "id_piece": rp.id_piece,
                "nom_piece": rp.piece.nom if (hasattr(rp, "piece") and rp.piece) else None,
                "quantite": qty,
                "prix_unitaire": p_unit,
                "sous_total": round(p_unit * qty, 2),
            })
        return pieces_list

    def get_reparation(self, obj):
        if hasattr(obj, "reparation") and obj.reparation:
            return obj.reparation.to_dict()
        return None


facture_create_schema = FactureCreateSchema()
facture_update_schema = FactureUpdateSchema()
facture_response_schema = FactureResponseSchema()
factures_response_schema = FactureResponseSchema(many=True)
facture_detail_response_schema = FactureDetailResponseSchema()
