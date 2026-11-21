"""Modèle PieceDetachee pour GarageFlow.

Correspondance exacte avec la table PostgreSQL 'piece_detachee'.
Le prix unitaire est défini sous forme Numeric(10, 2).
"""
from app.extensions import db


class PieceDetachee(db.Model):
    """Représente une pièce détachée disponible dans le stock du garage."""

    __tablename__ = "piece_detachee"

    id_piece = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(100), nullable=False)
    prix_unitaire = db.Column(db.Numeric(10, 2), nullable=False)
    quantite_stock = db.Column(db.Integer, nullable=False)

    # Relations
    reparation_pieces = db.relationship(
        "ReparationPiece",
        back_populates="piece",
        lazy=True,
    )

    def __repr__(self):
        return f"<PieceDetachee id={self.id_piece} nom='{self.nom}' stock={self.quantite_stock}>"

    def to_dict(self):
        return {
            "id_piece": self.id_piece,
            "nom": self.nom,
            "prix_unitaire": float(self.prix_unitaire) if self.prix_unitaire is not None else None,
            "quantite_stock": self.quantite_stock,
        }
