"""Tests complets pour le module Association Réparations - Pièces et Gestion des Stocks.

Exécution isolée en mémoire avec SQLite (sqlite:///:memory:).
Aucune connexion à PostgreSQL, aucune modification de la base réelle et aucune migration.
Couvre :
- Authentification JWT & RBAC (RESPONSABLE vs MECANICIEN vs Rôles interdits)
- Contrôle de propriété du mécanicien (isolation stricte par profil mécanicien)
- Opérations CRUD d'association (GET, POST, PATCH/PUT, DELETE)
- Décrémentation et réintégration automatique des stocks
- Détection et rejet en cas de stock insuffisant (409 Conflict)
- Gestion du différentiel de quantité (augmentation et diminution)
- Prévention des doublons d'association pour un même couple (id_reparation, id_piece)
- Préservation de l'instantané historique du prix unitaire catalogue (snapshot)
- Protection comptable : interdiction de modifier les pièces d'une réparation déjà facturée (409 Conflict)
- Atomicité transactionnelle et rollback en cas d'erreur
- Tests directs du service et des schémas Marshmallow
"""
import pytest
from datetime import date
from decimal import Decimal
from unittest.mock import patch
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
    Facture,
)
from app.services import reparation_piece_service
from app.schemas.reparation_piece_schema import (
    reparation_piece_create_schema,
    reparation_piece_update_schema,
    reparation_piece_response_schema,
)
from app.utils.exceptions import NotFoundError, ConflictError, ValidationError, ForbiddenError


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def rep_piece_app(monkeypatch):
    """Crée une instance Flask isolée avec base SQLite en mémoire."""
    monkeypatch.setenv("TEST_DATABASE_URL", "sqlite:///:memory:")
    app = create_app("testing")
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def test_client(rep_piece_app):
    """Client HTTP de test."""
    return rep_piece_app.test_client()


@pytest.fixture
def responsable_user(rep_piece_app):
    """Utilisateur avec rôle RESPONSABLE."""
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
def mecanicien1_user(rep_piece_app):
    """Premier utilisateur mécanicien."""
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
def mecanicien1_profile(rep_piece_app, mecanicien1_user):
    """Profil mécanicien 1."""
    m = Mecanicien(
        specialite="Moteur & Diagnostic",
        id_utilisateur=mecanicien1_user.id_utilisateur,
    )
    db.session.add(m)
    db.session.commit()
    return m


@pytest.fixture
def mecanicien2_user(rep_piece_app):
    """Deuxième utilisateur mécanicien."""
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
def mecanicien2_profile(rep_piece_app, mecanicien2_user):
    """Profil mécanicien 2."""
    m = Mecanicien(
        specialite="Freinage & Trains roulants",
        id_utilisateur=mecanicien2_user.id_utilisateur,
    )
    db.session.add(m)
    db.session.commit()
    return m


@pytest.fixture
def unassigned_mecanicien_user(rep_piece_app):
    """Utilisateur au rôle MECANICIEN sans profil Mecanicien rattaché."""
    u = Utilisateur(
        nom="Sans",
        prenom="Profil",
        email="sans.profil@garageflow.fr",
        role="MECANICIEN",
        telephone="0699999999",
    )
    u.set_password("NoProfile123!")
    db.session.add(u)
    db.session.commit()
    return u


@pytest.fixture
def client_owner(rep_piece_app):
    """Client propriétaire de véhicules."""
    c = Client(
        nom="Martin",
        prenom="Thomas",
        telephone="0611223344",
        adresse="5 Boulevard Saint-Michel, 75005 Paris",
    )
    db.session.add(c)
    db.session.commit()
    return c


@pytest.fixture
def vehicule1(rep_piece_app, client_owner):
    """Véhicule témoin."""
    v = Vehicule(
        marque="Renault",
        modele="Clio 5",
        immatriculation="AA-555-AA",
        annee=2022,
        kilometrage=28000,
        etat="BON",
        id_client=client_owner.id_client,
    )
    db.session.add(v)
    db.session.commit()
    return v


