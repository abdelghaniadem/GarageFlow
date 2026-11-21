"""Tests complets pour le module Gestion des Pièces Détachées de GarageFlow.

Exécution isolée en mémoire avec SQLite (sqlite:///:memory:).
Aucune connexion à PostgreSQL, aucune modification de la base réelle et aucune migration.
Couvre :
- Enregistrement du blueprint (/api/v1/pieces et alias /api/v1/pieces-detachees)
- Authentification JWT & RBAC (RESPONSABLE vs MECANICIEN vs Rôles interdits)
- Validation des schémas Marshmallow (nom obligatoire 1-100 car, prix >= 0, stock >= 0)
- Opérations CRUD complètes (Create, Read, Update, Delete)
- Recherche textuelle et filtrage par seuil de stock et fourchette de prix
- Rejet des conflits de doublons de nom (409 Conflict)
- Protection anti-cascade contre la suppression si la pièce est liée à des réparations (409 Conflict)
- Tests directs de service et de schéma
"""
import pytest
from decimal import Decimal
from datetime import date
from flask_jwt_extended import create_access_token

from app import create_app
from app.extensions import db
from app.models import (
    Utilisateur,
    Mecanicien,
    Client,
    Vehicule,
    Reparation,
    PieceDetachee,
    ReparationPiece,
)
from app.services import piece_detachee_service
from app.schemas.piece_detachee_schema import (
    piece_detachee_create_schema,
    piece_detachee_update_schema,
    piece_detachee_response_schema,
)
from app.utils.exceptions import NotFoundError, ConflictError, ValidationError


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def piece_app(monkeypatch):
    """Crée une instance d'application Flask isolée avec base SQLite en mémoire."""
    monkeypatch.setenv("TEST_DATABASE_URL", "sqlite:///:memory:")
    app = create_app("testing")
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def test_client(piece_app):
    """Client HTTP de test."""
    return piece_app.test_client()


