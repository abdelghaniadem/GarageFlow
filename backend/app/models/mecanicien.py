"""Modèle Mecanicien pour GarageFlow.

Correspondance exacte avec la table PostgreSQL 'mecanicien'.
"""
from app.extensions import db


class Mecanicien(db.Model):
    """Représente un mécanicien du garage lié à un profil utilisateur."""

    __tablename__ = "mecanicien"

    id_mecanicien = db.Column(db.Integer, primary_key=True)
    specialite = db.Column(db.String(100), nullable=False)
    id_utilisateur = db.Column(
        db.Integer,
        db.ForeignKey("utilisateur.id_utilisateur"),
        nullable=False,
        unique=True,
    )

    # Relations
    utilisateur = db.relationship("Utilisateur", back_populates="mecanicien")
    reparations = db.relationship(
        "Reparation",
        back_populates="mecanicien",
        lazy=True,
    )

    def __repr__(self):
        return f"<Mecanicien id={self.id_mecanicien} specialite='{self.specialite}' id_utilisateur={self.id_utilisateur}>"

    def to_dict(self):
        return {
            "id_mecanicien": self.id_mecanicien,
            "specialite": self.specialite,
            "id_utilisateur": self.id_utilisateur,
        }