@pytest.fixture
def reparation_meca1(rep_piece_app, vehicule1, mecanicien1_profile):
    """Réparation assignée au Mécanicien 1."""
    rep = Reparation(
        description="Remplacement filtre à huile et bougies",
        date_reparation=date(2026, 11, 18),
        statut="EN_COURS",
        cout=Decimal("120.00"),
        kilometrage=28000,
        id_vehicule=vehicule1.id_vehicule,
        id_mecanicien=mecanicien1_profile.id_mecanicien,
    )
    db.session.add(rep)
    db.session.commit()
    return rep


@pytest.fixture
def reparation_meca2(rep_piece_app, vehicule1, mecanicien2_profile):
    """Réparation assignée au Mécanicien 2."""
    rep = Reparation(
        description="Changement plaquettes de frein",
        date_reparation=date(2026, 11, 19),
        statut="EN_ATTENTE",
        cout=Decimal("200.00"),
        kilometrage=28000,
        id_vehicule=vehicule1.id_vehicule,
        id_mecanicien=mecanicien2_profile.id_mecanicien,
    )
    db.session.add(rep)
    db.session.commit()
    return rep


@pytest.fixture
def sample_piece(rep_piece_app):
    """Pièce détachée avec stock suffisant."""
    p = PieceDetachee(
        nom="Filtre à huile Purflux L358A",
        prix_unitaire=Decimal("15.50"),
        quantite_stock=20,
    )
    db.session.add(p)
    db.session.commit()
    return p


@pytest.fixture
def sample_piece_low_stock(rep_piece_app):
    """Pièce détachée avec stock faible (stock = 2)."""
    p = PieceDetachee(
        nom="Bougie d'allumage Iridium NGK",
        prix_unitaire=Decimal("18.00"),
        quantite_stock=2,
    )
    db.session.add(p)
    db.session.commit()
    return p


