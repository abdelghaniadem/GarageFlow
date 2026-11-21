"""Tests complets pour le module Gestion des Mécaniciens de GarageFlow.

Exécution isolée en mémoire avec SQLite (sqlite:///:memory:).
Aucune connexion à PostgreSQL, aucune modification de la base réelle et aucune migration.
"""
import pytest
from datetime import date
from flask_jwt_extended import create_access_token

from app import create_app
from app.extensions import db
from app.models import Utilisateur, Mecanicien, Client, Vehicule, Reparation


@pytest.fixture
def mecanicien_app(monkeypatch):
    """Crée une instance d'application Flask isolée avec base SQLite en mémoire."""
    monkeypatch.setenv("TEST_DATABASE_URL", "sqlite:///:memory:")
    app = create_app("testing")
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(mecanicien_app):
    """Client de test HTTP Flask."""
    return mecanicien_app.test_client()


@pytest.fixture
def responsable_token(mecanicien_app):
    """Jeton JWT avec le rôle RESPONSABLE."""
    return create_access_token(
        identity="1",
        additional_claims={"role": "RESPONSABLE"},
    )


@pytest.fixture
def mecanicien_token(mecanicien_app):
    """Jeton JWT avec le rôle MECANICIEN."""
    return create_access_token(
        identity="2",
        additional_claims={"role": "MECANICIEN"},
    )


@pytest.fixture
def headers_responsable(responsable_token):
    """En-têtes d'autorisation pour un Responsable."""
    return {"Authorization": f"Bearer {responsable_token}"}


@pytest.fixture
def headers_mecanicien(mecanicien_token):
    """En-têtes d'autorisation pour un Mécanicien."""
    return {"Authorization": f"Bearer {mecanicien_token}"}


@pytest.fixture
def unassigned_mechanic_user(mecanicien_app):
    """Utilisateur avec le rôle MECANICIEN sans profil mécanicien rattaché."""
    u = Utilisateur(
        nom="Dupont",
        prenom="Julien",
        email="julien.dupont@garageflow.fr",
        role="MECANICIEN",
        telephone="0601020304",
    )
    u.set_password("SecurePass123!")
    db.session.add(u)
    db.session.commit()
    return u


@pytest.fixture
def responsable_user(mecanicien_app):
    """Utilisateur avec le rôle RESPONSABLE (rôle invalide pour profil mécanicien)."""
    u = Utilisateur(
        nom="Boss",
        prenom="Bernard",
        email="bernard.boss@garageflow.fr",
        role="RESPONSABLE",
        telephone="0102030405",
    )
    u.set_password("BossPass123!")
    db.session.add(u)
    db.session.commit()
    return u


@pytest.fixture
def sample_mecanicien(mecanicien_app, unassigned_mechanic_user):
    """Mécanicien témoin rattaché à un utilisateur existant."""
    m = Mecanicien(
        specialite="Motorisation et Transmission",
        id_utilisateur=unassigned_mechanic_user.id_utilisateur,
    )
    db.session.add(m)
    db.session.commit()
    return m


@pytest.fixture
def mecanicien_with_repairs(mecanicien_app):
    """Mécanicien ayant une réparation rattachée (pour tester le conflit de suppression)."""
    u = Utilisateur(
        nom="Martin",
        prenom="Lucas",
        email="lucas.martin@garageflow.fr",
        role="MECANICIEN",
        telephone="0699887766",
    )
    u.set_password("LucasPass123!")
    db.session.add(u)
    db.session.commit()

    m = Mecanicien(
        specialite="Électronique et Diagnostic",
        id_utilisateur=u.id_utilisateur,
    )
    db.session.add(m)

    c = Client(nom="ClientTest", prenom="Paul", telephone="0145678910")
    db.session.add(c)
    db.session.commit()

    v = Vehicule(marque="Renault", modele="Megane", immatriculation="XX-123-YY", id_client=c.id_client)
    db.session.add(v)
    db.session.commit()

    rep = Reparation(
        description="Diagnostic système injection",
        date_reparation=date(2026, 11, 10),
        statut="EN_COURS",
        id_vehicule=v.id_vehicule,
        id_mecanicien=m.id_mecanicien,
    )
    db.session.add(rep)
    db.session.commit()
    return m


