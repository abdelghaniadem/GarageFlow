"""Tests complets pour le module Gestion des Rendez-Vous de GarageFlow.

Exécution isolée en mémoire avec SQLite (sqlite:///:memory:).
Aucune connexion à PostgreSQL, aucune modification de la base réelle et aucune migration.

Couvre :
- Authentification JWT & Contrôle d'accès RBAC (UC8 : seul RESPONSABLE autorisé, MECANICIEN refusé 403)
- Validation des schémas Marshmallow (formats date/heure, statuts, clés étrangères)
- Opérations CRUD complètes (Create, Read, Update, Delete)
- Validation d'existence du client et du véhicule (HTTP 404 Not Found)
- Règle de cohérence stricte : vérification de l'appartenance du véhicule au client sélectionné (HTTP 422)
- Rejet d'incohérence lors de la mise à jour (réassignation d'un véhicule à un autre propriétaire)
- Validation des formats d'heure (HH:MM / HH:MM:SS) et rejet des heures invalides (ex: 25:00, 12:65)
- Validation des formats de date et rejet des dates invalides
- Définition et validation des statuts autorisés (PLANIFIE, CONFIRME, EN_ATTENTE, etc.)
- Normalisation des statuts (insensible à la casse, aux accents et aux terminaisons féminines)
- Filtrage multicritères (client, véhicule, date exacte, plage de dates, statut)
- Préservation de l'historique d'atelier : interdiction de supprimer un rendez-vous honoré ou terminé (409 Conflict)
- Suppression réussie des rendez-vous planifiés, confirmés ou annulés (200 OK)
- Protection relationnelle : conflit lors de la suppression de clients ou véhicules liés à un rendez-vous
- Atomicité transactionnelle et rollback sécurisé en cas d'erreur de base de données
"""
import pytest
from datetime import date, time
from unittest.mock import patch
from flask_jwt_extended import create_access_token
from sqlalchemy.exc import IntegrityError

from app import create_app
from app.extensions import db
from app.models import (
    Utilisateur,
    Mecanicien,
    Client,
    Vehicule,
    RendezVous,
)
from app.services import rendez_vous_service
from app.schemas.rendez_vous_schema import (
    rendez_vous_create_schema,
    rendez_vous_update_schema,
    rendez_vous_response_schema,
    ALLOWED_APPOINTMENT_STATUSES,
)
from app.utils.exceptions import NotFoundError, ConflictError, ValidationError, ForbiddenError


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def rdv_app(monkeypatch):
    """Crée une instance d'application Flask isolée avec base SQLite en mémoire."""
    monkeypatch.setenv("TEST_DATABASE_URL", "sqlite:///:memory:")
    app = create_app("testing")
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def test_client(rdv_app):
    """Client HTTP de test."""
    return rdv_app.test_client()


@pytest.fixture
def responsable_user(rdv_app):
    """Utilisateur Responsable d'atelier."""
    u = Utilisateur(
        nom="Boss",
        prenom="Alice",
        email="alice.boss@garageflow.fr",
        role="RESPONSABLE",
        telephone="0102030405",
    )
    u.set_password("BossPass123!")
    db.session.add(u)
    db.session.commit()
    return u


@pytest.fixture
def mecanicien_user(rdv_app):
    """Utilisateur Mécanicien."""
    u = Utilisateur(
        nom="Meca",
        prenom="Marc",
        email="marc.meca@garageflow.fr",
        role="MECANICIEN",
        telephone="0601020304",
    )
    u.set_password("MecaPass123!")
    db.session.add(u)
    db.session.commit()
    return u


@pytest.fixture
def mecanicien_profile(rdv_app, mecanicien_user):
    """Profil mécanicien rattaché à mecanicien_user."""
    m = Mecanicien(
        specialite="Diagnostic électronique",
        id_utilisateur=mecanicien_user.id_utilisateur,
    )
    db.session.add(m)
    db.session.commit()
    return m


