"""Tests unitaires pour les modèles SQLAlchemy de GarageFlow.

Vérifie l'exactitude des tables, colonnes, types, clés primaires,
contraintes d'intégrité et relations ORM en mémoire pure,
sans aucune connexion à PostgreSQL et sans création de tables.
"""
import pytest
from decimal import Decimal
from sqlalchemy import inspect, Numeric, Integer, String, Text, Date, Time
from app import create_app
from app.models import (
    Client,
    Vehicule,
    Utilisateur,
    Mecanicien,
    Reparation,
    PieceDetachee,
    ReparationPiece,
    Facture,
    RendezVous,
)


@pytest.fixture(scope="module")
def app_context():
    """Crée un contexte d'application de test sans exécuter de requêtes SQL."""
    import os
    prev = os.environ.get("TEST_DATABASE_URL")
    os.environ["TEST_DATABASE_URL"] = "sqlite:///:memory:"
    app = create_app("testing")
    with app.app_context():
        yield app
    if prev is not None:
        os.environ["TEST_DATABASE_URL"] = prev
    else:
        os.environ.pop("TEST_DATABASE_URL", None)


class TestClientModel:
    """Vérifications structurelles du modèle Client."""

    def test_table_name_and_pks(self, app_context):
        assert Client.__tablename__ == "client"
        pks = [c.name for c in Client.__table__.primary_key.columns]
        assert pks == ["id_client"]

    def test_columns_and_nullability(self, app_context):
        cols = {c.name: c for c in Client.__table__.columns}
        assert set(cols.keys()) == {"id_client", "nom", "prenom", "telephone", "adresse"}
        assert cols["nom"].nullable is False
        assert cols["prenom"].nullable is False
        assert cols["telephone"].nullable is False
        assert cols["adresse"].nullable is True

        # Vérification qu'aucune colonne 'email' n'a été inventée
        assert "email" not in cols

    def test_relationships(self, app_context):
        mapper = inspect(Client)
        rels = {r.key: r for r in mapper.relationships}
        assert "vehicules" in rels
        assert rels["vehicules"].back_populates == "client"
        assert rels["vehicules"].uselist is True

        assert "rendez_vous" in rels
        assert rels["rendez_vous"].back_populates == "client"
        assert rels["rendez_vous"].uselist is True


class TestVehiculeModel:
    """Vérifications structurelles du modèle Vehicule."""

    def test_table_name_and_pks(self, app_context):
        assert Vehicule.__tablename__ == "vehicule"
        pks = [c.name for c in Vehicule.__table__.primary_key.columns]
        assert pks == ["id_vehicule"]

    def test_columns_and_constraints(self, app_context):
        cols = {c.name: c for c in Vehicule.__table__.columns}
        expected_cols = {
            "id_vehicule", "marque", "modele", "immatriculation",
            "annee", "kilometrage", "etat", "id_client"
        }
        assert set(cols.keys()) == expected_cols
        assert cols["immatriculation"].unique is True
        assert cols["id_client"].nullable is False

        # Vérification qu'aucune colonne 'motorisation' n'a été inventée
        assert "motorisation" not in cols

        # Clé étrangère
        fk_targets = [fk.target_fullname for fk in cols["id_client"].foreign_keys]
        assert fk_targets == ["client.id_client"]

    def test_relationships(self, app_context):
        mapper = inspect(Vehicule)
        rels = {r.key: r for r in mapper.relationships}
        assert "client" in rels
        assert rels["client"].back_populates == "vehicules"
        assert rels["client"].uselist is False

        assert "reparations" in rels
        assert rels["reparations"].back_populates == "vehicule"

        assert "rendez_vous" in rels
        assert rels["rendez_vous"].back_populates == "vehicule"


