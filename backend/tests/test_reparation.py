"""Tests complets pour le module Gestion des Réparations de GarageFlow.

Exécution isolée en mémoire avec SQLite (sqlite:///:memory:).
Aucune connexion à PostgreSQL, aucune modification de la base réelle et aucune migration.
Couvre :
- Authentification JWT & RBAC (RESPONSABLE vs MECANICIEN vs Rôles invalides)
- Validation des schémas Marshmallow (champs requis, formats, statut normalisé, coût/kilométrage >= 0)
- Opérations CRUD complètes (Create, Read, Update, Delete)
- Filtrage multicritère (véhicule, mécanicien, statut, date)
- Propriété stricte du mécanicien (UC10 / UC11 : isolation absolue des données entre mécaniciens)
- Interdiction pour un mécanicien de réassigner véhicule ou mécanicien
- Protection anti-cascade contre la suppression (conflit 409 si Facture ou Pièces détachées associées)
- Tests directs de service et de schéma
"""
import pytest
from datetime import date
from decimal import Decimal
from flask_jwt_extended import create_access_token

from app import create_app
from app.extensions import db
from app.models import (
    Utilisateur,
    Mecanicien,
    Client,
    Vehicule,
    Reparation,
    Facture,
    PieceDetachee,
    ReparationPiece,
)
from app.services import reparation_service
from app.schemas.reparation_schema import (
    reparation_create_schema,
    reparation_update_schema,
    reparation_response_schema,
    ALLOWED_STATUSES,
)
from app.utils.exceptions import NotFoundError, ConflictError, ValidationError, ForbiddenError


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def reparation_app(monkeypatch):
    """Crée une instance d'application Flask isolée avec base SQLite en mémoire."""
    monkeypatch.setenv("TEST_DATABASE_URL", "sqlite:///:memory:")
    app = create_app("testing")
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def test_client(reparation_app):
    """Client HTTP de test."""
    return reparation_app.test_client()


@pytest.fixture
def responsable_user(reparation_app):
    """Utilisateur Responsable."""
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
def mecanicien1_user(reparation_app):
    """Premier utilisateur avec le rôle MECANICIEN."""
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
def mecanicien1_profile(reparation_app, mecanicien1_user):
    """Profil mécanicien pour mecanicien1_user."""
    m = Mecanicien(
        specialite="Moteur & Diagnostic",
        id_utilisateur=mecanicien1_user.id_utilisateur,
    )
    db.session.add(m)
    db.session.commit()
    return m


@pytest.fixture
def mecanicien2_user(reparation_app):
    """Deuxième utilisateur avec le rôle MECANICIEN."""
    u = Utilisateur(
        nom="Tourneur",
        prenom="Paul",
        email="paul.tourneur@garageflow.fr",
        role="MECANICIEN",
        telephone="0605060708",
    )
    u.set_password("PaulPass123!")
    db.session.add(u)
    db.session.commit()
    return u


@pytest.fixture
def mecanicien2_profile(reparation_app, mecanicien2_user):
    """Profil mécanicien pour mecanicien2_user."""
    m = Mecanicien(
        specialite="Carrosserie & Peinture",
        id_utilisateur=mecanicien2_user.id_utilisateur,
    )
    db.session.add(m)
    db.session.commit()
    return m


@pytest.fixture
def unassigned_mecanicien_user(reparation_app):
    """Utilisateur avec rôle MECANICIEN sans profil Mecanicien rattaché."""
    u = Utilisateur(
        nom="Sans",
        prenom="Profil",
        email="sans.profil@garageflow.fr",
        role="MECANICIEN",
        telephone="0699999999",
    )
    u.set_password("NoProfilePass123!")
    db.session.add(u)
    db.session.commit()
    return u


@pytest.fixture
def client_owner(reparation_app):
    """Client propriétaire des véhicules."""
    c = Client(
        nom="Durand",
        prenom="Claire",
        telephone="0711223344",
        adresse="12 Rue de la Paix, 75001 Paris",
    )
    db.session.add(c)
    db.session.commit()
    return c


@pytest.fixture
def vehicule1(reparation_app, client_owner):
    """Premier véhicule de test."""
    v = Vehicule(
        marque="Peugeot",
        modele="208",
        immatriculation="AA-111-AA",
        annee=2021,
        kilometrage=35000,
        etat="BON",
        id_client=client_owner.id_client,
    )
    db.session.add(v)
    db.session.commit()
    return v


@pytest.fixture
def vehicule2(reparation_app, client_owner):
    """Second véhicule de test."""
    v = Vehicule(
        marque="Renault",
        modele="Clio",
        immatriculation="BB-222-BB",
        annee=2018,
        kilometrage=92000,
        etat="EN_PANNE",
        id_client=client_owner.id_client,
    )
    db.session.add(v)
    db.session.commit()
    return v


