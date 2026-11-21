"""Tests complets pour le module Véhicule CRUD de GarageFlow.

Exécution isolée en mémoire avec SQLite (sqlite:///:memory:).
Aucune connexion à PostgreSQL, aucune modification de la base réelle et aucune migration.
"""
import pytest
from datetime import date, time
from flask_jwt_extended import create_access_token

from app import create_app
from app.extensions import db
from app.models import Client, Vehicule, Reparation, Mecanicien, Utilisateur, RendezVous


@pytest.fixture
def vehicule_app(monkeypatch):
    """Crée une instance d'application Flask isolée avec base SQLite en mémoire."""
    monkeypatch.setenv("TEST_DATABASE_URL", "sqlite:///:memory:")
    app = create_app("testing")
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(vehicule_app):
    """Client de test HTTP Flask."""
    return vehicule_app.test_client()


@pytest.fixture
def responsable_token(vehicule_app):
    """Jeton JWT avec le rôle RESPONSABLE."""
    return create_access_token(
        identity="1",
        additional_claims={"role": "RESPONSABLE"},
    )


@pytest.fixture
def mecanicien_token(vehicule_app):
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
def sample_client(vehicule_app):
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
def second_client(vehicule_app):
    """Second client témoin pour tester le changement de propriétaire."""
    c = Client(
        nom="Martin",
        prenom="Sophie",
        telephone="0611223344",
        adresse="15 Rue de Lyon",
    )
    db.session.add(c)
    db.session.commit()
    return c


@pytest.fixture
def sample_vehicule(vehicule_app, sample_client):
    """Véhicule témoin en base."""
    v = Vehicule(
        marque="Renault",
        modele="Clio 5",
        immatriculation="205 TU 4589",
        annee=2021,
        kilometrage=45000,
        etat="BON",
        id_client=sample_client.id_client,
    )
    db.session.add(v)
    db.session.commit()
    return v


@pytest.fixture
def vehicule_with_repair(vehicule_app, sample_client):
    """Véhicule avec une réparation rattachée (pour tester le conflit de suppression)."""
    u = Utilisateur(
        nom="Meca",
        prenom="Bob",
        email="bob.meca@garageflow.fr",
        role="MECANICIEN",
    )
    u.set_password("SecurePass123!")
    db.session.add(u)
    db.session.commit()

    m = Mecanicien(specialite="Diagnostic", id_utilisateur=u.id_utilisateur)
    db.session.add(m)
    db.session.commit()

    v = Vehicule(
        marque="Peugeot",
        modele="308",
        immatriculation="206 TU 1234",
        annee=2019,
        kilometrage=75000,
        etat="EN_PANNE",
        id_client=sample_client.id_client,
    )
    db.session.add(v)
    db.session.commit()

    rep = Reparation(
        description="Remplacement courroie de distribution",
        date_reparation=date(2026, 11, 15),
        statut="EN_COURS",
        id_vehicule=v.id_vehicule,
        id_mecanicien=m.id_mecanicien,
    )
    db.session.add(rep)
    db.session.commit()
    return v


@pytest.fixture
def vehicule_with_appointment(vehicule_app, sample_client):
    """Véhicule avec un rendez-vous rattaché (pour tester le conflit de suppression)."""
    v = Vehicule(
        marque="Citroen",
        modele="C3",
        immatriculation="207 TU 9876",
        annee=2020,
        kilometrage=30000,
        etat="BON",
        id_client=sample_client.id_client,
    )
    db.session.add(v)
    db.session.commit()

    rdv = RendezVous(
        date_rendezvous=date(2026, 12, 10),
        heure=time(14, 0),
        motif="Révision annuelle",
        statut="CONFIRME",
        id_client=sample_client.id_client,
        id_vehicule=v.id_vehicule,
    )
    db.session.add(rdv)
    db.session.commit()
    return v


# ============================================================================
# Tests de Création (POST /api/v1/vehicules)
# ============================================================================

