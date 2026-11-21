"""Tests complets pour le module Client CRUD de GarageFlow.

Exécution isolée en mémoire avec SQLite (sqlite:///:memory:).
Aucune connexion à PostgreSQL, aucune modification de la base réelle et aucune migration.
"""
import pytest
from datetime import date, time
from flask_jwt_extended import create_access_token

from app import create_app
from app.extensions import db
from app.models import Client, Vehicule, RendezVous


@pytest.fixture
def client_app(monkeypatch):
    """Crée une instance d'application Flask isolée avec base SQLite en mémoire."""
    monkeypatch.setenv("TEST_DATABASE_URL", "sqlite:///:memory:")
    app = create_app("testing")
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(client_app):
    """Client de test HTTP Flask."""
    return client_app.test_client()


@pytest.fixture
def responsable_token(client_app):
    """Jeton JWT avec le rôle RESPONSABLE."""
    return create_access_token(
        identity="1",
        additional_claims={"role": "RESPONSABLE"},
    )


@pytest.fixture
def mecanicien_token(client_app):
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
def sample_client(client_app):
    """Client témoin en base."""
    c = Client(
        nom="Dupont",
        prenom="Jean",
        telephone="0123456789",
        adresse="10 Rue de Paris",
    )
    db.session.add(c)
    db.session.commit()
    return c


@pytest.fixture
def client_with_vehicle(client_app, sample_client):
    """Client associé à un véhicule (pour tester les conflits d'intégrité)."""
    v = Vehicule(
        marque="Peugeot",
        modele="208",
        immatriculation="AA-123-BB",
        annee=2021,
        kilometrage=35000,
        etat="BON",
        id_client=sample_client.id_client,
    )
    db.session.add(v)
    db.session.commit()
    return sample_client


@pytest.fixture
def client_with_appointment(client_app):
    """Client associé à un véhicule et un rendez-vous."""
    c = Client(
        nom="Durand",
        prenom="Paul",
        telephone="0611223344",
        adresse="5 Avenue Victor Hugo",
    )
    db.session.add(c)
    db.session.commit()

    v = Vehicule(
        marque="Renault",
        modele="Clio",
        immatriculation="CC-789-DD",
        annee=2019,
        kilometrage=60000,
        etat="MOYEN",
        id_client=c.id_client,
    )
    db.session.add(v)
    db.session.commit()

    rdv = RendezVous(
        date_rendezvous=date(2026, 12, 1),
        heure=time(10, 30),
        motif="Contrôle technique",
        statut="PLANIFIE",
        id_client=c.id_client,
        id_vehicule=v.id_vehicule,
    )
    db.session.add(rdv)
    db.session.commit()
    return c


# ============================================================================
# Tests de Création (POST /api/v1/clients)
# ============================================================================

class TestClientCreate:
    """Tests pour la création de client (POST /api/v1/clients)."""

    def test_create_client_success(self, client, headers_responsable):
        """Succès de création d'un client avec tous les champs valides."""
        payload = {
            "nom": "  Martin  ",
            "prenom": "  Pierre  ",
            "telephone": "0601020304",
            "adresse": "12 Boulevard Saint-Michel",
        }
        response = client.post("/api/v1/clients", json=payload, headers=headers_responsable)
        assert response.status_code == 201

        data = response.get_json()
        assert data["success"] is True
        assert data["message"] == "Client créé avec succès."
        assert data["data"]["nom"] == "Martin"
        assert data["data"]["prenom"] == "Pierre"
        assert data["data"]["telephone"] == "0601020304"
        assert data["data"]["adresse"] == "12 Boulevard Saint-Michel"
        assert isinstance(data["data"]["id_client"], int)

    def test_create_client_without_optional_address(self, client, headers_responsable):
        """Succès de création sans le champ optionnel adresse."""
        payload = {
            "nom": "Lefebvre",
            "prenom": "Claire",
            "telephone": "0701020304",
        }
        response = client.post("/api/v1/clients", json=payload, headers=headers_responsable)
        assert response.status_code == 201
        data = response.get_json()
        assert data["success"] is True
        assert data["data"]["adresse"] is None

    def test_create_client_missing_nom(self, client, headers_responsable):
        """Rejet HTTP 422 si le nom est manquant."""
        payload = {"prenom": "Claire", "telephone": "0701020304"}
        response = client.post("/api/v1/clients", json=payload, headers=headers_responsable)
        assert response.status_code == 422
        data = response.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"
        assert "nom" in data["error"]["details"]

    def test_create_client_missing_prenom(self, client, headers_responsable):
        """Rejet HTTP 422 si le prénom est manquant."""
        payload = {"nom": "Lefebvre", "telephone": "0701020304"}
        response = client.post("/api/v1/clients", json=payload, headers=headers_responsable)
        assert response.status_code == 422
        assert "prenom" in response.get_json()["error"]["details"]

    def test_create_client_missing_telephone(self, client, headers_responsable):
        """Rejet HTTP 422 si le téléphone est manquant."""
        payload = {"nom": "Lefebvre", "prenom": "Claire"}
        response = client.post("/api/v1/clients", json=payload, headers=headers_responsable)
        assert response.status_code == 422
        assert "telephone" in response.get_json()["error"]["details"]

    def test_create_client_empty_strings(self, client, headers_responsable):
        """Rejet HTTP 422 si les champs obligatoires ne contiennent que des espaces."""
        payload = {"nom": "   ", "prenom": "Claire", "telephone": "0701020304"}
        response = client.post("/api/v1/clients", json=payload, headers=headers_responsable)
        assert response.status_code == 422

    def test_create_client_field_length_exceeded(self, client, headers_responsable):
        """Rejet HTTP 422 si la longueur maximale d'un champ est dépassée."""
        payload = {
            "nom": "A" * 51,
            "prenom": "Claire",
            "telephone": "0701020304",
        }
        response = client.post("/api/v1/clients", json=payload, headers=headers_responsable)
        assert response.status_code == 422

    def test_create_client_non_json_body(self, client, headers_responsable):
        """Rejet HTTP 422 si le corps de requête n'est pas un JSON valide."""
        response = client.post(
            "/api/v1/clients",
            data="not a json",
            content_type="text/plain",
            headers=headers_responsable,
        )
        assert response.status_code == 422
        assert response.get_json()["error"]["code"] == "VALIDATION_ERROR"


