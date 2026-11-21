"""Modèle ReparationPiece pour GarageFlow.

Correspondance exacte avec la table d'association PostgreSQL 'reparation_piece'.
Contient une clé primaire composée (id_reparation, id_piece) et les attributs
spécifiques de la pièce consommée (quantité et instantané du prix unitaire).
"""
from app.extensions import db


class ReparationPiece(db.Model):
    """Table d'association matérialisant l'utilisation d'une pièce dans une réparation."""

    __tablename__ = "reparation_piece"

    id_reparation = db.Column(
        db.Integer,
        db.ForeignKey("reparation.id_reparation"),
        primary_key=True,
    )
    id_piece = db.Column(
        db.Integer,
        db.ForeignKey("piece_detachee.id_piece"),
        primary_key=True,
    )
    quantite = db.Column(db.Integer, nullable=False)
    prix_unitaire = db.Column(db.Numeric(10, 2), nullable=False)

    # Relations
    reparation = db.relationship("Reparation", back_populates="reparation_pieces")
    piece = db.relationship("PieceDetachee", back_populates="reparation_pieces")

    def __repr__(self):
        return (
            f"<ReparationPiece reparation_id={self.id_reparation} "
            f"piece_id={self.id_piece} quantite={self.quantite} prix={self.prix_unitaire}>"
        )

    def to_dict(self):
        return {
            "id_reparation": self.id_reparation,
            "id_piece": self.id_piece,
            "quantite": self.quantite,
            "prix_unitaire": float(self.prix_unitaire) if self.prix_unitaire is not None else None,
        }
