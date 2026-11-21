"""Modèle Reparation pour GarageFlow.

Correspondance exacte avec la table PostgreSQL 'reparation'.
Le coût est stocké sous forme Numeric(10, 2) pour préserver la précision financière.
"""
from app.extensions import db


class Reparation(db.Model):
    """Représente une fiche d'intervention ou de réparation sur un véhicule."""

    __tablename__ = "reparation"

    id_reparation = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.Text, nullable=False)
    date_reparation = db.Column(db.Date, nullable=False)
    diagnostic = db.Column(db.Text, nullable=True)
    travail_effectue = db.Column(db.Text, nullable=True)
    statut = db.Column(db.String(30), nullable=False)
    cout = db.Column(db.Numeric(10, 2), nullable=True)
    kilometrage = db.Column(db.Integer, nullable=True)
    id_vehicule = db.Column(
        db.Integer,
        db.ForeignKey("vehicule.id_vehicule"),
        nullable=False,
    )
    id_mecanicien = db.Column(
        db.Integer,
        db.ForeignKey("mecanicien.id_mecanicien"),
        nullable=False,
    )

    # Relations
    vehicule = db.relationship("Vehicule", back_populates="reparations")
    mecanicien = db.relationship("Mecanicien", back_populates="reparations")
    facture = db.relationship(
        "Facture",
        back_populates="reparation",
        uselist=False,
        lazy=True,
    )
    reparation_pieces = db.relationship(
        "ReparationPiece",
        back_populates="reparation",
        lazy=True,
    )

    def __repr__(self):
        return f"<Reparation id={self.id_reparation} statut='{self.statut}' date='{self.date_reparation}'>"

    def to_dict(self):
        return {
            "id_reparation": self.id_reparation,
            "description": self.description,
            "date_reparation": self.date_reparation.isoformat() if self.date_reparation else None,
            "diagnostic": self.diagnostic,
            "travail_effectue": self.travail_effectue,
            "statut": self.statut,
            "cout": float(self.cout) if self.cout is not None else None,
            "kilometrage": self.kilometrage,
            "id_vehicule": self.id_vehicule,
            "id_mecanicien": self.id_mecanicien,
        }