class TestVehiculeCreate:
    """Tests pour la création de véhicule (POST /api/v1/vehicules)."""

    def test_create_vehicule_success(self, client, headers_responsable, sample_client):
        """Succès de création d'un véhicule avec tous les champs valides."""
        payload = {
            "marque": "  Peugeot  ",
            "modele": "  208  ",
            "immatriculation": "  215 tu 4589  ",
            "annee": 2022,
            "kilometrage": 15000,
            "etat": "EXCELLENT",
            "id_client": sample_client.id_client,
        }
        response = client.post("/api/v1/vehicules", json=payload, headers=headers_responsable)
        assert response.status_code == 201

        data = response.get_json()
        assert data["success"] is True
        assert data["message"] == "Véhicule créé avec succès."
        assert data["data"]["marque"] == "Peugeot"
        assert data["data"]["modele"] == "208"
        assert data["data"]["immatriculation"] == "215 TU 4589"  # Nettoyé et majuscules
        assert data["data"]["annee"] == 2022
        assert data["data"]["kilometrage"] == 15000
        assert data["data"]["etat"] == "EXCELLENT"
        assert data["data"]["id_client"] == sample_client.id_client
        assert isinstance(data["data"]["id_vehicule"], int)

    def test_create_vehicule_with_optional_fields_none(self, client, headers_responsable, sample_client):
        """Succès de création avec uniquement les champs obligatoires."""
        payload = {
            "marque": "Toyota",
            "modele": "Yaris",
            "immatriculation": "216 TU 1111",
            "id_client": sample_client.id_client,
        }
        response = client.post("/api/v1/vehicules", json=payload, headers=headers_responsable)
        assert response.status_code == 201
        data = response.get_json()
        assert data["data"]["annee"] is None
        assert data["data"]["kilometrage"] is None
        assert data["data"]["etat"] is None

    def test_create_vehicule_nonexistent_client(self, client, headers_responsable):
        """Rejet HTTP 404 NOT_FOUND si le client rattaché n'existe pas."""
        payload = {
            "marque": "Toyota",
            "modele": "Yaris",
            "immatriculation": "217 TU 2222",
            "id_client": 99999,
        }
        response = client.post("/api/v1/vehicules", json=payload, headers=headers_responsable)
        assert response.status_code == 404
        data = response.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"

    def test_create_vehicule_rejects_foreign_plate(self, client, headers_responsable, sample_client):
        """Rejet HTTP 422 si l'immatriculation est un format étranger (ex: plaque française)."""
        payload = {
            "marque": "Peugeot",
            "modele": "208",
            "immatriculation": "AA-123-BB",
            "id_client": sample_client.id_client,
        }
        response = client.post("/api/v1/vehicules", json=payload, headers=headers_responsable)
        assert response.status_code == 422
        assert "immatriculation" in response.get_json()["error"]["details"]

    def test_create_vehicule_duplicate_immatriculation(self, client, headers_responsable, sample_vehicule):
        """Rejet HTTP 409 CONFLICT en cas d'immatriculation déjà existante."""
        payload = {
            "marque": "Volkswagen",
            "modele": "Golf",
            "immatriculation": sample_vehicule.immatriculation,  # Doublon
            "id_client": sample_vehicule.id_client,
        }
        response = client.post("/api/v1/vehicules", json=payload, headers=headers_responsable)
        assert response.status_code == 409
        data = response.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "CONFLICT"

    def test_create_vehicule_missing_required_fields(self, client, headers_responsable, sample_client):
        """Rejet HTTP 422 si un champ obligatoire est manquant."""
        # Marque manquante
        resp_no_marque = client.post(
            "/api/v1/vehicules",
            json={"modele": "Clio", "immatriculation": "218 TU 3333", "id_client": sample_client.id_client},
            headers=headers_responsable,
        )
        assert resp_no_marque.status_code == 422
        assert "marque" in resp_no_marque.get_json()["error"]["details"]

        # Modèle manquant
        resp_no_modele = client.post(
            "/api/v1/vehicules",
            json={"marque": "Renault", "immatriculation": "218 TU 3333", "id_client": sample_client.id_client},
            headers=headers_responsable,
        )
        assert resp_no_modele.status_code == 422
        assert "modele" in resp_no_modele.get_json()["error"]["details"]

        # Immatriculation manquante
        resp_no_immat = client.post(
            "/api/v1/vehicules",
            json={"marque": "Renault", "modele": "Clio", "id_client": sample_client.id_client},
            headers=headers_responsable,
        )
        assert resp_no_immat.status_code == 422
        assert "immatriculation" in resp_no_immat.get_json()["error"]["details"]

        # Client manquant
        resp_no_client = client.post(
            "/api/v1/vehicules",
            json={"marque": "Renault", "modele": "Clio", "immatriculation": "218 TU 3333"},
            headers=headers_responsable,
        )
        assert resp_no_client.status_code == 422
        assert "id_client" in resp_no_client.get_json()["error"]["details"]

    def test_create_vehicule_invalid_field_lengths_and_types(self, client, headers_responsable, sample_client):
        """Rejet HTTP 422 si un champ dépasse la taille autorisée ou a une valeur hors limite."""
        payload_long_marque = {
            "marque": "A" * 51,
            "modele": "208",
            "immatriculation": "219 TU 4444",
            "id_client": sample_client.id_client,
        }
        resp1 = client.post("/api/v1/vehicules", json=payload_long_marque, headers=headers_responsable)
        assert resp1.status_code == 422

        payload_invalid_annee = {
            "marque": "Peugeot",
            "modele": "208",
            "immatriculation": "219 TU 4444",
            "annee": 1850,  # Année invalide
            "id_client": sample_client.id_client,
        }
        resp2 = client.post("/api/v1/vehicules", json=payload_invalid_annee, headers=headers_responsable)
        assert resp2.status_code == 422

        payload_negative_km = {
            "marque": "Peugeot",
            "modele": "208",
            "immatriculation": "219 TU 4444",
            "kilometrage": -50,  # Kilométrage négatif
            "id_client": sample_client.id_client,
        }
        resp3 = client.post("/api/v1/vehicules", json=payload_negative_km, headers=headers_responsable)
        assert resp3.status_code == 422

    def test_create_vehicule_non_json_body(self, client, headers_responsable):
        """Rejet HTTP 422 si le corps de la requête n'est pas du JSON."""
        response = client.post(
            "/api/v1/vehicules",
            data="invalid payload",
            content_type="text/plain",
            headers=headers_responsable,
        )
        assert response.status_code == 422
        assert response.get_json()["error"]["code"] == "VALIDATION_ERROR"


