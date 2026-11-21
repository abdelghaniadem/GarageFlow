"""Modèle Facture pour GarageFlow.

Correspondance exacte avec la table PostgreSQL 'facture'.
Le montant total est un Numeric(10, 2).
La relation avec reparation est strictement 1:1 via la contrainte UNIQUE sur id_reparation.
"""
from app.extensions import db


class Facture(db.Model):
    """Représente une facture émise pour une réparation effectuée."""

    __tablename__ = "facture"

    id_facture = db.Column(db.Integer, primary_key=True)
    date_facture = db.Column(db.Date, nullable=False)
    montant_total = db.Column(db.Numeric(10, 2), nullable=False)
    statut_paiement = db.Column(db.String(30), nullable=False)
    id_reparation = db.Column(
        db.Integer,
        db.ForeignKey("reparation.id_reparation"),
        nullable=False,
        unique=True,
    )

    # Relation 1:1 avec Reparation
    reparation = db.relationship("Reparation", back_populates="facture")

    def __repr__(self):
        return (
            f"<Facture id={self.id_facture} reparation_id={self.id_reparation} "
            f"montant={self.montant_total} statut='{self.statut_paiement}'>"
        )

    def to_dict(self):
        return {
            "id_facture": self.id_facture,
            "date_facture": self.date_facture.isoformat() if self.date_facture else None,
            "montant_total": float(self.montant_total) if self.montant_total is not None else None,
            "statut_paiement": self.statut_paiement,
            "id_reparation": self.id_reparation,
        }
