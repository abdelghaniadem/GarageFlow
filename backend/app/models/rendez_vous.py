"""Modèle RendezVous pour GarageFlow.

Correspondance exacte avec la table PostgreSQL 'rendez_vous'.
"""
from app.extensions import db


class RendezVous(db.Model):
    """Représente un rendez-vous d'atelier planifié avec un client pour un véhicule."""

    __tablename__ = "rendez_vous"

    id_rendezvous = db.Column(db.Integer, primary_key=True)
    date_rendezvous = db.Column(db.Date, nullable=False)
    heure = db.Column(db.Time, nullable=False)
    motif = db.Column(db.Text, nullable=True)
    statut = db.Column(db.String(30), nullable=False)
    id_client = db.Column(db.Integer, db.ForeignKey("client.id_client"), nullable=False)
    id_vehicule = db.Column(
        db.Integer,
        db.ForeignKey("vehicule.id_vehicule"),
        nullable=False,
    )

    # Relations
    client = db.relationship("Client", back_populates="rendez_vous")
    vehicule = db.relationship("Vehicule", back_populates="rendez_vous")

    def __repr__(self):
        return (
            f"<RendezVous id={self.id_rendezvous} date='{self.date_rendezvous}' "
            f"heure='{self.heure}' statut='{self.statut}'>"
        )

    def to_dict(self):
        return {
            "id_rendezvous": self.id_rendezvous,
            "date_rendezvous": self.date_rendezvous.isoformat() if self.date_rendezvous else None,
            "heure": self.heure.isoformat() if self.heure else None,
            "motif": self.motif,
            "statut": self.statut,
            "id_client": self.id_client,
            "id_vehicule": self.id_vehicule,
        }
