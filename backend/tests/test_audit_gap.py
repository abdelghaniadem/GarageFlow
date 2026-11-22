"""Tests complémentaires d'audit pour GarageFlow.

Complète la couverture de tests sur :
1. Le point de terminaison de santé /api/v1/health (utilisé par Docker et Kubernetes).
2. La gestion standardisée des erreurs HTTP globales (404, 405).
3. Les cas limites de mise à jour avec des corps JSON vides ou invalides.
4. La validation stricte des paramètres de requête (query string) non conformes.
5. Le rejet et la standardisation des jetons JWT manquants ou corrompus.
6. Le respect strict des restrictions RBAC (MECANICIEN interdisant l'accès aux modules d'administration).
"""
import pytest
from datetime import date
from flask_jwt_extended import create_access_token

from app import create_app
from app.extensions import db
from app.models.utilisateur import Utilisateur
from app.models.mecanicien import Mecanicien
from app.models.client import Client
from app.models.vehicule import Vehicule
from app.models.piece_detachee import PieceDetachee
from app.models.reparation import Reparation
from app.models.reparation_piece import ReparationPiece


@pytest.fixture
def test_app(monkeypatch):
    """Application isolée en mémoire SQLite."""
    monkeypatch.setenv("TEST_DATABASE_URL", "sqlite:///:memory:")
    app = create_app("testing")
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(test_app):
    """Client de test HTTP."""
    return test_app.test_client()


@pytest.fixture
def responsable_token(test_app):
    """Jeton JWT pour un profil RESPONSABLE."""
    with test_app.app_context():
        u = Utilisateur(
            nom="Admin",
            prenom="Directeur",
            email="resp.gap@garageflow.tn",
            role="RESPONSABLE",
            telephone="71111222",
        )
        u.set_password("AdminPass123!")
        db.session.add(u)
        db.session.commit()
        return create_access_token(
            identity=str(u.id_utilisateur),
            additional_claims={"role": u.role, "email": u.email},
        )


@pytest.fixture
def mecanicien_token_and_id(test_app):
    """Jeton JWT et identifiant pour un profil MECANICIEN."""
    with test_app.app_context():
        u = Utilisateur(
            nom="Meca",
            prenom="Technicien",
            email="meca.gap@garageflow.tn",
            role="MECANICIEN",
            telephone="72222333",
        )
        u.set_password("MecaPass123!")
        db.session.add(u)
        db.session.flush()

        m = Mecanicien(
            specialite="Moteur",
            id_utilisateur=u.id_utilisateur,
        )
        db.session.add(m)
        db.session.commit()

        token = create_access_token(
            identity=str(u.id_utilisateur),
            additional_claims={"role": u.role, "email": u.email},
        )
        return token, m.id_mecanicien


@pytest.fixture
def sample_data(test_app, mecanicien_token_and_id):
    """Crée un ensemble de données pour les tests de cas limites."""
    _, id_mecanicien = mecanicien_token_and_id
    with test_app.app_context():
        c = Client(nom="TestNom", prenom="TestPrenom", telephone="98111222", adresse="Tunis")
        db.session.add(c)
        db.session.flush()

        v = Vehicule(
            marque="Renault",
            modele="Clio",
            immatriculation="150 تونس 1234",
            id_client=c.id_client,
        )
        db.session.add(v)
        db.session.flush()

        p = PieceDetachee(
            nom="Filtre à huile",
            prix_unitaire=25.500,
            quantite_stock=10,
        )
        db.session.add(p)
        db.session.flush()

        r = Reparation(
            description="Entretien régulier",
            date_reparation=date.today(),
            statut="EN_COURS",
            id_vehicule=v.id_vehicule,
            id_mecanicien=id_mecanicien,
        )
        db.session.add(r)
        db.session.flush()

        rp = ReparationPiece(
            id_reparation=r.id_reparation,
            id_piece=p.id_piece,
            quantite=2,
            prix_unitaire=25.500,
        )
        db.session.add(rp)
        db.session.commit()

        return {
            "id_client": c.id_client,
            "id_vehicule": v.id_vehicule,
            "id_piece": p.id_piece,
            "id_reparation": r.id_reparation,
            "id_mecanicien": id_mecanicien,
        }


class TestHealthEndpoint:
    """Vérifications du point de contrôle de santé de l'API (/api/v1/health)."""

    def test_health_check_returns_200_and_json(self, client):
        resp = client.get("/api/v1/health")
        assert resp.status_code == 200
        payload = resp.get_json()
        assert payload["status"] == "healthy"
        assert payload["service"] == "GarageFlow Backend API"
        assert "version" in payload

    def test_health_check_method_not_allowed(self, client):
        resp = client.post("/api/v1/health")
        assert resp.status_code == 405
        payload = resp.get_json()
        assert payload["success"] is False
        assert payload["error"]["code"] == "METHOD_NOT_ALLOWED"


class TestGlobalErrorHandling:
    """Vérifications des gestionnaires d'erreurs globales HTTP."""

    def test_unknown_route_returns_404_json(self, client):
        resp = client.get("/api/v1/non-existent-route-for-audit")
        assert resp.status_code == 404
        payload = resp.get_json()
        assert payload["success"] is False
        assert payload["error"]["code"] == "NOT_FOUND"
        assert "message" in payload["error"]

    def test_missing_jwt_returns_standard_401(self, client):
        resp = client.get("/api/v1/auth/me")
        assert resp.status_code == 401
        payload = resp.get_json()
        assert payload["success"] is False
        assert payload["error"]["code"] == "AUTHENTICATION_REQUIRED"

    def test_invalid_jwt_token_returns_standard_401(self, client):
        resp = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer not-a-valid-jwt-token"},
        )
        assert resp.status_code == 401
        payload = resp.get_json()
        assert payload["success"] is False
        assert payload["error"]["code"] == "INVALID_TOKEN"