@pytest.fixture
def headers_responsable(responsable_user):
    """Bearer token pour Responsable."""
    token = create_access_token(
        identity=str(responsable_user.id_utilisateur),
        additional_claims={"role": "RESPONSABLE"},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def headers_mecanicien1(mecanicien1_user, mecanicien1_profile):
    """Bearer token pour Mécanicien 1."""
    token = create_access_token(
        identity=str(mecanicien1_user.id_utilisateur),
        additional_claims={"role": "MECANICIEN"},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def headers_mecanicien2(mecanicien2_user, mecanicien2_profile):
    """Bearer token pour Mécanicien 2."""
    token = create_access_token(
        identity=str(mecanicien2_user.id_utilisateur),
        additional_claims={"role": "MECANICIEN"},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def headers_unassigned_mecanicien(unassigned_mecanicien_user):
    """Bearer token pour Mécanicien sans profil."""
    token = create_access_token(
        identity=str(unassigned_mecanicien_user.id_utilisateur),
        additional_claims={"role": "MECANICIEN"},
    )
    return {"Authorization": f"Bearer {token}"}


# ============================================================================
# Tests: Authentication, RBAC & Mechanic Ownership
# ============================================================================

class TestReparationPieceRBAC:
    """Vérification de l'authentification et du respect de la propriété mécanicien."""

    def test_endpoints_unauthorized_without_jwt(
        self, test_client, reparation_meca1, sample_piece
    ):
        """Toutes les opérations requièrent un jeton JWT valide (401 Unauthorized)."""
        r_id = reparation_meca1.id_reparation
        p_id = sample_piece.id_piece
        endpoints = [
            ("GET", f"/api/v1/reparations/{r_id}/pieces", None),
            ("POST", f"/api/v1/reparations/{r_id}/pieces", {"id_piece": p_id, "quantite": 1}),
            ("GET", f"/api/v1/reparations/{r_id}/pieces/{p_id}", None),
            ("PATCH", f"/api/v1/reparations/{r_id}/pieces/{p_id}", {"quantite": 2}),
            ("DELETE", f"/api/v1/reparations/{r_id}/pieces/{p_id}", None),
        ]
        for method, url, payload in endpoints:
            if method == "GET":
                resp = test_client.get(url)
            elif method == "POST":
                resp = test_client.post(url, json=payload)
            elif method == "PATCH":
                resp = test_client.patch(url, json=payload)
            elif method == "DELETE":
                resp = test_client.delete(url)
            assert resp.status_code == 401, f"Expected 401 for {method} {url}, got {resp.status_code}"

    def test_mechanic_can_manage_own_repair_pieces(
        self, test_client, headers_mecanicien1, reparation_meca1, sample_piece
    ):
        """Un mécanicien peut ajouter, consulter, modifier et retirer des pièces sur ses réparations (200/201)."""
        r_id = reparation_meca1.id_reparation
        p_id = sample_piece.id_piece

        # POST: ajout d'une pièce
        res_add = test_client.post(
            f"/api/v1/reparations/{r_id}/pieces",
            headers=headers_mecanicien1,
            json={"id_piece": p_id, "quantite": 2},
        )
        assert res_add.status_code == 201

        # GET: consultation des pièces
        res_list = test_client.get(
            f"/api/v1/reparations/{r_id}/pieces",
            headers=headers_mecanicien1,
        )
        assert res_list.status_code == 200
        assert len(res_list.get_json()["data"]) == 1

        # PATCH: mise à jour de la quantité
        res_patch = test_client.patch(
            f"/api/v1/reparations/{r_id}/pieces/{p_id}",
            headers=headers_mecanicien1,
            json={"quantite": 3},
        )
        assert res_patch.status_code == 200

        # DELETE: suppression de l'association
        res_del = test_client.delete(
            f"/api/v1/reparations/{r_id}/pieces/{p_id}",
            headers=headers_mecanicien1,
        )
        assert res_del.status_code == 200

    def test_mechanic_cannot_access_other_mechanic_repair_pieces(
        self, test_client, headers_mecanicien1, reparation_meca2, sample_piece
    ):
        """Le Mécanicien 1 se voit refuser l'accès aux pièces de la réparation du Mécanicien 2 (403 Forbidden)."""
        r_id = reparation_meca2.id_reparation
        p_id = sample_piece.id_piece

        endpoints = [
            ("GET", f"/api/v1/reparations/{r_id}/pieces", None),
            ("POST", f"/api/v1/reparations/{r_id}/pieces", {"id_piece": p_id, "quantite": 1}),
            ("GET", f"/api/v1/reparations/{r_id}/pieces/{p_id}", None),
            ("PATCH", f"/api/v1/reparations/{r_id}/pieces/{p_id}", {"quantite": 2}),
            ("DELETE", f"/api/v1/reparations/{r_id}/pieces/{p_id}", None),
        ]
        for method, url, payload in endpoints:
            if method == "GET":
                resp = test_client.get(url, headers=headers_mecanicien1)
            elif method == "POST":
                resp = test_client.post(url, json=payload, headers=headers_mecanicien1)
            elif method == "PATCH":
                resp = test_client.patch(url, json=payload, headers=headers_mecanicien1)
            elif method == "DELETE":
                resp = test_client.delete(url, headers=headers_mecanicien1)
            assert resp.status_code == 403, f"Expected 403 for {method} {url}, got {resp.status_code}"
            assert resp.get_json()["error"]["code"] == "FORBIDDEN"

    def test_unassigned_mechanic_user_forbidden(
        self, test_client, headers_unassigned_mecanicien, reparation_meca1, sample_piece
    ):
        """Un utilisateur au rôle MECANICIEN sans profil en base est bloqué (403 Forbidden)."""
        r_id = reparation_meca1.id_reparation
        res = test_client.get(
            f"/api/v1/reparations/{r_id}/pieces",
            headers=headers_unassigned_mecanicien,
        )
        assert res.status_code == 403
        assert res.get_json()["error"]["code"] == "FORBIDDEN"

    def test_unknown_role_forbidden(
        self, test_client, reparation_meca1, sample_piece
    ):
        """Un rôle non autorisé (ex: CLIENT) est bloqué (403 Forbidden)."""
        token = create_access_token(
            identity="888",
            additional_claims={"role": "CLIENT"},
        )
        headers = {"Authorization": f"Bearer {token}"}
        r_id = reparation_meca1.id_reparation
        res = test_client.get(f"/api/v1/reparations/{r_id}/pieces", headers=headers)
        assert res.status_code == 403
        assert res.get_json()["error"]["code"] == "FORBIDDEN"


# ============================================================================
# Tests: CRUD & Business Validations
# ============================================================================

class TestReparationPieceCRUD:
    """Tests des opérations CRUD d'association et des validations."""

    def test_add_piece_success(
        self, test_client, headers_responsable, reparation_meca1, sample_piece
    ):
        """Ajout réussi d'une pièce à une réparation (201 Created)."""
        r_id = reparation_meca1.id_reparation
        p_id = sample_piece.id_piece
        payload = {"id_piece": p_id, "quantite": 2}

        res = test_client.post(
            f"/api/v1/reparations/{r_id}/pieces",
            headers=headers_responsable,
            json=payload,
        )
        assert res.status_code == 201
        body = res.get_json()
        assert body["success"] is True
        data = body["data"]
        assert data["id_reparation"] == r_id
        assert data["id_piece"] == p_id
        assert data["quantite"] == 2
        assert data["prix_unitaire"] == float(sample_piece.prix_unitaire)
        assert data["nom_piece"] == sample_piece.nom
        assert data["sous_total"] == round(float(sample_piece.prix_unitaire) * 2, 2)

    def test_add_piece_nonexistent_reparation(
        self, test_client, headers_responsable, sample_piece
    ):
        """Échec avec 404 si la réparation n'existe pas."""
        res = test_client.post(
            "/api/v1/reparations/99999/pieces",
            headers=headers_responsable,
            json={"id_piece": sample_piece.id_piece, "quantite": 1},
        )
        assert res.status_code == 404
        assert res.get_json()["error"]["code"] == "NOT_FOUND"

    def test_add_piece_nonexistent_piece(
        self, test_client, headers_responsable, reparation_meca1
    ):
        """Échec avec 404 si la pièce détachée n'existe pas dans le catalogue."""
        res = test_client.post(
            f"/api/v1/reparations/{reparation_meca1.id_reparation}/pieces",
            headers=headers_responsable,
            json={"id_piece": 99999, "quantite": 1},
        )
        assert res.status_code == 404
        assert res.get_json()["error"]["code"] == "NOT_FOUND"

    def test_add_piece_invalid_quantity(
        self, test_client, headers_responsable, reparation_meca1, sample_piece
    ):
        """Échec avec 422 si la quantité est nulle ou négative."""
        r_id = reparation_meca1.id_reparation
        p_id = sample_piece.id_piece

        # quantite = 0
        res0 = test_client.post(
            f"/api/v1/reparations/{r_id}/pieces",
            headers=headers_responsable,
            json={"id_piece": p_id, "quantite": 0},
        )
        assert res0.status_code == 422
        assert "quantite" in res0.get_json()["error"]["details"]

        # quantite = -5
        res_neg = test_client.post(
            f"/api/v1/reparations/{r_id}/pieces",
            headers=headers_responsable,
            json={"id_piece": p_id, "quantite": -5},
        )
        assert res_neg.status_code == 422
        assert "quantite" in res_neg.get_json()["error"]["details"]

    def test_add_piece_missing_fields(
        self, test_client, headers_responsable, reparation_meca1
    ):
        """Échec avec 422 si des champs obligatoires sont absents."""
        r_id = reparation_meca1.id_reparation
        res = test_client.post(
            f"/api/v1/reparations/{r_id}/pieces",
            headers=headers_responsable,
            json={},
        )
        assert res.status_code == 422
        assert res.get_json()["error"]["code"] == "VALIDATION_ERROR"

    def test_list_reparation_pieces_empty(
        self, test_client, headers_responsable, reparation_meca1
    ):
        """Liste vide quand aucune pièce n'a encore été ajoutée (200 OK)."""
        res = test_client.get(
            f"/api/v1/reparations/{reparation_meca1.id_reparation}/pieces",
            headers=headers_responsable,
        )
        assert res.status_code == 200
        assert res.get_json()["data"] == []

    def test_get_single_reparation_piece_success(
        self, test_client, headers_responsable, reparation_meca1, sample_piece
    ):
        """Consultation d'une pièce spécifique associée (200 OK)."""
        r_id = reparation_meca1.id_reparation
        p_id = sample_piece.id_piece
        test_client.post(
            f"/api/v1/reparations/{r_id}/pieces",
            headers=headers_responsable,
            json={"id_piece": p_id, "quantite": 2},
        )
        res = test_client.get(
            f"/api/v1/reparations/{r_id}/pieces/{p_id}",
            headers=headers_responsable,
        )
        assert res.status_code == 200
        body = res.get_json()
        assert body["data"]["id_piece"] == p_id
        assert body["data"]["quantite"] == 2

    def test_get_single_reparation_piece_unassociated(
        self, test_client, headers_responsable, reparation_meca1, sample_piece
    ):
        """Consultation d'une pièce non associée à cette réparation renvoie 404."""
        r_id = reparation_meca1.id_reparation
        p_id = sample_piece.id_piece
        res = test_client.get(
            f"/api/v1/reparations/{r_id}/pieces/{p_id}",
            headers=headers_responsable,
        )
        assert res.status_code == 404
        assert res.get_json()["error"]["code"] == "NOT_FOUND"


# ============================================================================
# Tests: Inventory Management & Stock Operations
# ============================================================================

class TestStockManagement:
    """Vérification stricte de la décrémentation, réintégration et non-négativité des stocks."""

    def test_stock_deduction_on_add(
        self, test_client, headers_responsable, reparation_meca1, sample_piece
    ):
        """L'ajout d'une pièce à une réparation décrémente automatiquement le stock en magasin."""
        initial_stock = sample_piece.quantite_stock  # 20
        quantite_ajoutee = 6

        res = test_client.post(
            f"/api/v1/reparations/{reparation_meca1.id_reparation}/pieces",
            headers=headers_responsable,
            json={"id_piece": sample_piece.id_piece, "quantite": quantite_ajoutee},
        )
        assert res.status_code == 201

        # Vérification en base de données
        db.session.refresh(sample_piece)
        assert sample_piece.quantite_stock == initial_stock - quantite_ajoutee  # 14

    def test_insufficient_stock_rejected(
        self, test_client, headers_responsable, reparation_meca1, sample_piece_low_stock
    ):
        """Rejet avec 409 Conflict si le stock disponible est insuffisant."""
        initial_stock = sample_piece_low_stock.quantite_stock  # 2
        quantite_demandee = 5

        res = test_client.post(
            f"/api/v1/reparations/{reparation_meca1.id_reparation}/pieces",
            headers=headers_responsable,
            json={"id_piece": sample_piece_low_stock.id_piece, "quantite": quantite_demandee},
        )
        assert res.status_code == 409
        body = res.get_json()
        assert body["success"] is False
        assert body["error"]["code"] == "CONFLICT"
        assert "insuffisant" in body["error"]["message"].lower()
        assert body["error"]["details"]["stock_disponible"] == initial_stock
        assert body["error"]["details"]["quantite_demandee"] == quantite_demandee

        # Le stock en magasin reste absolument inchangé
        db.session.refresh(sample_piece_low_stock)
        assert sample_piece_low_stock.quantite_stock == initial_stock  # 2

    def test_stock_restoration_on_delete(
        self, test_client, headers_responsable, reparation_meca1, sample_piece
    ):
        """Le retrait d'une pièce réintègre intégralement sa quantité dans le stock."""
        initial_stock = sample_piece.quantite_stock  # 20
        quantite = 4
        r_id = reparation_meca1.id_reparation
        p_id = sample_piece.id_piece

        # Ajout préalable
        test_client.post(
            f"/api/v1/reparations/{r_id}/pieces",
            headers=headers_responsable,
            json={"id_piece": p_id, "quantite": quantite},
        )
        db.session.refresh(sample_piece)
        assert sample_piece.quantite_stock == initial_stock - quantite  # 16

        # Suppression de l'association
        res_del = test_client.delete(
            f"/api/v1/reparations/{r_id}/pieces/{p_id}",
            headers=headers_responsable,
        )
        assert res_del.status_code == 200

        # Le stock est réintégré exactement à sa valeur initiale
        db.session.refresh(sample_piece)
        assert sample_piece.quantite_stock == initial_stock  # 20

    def test_quantity_increase_differential(
        self, test_client, headers_responsable, reparation_meca1, sample_piece
    ):
        """Augmentation de la quantité : décrémente uniquement le différentiel de stock."""
        r_id = reparation_meca1.id_reparation
        p_id = sample_piece.id_piece
        initial_stock = sample_piece.quantite_stock  # 20

        # Ajout initial de 3 pièces
        test_client.post(
            f"/api/v1/reparations/{r_id}/pieces",
            headers=headers_responsable,
            json={"id_piece": p_id, "quantite": 3},
        )
        db.session.refresh(sample_piece)
        assert sample_piece.quantite_stock == 17

        # Augmentation à 7 (+4 pièces demandées)
        res_patch = test_client.patch(
            f"/api/v1/reparations/{r_id}/pieces/{p_id}",
            headers=headers_responsable,
            json={"quantite": 7},
        )
        assert res_patch.status_code == 200
        assert res_patch.get_json()["data"]["quantite"] == 7

        # Le stock doit être décrémenté de 4 supplémentaires (17 - 4 = 13)
        db.session.refresh(sample_piece)
        assert sample_piece.quantite_stock == 13

    def test_quantity_increase_insufficient_stock(
        self, test_client, headers_responsable, reparation_meca1, sample_piece
    ):
        """Augmentation impossible si le stock ne couvre pas le surplus (409 Conflict)."""
        r_id = reparation_meca1.id_reparation
        p_id = sample_piece.id_piece

        # Ajout de 18 pièces sur 20 disponibles (reste 2 en stock)
        test_client.post(
            f"/api/v1/reparations/{r_id}/pieces",
            headers=headers_responsable,
            json={"id_piece": p_id, "quantite": 18},
        )
        db.session.refresh(sample_piece)
        assert sample_piece.quantite_stock == 2

        # Tentative d'augmenter à 25 (+7 demandé, or seulement 2 disponibles)
        res_patch = test_client.patch(
            f"/api/v1/reparations/{r_id}/pieces/{p_id}",
            headers=headers_responsable,
            json={"quantite": 25},
        )
        assert res_patch.status_code == 409
        body = res_patch.get_json()
        assert body["error"]["code"] == "CONFLICT"
        assert body["error"]["details"]["stock_disponible"] == 2
        assert body["error"]["details"]["surplus_demande"] == 7

        # Le stock et la quantité associée restent inchangés
        db.session.refresh(sample_piece)
        assert sample_piece.quantite_stock == 2

    def test_quantity_decrease_differential(
        self, test_client, headers_responsable, reparation_meca1, sample_piece
    ):
        """Diminution de la quantité : réintègre l'excédent dans le stock en magasin."""
        r_id = reparation_meca1.id_reparation
        p_id = sample_piece.id_piece

        # Ajout de 10 pièces (stock passe de 20 à 10)
        test_client.post(
            f"/api/v1/reparations/{r_id}/pieces",
            headers=headers_responsable,
            json={"id_piece": p_id, "quantite": 10},
        )
        db.session.refresh(sample_piece)
        assert sample_piece.quantite_stock == 10

        # Diminution à 4 pièces (-6 consommées -> +6 remises en stock)
        res_patch = test_client.patch(
            f"/api/v1/reparations/{r_id}/pieces/{p_id}",
            headers=headers_responsable,
            json={"quantite": 4},
        )
        assert res_patch.status_code == 200
        assert res_patch.get_json()["data"]["quantite"] == 4

        # Le stock doit être réaugmenté de 6 (10 + 6 = 16)
        db.session.refresh(sample_piece)
        assert sample_piece.quantite_stock == 16

    def test_quantity_unchanged_differential(
        self, test_client, headers_responsable, reparation_meca1, sample_piece
    ):
        """Mise à jour avec la même quantité : opération idempotente sans mouvement de stock."""
        r_id = reparation_meca1.id_reparation
        p_id = sample_piece.id_piece

        test_client.post(
            f"/api/v1/reparations/{r_id}/pieces",
            headers=headers_responsable,
            json={"id_piece": p_id, "quantite": 5},
        )
        db.session.refresh(sample_piece)
        assert sample_piece.quantite_stock == 15

        res_patch = test_client.patch(
            f"/api/v1/reparations/{r_id}/pieces/{p_id}",
            headers=headers_responsable,
            json={"quantite": 5},
        )
        assert res_patch.status_code == 200
        db.session.refresh(sample_piece)
        assert sample_piece.quantite_stock == 15


# ============================================================================
# Tests: Duplicate Association & Price Snapshot
# ============================================================================

class TestIntegrityAndPriceSnapshot:
    """Vérification des doublons d'association et de l'instantané de prix."""

    def test_duplicate_association_rejected(
        self, test_client, headers_responsable, reparation_meca1, sample_piece
    ):
        """Interdiction d'associer deux fois la même pièce à la même réparation (409 Conflict)."""
        r_id = reparation_meca1.id_reparation
        p_id = sample_piece.id_piece

        # Premier ajout réussi
        res1 = test_client.post(
            f"/api/v1/reparations/{r_id}/pieces",
            headers=headers_responsable,
            json={"id_piece": p_id, "quantite": 2},
        )
        assert res1.status_code == 201

        # Second ajout : rejet avec 409 Conflict et aucun double débit de stock
        res2 = test_client.post(
            f"/api/v1/reparations/{r_id}/pieces",
            headers=headers_responsable,
            json={"id_piece": p_id, "quantite": 3},
        )
        assert res2.status_code == 409
        body = res2.get_json()
        assert body["error"]["code"] == "CONFLICT"
        assert "déjà associée" in body["error"]["message"].lower()

        # Le stock a été débité une seule fois (-2)
        db.session.refresh(sample_piece)
        assert sample_piece.quantite_stock == 18

    def test_historical_unit_price_snapshot_preserved(
        self, test_client, headers_responsable, reparation_meca1, sample_piece
    ):
        """Le prix unitaire enregistré fige le tarif catalogue et résiste aux variations futures."""
        r_id = reparation_meca1.id_reparation
        p_id = sample_piece.id_piece
        prix_initial = float(sample_piece.prix_unitaire)  # 15.50

        # Association de la pièce au tarif de 15.50
        res = test_client.post(
            f"/api/v1/reparations/{r_id}/pieces",
            headers=headers_responsable,
            json={"id_piece": p_id, "quantite": 2},
        )
        assert res.status_code == 201
        assert res.get_json()["data"]["prix_unitaire"] == prix_initial

        # Modification ultérieure du prix unitaire dans le catalogue de pièces
        sample_piece.prix_unitaire = Decimal("28.90")
        db.session.commit()

        # Consultation de la pièce dans la réparation : l'instantané historique reste à 15.50
        res_get = test_client.get(
            f"/api/v1/reparations/{r_id}/pieces/{p_id}",
            headers=headers_responsable,
        )
        assert res_get.status_code == 200
        assert res_get.get_json()["data"]["prix_unitaire"] == prix_initial

        # Modification de la quantité : l'instantané historique n'est toujours pas écrasé
        res_patch = test_client.patch(
            f"/api/v1/reparations/{r_id}/pieces/{p_id}",
            headers=headers_responsable,
            json={"quantite": 4},
        )
        assert res_patch.status_code == 200
        assert res_patch.get_json()["data"]["prix_unitaire"] == prix_initial


# ============================================================================
# Tests: Invoice Protection & Accounting Integrity
# ============================================================================

class TestInvoiceProtection:
    """Interdiction formelle de modifier les pièces d'une réparation déjà facturée."""

    @pytest.fixture
    def invoiced_reparation(self, rep_piece_app, reparation_meca1, sample_piece):
        """Réparation avec pièce associée et facture déjà émise."""
        # Association d'une pièce
        assoc = ReparationPiece(
            id_reparation=reparation_meca1.id_reparation,
            id_piece=sample_piece.id_piece,
            quantite=2,
            prix_unitaire=sample_piece.prix_unitaire,
        )
        db.session.add(assoc)
        sample_piece.quantite_stock -= 2
        db.session.commit()

        # Émission d'une facture
        facture = Facture(
            date_facture=date(2026, 11, 20),
            montant_total=Decimal("151.00"),
            statut_paiement="PAYEE",
            id_reparation=reparation_meca1.id_reparation,
        )
        db.session.add(facture)
        db.session.commit()
        return reparation_meca1

    def test_cannot_add_piece_to_invoiced_reparation(
        self, test_client, headers_responsable, invoiced_reparation, sample_piece_low_stock
    ):
        """Impossible d'ajouter des pièces à une réparation déjà facturée (409 Conflict)."""
        res = test_client.post(
            f"/api/v1/reparations/{invoiced_reparation.id_reparation}/pieces",
            headers=headers_responsable,
            json={"id_piece": sample_piece_low_stock.id_piece, "quantite": 1},
        )
        assert res.status_code == 409
        body = res.get_json()
        assert body["error"]["code"] == "CONFLICT"
        assert "facturée" in body["error"]["message"].lower()

    def test_cannot_update_piece_on_invoiced_reparation(
        self, test_client, headers_responsable, invoiced_reparation, sample_piece
    ):
        """Impossible de modifier la quantité d'une pièce sur une réparation facturée (409 Conflict)."""
        res = test_client.patch(
            f"/api/v1/reparations/{invoiced_reparation.id_reparation}/pieces/{sample_piece.id_piece}",
            headers=headers_responsable,
            json={"quantite": 10},
        )
        assert res.status_code == 409
        assert res.get_json()["error"]["code"] == "CONFLICT"

    def test_cannot_delete_piece_from_invoiced_reparation(
        self, test_client, headers_responsable, invoiced_reparation, sample_piece
    ):
        """Impossible de retirer une pièce d'une réparation facturée (409 Conflict)."""
        res = test_client.delete(
            f"/api/v1/reparations/{invoiced_reparation.id_reparation}/pieces/{sample_piece.id_piece}",
            headers=headers_responsable,
        )
        assert res.status_code == 409
        assert res.get_json()["error"]["code"] == "CONFLICT"

    def test_can_read_pieces_on_invoiced_reparation(
        self, test_client, headers_responsable, invoiced_reparation, sample_piece
    ):
        """La consultation en lecture seule des pièces sur réparation facturée reste autorisée (200 OK)."""
        res = test_client.get(
            f"/api/v1/reparations/{invoiced_reparation.id_reparation}/pieces",
            headers=headers_responsable,
        )
        assert res.status_code == 200
        assert len(res.get_json()["data"]) == 1


# ============================================================================
# Tests: Transaction Rollback on Error
# ============================================================================

class TestTransactionRollback:
    """Vérification de l'atomicité transactionnelle : rollback complet en cas d'incident."""

    def test_add_piece_rollback_on_commit_error(
        self, test_client, headers_responsable, reparation_meca1, sample_piece
    ):
        """Si le commit échoue, le stock décrémenté en mémoire est annulé par rollback."""
        initial_stock = sample_piece.quantite_stock  # 20
        r_id = reparation_meca1.id_reparation
        p_id = sample_piece.id_piece

        with patch("app.extensions.db.session.commit", side_effect=Exception("Database failure")):
            with pytest.raises(Exception):
                reparation_piece_service.add_piece_to_reparation(
                    id_reparation=r_id,
                    data={"id_piece": p_id, "quantite": 5},
                )

        # Vérification : le stock n'a pas été décrémenté en base
        db.session.rollback()
        db.session.refresh(sample_piece)
        assert sample_piece.quantite_stock == initial_stock
        assert db.session.get(ReparationPiece, (r_id, p_id)) is None


# ============================================================================
# Tests: Marshmallow Schemas & Direct Service
# ============================================================================

class TestServiceAndSchemasDirect:
    """Tests unitaires directs sur les schémas et le service."""

    def test_create_schema_validation(self):
        """Validation des règles du schéma d'association."""
        # Valide
        valid = reparation_piece_create_schema.load({"id_piece": 10, "quantite": 3})
        assert valid["id_piece"] == 10
        assert valid["quantite"] == 3

        # Invalide : quantite <= 0
        with pytest.raises(Exception):
            reparation_piece_create_schema.load({"id_piece": 10, "quantite": 0})

    def test_update_schema_validation(self):
        """Validation des règles du schéma de mise à jour de quantité."""
        valid = reparation_piece_update_schema.load({"quantite": 7})
        assert valid["quantite"] == 7

        with pytest.raises(Exception):
            reparation_piece_update_schema.load({"quantite": -2})

    def test_response_schema_dump(self, rep_piece_app, reparation_meca1, sample_piece):
        """Vérification de la sérialisation avec sous-total calculé."""
        assoc = ReparationPiece(
            id_reparation=reparation_meca1.id_reparation,
            id_piece=sample_piece.id_piece,
            quantite=3,
            prix_unitaire=Decimal("15.50"),
        )
        db.session.add(assoc)
        db.session.commit()

        dumped = reparation_piece_response_schema.dump(assoc)
        assert dumped["id_reparation"] == reparation_meca1.id_reparation
        assert dumped["id_piece"] == sample_piece.id_piece
        assert dumped["quantite"] == 3
        assert dumped["prix_unitaire"] == 15.50
        assert dumped["nom_piece"] == sample_piece.nom
        assert dumped["sous_total"] == 46.50
