"""Tests unitaires et d'intégration d'API pour le tableau de bord (/api/v1/dashboard/stats).

Exécution isolée en mémoire avec SQLite (sqlite:///:memory:).
Aucune connexion à PostgreSQL réelle, aucune modification de la base de production.
"""
import pytest
from datetime import date, time, timedelta
from flask_jwt_extended import create_access_token

from app import create_app
from app.extensions import db
from app.models.utilisateur import Utilisateur
from app.models.mecanicien import Mecanicien
from app.models.client import Client
from app.models.vehicule import Vehicule
from app.models.reparation import Reparation
from app.models.facture import Facture
from app.models.piece_detachee import PieceDetachee
from app.models.rendez_vous import RendezVous


@pytest.fixture
def dashboard_app(monkeypatch):
    """Crée une instance isolée de test avec SQLite en mémoire."""
    monkeypatch.setenv("TEST_DATABASE_URL", "sqlite:///:memory:")
    app = create_app("testing")
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(dashboard_app):
    """Client HTTP de test."""
    return dashboard_app.test_client()


@pytest.fixture
def responsable_user(dashboard_app):
    """Utilisateur Responsable."""
    u = Utilisateur(
        nom="Directeur",
        prenom="Alain",
        email="alain.directeur@garageflow.fr",
        role="RESPONSABLE",
        telephone="0101010101",
    )
    u.set_password("AdminSecret123!")
    db.session.add(u)
    db.session.commit()
    return u


@pytest.fixture
def mecanicien_user(dashboard_app):
    """Utilisateur Mécanicien."""
    u = Utilisateur(
        nom="Ouvrier",
        prenom="Michel",
        email="michel.ouvrier@garageflow.fr",
        role="MECANICIEN",
        telephone="0606060606",
    )
    u.set_password("MecaSecret123!")
    db.session.add(u)
    db.session.commit()

    m = Mecanicien(
        specialite="Moteur",
        id_utilisateur=u.id_utilisateur,
    )
    db.session.add(m)
    db.session.commit()
    return u, m


@pytest.fixture
def second_mecanicien(dashboard_app):
    """Deuxième mécanicien pour tester le cloisonnement."""
    u = Utilisateur(
        nom="Second",
        prenom="Pierre",
        email="pierre.second@garageflow.fr",
        role="MECANICIEN",
        telephone="0707070707",
    )
    u.set_password("SecondSecret123!")
    db.session.add(u)
    db.session.commit()

    m = Mecanicien(
        specialite="Carrosserie",
        id_utilisateur=u.id_utilisateur,
    )
    db.session.add(m)
    db.session.commit()
    return u, m


def get_auth_headers(user):
    """Génère l'en-tête Authorization Bearer pour un utilisateur."""
    token = create_access_token(
        identity=str(user.id_utilisateur),
        additional_claims={"role": user.role},
    )
    return {"Authorization": f"Bearer {token}"}


class TestDashboardAuthentication:
    """Vérification des règles d'authentification."""

    def test_stats_requires_jwt(self, client):
        """L'accès sans jeton JWT doit être rejeté avec un code 401."""
        response = client.get("/api/v1/dashboard/stats")
        assert response.status_code == 401
        data = response.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "AUTHENTICATION_REQUIRED"

    def test_stats_invalid_jwt(self, client):
        """L'accès avec un jeton invalide doit être rejeté avec un code 401."""
        headers = {"Authorization": "Bearer jeton_invalide"}
        response = client.get("/api/v1/dashboard/stats", headers=headers)
        assert response.status_code == 401
        data = response.get_json()
        assert data["success"] is False