# ============================================================================
# Tests de Lecture (GET /api/v1/vehicules et GET /api/v1/vehicules/<id>)
# ============================================================================

class TestVehiculeRead:
    """Tests pour la consultation des véhicules (GET)."""

    def test_list_vehicules_empty(self, client, headers_responsable):
        """Retourne une liste vide HTTP 200 lorsqu'aucun véhicule n'existe."""
        response = client.get("/api/v1/vehicules", headers=headers_responsable)
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert data["data"] == []

    def test_list_vehicules_populated(self, client, headers_responsable, sample_vehicule):
        """Retourne la liste des véhicules existants."""
        response = client.get("/api/v1/vehicules", headers=headers_responsable)
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert len(data["data"]) == 1
        assert data["data"][0]["immatriculation"] == sample_vehicule.immatriculation

    def test_list_vehicules_filter_by_client_id(self, client, headers_responsable, sample_vehicule, second_client):
        """Filtre les véhicules par l'identifiant du client (?id_client=)."""
        # Véhicule appartenant à sample_client
        resp_found = client.get(
            f"/api/v1/vehicules?id_client={sample_vehicule.id_client}",
            headers=headers_responsable,
        )
        assert resp_found.status_code == 200
        assert len(resp_found.get_json()["data"]) == 1

        # Client sans véhicule
        resp_empty = client.get(
            f"/api/v1/vehicules?id_client={second_client.id_client}",
            headers=headers_responsable,
        )
        assert resp_empty.status_code == 200
        assert len(resp_empty.get_json()["data"]) == 0

    def test_list_vehicules_filter_by_invalid_client_id(self, client, headers_responsable):
        """Rejet HTTP 422 si le paramètre id_client n'est pas un entier."""
        response = client.get("/api/v1/vehicules?id_client=not_an_int", headers=headers_responsable)
        assert response.status_code == 422
        assert response.get_json()["error"]["code"] == "VALIDATION_ERROR"

    def test_list_vehicules_filter_by_immatriculation(self, client, headers_responsable, sample_vehicule):
        """Filtre les véhicules par immatriculation (?immatriculation=)."""
        resp_found = client.get(
            f"/api/v1/vehicules?immatriculation={sample_vehicule.immatriculation}",
            headers=headers_responsable,
        )
        assert resp_found.status_code == 200
        assert len(resp_found.get_json()["data"]) == 1

        resp_none = client.get(
            "/api/v1/vehicules?immatriculation=INCONNU-999",
            headers=headers_responsable,
        )
        assert resp_none.status_code == 200
        assert len(resp_none.get_json()["data"]) == 0

    def test_list_vehicules_search(self, client, headers_responsable, sample_vehicule):
        """Recherche textuelle sur marque, modèle ou immatriculation (?search=)."""
        resp_search = client.get("/api/v1/vehicules?search=clio", headers=headers_responsable)
        assert resp_search.status_code == 200
        assert len(resp_search.get_json()["data"]) == 1

    def test_get_vehicule_by_id_success(self, client, headers_responsable, sample_vehicule):
        """Récupère un véhicule par son identifiant."""
        response = client.get(f"/api/v1/vehicules/{sample_vehicule.id_vehicule}", headers=headers_responsable)
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert data["data"]["id_vehicule"] == sample_vehicule.id_vehicule
        assert data["data"]["marque"] == sample_vehicule.marque

    def test_get_vehicule_by_id_not_found(self, client, headers_responsable):
        """Retourne HTTP 404 NOT_FOUND si le véhicule n'existe pas."""
        response = client.get("/api/v1/vehicules/99999", headers=headers_responsable)
        assert response.status_code == 404
        assert response.get_json()["error"]["code"] == "NOT_FOUND"

    def test_mecanicien_can_read_vehicules(self, client, headers_mecanicien, sample_vehicule):
        """Conformité UML (UC12) : Le Mécanicien a le droit de consulter les véhicules (GET)."""
        resp_list = client.get("/api/v1/vehicules", headers=headers_mecanicien)
        assert resp_list.status_code == 200

        resp_get = client.get(f"/api/v1/vehicules/{sample_vehicule.id_vehicule}", headers=headers_mecanicien)
        assert resp_get.status_code == 200


