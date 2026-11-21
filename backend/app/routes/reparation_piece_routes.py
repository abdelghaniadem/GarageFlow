"""Module des routes pour les pièces de réparation (GarageFlow).

Fournit les liaisons et alias pour le sous-module ReparationPiece.
Les routes complètes sont intégrées de manière RESTful à reparation_bp
sous le préfixe `/api/v1/reparations/<id_reparation>/pieces`.
"""
from app.routes.reparation_routes import reparation_bp as reparation_piece_bp

__all__ = ["reparation_piece_bp"]