class TestDashboardResponsable:
    """Vérification des statistiques complètes pour le rôle RESPONSABLE."""

    def test_stats_empty_database(self, client, responsable_user):
        """Vérifie le comportement sans données en base (doit renvoyer des zéros sans crash)."""
        headers = get_auth_headers(responsable_user)
        response = client.get("/api/v1/dashboard/stats", headers=headers)
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True

        stats = data["data"]
        assert stats["user_role"] == "RESPONSABLE"
        assert stats["clients_total"] == 0
        assert stats["vehicules_total"] == 0
        assert stats["reparations_en_cours"] == 0
        assert stats["reparations_terminees"] == 0
        assert stats["rendez_vous_aujourd_hui"] == 0
        assert stats["factures_impayees"] == 0
        assert stats["chiffre_affaires"] == 0.0
        assert stats["stock_faible"] == 0
        assert stats["reparations_recentes"] == []
        assert stats["rendez_vous_prochains"] == []
        assert stats["stock_alertes"] == []
        assert "activite_reparations" in stats
        assert "reparations_par_statut" in stats
        assert "evolution_revenus" in stats

    def test_stats_with_data(self, client, responsable_user, mecanicien_user):
        """Vérifie le calcul précis des indicateurs avec des données réelles."""
        _, meca = mecanicien_user

        # 1. Clients et véhicules
        c1 = Client(nom="Durand", prenom="Paul", telephone="0140203040")
        c2 = Client(nom="Moreau", prenom="Sophie", telephone="0150607080")
        db.session.add_all([c1, c2])
        db.session.commit()

        v1 = Vehicule(marque="Renault", modele="Clio", immatriculation="AB-123-CD", id_client=c1.id_client)
        v2 = Vehicule(marque="Peugeot", modele="208", immatriculation="EF-456-GH", id_client=c2.id_client)
        db.session.add_all([v1, v2])
        db.session.commit()

        # 2. Réparations avec statuts variés
        today = date.today()
        r1 = Reparation(
            description="Vidange moteur",
            date_reparation=today,
            statut="EN_COURS",
            cout=150.00,
            id_vehicule=v1.id_vehicule,
            id_mecanicien=meca.id_mecanicien,
        )
        r2 = Reparation(
            description="Changement plaquettes",
            date_reparation=today,
            statut="TERMINEE",
            cout=250.00,
            id_vehicule=v2.id_vehicule,
            id_mecanicien=meca.id_mecanicien,
        )
        r3 = Reparation(
            description="Diagnostic injection",
            date_reparation=today - timedelta(days=2),
            statut="EN_ATTENTE",
            cout=80.00,
            id_vehicule=v1.id_vehicule,
            id_mecanicien=meca.id_mecanicien,
        )
        db.session.add_all([r1, r2, r3])
        db.session.commit()

        # 3. Factures : 1 Payée, 1 Impayée
        f1 = Facture(
            date_facture=today,
            montant_total=250.00,
            statut_paiement="PAYEE",
            id_reparation=r2.id_reparation,
        )
        f2 = Facture(
            date_facture=today,
            montant_total=150.00,
            statut_paiement="EN_ATTENTE",
            id_reparation=r1.id_reparation,
        )
        db.session.add_all([f1, f2])
        db.session.commit()

        # 4. Rendez-vous : 1 aujourd'hui, 1 demain
        rdv_today = RendezVous(
            date_rendezvous=today,
            heure=time(10, 0),
            motif="Contrôle technique",
            statut="PLANIFIE",
            id_client=c1.id_client,
            id_vehicule=v1.id_vehicule,
        )
        rdv_tomorrow = RendezVous(
            date_rendezvous=today + timedelta(days=1),
            heure=time(14, 30),
            motif="Révision annuelle",
            statut="CONFIRME",
            id_client=c2.id_client,
            id_vehicule=v2.id_vehicule,
        )
        db.session.add_all([rdv_today, rdv_tomorrow])
        db.session.commit()

        # 5. Pièces détachées : 1 rupture, 1 critique, 1 stock normal
        p_rupture = PieceDetachee(nom="Filtre à huile", prix_unitaire=15.00, quantite_stock=0)
        p_critique = PieceDetachee(nom="Plaquettes avant", prix_unitaire=45.00, quantite_stock=2)
        p_normal = PieceDetachee(nom="Liquide frein", prix_unitaire=12.00, quantite_stock=25)
        db.session.add_all([p_rupture, p_critique, p_normal])
        db.session.commit()

        # Requête au endpoint
        headers = get_auth_headers(responsable_user)
        response = client.get("/api/v1/dashboard/stats", headers=headers)
        assert response.status_code == 200
        stats = response.get_json()["data"]

        # Assertions des totaux
        assert stats["clients_total"] == 2
        assert stats["vehicules_total"] == 2
        assert stats["reparations_en_cours"] == 1
        assert stats["reparations_terminees"] == 1
        assert stats["reparations_en_attente"] == 1
        assert stats["rendez_vous_aujourd_hui"] == 1
        assert stats["factures_impayees"] == 1
        assert stats["chiffre_affaires"] == 250.00
        assert stats["stock_faible"] == 2  # p_rupture (0) et p_critique (2) <= 5

        # Vérification des listes enrichies
        assert len(stats["reparations_recentes"]) == 3
        first_rep = stats["reparations_recentes"][0]
        assert "vehicule" in first_rep and first_rep["vehicule"] is not None
        assert "client" in first_rep and first_rep["client"] is not None
        assert "mecanicien" in first_rep and first_rep["mecanicien"] is not None

        assert len(stats["rendez_vous_prochains"]) == 2
        assert len(stats["stock_alertes"]) == 2
        assert stats["stock_alertes"][0]["severite"] == "RUPTURE"
        assert stats["stock_alertes"][1]["severite"] == "CRITIQUE"