# ============================================================================
# Tests de Mise à jour (PUT/PATCH /api/v1/vehicules/<id>)
# ============================================================================

class TestVehiculeUpdate:
    """Tests pour la mise à jour de véhicule (PUT / PATCH)."""

    def test_update_vehicule_partial_success(self, client, headers_responsable, sample_vehicule):
        """Mise à jour partielle (ex: kilométrage et état)."""
        payload = {"kilometrage": 52000, "etat": "TRES_BON"}
        response = client.put(
            f"/api/v1/vehicules/{sample_vehicule.id_vehicule}",
            json=payload,
            headers=headers_responsable,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert data["message"] == "Véhicule mis à jour avec succès."
        assert data["data"]["kilometrage"] == 52000
        assert data["data"]["etat"] == "TRES_BON"
        assert data["data"]["marque"] == sample_vehicule.marque

    def test_update_vehicule_all_fields_success(self, client, headers_responsable, sample_vehicule, second_client):
        """Mise à jour complète incluant le changement de propriétaire."""
        payload = {
            "marque": "Renault-Modifie",
            "modele": "Clio 5 Phase 2",
            "immatriculation": "220 TU 5555",
            "annee": 2023,
            "kilometrage": 60000,
            "etat": "EXCELLENT",
            "id_client": second_client.id_client,
        }
        response = client.put(
            f"/api/v1/vehicules/{sample_vehicule.id_vehicule}",
            json=payload,
            headers=headers_responsable,
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["data"]["marque"] == "Renault-Modifie"
        assert data["data"]["immatriculation"] == "220 TU 5555"
        assert data["data"]["id_client"] == second_client.id_client

    def test_update_vehicule_change_client_not_found(self, client, headers_responsable, sample_vehicule):
        """Rejet HTTP 404 si le nouveau propriétaire spécifié n'existe pas."""
        response = client.put(
            f"/api/v1/vehicules/{sample_vehicule.id_vehicule}",
            json={"id_client": 99999},
            headers=headers_responsable,
        )
        assert response.status_code == 404
        assert response.get_json()["error"]["code"] == "NOT_FOUND"

    def test_update_vehicule_duplicate_immatriculation(self, client, headers_responsable, sample_vehicule, sample_client):
        """Rejet HTTP 409 si la nouvelle immatriculation est déjà portée par un autre véhicule."""
        # Création d'un second véhicule
        v2 = Vehicule(
            marque="Ford",
            modele="Fiesta",
            immatriculation="221 TU 6666",
            id_client=sample_client.id_client,
        )
        db.session.add(v2)
        db.session.commit()

        # Tentative d'attribuer l'immatriculation de v2 à sample_vehicule
        response = client.put(
            f"/api/v1/vehicules/{sample_vehicule.id_vehicule}",
            json={"immatriculation": "221 TU 6666"},
            headers=headers_responsable,
        )
        assert response.status_code == 409
        assert response.get_json()["error"]["code"] == "CONFLICT"

    def test_update_vehicule_empty_payload_rejected(self, client, headers_responsable, sample_vehicule):
        """Rejet HTTP 422 si le corps de mise à jour est un objet JSON vide ({})."""
        response = client.put(
            f"/api/v1/vehicules/{sample_vehicule.id_vehicule}",
            json={},
            headers=headers_responsable,
        )
        assert response.status_code == 422
        assert response.get_json()["error"]["code"] == "VALIDATION_ERROR"

    def test_update_vehicule_not_found(self, client, headers_responsable):
        """Retourne HTTP 404 si le véhicule à mettre à jour n'existe pas."""
        response = client.put(
            "/api/v1/vehicules/99999",
            json={"marque": "NouvelleMarque"},
            headers=headers_responsable,
        )
        assert response.status_code == 404
        assert response.get_json()["error"]["code"] == "NOT_FOUND"

    def test_update_vehicule_invalid_fields(self, client, headers_responsable, sample_vehicule):
        """Rejet HTTP 422 sur valeur invalide (ex: kilométrage négatif)."""
        response = client.put(
            f"/api/v1/vehicules/{sample_vehicule.id_vehicule}",
            json={"kilometrage": -10},
            headers=headers_responsable,
        )
        assert response.status_code == 422


# ============================================================================
# Tests de Suppression (DELETE /api/v1/vehicules/<id>)
# ============================================================================

class TestVehiculeDelete:
    """Tests pour la suppression de véhicule (DELETE)."""

    def test_delete_vehicule_success(self, client, headers_responsable, sample_vehicule):
        """Suppression réussie d'un véhicule orphelin de réparations et de rendez-vous."""
        v_id = sample_vehicule.id_vehicule
        response = client.delete(f"/api/v1/vehicules/{v_id}", headers=headers_responsable)
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert data["message"] == "Véhicule supprimé avec succès."
        assert data["data"]["id_vehicule"] == v_id

        # Vérification en base qu'il est bien supprimé
        get_resp = client.get(f"/api/v1/vehicules/{v_id}", headers=headers_responsable)
        assert get_resp.status_code == 404

    def test_delete_vehicule_not_found(self, client, headers_responsable):
        """Retourne HTTP 404 si le véhicule à supprimer n'existe pas."""
        response = client.delete("/api/v1/vehicules/99999", headers=headers_responsable)
        assert response.status_code == 404
        assert response.get_json()["error"]["code"] == "NOT_FOUND"

    def test_delete_vehicule_conflict_with_repairs(self, client, headers_responsable, vehicule_with_repair):
        """Retourne HTTP 409 CONFLICT si le véhicule possède des réparations rattachées."""
        v_id = vehicule_with_repair.id_vehicule
        response = client.delete(f"/api/v1/vehicules/{v_id}", headers=headers_responsable)
        assert response.status_code == 409
        data = response.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "CONFLICT"
        assert "réparation" in data["error"]["message"].lower()

        # Vérifie que le véhicule n'a pas été supprimé
        get_resp = client.get(f"/api/v1/vehicules/{v_id}", headers=headers_responsable)
        assert get_resp.status_code == 200

    def test_delete_vehicule_conflict_with_appointments(self, client, headers_responsable, vehicule_with_appointment):
        """Retourne HTTP 409 CONFLICT si le véhicule possède des rendez-vous rattachés."""
        v_id = vehicule_with_appointment.id_vehicule
        response = client.delete(f"/api/v1/vehicules/{v_id}", headers=headers_responsable)
        assert response.status_code == 409
        data = response.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "CONFLICT"
        assert "rendez-vous" in data["error"]["message"].lower()


# ============================================================================
# Tests d'Autorisation et Sécurité (401 Unauthorized / 403 Forbidden)
# ============================================================================

class TestVehiculeSecurityAndRoles:
    """Tests vérifiant l'application stricte du contrôle d'accès RBAC et JWT."""

    def test_endpoints_unauthorized_without_jwt(self, client, sample_vehicule):
        """Toutes les opérations protégées doivent renvoyer HTTP 401 sans jeton JWT."""
        v_id = sample_vehicule.id_vehicule
        endpoints = [
            ("GET", "/api/v1/vehicules", None),
            ("POST", "/api/v1/vehicules", {"marque": "A", "modele": "B", "immatriculation": "X", "id_client": 1}),
            ("GET", f"/api/v1/vehicules/{v_id}", None),
            ("PUT", f"/api/v1/vehicules/{v_id}", {"marque": "Updated"}),
            ("DELETE", f"/api/v1/vehicules/{v_id}", None),
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

    def test_write_endpoints_forbidden_for_mecanicien(self, client, headers_mecanicien, sample_vehicule, sample_client):
        """Le rôle MECANICIEN est interdit (HTTP 403 FORBIDDEN) sur les opérations d'écriture (POST, PUT, DELETE)."""
        v_id = sample_vehicule.id_vehicule
        write_endpoints = [
            ("POST", "/api/v1/vehicules", {
                "marque": "A",
                "modele": "B",
                "immatriculation": "NEW-123",
                "id_client": sample_client.id_client,
            }),
            ("PUT", f"/api/v1/vehicules/{v_id}", {"marque": "ForbiddenUpdate"}),
            ("DELETE", f"/api/v1/vehicules/{v_id}", None),
        ]
        for method, url, payload in write_endpoints:
            if method == "POST":
                resp = client.post(url, json=payload, headers=headers_mecanicien)
            elif method == "PUT":
                resp = client.put(url, json=payload, headers=headers_mecanicien)
            elif method == "DELETE":
                resp = client.delete(url, headers=headers_mecanicien)

            assert resp.status_code == 403, f"Expected 403 for {method} {url}, got {resp.status_code}"
            data = resp.get_json()
            assert data["success"] is False
            assert data["error"]["code"] == "FORBIDDEN"