@pytest.fixture
def responsable_user(piece_app):
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
def mecanicien_user(piece_app):
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
def headers_responsable(responsable_user):
    """En-tête Bearer pour le Responsable."""
    token = create_access_token(
        identity=str(responsable_user.id_utilisateur),
        additional_claims={"role": "RESPONSABLE"},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def headers_mecanicien(mecanicien_user):
    """En-tête Bearer pour le Mécanicien."""
    token = create_access_token(
        identity=str(mecanicien_user.id_utilisateur),
        additional_claims={"role": "MECANICIEN"},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sample_piece1(piece_app):
    """Première pièce détachée témoin (stock normal)."""
    p = PieceDetachee(
        nom="Filtre à huile Purflux L358A",
        prix_unitaire=Decimal("12.50"),
        quantite_stock=25,
    )
    db.session.add(p)
    db.session.commit()
    return p


@pytest.fixture
def sample_piece2(piece_app):
    """Deuxième pièce détachée témoin (stock faible)."""
    p = PieceDetachee(
        nom="Plaquettes de frein avant Brembo P85020",
        prix_unitaire=Decimal("45.90"),
        quantite_stock=3,
    )
    db.session.add(p)
    db.session.commit()
    return p


@pytest.fixture
def sample_piece_out_of_stock(piece_app):
    """Troisième pièce témoin en rupture de stock (stock = 0)."""
    p = PieceDetachee(
        nom="Amortisseur arrière Monroe",
        prix_unitaire=Decimal("89.00"),
        quantite_stock=0,
    )
    db.session.add(p)
    db.session.commit()
    return p


@pytest.fixture
def piece_with_reparation(piece_app, sample_piece1, responsable_user, mecanicien_user):
    """Pièce détachée associée à une réparation (pour tester l'anti-cascade)."""
    # Profil mécanicien
    m = Mecanicien(specialite="Générale", id_utilisateur=mecanicien_user.id_utilisateur)
    # Client et véhicule
    c = Client(nom="Test", prenom="Client", telephone="0102030405")
    db.session.add_all([m, c])
    db.session.commit()

    v = Vehicule(
        marque="Renault",
        modele="Megane",
        immatriculation="CC-999-ZZ",
        id_client=c.id_client,
    )
    db.session.add(v)
    db.session.commit()

    rep = Reparation(
        description="Vidange moteur",
        date_reparation=date(2026, 11, 15),
        statut="TERMINEE",
        id_vehicule=v.id_vehicule,
        id_mecanicien=m.id_mecanicien,
    )
    db.session.add(rep)
    db.session.commit()

    assoc = ReparationPiece(
        id_reparation=rep.id_reparation,
        id_piece=sample_piece1.id_piece,
        quantite=1,
        prix_unitaire=Decimal("12.50"),
    )
    db.session.add(assoc)
    db.session.commit()
    return sample_piece1


# ============================================================================
# Tests: Blueprint Registration
# ============================================================================

class TestBlueprintRegistration:
    """Vérification de l'enregistrement correct du blueprint des pièces détachées."""

    def test_piece_blueprint_registered(self, piece_app):
        """Vérifie que le blueprint pieces_detachees est bien enregistré."""
        assert "pieces_detachees" in piece_app.blueprints
        rules = [rule.rule for rule in piece_app.url_map.iter_rules()]
        assert any("/api/v1/pieces" in r for r in rules)
        assert any("/api/v1/pieces-detachees" in r for r in rules)


# ============================================================================
# Tests: Authentication & RBAC
# ============================================================================

class TestPieceRBAC:
    """Vérification de l'authentification JWT et du contrôle d'accès basé sur les rôles (RBAC)."""

    def test_endpoints_unauthorized_without_jwt(self, test_client, sample_piece1):
        """Toutes les opérations requièrent un jeton JWT et renvoient HTTP 401 sans jeton."""
        p_id = sample_piece1.id_piece
        endpoints = [
            ("GET", "/api/v1/pieces", None),
            ("POST", "/api/v1/pieces", {"nom": "Bougie", "prix_unitaire": 8.5, "quantite_stock": 10}),
            ("GET", f"/api/v1/pieces/{p_id}", None),
            ("PUT", f"/api/v1/pieces/{p_id}", {"quantite_stock": 15}),
            ("DELETE", f"/api/v1/pieces/{p_id}", None),
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

    def test_read_endpoints_allowed_for_mecanicien(
        self, test_client, headers_mecanicien, sample_piece1
    ):
        """Un mécanicien a un accès en lecture seule aux pièces détachées (200 OK)."""
        # Liste
        res_list = test_client.get("/api/v1/pieces", headers=headers_mecanicien)
        assert res_list.status_code == 200
        assert res_list.get_json()["success"] is True

        # Détail
        res_get = test_client.get(
            f"/api/v1/pieces/{sample_piece1.id_piece}",
            headers=headers_mecanicien,
        )
        assert res_get.status_code == 200
        assert res_get.get_json()["success"] is True

    def test_write_endpoints_forbidden_for_mecanicien(
        self, test_client, headers_mecanicien, sample_piece1
    ):
        """Un mécanicien ne peut pas modifier le catalogue de pièces (403 Forbidden)."""
        p_id = sample_piece1.id_piece
        write_endpoints = [
            ("POST", "/api/v1/pieces", {"nom": "Test", "prix_unitaire": 10.0, "quantite_stock": 5}),
            ("PUT", f"/api/v1/pieces/{p_id}", {"quantite_stock": 30}),
            ("DELETE", f"/api/v1/pieces/{p_id}", None),
        ]
        for method, url, payload in write_endpoints:
            if method == "POST":
                resp = test_client.post(url, json=payload, headers=headers_mecanicien)
            elif method == "PUT":
                resp = test_client.put(url, json=payload, headers=headers_mecanicien)
            elif method == "DELETE":
                resp = test_client.delete(url, headers=headers_mecanicien)
            assert resp.status_code == 403, f"Expected 403 for {method} {url}, got {resp.status_code}"
            assert resp.get_json()["error"]["code"] == "FORBIDDEN"

    def test_unknown_role_forbidden(self, test_client, sample_piece1):
        """Un rôle non autorisé (ex: CLIENT) est rejeté sur tous les endpoints (403 Forbidden)."""
        token = create_access_token(
            identity="999",
            additional_claims={"role": "CLIENT"},
        )
        headers = {"Authorization": f"Bearer {token}"}
        p_id = sample_piece1.id_piece

        endpoints = [
            ("GET", "/api/v1/pieces", None),
            ("POST", "/api/v1/pieces", {"nom": "Test", "prix_unitaire": 10.0, "quantite_stock": 5}),
            ("GET", f"/api/v1/pieces/{p_id}", None),
            ("PUT", f"/api/v1/pieces/{p_id}", {"quantite_stock": 30}),
            ("DELETE", f"/api/v1/pieces/{p_id}", None),
        ]
        for method, url, payload in endpoints:
            if method == "GET":
                resp = test_client.get(url, headers=headers)
            elif method == "POST":
                resp = test_client.post(url, json=payload, headers=headers)
            elif method == "PUT":
                resp = test_client.put(url, json=payload, headers=headers)
            elif method == "DELETE":
                resp = test_client.delete(url, headers=headers)
            assert resp.status_code == 403, f"Expected 403 for {method} {url}, got {resp.status_code}"
            assert resp.get_json()["error"]["code"] == "FORBIDDEN"


# ============================================================================
# Tests: CRUD Operations & Validations
# ============================================================================

class TestPieceCRUD:
    """Tests des opérations CRUD complètes et des validations métier."""

    def test_create_piece_success(self, test_client, headers_responsable):
        """Le Responsable crée une pièce détachée avec succès (201 Created)."""
        payload = {
            "nom": "Disque de frein ventilé Bosch",
            "prix_unitaire": 58.75,
            "quantite_stock": 14,
        }
        res = test_client.post("/api/v1/pieces", headers=headers_responsable, json=payload)
        assert res.status_code == 201
        body = res.get_json()
        assert body["success"] is True
        data = body["data"]
        assert data["id_piece"] is not None
        assert data["nom"] == payload["nom"]
        assert data["prix_unitaire"] == 58.75
        assert data["quantite_stock"] == 14

    def test_create_piece_duplicate_name_conflict(
        self, test_client, headers_responsable, sample_piece1
    ):
        """Tentative de créer une pièce avec un nom déjà existant (insensible à la casse) -> 409 Conflict."""
        payload = {
            "nom": sample_piece1.nom.upper(),
            "prix_unitaire": 15.0,
            "quantite_stock": 10,
        }
        res = test_client.post("/api/v1/pieces", headers=headers_responsable, json=payload)
        assert res.status_code == 409
        body = res.get_json()
        assert body["success"] is False
        assert body["error"]["code"] == "CONFLICT"
        assert "nom" in body["error"]["details"]

    def test_create_piece_missing_required_fields(self, test_client, headers_responsable):
        """Échec avec 422 si des champs requis sont manquants."""
        # Manque prix_unitaire et quantite_stock
        res = test_client.post(
            "/api/v1/pieces",
            headers=headers_responsable,
            json={"nom": "Seulement le nom"},
        )
        assert res.status_code == 422
        body = res.get_json()
        assert body["success"] is False
        assert body["error"]["code"] == "VALIDATION_ERROR"
        details = body["error"]["details"]
        assert "prix_unitaire" in details
        assert "quantite_stock" in details

    def test_create_piece_empty_name(self, test_client, headers_responsable):
        """Échec avec 422 si le nom est vide ou contient uniquement des espaces."""
        payload = {
            "nom": "    ",
            "prix_unitaire": 10.0,
            "quantite_stock": 5,
        }
        res = test_client.post("/api/v1/pieces", headers=headers_responsable, json=payload)
        assert res.status_code == 422
        body = res.get_json()
        assert body["success"] is False
        assert "nom" in body["error"]["details"]

    def test_create_piece_name_too_long(self, test_client, headers_responsable):
        """Échec avec 422 si le nom dépasse 100 caractères."""
        payload = {
            "nom": "P" * 101,
            "prix_unitaire": 10.0,
            "quantite_stock": 5,
        }
        res = test_client.post("/api/v1/pieces", headers=headers_responsable, json=payload)
        assert res.status_code == 422
        assert "nom" in res.get_json()["error"]["details"]

    def test_create_piece_negative_price(self, test_client, headers_responsable):
        """Échec avec 422 si le prix unitaire est négatif."""
        payload = {
            "nom": "Pièce à prix négatif",
            "prix_unitaire": -10.0,
            "quantite_stock": 5,
        }
        res = test_client.post("/api/v1/pieces", headers=headers_responsable, json=payload)
        assert res.status_code == 422
        assert "prix_unitaire" in res.get_json()["error"]["details"]

    def test_create_piece_negative_stock(self, test_client, headers_responsable):
        """Échec avec 422 si la quantité en stock est négative."""
        payload = {
            "nom": "Pièce à stock négatif",
            "prix_unitaire": 15.0,
            "quantite_stock": -3,
        }
        res = test_client.post("/api/v1/pieces", headers=headers_responsable, json=payload)
        assert res.status_code == 422
        assert "quantite_stock" in res.get_json()["error"]["details"]

    def test_create_piece_empty_payload(self, test_client, headers_responsable):
        """Échec avec 422 si le corps de requête est vide ou non JSON."""
        res = test_client.post(
            "/api/v1/pieces",
            headers=headers_responsable,
            data="not-json",
            content_type="text/plain",
        )
        assert res.status_code == 422
        assert res.get_json()["error"]["code"] == "VALIDATION_ERROR"

    # --- LIST / GET TESTS ---

    def test_list_pieces_success(
        self, test_client, headers_responsable, sample_piece1, sample_piece2, sample_piece_out_of_stock
    ):
        """Liste l'ensemble des pièces disponibles (200 OK)."""
        res = test_client.get("/api/v1/pieces", headers=headers_responsable)
        assert res.status_code == 200
        body = res.get_json()
        assert body["success"] is True
        ids = [p["id_piece"] for p in body["data"]]
        assert sample_piece1.id_piece in ids
        assert sample_piece2.id_piece in ids
        assert sample_piece_out_of_stock.id_piece in ids

    def test_list_pieces_alias_endpoint(
        self, test_client, headers_responsable, sample_piece1
    ):
        """Vérifie que l'alias /api/v1/pieces-detachees fonctionne à l'identique."""
        res = test_client.get("/api/v1/pieces-detachees", headers=headers_responsable)
        assert res.status_code == 200
        body = res.get_json()
        assert body["success"] is True
        ids = [p["id_piece"] for p in body["data"]]
        assert sample_piece1.id_piece in ids

    def test_list_pieces_search_filter(
        self, test_client, headers_responsable, sample_piece1, sample_piece2
    ):
        """Recherche textuelle par nom de pièce (insensible à la casse)."""
        res = test_client.get("/api/v1/pieces?search=purflux", headers=headers_responsable)
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert len(data) == 1
        assert data[0]["id_piece"] == sample_piece1.id_piece

    def test_list_pieces_stock_faible_filter(
        self, test_client, headers_responsable, sample_piece1, sample_piece2, sample_piece_out_of_stock
    ):
        """Filtrage des pièces en stock faible (stock <= 5)."""
        res = test_client.get("/api/v1/pieces?stock_faible=true", headers=headers_responsable)
        assert res.status_code == 200
        data = res.get_json()["data"]
        ids = [p["id_piece"] for p in data]
        # sample_piece2 (stock 3) et sample_piece_out_of_stock (stock 0) doivent être présents
        assert sample_piece2.id_piece in ids
        assert sample_piece_out_of_stock.id_piece in ids
        # sample_piece1 (stock 25) ne doit PAS être présent
        assert sample_piece1.id_piece not in ids

    def test_list_pieces_stock_range_filter(
        self, test_client, headers_responsable, sample_piece1, sample_piece2, sample_piece_out_of_stock
    ):
        """Filtrage par fourchette de stock (stock_min et stock_max)."""
        res = test_client.get(
            "/api/v1/pieces?stock_min=1&stock_max=10",
            headers=headers_responsable,
        )
        assert res.status_code == 200
        data = res.get_json()["data"]
        ids = [p["id_piece"] for p in data]
        assert sample_piece2.id_piece in ids
        assert sample_piece1.id_piece not in ids
        assert sample_piece_out_of_stock.id_piece not in ids

    def test_list_pieces_price_range_filter(
        self, test_client, headers_responsable, sample_piece1, sample_piece2, sample_piece_out_of_stock
    ):
        """Filtrage par fourchette de prix (prix_min et prix_max)."""
        res = test_client.get(
            "/api/v1/pieces?prix_min=40.0&prix_max=60.0",
            headers=headers_responsable,
        )
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert len(data) == 1
        assert data[0]["id_piece"] == sample_piece2.id_piece

    def test_list_pieces_invalid_filter_types(self, test_client, headers_responsable):
        """Paramètres de filtre invalides renvoient HTTP 422."""
        res1 = test_client.get("/api/v1/pieces?stock_min=not_an_int", headers=headers_responsable)
        assert res1.status_code == 422
        assert res1.get_json()["error"]["code"] == "VALIDATION_ERROR"

        res2 = test_client.get("/api/v1/pieces?prix_min=not_a_float", headers=headers_responsable)
        assert res2.status_code == 422
        assert res2.get_json()["error"]["code"] == "VALIDATION_ERROR"

    def test_get_piece_by_id_success(self, test_client, headers_responsable, sample_piece1):
        """Consultation d'une pièce par identifiant (200 OK)."""
        res = test_client.get(f"/api/v1/pieces/{sample_piece1.id_piece}", headers=headers_responsable)
        assert res.status_code == 200
        body = res.get_json()
        assert body["success"] is True
        assert body["data"]["id_piece"] == sample_piece1.id_piece
        assert body["data"]["nom"] == sample_piece1.nom

    def test_get_piece_by_id_not_found(self, test_client, headers_responsable):
        """Consultation d'une pièce inexistante renvoie 404."""
        res = test_client.get("/api/v1/pieces/99999", headers=headers_responsable)
        assert res.status_code == 404
        assert res.get_json()["error"]["code"] == "NOT_FOUND"

    # --- UPDATE TESTS ---

    def test_update_piece_success(self, test_client, headers_responsable, sample_piece1):
        """Mise à jour partielle des champs (200 OK)."""
        payload = {
            "prix_unitaire": 14.20,
            "quantite_stock": 35,
        }
        res = test_client.put(
            f"/api/v1/pieces/{sample_piece1.id_piece}",
            headers=headers_responsable,
            json=payload,
        )
        assert res.status_code == 200
        body = res.get_json()
        assert body["success"] is True
        assert body["data"]["prix_unitaire"] == 14.20
        assert body["data"]["quantite_stock"] == 35
        # Le nom reste inchangé
        assert body["data"]["nom"] == sample_piece1.nom

    def test_update_piece_rename_success(self, test_client, headers_responsable, sample_piece1):
        """Renommage valide d'une pièce (200 OK)."""
        res = test_client.patch(
            f"/api/v1/pieces/{sample_piece1.id_piece}",
            headers=headers_responsable,
            json={"nom": "Filtre à huile Purflux L358A (Nouveau Modèle)"},
        )
        assert res.status_code == 200
        assert res.get_json()["data"]["nom"] == "Filtre à huile Purflux L358A (Nouveau Modèle)"

    def test_update_piece_duplicate_name_conflict(
        self, test_client, headers_responsable, sample_piece1, sample_piece2
    ):
        """Tentative de renommer une pièce avec le nom d'une autre pièce -> 409 Conflict."""
        res = test_client.patch(
            f"/api/v1/pieces/{sample_piece1.id_piece}",
            headers=headers_responsable,
            json={"nom": sample_piece2.nom},
        )
        assert res.status_code == 409
        body = res.get_json()
        assert body["success"] is False
        assert body["error"]["code"] == "CONFLICT"

    def test_update_piece_empty_body(self, test_client, headers_responsable, sample_piece1):
        """Rejette une charge utile vide avec HTTP 422."""
        res = test_client.put(
            f"/api/v1/pieces/{sample_piece1.id_piece}",
            headers=headers_responsable,
            json={},
        )
        assert res.status_code == 422
        assert res.get_json()["error"]["code"] == "VALIDATION_ERROR"

    def test_update_piece_negative_values(self, test_client, headers_responsable, sample_piece1):
        """Rejette un prix unitaire ou un stock négatif avec HTTP 422."""
        res1 = test_client.patch(
            f"/api/v1/pieces/{sample_piece1.id_piece}",
            headers=headers_responsable,
            json={"prix_unitaire": -5.0},
        )
        assert res1.status_code == 422

        res2 = test_client.patch(
            f"/api/v1/pieces/{sample_piece1.id_piece}",
            headers=headers_responsable,
            json={"quantite_stock": -10},
        )
        assert res2.status_code == 422

    def test_update_piece_not_found(self, test_client, headers_responsable):
        """Mise à jour d'une pièce inexistante renvoie 404."""
        res = test_client.put(
            "/api/v1/pieces/99999",
            headers=headers_responsable,
            json={"quantite_stock": 10},
        )
        assert res.status_code == 404
        assert res.get_json()["error"]["code"] == "NOT_FOUND"

    # --- DELETE TESTS ---

    def test_delete_piece_clean_success(self, test_client, headers_responsable, sample_piece2):
        """Suppression d'une pièce sans historique d'utilisation (200 OK)."""
        p_id = sample_piece2.id_piece
        res = test_client.delete(f"/api/v1/pieces/{p_id}", headers=headers_responsable)
        assert res.status_code == 200
        assert res.get_json()["success"] is True

        # Vérification de la disparition en base
        res_get = test_client.get(f"/api/v1/pieces/{p_id}", headers=headers_responsable)
        assert res_get.status_code == 404

    def test_delete_piece_not_found(self, test_client, headers_responsable):
        """Suppression d'une pièce inexistante renvoie 404."""
        res = test_client.delete("/api/v1/pieces/99999", headers=headers_responsable)
        assert res.status_code == 404
        assert res.get_json()["error"]["code"] == "NOT_FOUND"

    def test_delete_piece_with_reparations_conflict(
        self, test_client, headers_responsable, piece_with_reparation
    ):
        """Interdiction de supprimer une pièce rattachée à une réparation (409 Conflict)."""
        res = test_client.delete(
            f"/api/v1/pieces/{piece_with_reparation.id_piece}",
            headers=headers_responsable,
        )
        assert res.status_code == 409
        body = res.get_json()
        assert body["success"] is False
        assert body["error"]["code"] == "CONFLICT"
        assert "réparation(s)" in body["error"]["message"]
        assert body["error"]["details"]["reparations_count"] == 1


# ============================================================================
# Tests: Service Layer Direct & Edge Cases
# ============================================================================

class TestPieceServiceDirect:
    """Tests unitaires directs sur piece_detachee_service."""

    def test_create_piece_service_direct(self, piece_app):
        """Création directe via le service."""
        data = {
            "nom": "Bougie d'allumage NGK BKR6E",
            "prix_unitaire": Decimal("7.20"),
            "quantite_stock": 48,
        }
        piece = piece_detachee_service.create_piece(data)
        assert piece.id_piece is not None
        assert piece.nom == "Bougie d'allumage NGK BKR6E"

    def test_create_piece_service_direct_missing_data(self, piece_app):
        """Création directe avec données invalides lève ValidationError."""
        with pytest.raises(ValidationError):
            piece_detachee_service.create_piece({})

        with pytest.raises(ValidationError):
            piece_detachee_service.create_piece({"nom": "Test", "prix_unitaire": -1, "quantite_stock": 5})

    def test_update_piece_service_empty_data_raises(self, piece_app, sample_piece1):
        """Mise à jour avec dictionnaire vide lève ValidationError."""
        with pytest.raises(ValidationError):
            piece_detachee_service.update_piece(sample_piece1.id_piece, {})


# ============================================================================
# Tests: Marshmallow Schema Direct
# ============================================================================

class TestPieceSchemasDirect:
    """Tests unitaires sur les schémas Marshmallow."""

    def test_create_schema_valid_payload(self):
        """Validation réussie d'un payload complet."""
        raw = {
            "nom": "   Liquide de frein DOT4   ",
            "prix_unitaire": 9.50,
            "quantite_stock": 18,
        }
        result = piece_detachee_create_schema.load(raw)
        assert result["nom"] == "Liquide de frein DOT4"
        assert result["prix_unitaire"] == Decimal("9.50")
        assert result["quantite_stock"] == 18

    def test_update_schema_partial(self):
        """Mise à jour partielle via le schéma."""
        result = piece_detachee_update_schema.load({"prix_unitaire": 11.00})
        assert result["prix_unitaire"] == Decimal("11.00")
        assert "quantite_stock" not in result

    def test_response_schema_dump(self, piece_app, sample_piece1):
        """Sérialisation conforme par PieceDetacheeResponseSchema."""
        dumped = piece_detachee_response_schema.dump(sample_piece1)
        assert dumped["id_piece"] == sample_piece1.id_piece
        assert dumped["nom"] == sample_piece1.nom
        assert isinstance(dumped["prix_unitaire"], float)
        assert dumped["prix_unitaire"] == 12.50
        assert dumped["quantite_stock"] == 25


# ============================================================================
# Tests: Seuil dynamique LOW_STOCK_THRESHOLD
# ============================================================================

class TestLowStockThresholdConfiguration:
    """Vérifie que la configuration LOW_STOCK_THRESHOLD est prise en compte."""

    def test_configured_low_stock_threshold_applied_in_route(
        self, test_client, headers_responsable, piece_app, sample_piece1, sample_piece2, sample_piece_out_of_stock
    ):
        """La route utilise la valeur dynamique de LOW_STOCK_THRESHOLD de l'application."""
        # sample_piece_out_of_stock: stock 0
        # sample_piece2: stock 3
        # sample_piece1: stock 25

        # 1. Seuil abaissé à 2 : sample_piece2 (stock 3) ne doit plus figurer dans les alertes
        piece_app.config["LOW_STOCK_THRESHOLD"] = 2
        res_low = test_client.get("/api/v1/pieces?stock_faible=true", headers=headers_responsable)
        assert res_low.status_code == 200
        ids_low = [p["id_piece"] for p in res_low.get_json()["data"]]
        assert sample_piece_out_of_stock.id_piece in ids_low
        assert sample_piece2.id_piece not in ids_low
        assert sample_piece1.id_piece not in ids_low

        # 2. Seuil relevé à 30 : toutes les pièces (stocks 0, 3, 25) doivent être incluses
        piece_app.config["LOW_STOCK_THRESHOLD"] = 30
        res_high = test_client.get("/api/v1/pieces?stock_faible=true", headers=headers_responsable)
        assert res_high.status_code == 200
        ids_high = [p["id_piece"] for p in res_high.get_json()["data"]]
        assert sample_piece_out_of_stock.id_piece in ids_high
        assert sample_piece2.id_piece in ids_high
        assert sample_piece1.id_piece in ids_high

        # 3. Rétablissement du seuil par défaut
        piece_app.config["LOW_STOCK_THRESHOLD"] = 5

    def test_query_param_seuil_override(
        self, test_client, headers_responsable, piece_app, sample_piece1, sample_piece2, sample_piece_out_of_stock
    ):
        """Le paramètre de requête seuil permet une surcharge explicite par appel."""
        piece_app.config["LOW_STOCK_THRESHOLD"] = 1  # Configuration par défaut basse
        # Surcharge via query param seuil=4
        res = test_client.get("/api/v1/pieces?stock_faible=true&seuil=4", headers=headers_responsable)
        assert res.status_code == 200
        ids = [p["id_piece"] for p in res.get_json()["data"]]
        assert sample_piece_out_of_stock.id_piece in ids
        assert sample_piece2.id_piece in ids
        assert sample_piece1.id_piece not in ids

    def test_direct_service_uses_app_config_threshold(
        self, piece_app, sample_piece1, sample_piece2, sample_piece_out_of_stock
    ):
        """L'appel direct au service sans paramètre de seuil lit LOW_STOCK_THRESHOLD."""
        piece_app.config["LOW_STOCK_THRESHOLD"] = 2
        pieces = piece_detachee_service.list_pieces(stock_faible=True)
        ids = [p.id_piece for p in pieces]
        assert sample_piece_out_of_stock.id_piece in ids
        assert sample_piece2.id_piece not in ids
        piece_app.config["LOW_STOCK_THRESHOLD"] = 5
