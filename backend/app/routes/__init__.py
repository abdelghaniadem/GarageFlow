"""Package des routes pour GarageFlow.
"""
from app.routes.auth_routes import auth_bp
from app.routes.client_routes import client_bp
from app.routes.vehicule_routes import vehicule_bp
from app.routes.mecanicien_routes import mecanicien_bp
from app.routes.reparation_routes import reparation_bp
from app.routes.piece_detachee_routes import piece_detachee_bp
from app.routes.reparation_piece_routes import reparation_piece_bp
from app.routes.facture_routes import facture_bp
from app.routes.rendez_vous_routes import rendez_vous_bp

__all__ = [
    "auth_bp",
    "client_bp",
    "vehicule_bp",
    "mecanicien_bp",
    "reparation_bp",
    "piece_detachee_bp",
    "reparation_piece_bp",
    "facture_bp",
    "rendez_vous_bp",
]
