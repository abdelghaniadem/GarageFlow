"""Package models pour GarageFlow.

Exporte l'ensemble des 9 modèles correspondant aux 9 tables de garageflow_db.
"""
from app.models.client import Client
from app.models.vehicule import Vehicule
from app.models.utilisateur import Utilisateur
from app.models.mecanicien import Mecanicien
from app.models.reparation import Reparation
from app.models.piece_detachee import PieceDetachee
from app.models.reparation_piece import ReparationPiece
from app.models.facture import Facture
from app.models.rendez_vous import RendezVous

__all__ = [
    "Client",
    "Vehicule",
    "Utilisateur",
    "Mecanicien",
    "Reparation",
    "PieceDetachee",
    "ReparationPiece",
    "Facture",
    "RendezVous",
]