class TestUtilisateurModel:
    """Vérifications structurelles du modèle Utilisateur."""

    def test_table_name_and_pks(self, app_context):
        assert Utilisateur.__tablename__ == "utilisateur"
        pks = [c.name for c in Utilisateur.__table__.primary_key.columns]
        assert pks == ["id_utilisateur"]

    def test_columns_and_constraints(self, app_context):
        cols = {c.name: c for c in Utilisateur.__table__.columns}
        assert set(cols.keys()) == {
            "id_utilisateur", "nom", "prenom", "email",
            "mot_de_passe", "role", "telephone"
        }
        assert cols["email"].unique is True
        assert cols["email"].nullable is False
        assert cols["mot_de_passe"].nullable is False
        assert cols["role"].nullable is False
        assert cols["telephone"].nullable is True

        # Contrainte CHECK sur le rôle
        checks = [ck.name for ck in Utilisateur.__table__.constraints if hasattr(ck, "sqltext")]
        assert "utilisateur_role_check" in checks

    def test_mecanicien_relation(self, app_context):
        mapper = inspect(Utilisateur)
        rels = {r.key: r for r in mapper.relationships}
        assert "mecanicien" in rels
        assert rels["mecanicien"].back_populates == "utilisateur"
        assert rels["mecanicien"].uselist is False  # 1:0..1

    def test_to_dict_never_contains_password(self, app_context):
        user = Utilisateur(
            id_utilisateur=1,
            nom="Dupont",
            prenom="Jean",
            email="jean.dupont@garageflow.fr",
            mot_de_passe="mot_de_passe_hache",
            role="RESPONSABLE",
            telephone="0123456789",
        )
        data = user.to_dict()
        assert "mot_de_passe" not in data
        assert data == {
            "id_utilisateur": 1,
            "nom": "Dupont",
            "prenom": "Jean",
            "email": "jean.dupont@garageflow.fr",
            "role": "RESPONSABLE",
            "telephone": "0123456789",
        }
        with pytest.raises(TypeError):
            user.to_dict(include_sensitive=True)

    def test_set_password_and_check_password(self, app_context):
        user = Utilisateur(
            nom="Martin",
            prenom="Paul",
            email="paul.martin@garageflow.fr",
            role="MECANICIEN",
        )
        user.set_password("MonSuperMotDePasse123!")
        assert user.mot_de_passe is not None
        assert user.mot_de_passe != "MonSuperMotDePasse123!"
        assert user.mot_de_passe.startswith("$2b$")
        assert len(user.mot_de_passe) <= 255
        assert user.check_password("MonSuperMotDePasse123!") is True
        assert user.check_password("MauvaisMotDePasse") is False
        assert user.check_password("") is False

        with pytest.raises(ValueError):
            user.set_password("")

    def test_check_password_without_password_set(self, app_context):
        user = Utilisateur()
        assert user.check_password("quelque_chose") is False

    def test_repr_does_not_contain_email(self, app_context):
        user = Utilisateur(id_utilisateur=42, email="confidentiel@garageflow.fr", role="RESPONSABLE")
        representation = repr(user)
        assert "confidentiel@garageflow.fr" not in representation
        assert "id=42" in representation
        assert "role='RESPONSABLE'" in representation

    def test_email_normalization(self, app_context):
        user = Utilisateur(
            email="   Jean.Dupont@GARAGEFLOW.Fr   ",
            nom="Dupont",
            prenom="Jean",
            role="RESPONSABLE",
        )
        assert user.email == "jean.dupont@garageflow.fr"

        user.email = "  NOUVELLE.Adresse@DOMAINE.COM   "
        assert user.email == "nouvelle.adresse@domaine.com"

        user.email = None
        assert user.email is None


