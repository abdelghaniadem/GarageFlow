"""Modèle Client pour GarageFlow.

Correspondance exacte avec la table PostgreSQL 'client'.
"""
from app.extensions import db


class Client(db.Model):
    """Représente un client du garage automobile."""

    __tablename__ = "client"

    id_client = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(50), nullable=False)
    prenom = db.Column(db.String(50), nullable=False)
    telephone = db.Column(db.String(20), nullable=False)
    adresse = db.Column(db.String(150), nullable=True)

    # Relations (sans suppression en cascade de l'historique)
    vehicules = db.relationship(
        "Vehicule",
        back_populates="client",
        lazy=True,
    )
    rendez_vous = db.relationship(
        "RendezVous",
        back_populates="client",
        lazy=True,
    )

    def __repr__(self):
        return f"<Client id={self.id_client} nom='{self.nom}' prenom='{self.prenom}'>"

    def to_dict(self):
        return {
            "id_client": self.id_client,
            "nom": self.nom,
            "prenom": self.prenom,
            "telephone": self.telephone,
            "adresse": self.adresse,
        }