# ============================================================================
# Tests de Lecture (GET /api/v1/clients et GET /api/v1/clients/<id>)
# ============================================================================

class TestClientRead:
    """Tests pour la lecture de clients (GET)."""

    def test_list_clients_empty(self, client, headers_responsable):
        """Retourne une liste vide HTTP 200 lorsqu'aucun client n'existe."""
        response = client.get("/api/v1/clients", headers=headers_responsable)
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert data["data"] == []

    def test_list_clients_populated(self, client, headers_responsable, sample_client):
        """Retourne la liste des clients existants."""
        response = client.get("/api/v1/clients", headers=headers_responsable)
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert len(data["data"]) == 1
        assert data["data"][0]["id_client"] == sample_client.id_client
        assert data["data"][0]["nom"] == "Dupont"

    def test_list_clients_search_filter(self, client, headers_responsable, sample_client):
        """Filtre les clients via le paramètre de requête ?search=."""
        # Recherche correspondant au client existant
        resp_found = client.get("/api/v1/clients?search=dupont", headers=headers_responsable)
        assert resp_found.status_code == 200
        assert len(resp_found.get_json()["data"]) == 1

        # Recherche ne correspondant à aucun client
        resp_none = client.get("/api/v1/clients?search=introuvable", headers=headers_responsable)
        assert resp_none.status_code == 200
        assert len(resp_none.get_json()["data"]) == 0

    def test_get_client_by_id_success(self, client, headers_responsable, sample_client):
        """Récupère un client existant par son identifiant unique."""
        response = client.get(f"/api/v1/clients/{sample_client.id_client}", headers=headers_responsable)
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert data["data"]["id_client"] == sample_client.id_client
        assert data["data"]["nom"] == sample_client.nom
        assert data["data"]["prenom"] == sample_client.prenom

    def test_get_client_by_id_not_found(self, client, headers_responsable):
        """Retourne HTTP 404 NOT_FOUND si l'identifiant n'existe pas."""
        response = client.get("/api/v1/clients/99999", headers=headers_responsable)
        assert response.status_code == 404
        data = response.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"


# ============================================================================
# Tests de Mise à jour (PUT/PATCH /api/v1/clients/<id>)
# ============================================================================