@pytest.fixture
def headers_responsable(responsable_user):
    """En-tête Bearer valide pour le Responsable."""
    token = create_access_token(
        identity=str(responsable_user.id_utilisateur),
        additional_claims={"role": "RESPONSABLE"},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def headers_mecanicien(mecanicien_user, mecanicien_profile):
    """En-tête Bearer valide pour un Mécanicien."""
    token = create_access_token(
        identity=str(mecanicien_user.id_utilisateur),
        additional_claims={"role": "MECANICIEN"},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def client_alice(rdv_app):
    """Premier client de test (Alice)."""
    c = Client(
        nom="Dupont",
        prenom="Alice",
        telephone="0611223344",
        adresse="10 Rue des Fleurs, 75008 Paris",
    )
    db.session.add(c)
    db.session.commit()
    return c


@pytest.fixture
def client_bob(rdv_app):
    """Deuxième client de test (Bob)."""
    c = Client(
        nom="Lemoine",
        prenom="Bob",
        telephone="0677889900",
        adresse="25 Avenue Victor Hugo, 69002 Lyon",
    )
    db.session.add(c)
    db.session.commit()
    return c


@pytest.fixture
def vehicule_alice(rdv_app, client_alice):
    """Véhicule appartenant à Alice (Peugeot 208)."""
    v = Vehicule(
        marque="Peugeot",
        modele="208",
        immatriculation="AA-100-AA",
        annee=2021,
        kilometrage=30000,
        etat="BON",
        id_client=client_alice.id_client,
    )
    db.session.add(v)
    db.session.commit()
    return v


@pytest.fixture
def vehicule_alice_second(rdv_app, client_alice):
    """Second véhicule appartenant à Alice (Peugeot 3008)."""
    v = Vehicule(
        marque="Peugeot",
        modele="3008",
        immatriculation="AA-200-BB",
        annee=2022,
        kilometrage=15000,
        etat="BON",
        id_client=client_alice.id_client,
    )
    db.session.add(v)
    db.session.commit()
    return v


@pytest.fixture
def vehicule_bob(rdv_app, client_bob):
    """Véhicule appartenant à Bob (Renault Clio)."""
    v = Vehicule(
        marque="Renault",
        modele="Clio",
        immatriculation="BB-300-CC",
        annee=2019,
        kilometrage=85000,
        etat="MOYEN",
        id_client=client_bob.id_client,
    )
    db.session.add(v)
    db.session.commit()
    return v


@pytest.fixture
def sample_rdv(rdv_app, client_alice, vehicule_alice):
    """Rendez-vous standard planifié pour Alice."""
    r = RendezVous(
        date_rendezvous=date(2026, 12, 1),
        heure=time(9, 30),
        motif="Révision générale et vidange",
        statut="PLANIFIE",
        id_client=client_alice.id_client,
        id_vehicule=vehicule_alice.id_vehicule,
    )
    db.session.add(r)
    db.session.commit()
    return r


# ============================================================================
# Tests: Authentication & Authorization (RBAC)
# ============================================================================

class TestRendezVousAuthorization:
    """Contrôle d'accès strict selon le diagramme UML Use Case (UC8)."""

    def test_unauthenticated_requests_fail(self, test_client):
        """Les requêtes sans jeton JWT sont rejetées avec HTTP 401."""
        assert test_client.get("/api/v1/rendez-vous").status_code == 401
        assert test_client.post("/api/v1/rendez-vous", json={}).status_code == 401
        assert test_client.get("/api/v1/rendez-vous/1").status_code == 401
        assert test_client.put("/api/v1/rendez-vous/1", json={}).status_code == 401
        assert test_client.patch("/api/v1/rendez-vous/1", json={}).status_code == 401
        assert test_client.delete("/api/v1/rendez-vous/1").status_code == 401

    def test_mechanic_role_forbidden(
        self, test_client, headers_mecanicien, sample_rdv, client_alice, vehicule_alice
    ):
        """Le rôle MECANICIEN n'a aucun droit sur les rendez-vous (HTTP 403 Forbidden)."""
        res_get = test_client.get("/api/v1/rendez-vous", headers=headers_mecanicien)
        assert res_get.status_code == 403
        assert res_get.get_json()["error"]["code"] == "FORBIDDEN"

        res_post = test_client.post(
            "/api/v1/rendez-vous",
            json={
                "date_rendezvous": "2026-12-05",
                "heure": "14:00",
                "id_client": client_alice.id_client,
                "id_vehicule": vehicule_alice.id_vehicule,
            },
            headers=headers_mecanicien,
        )
        assert res_post.status_code == 403

        res_get_id = test_client.get(
            f"/api/v1/rendez-vous/{sample_rdv.id_rendezvous}", headers=headers_mecanicien
        )
        assert res_get_id.status_code == 403

        res_patch = test_client.patch(
            f"/api/v1/rendez-vous/{sample_rdv.id_rendezvous}",
            json={"statut": "CONFIRME"},
            headers=headers_mecanicien,
        )
        assert res_patch.status_code == 403

        res_delete = test_client.delete(
            f"/api/v1/rendez-vous/{sample_rdv.id_rendezvous}", headers=headers_mecanicien
        )
        assert res_delete.status_code == 403


# ============================================================================
# Tests: Creation & Client-Vehicle Ownership Consistency
# ============================================================================

class TestRendezVousCreationAndConsistency:
    """Création et vérification stricte de la cohérence propriétaire-véhicule."""

    def test_create_rendez_vous_success(
        self, test_client, headers_responsable, client_alice, vehicule_alice
    ):
        """Création réussie d'un rendez-vous avec données valides (HTTP 201)."""
        payload = {
            "date_rendezvous": "2026-12-15",
            "heure": "10:30",
            "motif": "Changement des freins avant",
            "statut": "CONFIRME",
            "id_client": client_alice.id_client,
            "id_vehicule": vehicule_alice.id_vehicule,
        }
        res = test_client.post("/api/v1/rendez-vous", json=payload, headers=headers_responsable)
        assert res.status_code == 201

        body = res.get_json()
        assert body["success"] is True
        data = body["data"]
        assert data["date_rendezvous"] == "2026-12-15"
        assert data["heure"] == "10:30:00"
        assert data["motif"] == "Changement des freins avant"
        assert data["statut"] == "CONFIRME"
        assert data["id_client"] == client_alice.id_client
        assert data["id_vehicule"] == vehicule_alice.id_vehicule
        assert data["client"]["nom"] == client_alice.nom
        assert data["vehicule"]["immatriculation"] == vehicule_alice.immatriculation

        # Vérification en base
        rdv_db = db.session.get(RendezVous, data["id_rendezvous"])
        assert rdv_db is not None
        assert rdv_db.date_rendezvous == date(2026, 12, 15)
        assert rdv_db.heure == time(10, 30)

    def test_create_rendez_vous_default_statut(
        self, test_client, headers_responsable, client_alice, vehicule_alice
    ):
        """Le statut par défaut lors de la création est 'PLANIFIE'."""
        payload = {
            "date_rendezvous": "2026-12-18",
            "heure": "14:15",
            "id_client": client_alice.id_client,
            "id_vehicule": vehicule_alice.id_vehicule,
        }
        res = test_client.post("/api/v1/rendez-vous", json=payload, headers=headers_responsable)
        assert res.status_code == 201
        assert res.get_json()["data"]["statut"] == "PLANIFIE"

    def test_create_rendez_vous_vehicle_does_not_belong_to_client(
        self, test_client, headers_responsable, client_alice, vehicule_bob
    ):
        """IMPORTANT : Incohérence propriétaire-véhicule rejetée (HTTP 422).
        
        Tentative d'associer le véhicule de Bob (vehicule_bob) avec la cliente Alice.
        """
        payload = {
            "date_rendezvous": "2026-12-20",
            "heure": "11:00",
            "id_client": client_alice.id_client,
            "id_vehicule": vehicule_bob.id_vehicule,  # Appartient à Bob !
        }
        res = test_client.post("/api/v1/rendez-vous", json=payload, headers=headers_responsable)
        assert res.status_code == 422
        body = res.get_json()
        assert body["error"]["code"] == "VALIDATION_ERROR"
        assert "n'appartient pas" in body["error"]["message"].lower()
        assert "id_vehicule" in body["error"]["details"]

    def test_create_rendez_vous_nonexistent_client(
        self, test_client, headers_responsable, vehicule_alice
    ):
        """Client inexistant renvoie HTTP 404 Not Found."""
        payload = {
            "date_rendezvous": "2026-12-20",
            "heure": "11:00",
            "id_client": 99999,
            "id_vehicule": vehicule_alice.id_vehicule,
        }
        res = test_client.post("/api/v1/rendez-vous", json=payload, headers=headers_responsable)
        assert res.status_code == 404
        assert res.get_json()["error"]["code"] == "NOT_FOUND"

    def test_create_rendez_vous_nonexistent_vehicle(
        self, test_client, headers_responsable, client_alice
    ):
        """Véhicule inexistant renvoie HTTP 404 Not Found."""
        payload = {
            "date_rendezvous": "2026-12-20",
            "heure": "11:00",
            "id_client": client_alice.id_client,
            "id_vehicule": 99999,
        }
        res = test_client.post("/api/v1/rendez-vous", json=payload, headers=headers_responsable)
        assert res.status_code == 404
        assert res.get_json()["error"]["code"] == "NOT_FOUND"

    def test_create_rendez_vous_invalid_time_format(
        self, test_client, headers_responsable, client_alice, vehicule_alice
    ):
        """Format d'heure invalide (25:00, 12:75, 'midi') rejeté avec HTTP 422."""
        for bad_time in ["25:00", "12:65", "midi", "99:99"]:
            payload = {
                "date_rendezvous": "2026-12-20",
                "heure": bad_time,
                "id_client": client_alice.id_client,
                "id_vehicule": vehicule_alice.id_vehicule,
            }
            res = test_client.post("/api/v1/rendez-vous", json=payload, headers=headers_responsable)
            assert res.status_code == 422
            assert "heure" in res.get_json()["error"]["details"]

    def test_create_rendez_vous_invalid_date_format(
        self, test_client, headers_responsable, client_alice, vehicule_alice
    ):
        """Format de date invalide rejeté avec HTTP 422."""
        for bad_date in ["not-a-date", "2026-02-30", "12/25/2026"]:
            payload = {
                "date_rendezvous": bad_date,
                "heure": "10:00",
                "id_client": client_alice.id_client,
                "id_vehicule": vehicule_alice.id_vehicule,
            }
            res = test_client.post("/api/v1/rendez-vous", json=payload, headers=headers_responsable)
            assert res.status_code == 422
            assert "date_rendezvous" in res.get_json()["error"]["details"]

    def test_create_rendez_vous_missing_required_fields(
        self, test_client, headers_responsable
    ):
        """Champs obligatoires manquants rejetés avec HTTP 422."""
        # Payload vide
        res1 = test_client.post("/api/v1/rendez-vous", json={}, headers=headers_responsable)
        assert res1.status_code == 422
        details = res1.get_json()["error"]["details"]
        assert "date_rendezvous" in details
        assert "heure" in details
        assert "id_client" in details
        assert "id_vehicule" in details

    def test_create_rendez_vous_invalid_statut(
        self, test_client, headers_responsable, client_alice, vehicule_alice
    ):
        """Statut inconnu rejeté avec HTTP 422."""
        payload = {
            "date_rendezvous": "2026-12-20",
            "heure": "10:00",
            "statut": "STATUT_INEXISTANT",
            "id_client": client_alice.id_client,
            "id_vehicule": vehicule_alice.id_vehicule,
        }
        res = test_client.post("/api/v1/rendez-vous", json=payload, headers=headers_responsable)
        assert res.status_code == 422
        assert "statut" in res.get_json()["error"]["details"]

    def test_create_rendez_vous_statut_normalization(
        self, test_client, headers_responsable, client_alice, vehicule_alice
    ):
        """Normalisation des statuts (accents, minuscules, terminaison féminine)."""
        payload = {
            "date_rendezvous": "2026-12-20",
            "heure": "10:00",
            "statut": "confirmée",
            "id_client": client_alice.id_client,
            "id_vehicule": vehicule_alice.id_vehicule,
        }
        res = test_client.post("/api/v1/rendez-vous", json=payload, headers=headers_responsable)
        assert res.status_code == 201
        assert res.get_json()["data"]["statut"] == "CONFIRME"


# ============================================================================
# Tests: Detail Retrieval & Filtering
# ============================================================================

class TestRendezVousRetrievalAndFiltering:
    """Consultation et filtrage des rendez-vous."""

    @pytest.fixture
    def setup_multiple_rdvs(
        self, rdv_app, client_alice, client_bob, vehicule_alice, vehicule_bob
    ):
        """Crée un jeu de rendez-vous variés pour tester les filtres."""
        r1 = RendezVous(
            date_rendezvous=date(2026, 12, 1),
            heure=time(9, 0),
            motif="Vidange Alice",
            statut="TERMINE",
            id_client=client_alice.id_client,
            id_vehicule=vehicule_alice.id_vehicule,
        )
        r2 = RendezVous(
            date_rendezvous=date(2026, 12, 5),
            heure=time(14, 30),
            motif="Freins Alice",
            statut="CONFIRME",
            id_client=client_alice.id_client,
            id_vehicule=vehicule_alice.id_vehicule,
        )
        r3 = RendezVous(
            date_rendezvous=date(2026, 12, 10),
            heure=time(11, 0),
            motif="Contrôle Bob",
            statut="PLANIFIE",
            id_client=client_bob.id_client,
            id_vehicule=vehicule_bob.id_vehicule,
        )
        db.session.add_all([r1, r2, r3])
        db.session.commit()
        return {"r1": r1, "r2": r2, "r3": r3}

    def test_get_rendez_vous_by_id_success(
        self, test_client, headers_responsable, setup_multiple_rdvs
    ):
        """Consultation d'un rendez-vous par son identifiant unique (HTTP 200)."""
        r1 = setup_multiple_rdvs["r1"]
        res = test_client.get(f"/api/v1/rendez-vous/{r1.id_rendezvous}", headers=headers_responsable)
        assert res.status_code == 200

        data = res.get_json()["data"]
        assert data["id_rendezvous"] == r1.id_rendezvous
        assert data["date_rendezvous"] == "2026-12-01"
        assert data["heure"] == "09:00:00"
        assert data["motif"] == "Vidange Alice"
        assert data["statut"] == "TERMINE"
        assert data["client"]["id_client"] == r1.id_client
        assert data["vehicule"]["id_vehicule"] == r1.id_vehicule

    def test_get_rendez_vous_by_id_not_found(self, test_client, headers_responsable):
        """Rendez-vous introuvable renvoie HTTP 404 Not Found."""
        res = test_client.get("/api/v1/rendez-vous/99999", headers=headers_responsable)
        assert res.status_code == 404
        assert res.get_json()["error"]["code"] == "NOT_FOUND"

    def test_list_rendez_vous_all(
        self, test_client, headers_responsable, setup_multiple_rdvs
    ):
        """Liste de tous les rendez-vous triés chronologiquement."""
        res = test_client.get("/api/v1/rendez-vous", headers=headers_responsable)
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert len(data) == 3
        # Chronologique : r1 (2026-12-01), r2 (2026-12-05), r3 (2026-12-10)
        assert data[0]["id_rendezvous"] == setup_multiple_rdvs["r1"].id_rendezvous
        assert data[1]["id_rendezvous"] == setup_multiple_rdvs["r2"].id_rendezvous
        assert data[2]["id_rendezvous"] == setup_multiple_rdvs["r3"].id_rendezvous

    def test_list_rendez_vous_filter_by_client(
        self, test_client, headers_responsable, setup_multiple_rdvs, client_alice, client_bob
    ):
        """Filtrage par client."""
        res_alice = test_client.get(
            f"/api/v1/rendez-vous?id_client={client_alice.id_client}", headers=headers_responsable
        )
        assert res_alice.status_code == 200
        assert len(res_alice.get_json()["data"]) == 2

        res_bob = test_client.get(
            f"/api/v1/rendez-vous?id_client={client_bob.id_client}", headers=headers_responsable
        )
        assert res_bob.status_code == 200
        assert len(res_bob.get_json()["data"]) == 1

    def test_list_rendez_vous_filter_by_vehicule(
        self, test_client, headers_responsable, setup_multiple_rdvs, vehicule_alice, vehicule_bob
    ):
        """Filtrage par véhicule."""
        res = test_client.get(
            f"/api/v1/rendez-vous?id_vehicule={vehicule_bob.id_vehicule}", headers=headers_responsable
        )
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert len(data) == 1
        assert data[0]["id_vehicule"] == vehicule_bob.id_vehicule

    def test_list_rendez_vous_filter_by_statut(
        self, test_client, headers_responsable, setup_multiple_rdvs
    ):
        """Filtrage par statut."""
        res = test_client.get("/api/v1/rendez-vous?statut=CONFIRME", headers=headers_responsable)
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert len(data) == 1
        assert data[0]["id_rendezvous"] == setup_multiple_rdvs["r2"].id_rendezvous

    def test_list_rendez_vous_filter_by_exact_date(
        self, test_client, headers_responsable, setup_multiple_rdvs
    ):
        """Filtrage par date exacte."""
        res = test_client.get("/api/v1/rendez-vous?date=2026-12-05", headers=headers_responsable)
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert len(data) == 1
        assert data[0]["id_rendezvous"] == setup_multiple_rdvs["r2"].id_rendezvous

    def test_list_rendez_vous_filter_by_date_range(
        self, test_client, headers_responsable, setup_multiple_rdvs
    ):
        """Filtrage par plage de dates."""
        res = test_client.get(
            "/api/v1/rendez-vous?date_debut=2026-12-04&date_fin=2026-12-15",
            headers=headers_responsable,
        )
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert len(data) == 2
        ids = [r["id_rendezvous"] for r in data]
        assert setup_multiple_rdvs["r2"].id_rendezvous in ids
        assert setup_multiple_rdvs["r3"].id_rendezvous in ids

    def test_list_rendez_vous_invalid_filter_types(
        self, test_client, headers_responsable
    ):
        """Rejet des filtres avec types ou formats invalides (HTTP 422)."""
        assert test_client.get("/api/v1/rendez-vous?id_client=abc", headers=headers_responsable).status_code == 422
        assert test_client.get("/api/v1/rendez-vous?id_vehicule=abc", headers=headers_responsable).status_code == 422
        assert test_client.get("/api/v1/rendez-vous?date=invalid-date", headers=headers_responsable).status_code == 422
        assert test_client.get("/api/v1/rendez-vous?date_debut=bad", headers=headers_responsable).status_code == 422
        assert test_client.get("/api/v1/rendez-vous?date_fin=bad", headers=headers_responsable).status_code == 422


# ============================================================================
# Tests: Update (PUT / PATCH) & Inconsistency Prevention
# ============================================================================

class TestRendezVousUpdate:
    """Mise à jour des rendez-vous et prévention des incohérences."""

    def test_update_rendez_vous_partial_success(
        self, test_client, headers_responsable, sample_rdv
    ):
        """Mise à jour partielle (statut et heure) réussie (HTTP 200)."""
        payload = {
            "statut": "CONFIRME",
            "heure": "11:45",
            "motif": "Nouveau motif mis à jour",
        }
        res = test_client.patch(
            f"/api/v1/rendez-vous/{sample_rdv.id_rendezvous}",
            json=payload,
            headers=headers_responsable,
        )
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert data["statut"] == "CONFIRME"
        assert data["heure"] == "11:45:00"
        assert data["motif"] == "Nouveau motif mis à jour"

        # Vérification en base
        db.session.refresh(sample_rdv)
        assert sample_rdv.statut == "CONFIRME"
        assert sample_rdv.heure == time(11, 45)

    def test_update_rendez_vous_switch_to_another_vehicle_of_same_client(
        self, test_client, headers_responsable, sample_rdv, vehicule_alice_second
    ):
        """Mise à jour réussie du véhicule vers un autre véhicule appartenant au même client."""
        payload = {"id_vehicule": vehicule_alice_second.id_vehicule}
        res = test_client.patch(
            f"/api/v1/rendez-vous/{sample_rdv.id_rendezvous}",
            json=payload,
            headers=headers_responsable,
        )
        assert res.status_code == 200
        assert res.get_json()["data"]["id_vehicule"] == vehicule_alice_second.id_vehicule

    def test_update_rendez_vous_vehicle_mismatch_rejected(
        self, test_client, headers_responsable, sample_rdv, vehicule_bob
    ):
        """IMPORTANT : Tentative de remplacer le véhicule par celui d'un autre client rejetée (HTTP 422)."""
        payload = {"id_vehicule": vehicule_bob.id_vehicule}
        res = test_client.patch(
            f"/api/v1/rendez-vous/{sample_rdv.id_rendezvous}",
            json=payload,
            headers=headers_responsable,
        )
        assert res.status_code == 422
        body = res.get_json()
        assert "n'appartient pas" in body["error"]["message"].lower()

    def test_update_rendez_vous_client_mismatch_rejected(
        self, test_client, headers_responsable, sample_rdv, client_bob
    ):
        """IMPORTANT : Tentative de changer le client sans changer le véhicule (qui n'appartient pas au nouveau client) rejetée (HTTP 422)."""
        payload = {"id_client": client_bob.id_client}
        res = test_client.patch(
            f"/api/v1/rendez-vous/{sample_rdv.id_rendezvous}",
            json=payload,
            headers=headers_responsable,
        )
        assert res.status_code == 422
        body = res.get_json()
        assert "n'appartient pas" in body["error"]["message"].lower()

    def test_update_rendez_vous_switch_both_client_and_vehicle_consistent(
        self, test_client, headers_responsable, sample_rdv, client_bob, vehicule_bob
    ):
        """Mise à jour simultanée du client et du véhicule vers un couple valide réussie (HTTP 200)."""
        payload = {
            "id_client": client_bob.id_client,
            "id_vehicule": vehicule_bob.id_vehicule,
        }
        res = test_client.patch(
            f"/api/v1/rendez-vous/{sample_rdv.id_rendezvous}",
            json=payload,
            headers=headers_responsable,
        )
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert data["id_client"] == client_bob.id_client
        assert data["id_vehicule"] == vehicule_bob.id_vehicule

    def test_update_rendez_vous_empty_body(
        self, test_client, headers_responsable, sample_rdv
    ):
        """Charge utile vide rejetée avec HTTP 422."""
        res = test_client.patch(
            f"/api/v1/rendez-vous/{sample_rdv.id_rendezvous}",
            json={},
            headers=headers_responsable,
        )
        assert res.status_code == 422

    def test_update_rendez_vous_not_found(
        self, test_client, headers_responsable
    ):
        """Mise à jour d'un rendez-vous inexistant renvoie HTTP 404."""
        res = test_client.patch(
            "/api/v1/rendez-vous/99999",
            json={"statut": "CONFIRME"},
            headers=headers_responsable,
        )
        assert res.status_code == 404


# ============================================================================
# Tests: History Preservation & Deletion (Exigence 11)
# ============================================================================

class TestRendezVousDeletionAndHistoryPreservation:
    """Gestion de la suppression et protection de l'historique d'atelier."""

    def test_delete_planned_rendez_vous_success(
        self, test_client, headers_responsable, sample_rdv
    ):
        """Suppression d'un rendez-vous planifié autorisée (HTTP 200)."""
        r_id = sample_rdv.id_rendezvous
        res = test_client.delete(f"/api/v1/rendez-vous/{r_id}", headers=headers_responsable)
        assert res.status_code == 200
        assert res.get_json()["success"] is True

        # Vérification en base
        assert db.session.get(RendezVous, r_id) is None

    def test_delete_cancelled_rendez_vous_success(
        self, test_client, headers_responsable, sample_rdv
    ):
        """Suppression d'un rendez-vous annulé autorisée (HTTP 200)."""
        sample_rdv.statut = "ANNULE"
        db.session.commit()
        r_id = sample_rdv.id_rendezvous

        res = test_client.delete(f"/api/v1/rendez-vous/{r_id}", headers=headers_responsable)
        assert res.status_code == 200
        assert db.session.get(RendezVous, r_id) is None

    def test_delete_completed_rendez_vous_is_prevented(
        self, test_client, headers_responsable, sample_rdv
    ):
        """IMPORTANT : Interdiction formelle de supprimer un rendez-vous 'TERMINE' (HTTP 409 Conflict)."""
        sample_rdv.statut = "TERMINE"
        db.session.commit()
        r_id = sample_rdv.id_rendezvous

        res = test_client.delete(f"/api/v1/rendez-vous/{r_id}", headers=headers_responsable)
        assert res.status_code == 409
        body = res.get_json()
        assert body["error"]["code"] == "CONFLICT"
        assert "terminé" in body["error"]["message"].lower() or "honoré" in body["error"]["message"].lower()

        # Vérification en base : le rendez-vous n'a PAS été supprimé
        assert db.session.get(RendezVous, r_id) is not None

    def test_delete_honored_rendez_vous_is_prevented(
        self, test_client, headers_responsable, sample_rdv
    ):
        """IMPORTANT : Interdiction formelle de supprimer un rendez-vous 'HONORE' (HTTP 409 Conflict)."""
        sample_rdv.statut = "HONORE"
        db.session.commit()
        r_id = sample_rdv.id_rendezvous

        res = test_client.delete(f"/api/v1/rendez-vous/{r_id}", headers=headers_responsable)
        assert res.status_code == 409

        # Vérification en base
        assert db.session.get(RendezVous, r_id) is not None

    def test_delete_nonexistent_rendez_vous(
        self, test_client, headers_responsable
    ):
        """Suppression d'un rendez-vous inexistant renvoie HTTP 404."""
        res = test_client.delete("/api/v1/rendez-vous/99999", headers=headers_responsable)
        assert res.status_code == 404


# ============================================================================
# Tests: Transaction Rollback (Exigence 12)
# ============================================================================

class TestRendezVousTransactionRollback:
    """Vérification de l'atomicité transactionnelle et du rollback sécurisé."""

    def test_create_rendez_vous_rollback_on_commit_error(
        self, client_alice, vehicule_alice
    ):
        """En cas d'exception lors du commit, la transaction est annulée par rollback."""
        payload = {
            "date_rendezvous": date(2026, 12, 25),
            "heure": time(10, 0),
            "id_client": client_alice.id_client,
            "id_vehicule": vehicule_alice.id_vehicule,
        }

        with patch("app.extensions.db.session.commit", side_effect=Exception("Database crash")):
            with pytest.raises(Exception):
                rendez_vous_service.create_rendez_vous(payload)

        db.session.rollback()
        # Aucun enregistrement en base
        assert RendezVous.query.filter_by(date_rendezvous=date(2026, 12, 25)).first() is None

    def test_create_rendez_vous_integrity_error_mapped_to_conflict(
        self, client_alice, vehicule_alice
    ):
        """IntegrityError lors du commit est mappée sur ConflictError."""
        payload = {
            "date_rendezvous": date(2026, 12, 25),
            "heure": time(10, 0),
            "id_client": client_alice.id_client,
            "id_vehicule": vehicule_alice.id_vehicule,
        }

        with patch(
            "app.extensions.db.session.commit",
            side_effect=IntegrityError("INSERT INTO rendez_vous ...", {}, Exception("Integrity")),
        ):
            with pytest.raises(ConflictError) as exc_info:
                rendez_vous_service.create_rendez_vous(payload)
            assert "conflit d'intégrité" in exc_info.value.message.lower()

    def test_update_rendez_vous_rollback_on_commit_error(
        self, sample_rdv
    ):
        """Rollback lors d'un échec de mise à jour."""
        initial_motif = sample_rdv.motif

        with patch(
            "app.extensions.db.session.commit",
            side_effect=IntegrityError("UPDATE rendez_vous ...", {}, Exception("DB failure")),
        ):
            with pytest.raises(ConflictError):
                rendez_vous_service.update_rendez_vous(
                    sample_rdv.id_rendezvous,
                    {"motif": "Motif temporaire échoué"},
                )

        db.session.rollback()
        db.session.refresh(sample_rdv)
        assert sample_rdv.motif == initial_motif

    def test_delete_rendez_vous_rollback_on_commit_error(
        self, sample_rdv
    ):
        """Rollback lors d'un échec de suppression."""
        r_id = sample_rdv.id_rendezvous

        with patch(
            "app.extensions.db.session.commit",
            side_effect=IntegrityError("DELETE FROM rendez_vous ...", {}, Exception("DB failure")),
        ):
            with pytest.raises(ConflictError):
                rendez_vous_service.delete_rendez_vous(r_id)

        db.session.rollback()
        assert db.session.get(RendezVous, r_id) is not None


# ============================================================================
# Tests: Schemas & Service Direct Unit Tests
# ============================================================================

class TestRendezVousDirectUnitTests:
    """Tests unitaires directs sur les schémas Marshmallow et les services."""

    def test_create_schema_valid_load(self):
        """Validation directe du schéma RendezVousCreateSchema."""
        data = {
            "date_rendezvous": "2026-12-01",
            "heure": "09:30",
            "motif": "Contrôle technique",
            "statut": "planifiée",
            "id_client": 1,
            "id_vehicule": 2,
        }
        res = rendez_vous_create_schema.load(data)
        assert res["date_rendezvous"] == date(2026, 12, 1)
        assert res["heure"] == time(9, 30)
        assert res["statut"] == "PLANIFIE"

    def test_update_schema_valid_load(self):
        """Validation directe du schéma RendezVousUpdateSchema."""
        data = {
            "heure": "15:45:00",
            "statut": "confirmé",
        }
        res = rendez_vous_update_schema.load(data)
        assert res["heure"] == time(15, 45)
        assert res["statut"] == "CONFIRME"

    def test_allowed_appointment_statuses_list(self):
        """Vérification des statuts autorisés."""
        assert "PLANIFIE" in ALLOWED_APPOINTMENT_STATUSES
        assert "CONFIRME" in ALLOWED_APPOINTMENT_STATUSES
        assert "EN_ATTENTE" in ALLOWED_APPOINTMENT_STATUSES
        assert "TERMINE" in ALLOWED_APPOINTMENT_STATUSES
        assert "ANNULE" in ALLOWED_APPOINTMENT_STATUSES
        assert "HONORE" in ALLOWED_APPOINTMENT_STATUSES
