"""Modèle Vehicule pour GarageFlow.

Correspondance exacte avec la table PostgreSQL 'vehicule'.
Aucune colonne non présente dans la base de données (pas de 'motorisation').
"""
from app.extensions import db


class Vehicule(db.Model):
    """Représente un véhicule confié au garage automobile."""

    __tablename__ = "vehicule"

    id_vehicule = db.Column(db.Integer, primary_key=True)
    marque = db.Column(db.String(50), nullable=False)
    modele = db.Column(db.String(50), nullable=False)
    immatriculation = db.Column(db.String(30), nullable=False, unique=True)
    annee = db.Column(db.Integer, nullable=True)
    kilometrage = db.Column(db.Integer, nullable=True)
    etat = db.Column(db.String(30), nullable=True)
    id_client = db.Column(db.Integer, db.ForeignKey("client.id_client"), nullable=False)

    # Relations
    client = db.relationship("Client", back_populates="vehicules")
    reparations = db.relationship(
        "Reparation",
        back_populates="vehicule",
        lazy=True,
    )
    rendez_vous = db.relationship(
        "RendezVous",
        back_populates="vehicule",
        lazy=True,
    )

    def __repr__(self):
        return f"<Vehicule id={self.id_vehicule} immatriculation='{self.immatriculation}' marque='{self.marque}' modele='{self.modele}'>"

    def to_dict(self):
        return {
            "id_vehicule": self.id_vehicule,
            "marque": self.marque,
            "modele": self.modele,
            "immatriculation": self.immatriculation,
            "annee": self.annee,
            "kilometrage": self.kilometrage,
            "etat": self.etat,
            "id_client": self.id_client,
        }