class TestClientUpdate:
    """Tests pour la mise à jour de client (PUT / PATCH)."""

    def test_update_client_partial_success(self, client, headers_responsable, sample_client):
        """Mise à jour partielle : modifie uniquement le téléphone."""
        payload = {"telephone": "0699887766"}
        response = client.put(
            f"/api/v1/clients/{sample_client.id_client}",
            json=payload,
            headers=headers_responsable,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert data["message"] == "Client mis à jour avec succès."
        assert data["data"]["telephone"] == "0699887766"
        assert data["data"]["nom"] == sample_client.nom
        assert data["data"]["prenom"] == sample_client.prenom

    def test_update_client_all_fields_success(self, client, headers_responsable, sample_client):
        """Mise à jour de l'ensemble des champs du client."""
        payload = {
            "nom": "Dupont-Modifie",
            "prenom": "Jean-Marc",
            "telephone": "0199887766",
            "adresse": "20 Rue de la République",
        }
        response = client.put(
            f"/api/v1/clients/{sample_client.id_client}",
            json=payload,
            headers=headers_responsable,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["nom"] == "Dupont-Modifie"
        assert data["data"]["prenom"] == "Jean-Marc"
        assert data["data"]["telephone"] == "0199887766"
        assert data["data"]["adresse"] == "20 Rue de la République"

    def test_update_client_empty_payload_rejected(self, client, headers_responsable, sample_client):
        """Rejet HTTP 422 si le corps de mise à jour est un objet JSON vide ({})."""
        response = client.put(
            f"/api/v1/clients/{sample_client.id_client}",
            json={},
            headers=headers_responsable,
        )
        assert response.status_code == 422
        data = response.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    def test_update_client_not_found(self, client, headers_responsable):
        """Retourne HTTP 404 si le client à mettre à jour n'existe pas."""
        response = client.put(
            "/api/v1/clients/99999",
            json={"nom": "NouveauNom"},
            headers=headers_responsable,
        )
        assert response.status_code == 404
        assert response.get_json()["error"]["code"] == "NOT_FOUND"

    def test_update_client_invalid_field_data(self, client, headers_responsable, sample_client):
        """Rejet HTTP 422 si une valeur modifiée viole une contrainte de longueur."""
        response = client.put(
            f"/api/v1/clients/{sample_client.id_client}",
            json={"telephone": "0" * 25},
            headers=headers_responsable,
        )
        assert response.status_code == 422


# ============================================================================
# Tests de Suppression (DELETE /api/v1/clients/<id>)
# ============================================================================

class TestClientDelete:
    """Tests pour la suppression de client (DELETE)."""

    def test_delete_client_success(self, client, headers_responsable, sample_client):
        """Suppression réussie d'un client sans enregistrements liés."""
        client_id = sample_client.id_client
        response = client.delete(f"/api/v1/clients/{client_id}", headers=headers_responsable)
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert data["message"] == "Client supprimé avec succès."
        assert data["data"]["id_client"] == client_id

        # Vérification en base que le client est bien supprimé
        get_resp = client.get(f"/api/v1/clients/{client_id}", headers=headers_responsable)
        assert get_resp.status_code == 404

    def test_delete_client_not_found(self, client, headers_responsable):
        """Retourne HTTP 404 si le client à supprimer n'existe pas."""
        response = client.delete("/api/v1/clients/99999", headers=headers_responsable)
        assert response.status_code == 404
        assert response.get_json()["error"]["code"] == "NOT_FOUND"

    def test_delete_client_conflict_with_vehicles(self, client, headers_responsable, client_with_vehicle):
        """Retourne HTTP 409 CONFLICT si le client possède des véhicules rattachés."""
        client_id = client_with_vehicle.id_client
        response = client.delete(f"/api/v1/clients/{client_id}", headers=headers_responsable)
        assert response.status_code == 409
        data = response.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "CONFLICT"
        assert "véhicule" in data["error"]["message"].lower()

        # Vérification que le client n'a PAS été supprimé (protection historique)
        get_resp = client.get(f"/api/v1/clients/{client_id}", headers=headers_responsable)
        assert get_resp.status_code == 200

    def test_delete_client_conflict_with_appointments(self, client, headers_responsable, client_with_appointment):
        """Retourne HTTP 409 CONFLICT si le client possède des rendez-vous rattachés."""
        client_id = client_with_appointment.id_client
        response = client.delete(f"/api/v1/clients/{client_id}", headers=headers_responsable)
        assert response.status_code == 409
        data = response.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "CONFLICT"
        assert "rendez-vous" in data["error"]["message"].lower()


# ============================================================================
# Tests d'Autorisation et Sécurité (401 Unauthorized / 403 Forbidden)
# ============================================================================

class TestClientSecurityAndRoles:
    """Tests vérifiant l'application stricte du contrôle d'accès RBAC et JWT."""

    def test_endpoints_unauthorized_without_jwt(self, client, sample_client):
        """Toutes les opérations protégées doivent renvoyer HTTP 401 sans jeton JWT."""
        c_id = sample_client.id_client
        endpoints = [
            ("GET", "/api/v1/clients", None),
            ("POST", "/api/v1/clients", {"nom": "A", "prenom": "B", "telephone": "0102"}),
            ("GET", f"/api/v1/clients/{c_id}", None),
            ("PUT", f"/api/v1/clients/{c_id}", {"nom": "Updated"}),
            ("DELETE", f"/api/v1/clients/{c_id}", None),
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

    def test_endpoints_forbidden_for_mecanicien(self, client, headers_mecanicien, sample_client):
        """Le rôle MECANICIEN doit être rejeté avec HTTP 403 FORBIDDEN sur tous les endpoints."""
        c_id = sample_client.id_client
        endpoints = [
            ("GET", "/api/v1/clients", None),
            ("POST", "/api/v1/clients", {"nom": "A", "prenom": "B", "telephone": "0102"}),
            ("GET", f"/api/v1/clients/{c_id}", None),
            ("PUT", f"/api/v1/clients/{c_id}", {"nom": "Updated"}),
            ("DELETE", f"/api/v1/clients/{c_id}", None),
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
            data = resp.get_json()
            assert data["success"] is False
            assert data["error"]["code"] == "FORBIDDEN"
