"""Package des schémas Marshmallow pour GarageFlow.
"""
from app.schemas.auth_schema import login_schema
from app.schemas.client_schema import (
    client_create_schema,
    client_update_schema,
    client_response_schema,
    clients_response_schema,
)
from app.schemas.vehicule_schema import (
    vehicule_create_schema,
    vehicule_update_schema,
    vehicule_response_schema,
    vehicules_response_schema,
)
from app.schemas.mecanicien_schema import (
    mecanicien_create_schema,
    mecanicien_update_schema,
    mecanicien_response_schema,
    mecaniciens_response_schema,
)
from app.schemas.reparation_schema import (
    reparation_create_schema,
    reparation_update_schema,
    reparation_response_schema,
    reparations_response_schema,
)
from app.schemas.piece_detachee_schema import (
    piece_detachee_create_schema,
    piece_detachee_update_schema,
    piece_detachee_response_schema,
    pieces_detachees_response_schema,
)
from app.schemas.reparation_piece_schema import (
    reparation_piece_create_schema,
    reparation_piece_update_schema,
    reparation_piece_response_schema,
    reparation_pieces_response_schema,
)
from app.schemas.facture_schema import (
    facture_create_schema,
    facture_update_schema,
    facture_response_schema,
    factures_response_schema,
    facture_detail_response_schema,
    ALLOWED_PAYMENT_STATUSES,
)
from app.schemas.rendez_vous_schema import (
    rendez_vous_create_schema,
    rendez_vous_update_schema,
    rendez_vous_response_schema,
    rendez_vous_list_response_schema,
    ALLOWED_APPOINTMENT_STATUSES,
)

__all__ = [
    "login_schema",
    "client_create_schema",
    "client_update_schema",
    "client_response_schema",
    "clients_response_schema",
    "vehicule_create_schema",
    "vehicule_update_schema",
    "vehicule_response_schema",
    "vehicules_response_schema",
    "mecanicien_create_schema",
    "mecanicien_update_schema",
    "mecanicien_response_schema",
    "mecaniciens_response_schema",
    "reparation_create_schema",
    "reparation_update_schema",
    "reparation_response_schema",
    "reparations_response_schema",
    "piece_detachee_create_schema",
    "piece_detachee_update_schema",
    "piece_detachee_response_schema",
    "pieces_detachees_response_schema",
    "reparation_piece_create_schema",
    "reparation_piece_update_schema",
    "reparation_piece_response_schema",
    "reparation_pieces_response_schema",
    "facture_create_schema",
    "facture_update_schema",
    "facture_response_schema",
    "factures_response_schema",
    "facture_detail_response_schema",
    "ALLOWED_PAYMENT_STATUSES",
    "rendez_vous_create_schema",
    "rendez_vous_update_schema",
    "rendez_vous_response_schema",
    "rendez_vous_list_response_schema",
    "ALLOWED_APPOINTMENT_STATUSES",
]