@pytest.fixture
def headers_responsable(responsable_user):
    """En-tête Bearer pour le Responsable."""
    token = create_access_token(
        identity=str(responsable_user.id_utilisateur),
        additional_claims={"role": "RESPONSABLE"},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def headers_mecanicien1(mecanicien1_user, mecanicien1_profile):
    """En-tête Bearer pour le Mécanicien 1."""
    token = create_access_token(
        identity=str(mecanicien1_user.id_utilisateur),
        additional_claims={"role": "MECANICIEN"},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def headers_mecanicien2(mecanicien2_user, mecanicien2_profile):
    """En-tête Bearer pour le Mécanicien 2."""
    token = create_access_token(
        identity=str(mecanicien2_user.id_utilisateur),
        additional_claims={"role": "MECANICIEN"},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def headers_unassigned_mecanicien(unassigned_mecanicien_user):
    """En-tête Bearer pour le mécanicien sans profil."""
    token = create_access_token(
        identity=str(unassigned_mecanicien_user.id_utilisateur),
        additional_claims={"role": "MECANICIEN"},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sample_reparation1(reparation_app, vehicule1, mecanicien1_profile):
    """Réparation assignée au Mécanicien 1."""
    rep = Reparation(
        description="Vidange et révision générale",
        date_reparation=date(2026, 11, 10),
        diagnostic="Niveau d'huile bas, filtre encrassé",
        travail_effectue="Vidange huile 5W30 + filtre à huile",
        statut="EN_COURS",
        cout=Decimal("150.00"),
        kilometrage=35000,
        id_vehicule=vehicule1.id_vehicule,
        id_mecanicien=mecanicien1_profile.id_mecanicien,
    )
    db.session.add(rep)
    db.session.commit()
    return rep


@pytest.fixture
def sample_reparation2(reparation_app, vehicule2, mecanicien2_profile):
    """Réparation assignée au Mécanicien 2."""
    rep = Reparation(
        description="Remplacement plaquettes et disques",
        date_reparation=date(2026, 11, 12),
        diagnostic="Usure prononcée des disques avant",
        travail_effectue="Remplacement disques + plaquettes avant",
        statut="TERMINEE",
        cout=Decimal("320.50"),
        kilometrage=92000,
        id_vehicule=vehicule2.id_vehicule,
        id_mecanicien=mecanicien2_profile.id_mecanicien,
    )
    db.session.add(rep)
    db.session.commit()
    return rep


# ============================================================================
# Tests: Blueprint Registration & Health
# ============================================================================

class TestBlueprintRegistration:
    """Vérification de l'enregistrement correct du blueprint des réparations."""

    def test_reparation_blueprint_registered(self, reparation_app):
        """Vérifie que le blueprint reparations est bien enregistré à /api/v1/reparations."""
        assert "reparations" in reparation_app.blueprints
        rules = [rule.rule for rule in reparation_app.url_map.iter_rules()]
        assert any("/api/v1/reparations" in r for r in rules)


# ============================================================================
# Tests: Authentication & RBAC (Task 5)
# ============================================================================

class TestReparationRBAC:
    """Vérification de l'authentification JWT et du contrôle d'accès basé sur les rôles (RBAC)."""

    def test_endpoints_unauthorized_without_jwt(self, test_client, sample_reparation1):
        """Toutes les opérations requièrent un jeton JWT et renvoient HTTP 401 sans jeton."""
        rep_id = sample_reparation1.id_reparation
        endpoints = [
            ("GET", "/api/v1/reparations", None),
            ("POST", "/api/v1/reparations", {"description": "Test"}),
            ("GET", f"/api/v1/reparations/{rep_id}", None),
            ("PUT", f"/api/v1/reparations/{rep_id}", {"statut": "TERMINEE"}),
            ("DELETE", f"/api/v1/reparations/{rep_id}", None),
        ]
        for method, url, payload in endpoints:
            if method == "GET":
                resp = test_client.get(url)
            elif method == "POST":
                resp = test_client.post(url, json=payload)
            elif method == "PUT":
                resp = test_client.put(url, json=payload)
            elif method == "DELETE":
                resp = test_client.delete(url)
            assert resp.status_code == 401, f"Expected 401 for {method} {url}, got {resp.status_code}"

    def test_create_forbidden_for_mecanicien(
        self, test_client, headers_mecanicien1, vehicule1, mecanicien1_profile
    ):
        """Un mécanicien ne peut pas créer de fiche de réparation (403 Forbidden)."""
        payload = {
            "description": "Changement de batterie",
            "date_reparation": "2026-11-20",
            "statut": "EN_ATTENTE",
            "id_vehicule": vehicule1.id_vehicule,
            "id_mecanicien": mecanicien1_profile.id_mecanicien,
        }
        res = test_client.post(
            "/api/v1/reparations",
            headers=headers_mecanicien1,
            json=payload,
        )
        assert res.status_code == 403
        data = res.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "FORBIDDEN"

    def test_delete_forbidden_for_mecanicien(
        self, test_client, headers_mecanicien1, sample_reparation1
    ):
        """Un mécanicien ne peut pas supprimer une réparation (403 Forbidden)."""
        res = test_client.delete(
            f"/api/v1/reparations/{sample_reparation1.id_reparation}",
            headers=headers_mecanicien1,
        )
        assert res.status_code == 403
        data = res.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "FORBIDDEN"

    def test_unknown_role_forbidden(self, test_client, reparation_app, sample_reparation1):
        """Un rôle non autorisé (ex: CLIENT) est rejeté sur tous les endpoints (403)."""
        token = create_access_token(
            identity="999",
            additional_claims={"role": "CLIENT"},
        )
        headers = {"Authorization": f"Bearer {token}"}

        # GET list
        res = test_client.get("/api/v1/reparations", headers=headers)
        assert res.status_code == 403
        assert res.get_json()["error"]["code"] == "FORBIDDEN"

        # GET detail
        res = test_client.get(
            f"/api/v1/reparations/{sample_reparation1.id_reparation}",
            headers=headers,
        )
        assert res.status_code == 403
        assert res.get_json()["error"]["code"] == "FORBIDDEN"

        # POST
        res = test_client.post("/api/v1/reparations", headers=headers, json={})
        assert res.status_code == 403
        assert res.get_json()["error"]["code"] == "FORBIDDEN"

        # PUT
        res = test_client.put(
            f"/api/v1/reparations/{sample_reparation1.id_reparation}",
            headers=headers,
            json={"statut": "TERMINEE"},
        )
        assert res.status_code == 403
        assert res.get_json()["error"]["code"] == "FORBIDDEN"

        # DELETE
        res = test_client.delete(
            f"/api/v1/reparations/{sample_reparation1.id_reparation}",
            headers=headers,
        )
        assert res.status_code == 403
        assert res.get_json()["error"]["code"] == "FORBIDDEN"


# ============================================================================
# Tests: CRUD Operations & Validations (Task 4)
# ============================================================================

class TestReparationCRUD:
    """Tests des opérations CRUD complètes et des validations métier."""

    def test_create_reparation_success(
        self, test_client, headers_responsable, vehicule1, mecanicien1_profile
    ):
        """Le Responsable crée une réparation avec succès (201 Created)."""
        payload = {
            "description": "Remplacement courroie d'accessoire",
            "date_reparation": "2026-11-18",
            "diagnostic": "Courroie craquelée",
            "travail_effectue": "Pose d'une courroie neuve",
            "statut": "EN_COURS",
            "cout": 85.50,
            "kilometrage": 36000,
            "id_vehicule": vehicule1.id_vehicule,
            "id_mecanicien": mecanicien1_profile.id_mecanicien,
        }
        res = test_client.post(
            "/api/v1/reparations",
            headers=headers_responsable,
            json=payload,
        )
        assert res.status_code == 201
        body = res.get_json()
        assert body["success"] is True
        data = body["data"]
        assert data["id_reparation"] is not None
        assert data["description"] == payload["description"]
        assert data["date_reparation"] == "2026-11-18"
        assert data["statut"] == "EN_COURS"
        assert data["cout"] == 85.50
        assert data["kilometrage"] == 36000
        assert data["id_vehicule"] == vehicule1.id_vehicule
        assert data["id_mecanicien"] == mecanicien1_profile.id_mecanicien

    def test_create_reparation_minimal_fields(
        self, test_client, headers_responsable, vehicule1, mecanicien1_profile
    ):
        """Création réussie avec uniquement les champs obligatoires (201)."""
        payload = {
            "description": "Contrôle visuel freins",
            "date_reparation": "2026-11-19",
            "statut": "EN_ATTENTE",
            "id_vehicule": vehicule1.id_vehicule,
            "id_mecanicien": mecanicien1_profile.id_mecanicien,
        }
        res = test_client.post(
            "/api/v1/reparations",
            headers=headers_responsable,
            json=payload,
        )
        assert res.status_code == 201
        body = res.get_json()
        assert body["success"] is True
        data = body["data"]
        assert data["cout"] is None
        assert data["kilometrage"] is None
        assert data["diagnostic"] is None
        assert data["travail_effectue"] is None

    def test_create_reparation_status_normalization(
        self, test_client, headers_responsable, vehicule1, mecanicien1_profile
    ):
        """Normalisation automatique du statut (minuscules, espaces, accents)."""
        payload = {
            "description": "Diagnostic injection",
            "date_reparation": "2026-11-20",
            "statut": "en cours",
            "id_vehicule": vehicule1.id_vehicule,
            "id_mecanicien": mecanicien1_profile.id_mecanicien,
        }
        res = test_client.post(
            "/api/v1/reparations",
            headers=headers_responsable,
            json=payload,
        )
        assert res.status_code == 201
        assert res.get_json()["data"]["statut"] == "EN_COURS"

    def test_create_reparation_missing_required_fields(
        self, test_client, headers_responsable
    ):
        """Échoue avec 422 si des champs obligatoires sont absents."""
        res = test_client.post(
            "/api/v1/reparations",
            headers=headers_responsable,
            json={"description": "Test seul"},
        )
        assert res.status_code == 422
        body = res.get_json()
        assert body["success"] is False
        assert body["error"]["code"] == "VALIDATION_ERROR"
        details = body["error"]["details"]
        assert "date_reparation" in details
        assert "statut" in details
        assert "id_vehicule" in details
        assert "id_mecanicien" in details

    def test_create_reparation_empty_description(
        self, test_client, headers_responsable, vehicule1, mecanicien1_profile
    ):
        """Échoue avec 422 si la description est vide ou ne contient que des espaces."""
        payload = {
            "description": "   ",
            "date_reparation": "2026-11-19",
            "statut": "EN_ATTENTE",
            "id_vehicule": vehicule1.id_vehicule,
            "id_mecanicien": mecanicien1_profile.id_mecanicien,
        }
        res = test_client.post(
            "/api/v1/reparations",
            headers=headers_responsable,
            json=payload,
        )
        assert res.status_code == 422
        body = res.get_json()
        assert body["success"] is False
        assert "description" in body["error"]["details"]

    def test_create_reparation_invalid_status(
        self, test_client, headers_responsable, vehicule1, mecanicien1_profile
    ):
        """Échoue avec 422 si le statut n'est pas dans la liste autorisée."""
        payload = {
            "description": "Test",
            "date_reparation": "2026-11-19",
            "statut": "INCONNU_TOTAL",
            "id_vehicule": vehicule1.id_vehicule,
            "id_mecanicien": mecanicien1_profile.id_mecanicien,
        }
        res = test_client.post(
            "/api/v1/reparations",
            headers=headers_responsable,
            json=payload,
        )
        assert res.status_code == 422
        body = res.get_json()
        assert body["success"] is False
        assert "statut" in body["error"]["details"]

    def test_create_reparation_negative_cout(
        self, test_client, headers_responsable, vehicule1, mecanicien1_profile
    ):
        """Échoue avec 422 si le coût est négatif."""
        payload = {
            "description": "Test coût négatif",
            "date_reparation": "2026-11-19",
            "statut": "EN_ATTENTE",
            "cout": -50.0,
            "id_vehicule": vehicule1.id_vehicule,
            "id_mecanicien": mecanicien1_profile.id_mecanicien,
        }
        res = test_client.post(
            "/api/v1/reparations",
            headers=headers_responsable,
            json=payload,
        )
        assert res.status_code == 422
        body = res.get_json()
        assert body["success"] is False
        assert "cout" in body["error"]["details"]

    def test_create_reparation_negative_kilometrage(
        self, test_client, headers_responsable, vehicule1, mecanicien1_profile
    ):
        """Échoue avec 422 si le kilométrage est négatif."""
        payload = {
            "description": "Test km négatif",
            "date_reparation": "2026-11-19",
            "statut": "EN_ATTENTE",
            "kilometrage": -100,
            "id_vehicule": vehicule1.id_vehicule,
            "id_mecanicien": mecanicien1_profile.id_mecanicien,
        }
        res = test_client.post(
            "/api/v1/reparations",
            headers=headers_responsable,
            json=payload,
        )
        assert res.status_code == 422
        body = res.get_json()
        assert body["success"] is False
        assert "kilometrage" in body["error"]["details"]

    def test_create_reparation_nonexistent_vehicule(
        self, test_client, headers_responsable, mecanicien1_profile
    ):
        """Échoue avec 404 si le véhicule n'existe pas."""
        payload = {
            "description": "Test",
            "date_reparation": "2026-11-19",
            "statut": "EN_ATTENTE",
            "id_vehicule": 99999,
            "id_mecanicien": mecanicien1_profile.id_mecanicien,
        }
        res = test_client.post(
            "/api/v1/reparations",
            headers=headers_responsable,
            json=payload,
        )
        assert res.status_code == 404
        body = res.get_json()
        assert body["success"] is False
        assert body["error"]["code"] == "NOT_FOUND"

    def test_create_reparation_nonexistent_mecanicien(
        self, test_client, headers_responsable, vehicule1
    ):
        """Échoue avec 404 si le mécanicien n'existe pas."""
        payload = {
            "description": "Test",
            "date_reparation": "2026-11-19",
            "statut": "EN_ATTENTE",
            "id_vehicule": vehicule1.id_vehicule,
            "id_mecanicien": 99999,
        }
        res = test_client.post(
            "/api/v1/reparations",
            headers=headers_responsable,
            json=payload,
        )
        assert res.status_code == 404
        body = res.get_json()
        assert body["success"] is False
        assert body["error"]["code"] == "NOT_FOUND"

    def test_create_reparation_empty_payload(self, test_client, headers_responsable):
        """Échoue avec 422 si le corps JSON est vide ou manquant."""
        res = test_client.post(
            "/api/v1/reparations",
            headers=headers_responsable,
            data="not-json",
            content_type="text/plain",
        )
        assert res.status_code == 422
        assert res.get_json()["error"]["code"] == "VALIDATION_ERROR"

    # --- LIST / GET TESTS ---

    def test_list_reparations_responsable_sees_all(
        self, test_client, headers_responsable, sample_reparation1, sample_reparation2
    ):
        """Le Responsable voit l'ensemble des réparations de l'atelier."""
        res = test_client.get("/api/v1/reparations", headers=headers_responsable)
        assert res.status_code == 200
        body = res.get_json()
        assert body["success"] is True
        data = body["data"]
        ids = [r["id_reparation"] for r in data]
        assert sample_reparation1.id_reparation in ids
        assert sample_reparation2.id_reparation in ids

    def test_list_reparations_filter_by_vehicule(
        self, test_client, headers_responsable, sample_reparation1, sample_reparation2, vehicule1
    ):
        """Filtrage précis par véhicule."""
        res = test_client.get(
            f"/api/v1/reparations?id_vehicule={vehicule1.id_vehicule}",
            headers=headers_responsable,
        )
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert len(data) == 1
        assert data[0]["id_reparation"] == sample_reparation1.id_reparation

    def test_list_reparations_filter_by_mecanicien(
        self, test_client, headers_responsable, sample_reparation1, sample_reparation2, mecanicien2_profile
    ):
        """Filtrage précis par mécanicien pour un Responsable."""
        res = test_client.get(
            f"/api/v1/reparations?id_mecanicien={mecanicien2_profile.id_mecanicien}",
            headers=headers_responsable,
        )
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert len(data) == 1
        assert data[0]["id_reparation"] == sample_reparation2.id_reparation

    def test_list_reparations_filter_by_statut(
        self, test_client, headers_responsable, sample_reparation1, sample_reparation2
    ):
        """Filtrage précis par statut."""
        res = test_client.get(
            "/api/v1/reparations?statut=TERMINEE",
            headers=headers_responsable,
        )
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert len(data) == 1
        assert data[0]["id_reparation"] == sample_reparation2.id_reparation

    def test_list_reparations_filter_by_date(
        self, test_client, headers_responsable, sample_reparation1, sample_reparation2
    ):
        """Filtrage par date (paramètre date ou date_reparation)."""
        res = test_client.get(
            "/api/v1/reparations?date=2026-11-10",
            headers=headers_responsable,
        )
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert len(data) == 1
        assert data[0]["id_reparation"] == sample_reparation1.id_reparation

    def test_list_reparations_invalid_filter_types(self, test_client, headers_responsable):
        """Paramètres de filtre invalides renvoient 422."""
        res1 = test_client.get("/api/v1/reparations?id_vehicule=abc", headers=headers_responsable)
        assert res1.status_code == 422
        assert res1.get_json()["error"]["code"] == "VALIDATION_ERROR"

        res2 = test_client.get("/api/v1/reparations?id_mecanicien=xyz", headers=headers_responsable)
        assert res2.status_code == 422
        assert res2.get_json()["error"]["code"] == "VALIDATION_ERROR"

        res3 = test_client.get("/api/v1/reparations?date=pas-une-date", headers=headers_responsable)
        assert res3.status_code == 422
        assert res3.get_json()["error"]["code"] == "VALIDATION_ERROR"

    def test_get_reparation_by_id_success(
        self, test_client, headers_responsable, sample_reparation1
    ):
        """Récupération par identifiant unique (200 OK)."""
        res = test_client.get(
            f"/api/v1/reparations/{sample_reparation1.id_reparation}",
            headers=headers_responsable,
        )
        assert res.status_code == 200
        body = res.get_json()
        assert body["success"] is True
        data = body["data"]
        assert data["id_reparation"] == sample_reparation1.id_reparation
        assert data["description"] == sample_reparation1.description

    def test_get_reparation_by_id_not_found(self, test_client, headers_responsable):
        """Réparation introuvable renvoie 404."""
        res = test_client.get("/api/v1/reparations/99999", headers=headers_responsable)
        assert res.status_code == 404
        body = res.get_json()
        assert body["success"] is False
        assert body["error"]["code"] == "NOT_FOUND"

    # --- UPDATE TESTS ---

    def test_update_reparation_responsable_success(
        self, test_client, headers_responsable, sample_reparation1
    ):
        """Le Responsable peut mettre à jour n'importe quel champ valide (200 OK)."""
        payload = {
            "description": "Vidange complète + changement filtre habitacle",
            "statut": "TERMINEE",
            "cout": 190.0,
            "kilometrage": 35200,
        }
        res = test_client.put(
            f"/api/v1/reparations/{sample_reparation1.id_reparation}",
            headers=headers_responsable,
            json=payload,
        )
        assert res.status_code == 200
        body = res.get_json()
        assert body["success"] is True
        data = body["data"]
        assert data["description"] == payload["description"]
        assert data["statut"] == "TERMINEE"
        assert data["cout"] == 190.0
        assert data["kilometrage"] == 35200

    def test_update_reparation_responsable_reassign_vehicule(
        self, test_client, headers_responsable, sample_reparation1, vehicule2
    ):
        """Le Responsable peut réassigner le véhicule lié à la réparation."""
        payload = {"id_vehicule": vehicule2.id_vehicule}
        res = test_client.patch(
            f"/api/v1/reparations/{sample_reparation1.id_reparation}",
            headers=headers_responsable,
            json=payload,
        )
        assert res.status_code == 200
        assert res.get_json()["data"]["id_vehicule"] == vehicule2.id_vehicule

    def test_update_reparation_responsable_reassign_mecanicien(
        self, test_client, headers_responsable, sample_reparation1, mecanicien2_profile
    ):
        """Le Responsable peut réassigner le mécanicien en charge de la réparation."""
        payload = {"id_mecanicien": mecanicien2_profile.id_mecanicien}
        res = test_client.patch(
            f"/api/v1/reparations/{sample_reparation1.id_reparation}",
            headers=headers_responsable,
            json=payload,
        )
        assert res.status_code == 200
        assert res.get_json()["data"]["id_mecanicien"] == mecanicien2_profile.id_mecanicien

    def test_update_reparation_reassign_nonexistent_vehicule(
        self, test_client, headers_responsable, sample_reparation1
    ):
        """Échoue avec 404 si le nouveau véhicule n'existe pas."""
        res = test_client.patch(
            f"/api/v1/reparations/{sample_reparation1.id_reparation}",
            headers=headers_responsable,
            json={"id_vehicule": 99999},
        )
        assert res.status_code == 404
        assert res.get_json()["error"]["code"] == "NOT_FOUND"

    def test_update_reparation_reassign_nonexistent_mecanicien(
        self, test_client, headers_responsable, sample_reparation1
    ):
        """Échoue avec 404 si le nouveau mécanicien n'existe pas."""
        res = test_client.patch(
            f"/api/v1/reparations/{sample_reparation1.id_reparation}",
            headers=headers_responsable,
            json={"id_mecanicien": 99999},
        )
        assert res.status_code == 404
        assert res.get_json()["error"]["code"] == "NOT_FOUND"

    def test_update_reparation_empty_body(
        self, test_client, headers_responsable, sample_reparation1
    ):
        """Rejette une charge utile vide avec 422."""
        res = test_client.put(
            f"/api/v1/reparations/{sample_reparation1.id_reparation}",
            headers=headers_responsable,
            json={},
        )
        assert res.status_code == 422
        assert res.get_json()["error"]["code"] == "VALIDATION_ERROR"

    def test_update_reparation_negative_values(
        self, test_client, headers_responsable, sample_reparation1
    ):
        """Rejette les valeurs négatives lors de la mise à jour (422)."""
        res1 = test_client.patch(
            f"/api/v1/reparations/{sample_reparation1.id_reparation}",
            headers=headers_responsable,
            json={"cout": -15.0},
        )
        assert res1.status_code == 422
        assert res1.get_json()["error"]["code"] == "VALIDATION_ERROR"

        res2 = test_client.patch(
            f"/api/v1/reparations/{sample_reparation1.id_reparation}",
            headers=headers_responsable,
            json={"kilometrage": -50},
        )
        assert res2.status_code == 422
        assert res2.get_json()["error"]["code"] == "VALIDATION_ERROR"

    def test_update_reparation_not_found(self, test_client, headers_responsable):
        """Mise à jour d'une réparation inexistante renvoie 404."""
        res = test_client.put(
            "/api/v1/reparations/99999",
            headers=headers_responsable,
            json={"statut": "TERMINEE"},
        )
        assert res.status_code == 404
        assert res.get_json()["error"]["code"] == "NOT_FOUND"


# ============================================================================
# Tests: Mechanic Ownership & Isolation (Task 6)
# ============================================================================

class TestMechanicOwnership:
    """Vérification stricte de la propriété mécanicien.

    Un mécanicien ne peut accéder et mettre à jour qu'exclusivement
    les réparations qui lui sont assignées.
    """

    def test_mechanic_list_only_assigned_repairs(
        self, test_client, headers_mecanicien1, sample_reparation1, sample_reparation2
    ):
        """Le Mécanicien 1 ne voit dans la liste que ses propres réparations."""
        res = test_client.get("/api/v1/reparations", headers=headers_mecanicien1)
        assert res.status_code == 200
        body = res.get_json()
        assert body["success"] is True
        data = body["data"]
        ids = [r["id_reparation"] for r in data]
        assert sample_reparation1.id_reparation in ids
        assert sample_reparation2.id_reparation not in ids

    def test_mechanic_get_own_repair_success(
        self, test_client, headers_mecanicien1, sample_reparation1
    ):
        """Le Mécanicien 1 peut consulter sa propre réparation (200 OK)."""
        res = test_client.get(
            f"/api/v1/reparations/{sample_reparation1.id_reparation}",
            headers=headers_mecanicien1,
        )
        assert res.status_code == 200
        assert res.get_json()["data"]["id_reparation"] == sample_reparation1.id_reparation

    def test_mechanic_cannot_get_other_mechanic_repair(
        self, test_client, headers_mecanicien1, sample_reparation2
    ):
        """Le Mécanicien 1 se voit refuser l'accès à la réparation du Mécanicien 2 (403 Forbidden)."""
        res = test_client.get(
            f"/api/v1/reparations/{sample_reparation2.id_reparation}",
            headers=headers_mecanicien1,
        )
        assert res.status_code == 403
        data = res.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "FORBIDDEN"
        assert "Accès non autorisé" in data["error"]["message"]

    def test_mechanic_update_own_repair_success(
        self, test_client, headers_mecanicien1, sample_reparation1
    ):
        """Le Mécanicien 1 met à jour le statut, le diagnostic et le travail effectué (200 OK)."""
        payload = {
            "statut": "TERMINEE",
            "diagnostic": "Vidange terminée, niveau validé",
            "travail_effectue": "Huile 5W30 + filtre neufs",
            "kilometrage": 35050,
        }
        res = test_client.put(
            f"/api/v1/reparations/{sample_reparation1.id_reparation}",
            headers=headers_mecanicien1,
            json=payload,
        )
        assert res.status_code == 200
        body = res.get_json()
        assert body["success"] is True
        data = body["data"]
        assert data["statut"] == "TERMINEE"
        assert data["diagnostic"] == payload["diagnostic"]
        assert data["kilometrage"] == 35050

    def test_mechanic_cannot_update_other_mechanic_repair(
        self, test_client, headers_mecanicien1, sample_reparation2
    ):
        """Le Mécanicien 1 ne peut pas modifier la réparation d'un confrère (403 Forbidden)."""
        payload = {"statut": "TERMINEE"}
        res = test_client.put(
            f"/api/v1/reparations/{sample_reparation2.id_reparation}",
            headers=headers_mecanicien1,
            json=payload,
        )
        assert res.status_code == 403
        data = res.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "FORBIDDEN"

    def test_mechanic_cannot_reassign_mechanic(
        self, test_client, headers_mecanicien1, sample_reparation1, mecanicien2_profile
    ):
        """Un mécanicien ne peut pas réassigner la réparation à un autre mécanicien (403 Forbidden)."""
        payload = {"id_mecanicien": mecanicien2_profile.id_mecanicien}
        res = test_client.patch(
            f"/api/v1/reparations/{sample_reparation1.id_reparation}",
            headers=headers_mecanicien1,
            json=payload,
        )
        assert res.status_code == 403
        data = res.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "FORBIDDEN"
        assert "réassigner" in data["error"]["message"].lower()

    def test_mechanic_cannot_reassign_vehicule(
        self, test_client, headers_mecanicien1, sample_reparation1, vehicule2
    ):
        """Un mécanicien ne peut pas réassigner le véhicule de sa réparation (403 Forbidden)."""
        payload = {"id_vehicule": vehicule2.id_vehicule}
        res = test_client.patch(
            f"/api/v1/reparations/{sample_reparation1.id_reparation}",
            headers=headers_mecanicien1,
            json=payload,
        )
        assert res.status_code == 403
        data = res.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "FORBIDDEN"
        assert "réassigner" in data["error"]["message"].lower()

    def test_unassigned_mechanic_user_forbidden(
        self, test_client, headers_unassigned_mecanicien, sample_reparation1
    ):
        """Un utilisateur au rôle MECANICIEN sans profil en base est bloqué (403 Forbidden)."""
        res_list = test_client.get("/api/v1/reparations", headers=headers_unassigned_mecanicien)
        assert res_list.status_code == 403
        assert res_list.get_json()["error"]["code"] == "FORBIDDEN"

        res_get = test_client.get(
            f"/api/v1/reparations/{sample_reparation1.id_reparation}",
            headers=headers_unassigned_mecanicien,
        )
        assert res_get.status_code == 403
        assert res_get.get_json()["error"]["code"] == "FORBIDDEN"

        res_put = test_client.put(
            f"/api/v1/reparations/{sample_reparation1.id_reparation}",
            headers=headers_unassigned_mecanicien,
            json={"statut": "TERMINEE"},
        )
        assert res_put.status_code == 403
        assert res_put.get_json()["error"]["code"] == "FORBIDDEN"


# ============================================================================
# Tests: Anti-Cascade Deletion Prevention (Task 7)
# ============================================================================

class TestReparationDeletionPrevention:
    """Vérification de la protection contre la suppression (anti-cascade).

    La suppression d'une réparation est formellement bloquée si une facture
    ou des pièces détachées lui sont associées (409 Conflict).
    """

    def test_delete_reparation_clean_success(
        self, test_client, headers_responsable, sample_reparation1
    ):
        """Suppression réussie d'une réparation sans facture ni pièces (200 OK)."""
        rep_id = sample_reparation1.id_reparation
        res = test_client.delete(
            f"/api/v1/reparations/{rep_id}",
            headers=headers_responsable,
        )
        assert res.status_code == 200
        assert res.get_json()["success"] is True

        # Vérification en base : la réparation n'existe plus
        res_check = test_client.get(
            f"/api/v1/reparations/{rep_id}",
            headers=headers_responsable,
        )
        assert res_check.status_code == 404

    def test_delete_reparation_not_found(self, test_client, headers_responsable):
        """Suppression d'une réparation inexistante renvoie 404."""
        res = test_client.delete("/api/v1/reparations/99999", headers=headers_responsable)
        assert res.status_code == 404
        assert res.get_json()["error"]["code"] == "NOT_FOUND"

    def test_delete_reparation_with_invoice_conflict(
        self, test_client, headers_responsable, sample_reparation1
    ):
        """Interdiction de supprimer une réparation rattachée à une facture (409 Conflict)."""
        facture = Facture(
            date_facture=date(2026, 11, 15),
            montant_total=Decimal("150.00"),
            statut_paiement="PAYEE",
            id_reparation=sample_reparation1.id_reparation,
        )
        db.session.add(facture)
        db.session.commit()

        res = test_client.delete(
            f"/api/v1/reparations/{sample_reparation1.id_reparation}",
            headers=headers_responsable,
        )
        assert res.status_code == 409
        body = res.get_json()
        assert body["success"] is False
        assert body["error"]["code"] == "CONFLICT"
        assert "facture" in body["error"]["message"].lower()
        assert "facture_id" in body["error"]["details"]

    def test_delete_reparation_with_parts_conflict(
        self, test_client, headers_responsable, sample_reparation1
    ):
        """Interdiction de supprimer une réparation rattachée à des pièces consommées (409 Conflict)."""
        piece = PieceDetachee(
            nom="Filtre à huile Purflux",
            prix_unitaire=Decimal("15.00"),
            quantite_stock=50,
        )
        db.session.add(piece)
        db.session.commit()

        rep_piece = ReparationPiece(
            id_reparation=sample_reparation1.id_reparation,
            id_piece=piece.id_piece,
            quantite=1,
            prix_unitaire=Decimal("15.00"),
        )
        db.session.add(rep_piece)
        db.session.commit()

        res = test_client.delete(
            f"/api/v1/reparations/{sample_reparation1.id_reparation}",
            headers=headers_responsable,
        )
        assert res.status_code == 409
        body = res.get_json()
        assert body["success"] is False
        assert body["error"]["code"] == "CONFLICT"
        assert "pièce(s)" in body["error"]["message"]
        assert body["error"]["details"]["pieces_count"] == 1

    def test_delete_reparation_with_both_invoice_and_parts_conflict(
        self, test_client, headers_responsable, sample_reparation1
    ):
        """Interdiction avec mention explicite de la facture et des pièces (409 Conflict)."""
        facture = Facture(
            date_facture=date(2026, 11, 15),
            montant_total=Decimal("180.00"),
            statut_paiement="EN_ATTENTE",
            id_reparation=sample_reparation1.id_reparation,
        )
        piece = PieceDetachee(
            nom="Huile 5W30 5L",
            prix_unitaire=Decimal("45.00"),
            quantite_stock=20,
        )
        db.session.add_all([facture, piece])
        db.session.commit()

        rep_piece = ReparationPiece(
            id_reparation=sample_reparation1.id_reparation,
            id_piece=piece.id_piece,
            quantite=1,
            prix_unitaire=Decimal("45.00"),
        )
        db.session.add(rep_piece)
        db.session.commit()

        res = test_client.delete(
            f"/api/v1/reparations/{sample_reparation1.id_reparation}",
            headers=headers_responsable,
        )
        assert res.status_code == 409
        body = res.get_json()
        assert body["success"] is False
        assert body["error"]["code"] == "CONFLICT"
        assert "facture" in body["error"]["message"].lower()
        assert "pièce(s)" in body["error"]["message"].lower()


# ============================================================================
# Tests: Service Layer Direct & Edge Cases
# ============================================================================

class TestReparationServiceDirect:
    """Tests unitaires directs sur reparation_service."""

    def test_create_reparation_service_direct(
        self, reparation_app, vehicule1, mecanicien1_profile
    ):
        """Création directe via le service."""
        data = {
            "description": "Remplacement bougies d'allumage",
            "date_reparation": date(2026, 11, 21),
            "statut": "EN_ATTENTE",
            "cout": Decimal("60.00"),
            "kilometrage": 35000,
            "id_vehicule": vehicule1.id_vehicule,
            "id_mecanicien": mecanicien1_profile.id_mecanicien,
        }
        rep = reparation_service.create_reparation(data)
        assert rep.id_reparation is not None
        assert rep.description == "Remplacement bougies d'allumage"

    def test_update_reparation_service_empty_data_raises(
        self, reparation_app, sample_reparation1
    ):
        """Appel direct du service de mise à jour avec données vides lève ValidationError."""
        with pytest.raises(ValidationError):
            reparation_service.update_reparation(sample_reparation1.id_reparation, {})

    def test_get_authenticated_mecanicien_missing_user_id(self, reparation_app):
        """Recherche de profil mécanicien sans user_id lève ForbiddenError."""
        with pytest.raises(ForbiddenError):
            reparation_service._get_authenticated_mecanicien(None)

    def test_get_authenticated_mecanicien_nonexistent_profile(self, reparation_app):
        """Recherche de profil mécanicien pour un id inexistant lève ForbiddenError."""
        with pytest.raises(ForbiddenError):
            reparation_service._get_authenticated_mecanicien(99999)


# ============================================================================
# Tests: Marshmallow Schema Direct
# ============================================================================

class TestReparationSchemasDirect:
    """Tests unitaires sur les schémas Marshmallow de validation."""

    def test_create_schema_valid_payload(self):
        """Validation d'un payload valide complet."""
        raw = {
            "description": "  Test description  ",
            "date_reparation": "2026-11-25",
            "statut": "en cours",
            "cout": 120.5,
            "kilometrage": 50000,
            "id_vehicule": 1,
            "id_mecanicien": 2,
        }
        result = reparation_create_schema.load(raw)
        assert result["description"] == "Test description"
        assert result["statut"] == "EN_COURS"
        assert result["date_reparation"] == date(2026, 11, 25)
        assert result["cout"] == Decimal("120.5")

    def test_create_schema_invalid_status_choices(self):
        """Vérifie que les statuts invalides sont rejetés."""
        with pytest.raises(Exception):
            reparation_create_schema.load({
                "description": "Test",
                "date_reparation": "2026-11-25",
                "statut": "INVALIDE",
                "id_vehicule": 1,
                "id_mecanicien": 1,
            })

    def test_update_schema_partial(self):
        """Vérifie la mise à jour partielle via le schéma."""
        valid_result = reparation_update_schema.load({"statut": "terminee", "cout": 99.99})
        assert valid_result["statut"] == "TERMINEE"
        assert valid_result["cout"] == Decimal("99.99")

    def test_response_schema_dump(self, reparation_app, sample_reparation1):
        """Vérifie la sérialisation conforme par ReparationResponseSchema."""
        dumped = reparation_response_schema.dump(sample_reparation1)
        assert dumped["id_reparation"] == sample_reparation1.id_reparation
        assert dumped["description"] == sample_reparation1.description
        assert dumped["date_reparation"] == "2026-11-10"
        assert dumped["statut"] == "EN_COURS"
        assert isinstance(dumped["cout"], float)
        assert dumped["cout"] == 150.0