# ============================================================================
# Tests de Création (POST /api/v1/mecaniciens)
# ============================================================================

class TestMecanicienCreate:
    """Tests pour la création de profil mécanicien."""

    def test_create_mecanicien_with_existing_user(self, client, headers_responsable, unassigned_mechanic_user):
        """Succès de création en associant un utilisateur existant au rôle MECANICIEN."""
        payload = {
            "specialite": "Freinage et Sécurité",
            "id_utilisateur": unassigned_mechanic_user.id_utilisateur,
        }
        response = client.post("/api/v1/mecaniciens", json=payload, headers=headers_responsable)
        assert response.status_code == 201
        data = response.get_json()
        assert data["success"] is True
        assert data["message"] == "Mécanicien créé avec succès."
        assert data["data"]["specialite"] == "Freinage et Sécurité"
        assert data["data"]["id_utilisateur"] == unassigned_mechanic_user.id_utilisateur
        assert data["data"]["utilisateur"]["email"] == unassigned_mechanic_user.email
        assert data["data"]["utilisateur"]["role"] == "MECANICIEN"
        assert "mot_de_passe" not in data["data"]["utilisateur"]

    def test_create_mecanicien_simultaneous_user_creation(self, client, headers_responsable):
        """Succès de création simultanée du compte utilisateur (avec hachage Bcrypt) et du profil mécanicien."""
        payload = {
            "specialite": "Climatisation et Électricité",
            "nom": "Durand",
            "prenom": "Alain",
            "email": "alain.durand@garageflow.fr",
            "mot_de_passe": "MonMotDePasseSecret123!",
            "telephone": "0677889900",
        }
        response = client.post("/api/v1/mecaniciens", json=payload, headers=headers_responsable)
        assert response.status_code == 201
        data = response.get_json()
        assert data["success"] is True
        assert data["data"]["specialite"] == "Climatisation et Électricité"
        assert data["data"]["utilisateur"]["nom"] == "Durand"
        assert data["data"]["utilisateur"]["email"] == "alain.durand@garageflow.fr"
        assert data["data"]["utilisateur"]["role"] == "MECANICIEN"
        assert "mot_de_passe" not in data["data"]["utilisateur"]

        # Vérification en base que le mot de passe est bien haché et valide
        user = Utilisateur.query.filter_by(email="alain.durand@garageflow.fr").first()
        assert user is not None
        assert user.mot_de_passe != "MonMotDePasseSecret123!"
        assert user.mot_de_passe.startswith("$2b$")
        assert user.check_password("MonMotDePasseSecret123!") is True

    def test_create_mecanicien_nonexistent_user(self, client, headers_responsable):
        """Rejet HTTP 404 si l'identifiant utilisateur fourni n'existe pas."""
        payload = {"specialite": "Carrosserie", "id_utilisateur": 99999}
        response = client.post("/api/v1/mecaniciens", json=payload, headers=headers_responsable)
        assert response.status_code == 404
        assert response.get_json()["error"]["code"] == "NOT_FOUND"

    def test_create_mecanicien_wrong_role_rejected(self, client, headers_responsable, responsable_user):
        """Rejet HTTP 422 si l'utilisateur associé n'a pas le rôle MECANICIEN."""
        payload = {
            "specialite": "Motorisation",
            "id_utilisateur": responsable_user.id_utilisateur,
        }
        response = client.post("/api/v1/mecaniciens", json=payload, headers=headers_responsable)
        assert response.status_code == 422
        data = response.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"
        assert "role" in data["error"]["details"]

    def test_create_mecanicien_duplicate_profile_rejected(self, client, headers_responsable, sample_mecanicien):
        """Rejet HTTP 409 si un utilisateur possède déjà un profil mécanicien (unicité)."""
        payload = {
            "specialite": "Autre Spécialité",
            "id_utilisateur": sample_mecanicien.id_utilisateur,
        }
        response = client.post("/api/v1/mecaniciens", json=payload, headers=headers_responsable)
        assert response.status_code == 409
        data = response.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "CONFLICT"

    def test_create_mecanicien_duplicate_email_rejected(self, client, headers_responsable, unassigned_mechanic_user):
        """Rejet HTTP 409 lors de la création simultanée si l'email existe déjà."""
        payload = {
            "specialite": "Spécialité Test",
            "nom": "Doublon",
            "prenom": "Test",
            "email": unassigned_mechanic_user.email,  # Email déjà utilisé
            "mot_de_passe": "TestPass123!",
        }
        response = client.post("/api/v1/mecaniciens", json=payload, headers=headers_responsable)
        assert response.status_code == 409
        assert response.get_json()["error"]["code"] == "CONFLICT"

    def test_create_mecanicien_missing_specialite(self, client, headers_responsable, unassigned_mechanic_user):
        """Rejet HTTP 422 si la spécialité est manquante."""
        payload = {"id_utilisateur": unassigned_mechanic_user.id_utilisateur}
        response = client.post("/api/v1/mecaniciens", json=payload, headers=headers_responsable)
        assert response.status_code == 422
        assert "specialite" in response.get_json()["error"]["details"]

    def test_create_mecanicien_missing_user_info(self, client, headers_responsable):
        """Rejet HTTP 422 si ni id_utilisateur ni les champs du compte ne sont fournis."""
        payload = {"specialite": "Pneumatique"}
        response = client.post("/api/v1/mecaniciens", json=payload, headers=headers_responsable)
        assert response.status_code == 422
        assert response.get_json()["error"]["code"] == "VALIDATION_ERROR"


