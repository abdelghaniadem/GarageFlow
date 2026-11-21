"""Modèle Utilisateur pour GarageFlow.

Correspondance exacte avec la table PostgreSQL 'utilisateur'.
Respecte la contrainte CHECK sur le rôle ('RESPONSABLE', 'MECANICIEN').
"""
from sqlalchemy.orm import validates
from app.extensions import db, bcrypt


class Utilisateur(db.Model):
    """Représente un utilisateur du système GarageFlow (Responsable ou Mécanicien)."""

    __tablename__ = "utilisateur"
    __table_args__ = (
        db.CheckConstraint(
            "role IN ('RESPONSABLE', 'MECANICIEN')",
            name="utilisateur_role_check",
        ),
    )

    id_utilisateur = db.Column(db.Integer, primary_key=True)
    nom = db.Column(db.String(50), nullable=False)
    prenom = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(120), nullable=False, unique=True)
    mot_de_passe = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False)
    telephone = db.Column(db.String(20), nullable=True)

    # Relation 1:0..1 avec Mecanicien
    mecanicien = db.relationship(
        "Mecanicien",
        back_populates="utilisateur",
        uselist=False,
        lazy=True,
    )

    @validates("email")
    def validate_email(self, key, address):
        """Normalise l'email en minuscules et supprime les espaces superflus."""
        if address is not None:
            return address.strip().lower()
        return address

    def set_password(self, password: str) -> None:
        """Hache et enregistre le mot de passe avec Flask-Bcrypt."""
        if not password:
            raise ValueError("Le mot de passe ne peut pas être vide.")
        self.mot_de_passe = bcrypt.generate_password_hash(password).decode("utf-8")

    def check_password(self, password: str) -> bool:
        """Vérifie le mot de passe fourni par rapport au hash enregistré."""
        if not self.mot_de_passe or not password:
            return False
        return bcrypt.check_password_hash(self.mot_de_passe, password)

    def __repr__(self):
        return f"<Utilisateur id={self.id_utilisateur} role='{self.role}'>"

    def to_dict(self):
        return {
            "id_utilisateur": self.id_utilisateur,
            "nom": self.nom,
            "prenom": self.prenom,
            "email": self.email,
            "role": self.role,
            "telephone": self.telephone,
        }