class TestEdgeCasesAndQueryValidations:
    """Cas limites sur les query strings et corps de requêtes vides."""

    def test_update_mecanicien_with_empty_body(self, client, responsable_token, sample_data):
        id_meca = sample_data["id_mecanicien"]
        resp = client.patch(
            f"/api/v1/mecaniciens/{id_meca}",
            json={},
            headers={"Authorization": f"Bearer {responsable_token}"},
        )
        assert resp.status_code == 422
        payload = resp.get_json()
        assert payload["success"] is False
        assert payload["error"]["code"] == "VALIDATION_ERROR"

    def test_update_piece_with_empty_body(self, client, responsable_token, sample_data):
        id_piece = sample_data["id_piece"]
        resp = client.patch(
            f"/api/v1/pieces/{id_piece}",
            json={},
            headers={"Authorization": f"Bearer {responsable_token}"},
        )
        assert resp.status_code == 422
        payload = resp.get_json()
        assert payload["success"] is False
        assert payload["error"]["code"] == "VALIDATION_ERROR"

    def test_update_reparation_with_empty_body(self, client, responsable_token, sample_data):
        id_rep = sample_data["id_reparation"]
        resp = client.patch(
            f"/api/v1/reparations/{id_rep}",
            json={},
            headers={"Authorization": f"Bearer {responsable_token}"},
        )
        assert resp.status_code == 422
        payload = resp.get_json()
        assert payload["success"] is False
        assert payload["error"]["code"] == "VALIDATION_ERROR"

    def test_update_reparation_piece_empty_body(self, client, responsable_token, sample_data):
        id_rep = sample_data["id_reparation"]
        id_piece = sample_data["id_piece"]
        resp = client.patch(
            f"/api/v1/reparations/{id_rep}/pieces/{id_piece}",
            json={},
            headers={"Authorization": f"Bearer {responsable_token}"},
        )
        assert resp.status_code == 422
        payload = resp.get_json()
        assert payload["success"] is False
        assert payload["error"]["code"] == "VALIDATION_ERROR"

    def test_piece_query_parameters_validation(self, client, responsable_token):
        headers = {"Authorization": f"Bearer {responsable_token}"}
        # stock_max non entier
        r1 = client.get("/api/v1/pieces?stock_max=invalid", headers=headers)
        assert r1.status_code == 422
        assert "stock_max" in r1.get_json()["error"]["message"].lower() or "paramètre" in r1.get_json()["error"]["message"].lower()

        # prix_min non numérique
        r2 = client.get("/api/v1/pieces?prix_min=invalid", headers=headers)
        assert r2.status_code == 422

        # prix_max non numérique
        r3 = client.get("/api/v1/pieces?prix_max=invalid", headers=headers)
        assert r3.status_code == 422

        # seuil non numérique
        r4 = client.get("/api/v1/pieces?seuil=invalid", headers=headers)
        assert r4.status_code == 422

    def test_reparation_query_parameters_validation(self, client, responsable_token):
        headers = {"Authorization": f"Bearer {responsable_token}"}
        # id_vehicule non entier
        r1 = client.get("/api/v1/reparations?id_vehicule=not_int", headers=headers)
        assert r1.status_code == 422

        # id_mecanicien non entier
        r2 = client.get("/api/v1/reparations?id_mecanicien=not_int", headers=headers)
        assert r2.status_code == 422

        # date invalide
        r3 = client.get("/api/v1/reparations?date=not-a-valid-date", headers=headers)
        assert r3.status_code == 422


class TestRbacEnforcement:
    """Vérifications des restrictions RBAC pour le profil MECANICIEN."""

    def test_mecanicien_cannot_create_client(self, client, mecanicien_token_and_id):
        token, _ = mecanicien_token_and_id
        resp = client.post(
            "/api/v1/clients",
            json={"nom": "Interdit", "prenom": "User", "telephone": "98123456"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403
        payload = resp.get_json()
        assert payload["success"] is False
        assert payload["error"]["code"] == "FORBIDDEN"

    def test_mecanicien_cannot_access_factures(self, client, mecanicien_token_and_id):
        token, _ = mecanicien_token_and_id
        resp = client.get(
            "/api/v1/factures",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403
        payload = resp.get_json()
        assert payload["success"] is False
        assert payload["error"]["code"] == "FORBIDDEN"

    def test_mecanicien_cannot_create_mecanicien(self, client, mecanicien_token_and_id):
        token, _ = mecanicien_token_and_id
        resp = client.post(
            "/api/v1/mecaniciens",
            json={"nom": "Ouvrier", "prenom": "Nouveau", "email": "nouveau@gf.tn", "telephone": "98222333"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403
        payload = resp.get_json()
        assert payload["success"] is False
        assert payload["error"]["code"] == "FORBIDDEN"

    def test_mecanicien_cannot_create_rendez_vous(self, client, mecanicien_token_and_id):
        token, _ = mecanicien_token_and_id
        resp = client.post(
            "/api/v1/rendez-vous",
            json={"date_rdv": "2026-12-01", "heure_rdv": "10:00:00", "id_client": 1, "id_vehicule": 1},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403
        payload = resp.get_json()
        assert payload["success"] is False
        assert payload["error"]["code"] == "FORBIDDEN"