class TestDashboardMecanicien:
    """Vérification du cloisonnement des données pour le rôle MECANICIEN."""

    def test_mecanicien_data_isolation(self, client, mecanicien_user, second_mecanicien):
        """Un mécanicien ne doit voir QUE ses réparations et aucune donnée financière."""
        meca_user1, meca1 = mecanicien_user
        _, meca2 = second_mecanicien

        c = Client(nom="Test", prenom="Client", telephone="0102030405")
        db.session.add(c)
        db.session.commit()

        v = Vehicule(marque="VW", modele="Golf", immatriculation="WW-111-WW", id_client=c.id_client)
        db.session.add(v)
        db.session.commit()

        today = date.today()
        # Réparation mécanicien 1 (en cours)
        r_meca1 = Reparation(
            description="Freins Meca 1",
            date_reparation=today,
            statut="EN_COURS",
            cout=100.00,
            id_vehicule=v.id_vehicule,
            id_mecanicien=meca1.id_mecanicien,
        )
        # Réparation mécanicien 2 (en cours)
        r_meca2 = Reparation(
            description="Embrayage Meca 2",
            date_reparation=today,
            statut="EN_COURS",
            cout=300.00,
            id_vehicule=v.id_vehicule,
            id_mecanicien=meca2.id_mecanicien,
        )
        db.session.add_all([r_meca1, r_meca2])
        db.session.commit()

        # Requête émise par meca_user1
        headers = get_auth_headers(meca_user1)
        response = client.get("/api/v1/dashboard/stats", headers=headers)
        assert response.status_code == 200
        stats = response.get_json()["data"]

        # Le mécanicien 1 ne doit voir que SA réparation en cours (1 au lieu de 2)
        assert stats["user_role"] == "MECANICIEN"
        assert stats["reparations_en_cours"] == 1
        assert len(stats["reparations_recentes"]) == 1
        assert stats["reparations_recentes"][0]["description"] == "Freins Meca 1"

        # Les indicateurs financiers et clients globaux sont masqués pour le mécanicien
        assert stats["chiffre_affaires"] is None
        assert stats["factures_impayees"] is None
        assert stats["clients_total"] is None
        assert stats["evolution_revenus"] is None