# ============================================================================
# Tests de Lecture (GET /api/v1/mecaniciens)
# ============================================================================

class TestMecanicienRead:
    """Tests pour la consultation des mécaniciens."""

    def test_list_mecaniciens_empty(self, client, headers_responsable):
        """Retourne une liste vide HTTP 200 lorsqu'aucun mécanicien n'existe."""
        response = client.get("/api/v1/mecaniciens", headers=headers_responsable)
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert data["data"] == []

    def test_list_mecaniciens_populated(self, client, headers_responsable, sample_mecanicien):
        """Retourne la liste des mécaniciens existants avec leurs informations publiques."""
        response = client.get("/api/v1/mecaniciens", headers=headers_responsable)
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert len(data["data"]) == 1
        assert data["data"][0]["specialite"] == sample_mecanicien.specialite
        assert data["data"][0]["utilisateur"]["nom"] == "Dupont"

    def test_list_mecaniciens_filter_by_specialite(self, client, headers_responsable, sample_mecanicien):
        """Filtre les mécaniciens par spécialité (?specialite=)."""
        resp_found = client.get("/api/v1/mecaniciens?specialite=Transmission", headers=headers_responsable)
        assert resp_found.status_code == 200
        assert len(resp_found.get_json()["data"]) == 1

        resp_none = client.get("/api/v1/mecaniciens?specialite=Inexistante", headers=headers_responsable)
        assert resp_none.status_code == 200
        assert len(resp_none.get_json()["data"]) == 0

    def test_list_mecaniciens_search(self, client, headers_responsable, sample_mecanicien):
        """Recherche textuelle sur le nom de l'utilisateur ou la spécialité (?search=)."""
        resp_search = client.get("/api/v1/mecaniciens?search=dupont", headers=headers_responsable)
        assert resp_search.status_code == 200
        assert len(resp_search.get_json()["data"]) == 1

    def test_get_mecanicien_by_id_success(self, client, headers_responsable, sample_mecanicien):
        """Récupère un mécanicien par son identifiant unique."""
        response = client.get(f"/api/v1/mecaniciens/{sample_mecanicien.id_mecanicien}", headers=headers_responsable)
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert data["data"]["id_mecanicien"] == sample_mecanicien.id_mecanicien
        assert data["data"]["specialite"] == sample_mecanicien.specialite
        assert data["data"]["utilisateur"]["email"] == "julien.dupont@garageflow.fr"

    def test_get_mecanicien_by_id_not_found(self, client, headers_responsable):
        """Retourne HTTP 404 NOT_FOUND si le mécanicien n'existe pas."""
        response = client.get("/api/v1/mecaniciens/99999", headers=headers_responsable)
        assert response.status_code == 404
        assert response.get_json()["error"]["code"] == "NOT_FOUND"