class TestMecanicienModel:
    """Vérifications structurelles du modèle Mecanicien."""

    def test_table_name_and_pks(self, app_context):
        assert Mecanicien.__tablename__ == "mecanicien"
        pks = [c.name for c in Mecanicien.__table__.primary_key.columns]
        assert pks == ["id_mecanicien"]

    def test_columns_and_foreign_key(self, app_context):
        cols = {c.name: c for c in Mecanicien.__table__.columns}
        assert set(cols.keys()) == {"id_mecanicien", "specialite", "id_utilisateur"}
        assert cols["specialite"].nullable is False
        assert cols["id_utilisateur"].nullable is False
        assert cols["id_utilisateur"].unique is True

        fk_targets = [fk.target_fullname for fk in cols["id_utilisateur"].foreign_keys]
        assert fk_targets == ["utilisateur.id_utilisateur"]

    def test_relationships(self, app_context):
        mapper = inspect(Mecanicien)
        rels = {r.key: r for r in mapper.relationships}
        assert "utilisateur" in rels
        assert rels["utilisateur"].back_populates == "mecanicien"
        assert "reparations" in rels
        assert rels["reparations"].back_populates == "mecanicien"


class TestReparationModel:
    """Vérifications structurelles du modèle Reparation."""

    def test_table_name_and_pks(self, app_context):
        assert Reparation.__tablename__ == "reparation"
        pks = [c.name for c in Reparation.__table__.primary_key.columns]
        assert pks == ["id_reparation"]

    def test_columns_and_types(self, app_context):
        cols = {c.name: c for c in Reparation.__table__.columns}
        expected = {
            "id_reparation", "description", "date_reparation", "diagnostic",
            "travail_effectue", "statut", "cout", "kilometrage",
            "id_vehicule", "id_mecanicien"
        }
        assert set(cols.keys()) == expected

        # Vérification du type financier Numeric(10, 2)
        assert isinstance(cols["cout"].type, Numeric)
        assert cols["cout"].type.precision == 10
        assert cols["cout"].type.scale == 2

        # Nullabilité
        assert cols["description"].nullable is False
        assert cols["date_reparation"].nullable is False
        assert cols["statut"].nullable is False
        assert cols["id_vehicule"].nullable is False
        assert cols["id_mecanicien"].nullable is False

    def test_relationships(self, app_context):
        mapper = inspect(Reparation)
        rels = {r.key: r for r in mapper.relationships}
        assert "vehicule" in rels
        assert rels["vehicule"].back_populates == "reparations"
        assert "mecanicien" in rels
        assert rels["mecanicien"].back_populates == "reparations"
        assert "facture" in rels
        assert rels["facture"].back_populates == "reparation"
        assert rels["facture"].uselist is False
        assert "reparation_pieces" in rels
        assert rels["reparation_pieces"].back_populates == "reparation"


class TestPieceDetacheeModel:
    """Vérifications structurelles du modèle PieceDetachee."""

    def test_table_name_and_pks(self, app_context):
        assert PieceDetachee.__tablename__ == "piece_detachee"
        pks = [c.name for c in PieceDetachee.__table__.primary_key.columns]
        assert pks == ["id_piece"]

    def test_columns_and_financial_type(self, app_context):
        cols = {c.name: c for c in PieceDetachee.__table__.columns}
        assert set(cols.keys()) == {"id_piece", "nom", "prix_unitaire", "quantite_stock"}

        assert isinstance(cols["prix_unitaire"].type, Numeric)
        assert cols["prix_unitaire"].type.precision == 10
        assert cols["prix_unitaire"].type.scale == 2

        assert cols["nom"].nullable is False
        assert cols["prix_unitaire"].nullable is False
        assert cols["quantite_stock"].nullable is False

    def test_relationships(self, app_context):
        mapper = inspect(PieceDetachee)
        rels = {r.key: r for r in mapper.relationships}
        assert "reparation_pieces" in rels
        assert rels["reparation_pieces"].back_populates == "piece"