# ============================================================================
# Tests de Mise à jour (PUT/PATCH /api/v1/mecaniciens/<id>)
# ============================================================================

class TestMecanicienUpdate:
    """Tests pour la mise à jour d'un mécanicien."""

    def test_update_mecanicien_specialite_success(self, client, headers_responsable, sample_mecanicien):
        """Mise à jour réussie de la spécialité."""
        payload = {"specialite": "Expert Diagnostic Moteur"}
        response = client.put(
            f"/api/v1/mecaniciens/{sample_mecanicien.id_mecanicien}",
            json=payload,
            headers=headers_responsable,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert data["data"]["specialite"] == "Expert Diagnostic Moteur"

    def test_update_mecanicien_user_metadata_success(self, client, headers_responsable, sample_mecanicien):
        """Mise à jour des coordonnées de l'utilisateur associé (nom, téléphone)."""
        payload = {"nom": "Dupont-Nouveau", "telephone": "0600000000"}
        response = client.put(
            f"/api/v1/mecaniciens/{sample_mecanicien.id_mecanicien}",
            json=payload,
            headers=headers_responsable,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["utilisateur"]["nom"] == "Dupont-Nouveau"
        assert data["data"]["utilisateur"]["telephone"] == "0600000000"

    def test_update_mecanicien_change_user_forbidden(self, client, headers_responsable, sample_mecanicien):
        """Rejet HTTP 422 si l'on tente de réassigner l'identifiant utilisateur (Règle 6)."""
        payload = {"id_utilisateur": 99999}
        response = client.put(
            f"/api/v1/mecaniciens/{sample_mecanicien.id_mecanicien}",
            json=payload,
            headers=headers_responsable,
        )
        assert response.status_code == 422
        data = response.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"
        assert "id_utilisateur" in data["error"]["details"]

    def test_update_mecanicien_empty_payload_rejected(self, client, headers_responsable, sample_mecanicien):
        """Rejet HTTP 422 si le corps de requête est vide ({})."""
        response = client.put(
            f"/api/v1/mecaniciens/{sample_mecanicien.id_mecanicien}",
            json={},
            headers=headers_responsable,
        )
        assert response.status_code == 422
        assert response.get_json()["error"]["code"] == "VALIDATION_ERROR"

    def test_update_mecanicien_not_found(self, client, headers_responsable):
        """Retourne HTTP 404 si le mécanicien à modifier n'existe pas."""
        response = client.put(
            "/api/v1/mecaniciens/99999",
            json={"specialite": "Nouvelle Spécialité"},
            headers=headers_responsable,
        )
        assert response.status_code == 404
        assert response.get_json()["error"]["code"] == "NOT_FOUND"


# ============================================================================
# Tests de Suppression (DELETE /api/v1/mecaniciens/<id>)
# ============================================================================

class TestMecanicienDelete:
    """Tests pour la suppression d'un mécanicien."""

    def test_delete_mecanicien_success(self, client, headers_responsable, sample_mecanicien):
        """Suppression réussie d'un mécanicien sans historique de réparations."""
        m_id = sample_mecanicien.id_mecanicien
        response = client.delete(f"/api/v1/mecaniciens/{m_id}", headers=headers_responsable)
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert data["message"] == "Mécanicien supprimé avec succès."
        assert data["data"]["id_mecanicien"] == m_id

        # Vérification en base que le profil est supprimé
        get_resp = client.get(f"/api/v1/mecaniciens/{m_id}", headers=headers_responsable)
        assert get_resp.status_code == 404

    def test_delete_mecanicien_not_found(self, client, headers_responsable):
        """Retourne HTTP 404 si le mécanicien à supprimer n'existe pas."""
        response = client.delete("/api/v1/mecaniciens/99999", headers=headers_responsable)
        assert response.status_code == 404
        assert response.get_json()["error"]["code"] == "NOT_FOUND"

    def test_delete_mecanicien_conflict_with_repairs(self, client, headers_responsable, mecanicien_with_repairs):
        """Retourne HTTP 409 CONFLICT si le mécanicien a des réparations associées (Règle 7)."""
        m_id = mecanicien_with_repairs.id_mecanicien
        response = client.delete(f"/api/v1/mecaniciens/{m_id}", headers=headers_responsable)
        assert response.status_code == 409
        data = response.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "CONFLICT"
        assert "réparation" in data["error"]["message"].lower()

        # Vérification que le mécanicien n'a PAS été supprimé
        get_resp = client.get(f"/api/v1/mecaniciens/{m_id}", headers=headers_responsable)
        assert get_resp.status_code == 200


# ============================================================================
# Tests de Sécurité et Permissions RBAC
# ============================================================================

class TestMecanicienSecurityAndRoles:
    """Tests vérifiant l'authentification JWT et la restriction au rôle RESPONSABLE."""

    def test_endpoints_unauthorized_without_jwt(self, client, sample_mecanicien):
        """Toutes les opérations requièrent un jeton JWT et renvoient HTTP 401 sans jeton."""
        m_id = sample_mecanicien.id_mecanicien
        endpoints = [
            ("GET", "/api/v1/mecaniciens", None),
            ("POST", "/api/v1/mecaniciens", {"specialite": "Test", "id_utilisateur": 1}),
            ("GET", f"/api/v1/mecaniciens/{m_id}", None),
            ("PUT", f"/api/v1/mecaniciens/{m_id}", {"specialite": "New"}),
            ("DELETE", f"/api/v1/mecaniciens/{m_id}", None),
        ]
        for method, url, payload in endpoints:
            if method == "GET":
                resp = client.get(url)
            elif method == "POST":
                resp = client.post(url, json=payload)
            elif method == "PUT":
                resp = client.put(url, json=payload)
            elif method == "DELETE":
                resp = client.delete(url)
            assert resp.status_code == 401, f"Expected 401 for {method} {url}, got {resp.status_code}"

    def test_endpoints_forbidden_for_mecanicien(self, client, headers_mecanicien, sample_mecanicien):
        """Le rôle MECANICIEN est rejeté avec HTTP 403 FORBIDDEN sur l'ensemble des endpoints de gestion."""
        m_id = sample_mecanicien.id_mecanicien
        endpoints = [
            ("GET", "/api/v1/mecaniciens", None),
            ("POST", "/api/v1/mecaniciens", {"specialite": "Test", "id_utilisateur": 1}),
            ("GET", f"/api/v1/mecaniciens/{m_id}", None),
            ("PUT", f"/api/v1/mecaniciens/{m_id}", {"specialite": "New"}),
            ("DELETE", f"/api/v1/mecaniciens/{m_id}", None),
        ]
        for method, url, payload in endpoints:
            if method == "GET":
                resp = client.get(url, headers=headers_mecanicien)
            elif method == "POST":
                resp = client.post(url, json=payload, headers=headers_mecanicien)
            elif method == "PUT":
                resp = client.put(url, json=payload, headers=headers_mecanicien)
            elif method == "DELETE":
                resp = client.delete(url, headers=headers_mecanicien)

            assert resp.status_code == 403, f"Expected 403 for {method} {url}, got {resp.status_code}"
            assert resp.get_json()["error"]["code"] == "FORBIDDEN"

    def test_password_hash_never_exposed(self, client, headers_responsable, sample_mecanicien):
        """Vérifie qu'aucun hash de mot de passe n'apparaît dans la réponse (Règle 5)."""
        response = client.get(f"/api/v1/mecaniciens/{sample_mecanicien.id_mecanicien}", headers=headers_responsable)
        raw_text = response.get_data(as_text=True)
        assert "$2b$" not in raw_text
        assert "mot_de_passe" not in raw_text