class TestReparationPieceModel:
    """Vérifications structurelles de la classe d'association ReparationPiece."""

    def test_composite_primary_key(self, app_context):
        assert ReparationPiece.__tablename__ == "reparation_piece"
        pks = [c.name for c in ReparationPiece.__table__.primary_key.columns]
        assert set(pks) == {"id_reparation", "id_piece"}

    def test_columns_and_types(self, app_context):
        cols = {c.name: c for c in ReparationPiece.__table__.columns}
        assert set(cols.keys()) == {"id_reparation", "id_piece", "quantite", "prix_unitaire"}

        assert isinstance(cols["prix_unitaire"].type, Numeric)
        assert cols["prix_unitaire"].type.precision == 10
        assert cols["prix_unitaire"].type.scale == 2

        assert cols["quantite"].nullable is False
        assert cols["prix_unitaire"].nullable is False

        # Vérification des deux clés étrangères
        fk_reparation = [fk.target_fullname for fk in cols["id_reparation"].foreign_keys]
        assert fk_reparation == ["reparation.id_reparation"]

        fk_piece = [fk.target_fullname for fk in cols["id_piece"].foreign_keys]
        assert fk_piece == ["piece_detachee.id_piece"]

    def test_relationships(self, app_context):
        mapper = inspect(ReparationPiece)
        rels = {r.key: r for r in mapper.relationships}
        assert "reparation" in rels
        assert rels["reparation"].back_populates == "reparation_pieces"
        assert "piece" in rels
        assert rels["piece"].back_populates == "reparation_pieces"


class TestFactureModel:
    """Vérifications structurelles du modèle Facture."""

    def test_table_name_and_pks(self, app_context):
        assert Facture.__tablename__ == "facture"
        pks = [c.name for c in Facture.__table__.primary_key.columns]
        assert pks == ["id_facture"]

    def test_columns_and_unique_constraint(self, app_context):
        cols = {c.name: c for c in Facture.__table__.columns}
        assert set(cols.keys()) == {
            "id_facture", "date_facture", "montant_total",
            "statut_paiement", "id_reparation"
        }

        assert isinstance(cols["montant_total"].type, Numeric)
        assert cols["montant_total"].type.precision == 10
        assert cols["montant_total"].type.scale == 2

        # Contrainte UNIQUE sur id_reparation (relation 1:1 stricte)
        assert cols["id_reparation"].unique is True
        assert cols["id_reparation"].nullable is False

        fk_targets = [fk.target_fullname for fk in cols["id_reparation"].foreign_keys]
        assert fk_targets == ["reparation.id_reparation"]

    def test_relationships(self, app_context):
        mapper = inspect(Facture)
        rels = {r.key: r for r in mapper.relationships}
        assert "reparation" in rels
        assert rels["reparation"].back_populates == "facture"
        assert rels["reparation"].uselist is False


class TestRendezVousModel:
    """Vérifications structurelles du modèle RendezVous."""

    def test_table_name_and_pks(self, app_context):
        assert RendezVous.__tablename__ == "rendez_vous"
        pks = [c.name for c in RendezVous.__table__.primary_key.columns]
        assert pks == ["id_rendezvous"]

    def test_columns_and_foreign_keys(self, app_context):
        cols = {c.name: c for c in RendezVous.__table__.columns}
        assert set(cols.keys()) == {
            "id_rendezvous", "date_rendezvous", "heure",
            "motif", "statut", "id_client", "id_vehicule"
        }

        assert cols["date_rendezvous"].nullable is False
        assert cols["heure"].nullable is False
        assert cols["statut"].nullable is False
        assert cols["motif"].nullable is True

        fk_client = [fk.target_fullname for fk in cols["id_client"].foreign_keys]
        assert fk_client == ["client.id_client"]

        fk_vehicule = [fk.target_fullname for fk in cols["id_vehicule"].foreign_keys]
        assert fk_vehicule == ["vehicule.id_vehicule"]

    def test_relationships(self, app_context):
        mapper = inspect(RendezVous)
        rels = {r.key: r for r in mapper.relationships}
        assert "client" in rels
        assert rels["client"].back_populates == "rendez_vous"
        assert "vehicule" in rels
        assert rels["vehicule"].back_populates == "rendez_vous"
