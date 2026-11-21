"""Tests complets pour le module Gestion des Factures de GarageFlow.

Exécution isolée en mémoire avec SQLite (sqlite:///:memory:).
Aucune connexion à PostgreSQL, aucune modification de la base réelle et aucune migration.

Couvre :
- Authentification JWT & Contrôle d'accès RBAC (UC9 : seul RESPONSABLE autorisé, MECANICIEN refusé 403)
- Validation des schémas Marshmallow (formats de date, statuts de paiement, intégrité des charges utiles)
- Émission de factures pour réparations existantes
- Règle 1:1 stricte : interdiction absolue de créer plusieurs factures pour une même réparation (409 Conflict)
- Calcul automatique inviolable du montant total :
  * Main-d'œuvre seule (reparation.cout, sans pièces)
  * Réparation sans main-d'œuvre ni pièces (total = 0.00)
  * Réparation avec main-d'œuvre et plusieurs pièces détachées
  * Utilisation stricte des prix historiques (reparation_piece.prix_unitaire), insensible aux changements du catalogue
- Prise en charge des réparations avec identifiants inexistants (404 Not Found)
- Validation des dates d'émission (rejet si antérieure à la date de l'intervention)
- Validation et normalisation des statuts de paiement (insensible à la casse et aux accents)
- Protection anti-altération : interdiction de modifier manuellement le montant total via PATCH (422 Unprocessable)
- Protection anti-altération : interdiction de réassigner la réparation ou de modifier la date
- Mise à jour autorisée du statut de paiement via PATCH
- Consultation détaillée (GET /api/v1/factures/<id_facture>) avec décomposition main-d'œuvre et pièces
- Liste et filtrage multicritères (statut, réparation, date, plage de dates, véhicule, client)
- Protection de l'historique comptable et fiscal : interdiction absolue de suppression (DELETE 409 Conflict)
- Protection relationnelle : impossibilité de supprimer ou modifier une réparation/pièce une fois facturée
- Atomicité transactionnelle et rollback sécurisé en cas d'erreur de base de données
"""
import pytest
from datetime import date, timedelta
from decimal import Decimal
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
    Reparation,
    Facture,
    PieceDetachee,
    ReparationPiece,
)
from app.services import facture_service
from app.schemas.facture_schema import (
    facture_create_schema,
    facture_update_schema,
    facture_response_schema,
    ALLOWED_PAYMENT_STATUSES,
)
from app.utils.exceptions import NotFoundError, ConflictError, ValidationError, ForbiddenError


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def facture_app(monkeypatch):
    """Crée une instance d'application Flask isolée avec base SQLite en mémoire."""
    monkeypatch.setenv("TEST_DATABASE_URL", "sqlite:///:memory:")
    app = create_app("testing")
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def test_client(facture_app):
    """Client HTTP de test."""
    return facture_app.test_client()


@pytest.fixture
def responsable_user(facture_app):
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
def mecanicien_user(facture_app):
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
def mecanicien_profile(facture_app, mecanicien_user):
    """Profil mécanicien rattaché à mecanicien_user."""
    m = Mecanicien(
        specialite="Moteur & Diagnostic",
        id_utilisateur=mecanicien_user.id_utilisateur,
    )
    db.session.add(m)
    db.session.commit()
    return m


@pytest.fixture
def client_owner(facture_app):
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
def client_other(facture_app):
    """Autre client pour tester le filtrage."""
    c = Client(
        nom="Martin",
        prenom="Lucas",
        telephone="0799887766",
        adresse="45 Avenue de la République, 69002 Lyon",
    )
    db.session.add(c)
    db.session.commit()
    return c


@pytest.fixture
def vehicule1(facture_app, client_owner):
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
def vehicule2(facture_app, client_other):
    """Deuxième véhicule de test (autre client)."""
    v = Vehicule(
        marque="Renault",
        modele="Clio",
        immatriculation="BB-222-BB",
        annee=2019,
        kilometrage=75000,
        etat="BON",
        id_client=client_other.id_client,
    )
    db.session.add(v)
    db.session.commit()
    return v


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
def reparation_labor_only(facture_app, vehicule1, mecanicien_profile):
    """Réparation terminée avec coût de main-d'œuvre et sans pièces."""
    r = Reparation(
        description="Vidange et contrôle des niveaux",
        date_reparation=date(2026, 11, 10),
        statut="TERMINEE",
        cout=Decimal("85.50"),
        kilometrage=35200,
        id_vehicule=vehicule1.id_vehicule,
        id_mecanicien=mecanicien_profile.id_mecanicien,
    )
    db.session.add(r)
    db.session.commit()
    return r


@pytest.fixture
def reparation_no_labor_no_parts(facture_app, vehicule1, mecanicien_profile):
    """Réparation terminée sans coût de main-d'œuvre (0 ou None) et sans pièces."""
    r = Reparation(
        description="Contrôle visuel de courtoisie",
        date_reparation=date(2026, 11, 11),
        statut="TERMINEE",
        cout=None,
        kilometrage=35250,
        id_vehicule=vehicule1.id_vehicule,
        id_mecanicien=mecanicien_profile.id_mecanicien,
    )
    db.session.add(r)
    db.session.commit()
    return r


@pytest.fixture
def sample_piece1(facture_app):
    """Première pièce détachée en stock."""
    p = PieceDetachee(
        nom="Filtre à huile premium",
        prix_unitaire=Decimal("25.00"),
        quantite_stock=50,
    )
    db.session.add(p)
    db.session.commit()
    return p


@pytest.fixture
def sample_piece2(facture_app):
    """Deuxième pièce détachée en stock."""
    p = PieceDetachee(
        nom="Plaquettes de frein avant",
        prix_unitaire=Decimal("45.50"),
        quantite_stock=30,
    )
    db.session.add(p)
    db.session.commit()
    return p


@pytest.fixture
def reparation_with_parts(
    facture_app, vehicule1, mecanicien_profile, sample_piece1, sample_piece2
):
    """Réparation terminée avec main-d'œuvre et 2 pièces associées."""
    r = Reparation(
        description="Révision complète et freinage",
        date_reparation=date(2026, 11, 12),
        statut="TERMINEE",
        cout=Decimal("120.00"),  # Main-d'œuvre
        kilometrage=35500,
        id_vehicule=vehicule1.id_vehicule,
        id_mecanicien=mecanicien_profile.id_mecanicien,
    )
    db.session.add(r)
    db.session.commit()

    # Pièce 1 : 2 x 25.00 = 50.00
    rp1 = ReparationPiece(
        id_reparation=r.id_reparation,
        id_piece=sample_piece1.id_piece,
        quantite=2,
        prix_unitaire=Decimal("25.00"),
    )
    # Pièce 2 : 1 x 45.50 = 45.50
    rp2 = ReparationPiece(
        id_reparation=r.id_reparation,
        id_piece=sample_piece2.id_piece,
        quantite=1,
        prix_unitaire=Decimal("45.50"),
    )
    db.session.add_all([rp1, rp2])
    db.session.commit()
    # Total attendu = 120.00 + 50.00 + 45.50 = 215.50
    return r


# ============================================================================
# Tests: Authentication & Authorization (RBAC)
# ============================================================================

class TestFactureAuthorization:
    """Contrôle d'accès strict selon le diagramme UML Use Case (UC9)."""

    def test_unauthenticated_requests_fail(self, test_client):
        """Les requêtes non authentifiées sont rejetées avec HTTP 401."""
        res_get = test_client.get("/api/v1/factures")
        assert res_get.status_code == 401

        res_post = test_client.post("/api/v1/factures", json={"id_reparation": 1})
        assert res_post.status_code == 401

        res_get_id = test_client.get("/api/v1/factures/1")
        assert res_get_id.status_code == 401

        res_patch = test_client.patch("/api/v1/factures/1", json={"statut_paiement": "PAYEE"})
        assert res_patch.status_code == 401

        res_delete = test_client.delete("/api/v1/factures/1")
        assert res_delete.status_code == 401

    def test_mechanic_role_forbidden(self, test_client, headers_mecanicien, reparation_labor_only):
        """Le rôle MECANICIEN n'a aucun droit sur les factures (HTTP 403 Forbidden)."""
        res_get = test_client.get("/api/v1/factures", headers=headers_mecanicien)
        assert res_get.status_code == 403
        assert res_get.get_json()["error"]["code"] == "FORBIDDEN"

        res_post = test_client.post(
            "/api/v1/factures",
            json={"id_reparation": reparation_labor_only.id_reparation},
            headers=headers_mecanicien,
        )
        assert res_post.status_code == 403

        res_get_id = test_client.get("/api/v1/factures/1", headers=headers_mecanicien)
        assert res_get_id.status_code == 403

        res_patch = test_client.patch(
            "/api/v1/factures/1",
            json={"statut_paiement": "PAYEE"},
            headers=headers_mecanicien,
        )
        assert res_patch.status_code == 403

        res_delete = test_client.delete("/api/v1/factures/1", headers=headers_mecanicien)
        assert res_delete.status_code == 403

    def test_unknown_role_forbidden(self, test_client, facture_app):
        """Un jeton avec un rôle non reconnu est rejeté avec HTTP 403."""
        token = create_access_token(identity="999", additional_claims={"role": "CLIENT"})
        headers = {"Authorization": f"Bearer {token}"}
        res = test_client.get("/api/v1/factures", headers=headers)
        assert res.status_code == 403


# ============================================================================
# Tests: Automatic Total Calculations & Creation
# ============================================================================

class TestFactureCreationAndCalculation:
    """Vérification des calculs automatiques et de la création de facture."""

    def test_create_facture_labor_only(
        self, test_client, headers_responsable, reparation_labor_only
    ):
        """Facture pour réparation avec coût de main-d'œuvre et sans pièces.
        
        Labor: 85.50, Parts: 0.00 -> Total: 85.50.
        """
        payload = {
            "id_reparation": reparation_labor_only.id_reparation,
            "date_facture": "2026-11-15",
            "statut_paiement": "EN_ATTENTE",
        }
        res = test_client.post("/api/v1/factures", json=payload, headers=headers_responsable)
        assert res.status_code == 201

        body = res.get_json()
        assert body["success"] is True
        data = body["data"]
        assert data["id_reparation"] == reparation_labor_only.id_reparation
        assert data["montant_total"] == 85.50
        assert data["cout_main_oeuvre"] == 85.50
        assert data["cout_pieces"] == 0.00
        assert data["statut_paiement"] == "EN_ATTENTE"
        assert data["date_facture"] == "2026-11-15"
        assert data["pieces"] == []

        # Vérification en base de données
        facture_db = db.session.get(Facture, data["id_facture"])
        assert facture_db is not None
        assert facture_db.montant_total == Decimal("85.50")

    def test_create_facture_no_labor_no_parts(
        self, test_client, headers_responsable, reparation_no_labor_no_parts
    ):
        """Facture pour réparation sans coût de main-d'œuvre et sans pièces (total = 0.00)."""
        payload = {
            "id_reparation": reparation_no_labor_no_parts.id_reparation,
            "date_facture": "2026-11-16",
        }
        res = test_client.post("/api/v1/factures", json=payload, headers=headers_responsable)
        assert res.status_code == 201

        data = res.get_json()["data"]
        assert data["montant_total"] == 0.00
        assert data["cout_main_oeuvre"] == 0.00
        assert data["cout_pieces"] == 0.00

    def test_create_facture_with_multiple_parts(
        self, test_client, headers_responsable, reparation_with_parts
    ):
        """Facture avec main-d'œuvre et plusieurs pièces associées.
        
        Labor: 120.00
        Piece 1: 2 * 25.00 = 50.00
        Piece 2: 1 * 45.50 = 45.50
        Total pièces = 95.50
        Total = 215.50
        """
        payload = {
            "id_reparation": reparation_with_parts.id_reparation,
            "date_facture": "2026-11-15",
        }
        res = test_client.post("/api/v1/factures", json=payload, headers=headers_responsable)
        assert res.status_code == 201

        data = res.get_json()["data"]
        assert data["montant_total"] == 215.50
        assert data["cout_main_oeuvre"] == 120.00
        assert data["cout_pieces"] == 95.50
        assert len(data["pieces"]) == 2
        # Vérification des sous-totaux des pièces
        pieces_dict = {p["id_piece"]: p for p in data["pieces"]}
        assert pieces_dict[1]["sous_total"] == 50.00
        assert pieces_dict[2]["sous_total"] == 45.50

    def test_create_facture_historical_part_price_usage(
        self, test_client, headers_responsable, reparation_with_parts, sample_piece1
    ):
        """Vérification stricte de l'utilisation du prix historique (exigence 4).
        
        Si le prix de la pièce dans le catalogue change ultérieurement, la facture
        doit impérativement utiliser le prix_unitaire figé dans reparation_piece.
        """
        # Modification drastique du prix unitaire dans le catalogue de pièces détachées
        sample_piece1.prix_unitaire = Decimal("999.99")
        db.session.commit()

        # Émission de la facture
        payload = {
            "id_reparation": reparation_with_parts.id_reparation,
            "date_facture": "2026-11-15",
        }
        res = test_client.post("/api/v1/factures", json=payload, headers=headers_responsable)
        assert res.status_code == 201

        data = res.get_json()["data"]
        # Le total DOIT rester calculé à partir de 25.00 (prix historique), PAS 999.99
        assert data["montant_total"] == 215.50
        assert data["cout_pieces"] == 95.50

    def test_prevent_manual_modification_of_calculated_total(
        self, test_client, headers_responsable, reparation_with_parts
    ):
        """Le montant fourni par le client dans la requête POST est ignoré (exigence 7)."""
        payload = {
            "id_reparation": reparation_with_parts.id_reparation,
            "date_facture": "2026-11-15",
            "montant_total": 10.00,  # Tentative de sous-évaluer la facture
        }
        res = test_client.post("/api/v1/factures", json=payload, headers=headers_responsable)
        assert res.status_code == 201

        data = res.get_json()["data"]
        # Le serveur a ignoré 10.00 et calculé 215.50
        assert data["montant_total"] == 215.50

    def test_default_values_on_creation(
        self, test_client, headers_responsable, reparation_labor_only
    ):
        """Valeurs par défaut lors de la création (date_facture = aujourd'hui, statut = EN_ATTENTE)."""
        payload = {"id_reparation": reparation_labor_only.id_reparation}
        res = test_client.post("/api/v1/factures", json=payload, headers=headers_responsable)
        assert res.status_code == 201

        data = res.get_json()["data"]
        assert data["statut_paiement"] == "EN_ATTENTE"
        assert data["date_facture"] == date.today().isoformat()

    def test_prevent_duplicate_invoice_for_same_repair(
        self, test_client, headers_responsable, reparation_labor_only
    ):
        """Une seule facture est autorisée par réparation (exigence 2, 409 Conflict)."""
        payload = {"id_reparation": reparation_labor_only.id_reparation}
        # Première création : succès
        res1 = test_client.post("/api/v1/factures", json=payload, headers=headers_responsable)
        assert res1.status_code == 201

        # Deuxième création pour la même réparation : 409 Conflict
        res2 = test_client.post("/api/v1/factures", json=payload, headers=headers_responsable)
        assert res2.status_code == 409
        body2 = res2.get_json()
        assert body2["success"] is False
        assert body2["error"]["code"] == "CONFLICT"
        assert "déjà été émise" in body2["error"]["message"].lower()

    def test_create_facture_invalid_repair_id_not_found(
        self, test_client, headers_responsable
    ):
        """Réparation inexistante renvoie HTTP 404 Not Found."""
        payload = {"id_reparation": 99999}
        res = test_client.post("/api/v1/factures", json=payload, headers=headers_responsable)
        assert res.status_code == 404
        body = res.get_json()
        assert body["error"]["code"] == "NOT_FOUND"

    def test_create_facture_invalid_repair_id_types(
        self, test_client, headers_responsable
    ):
        """Identifiant de réparation invalide renvoie HTTP 422."""
        res_neg = test_client.post(
            "/api/v1/factures", json={"id_reparation": -5}, headers=headers_responsable
        )
        assert res_neg.status_code == 422

        res_zero = test_client.post(
            "/api/v1/factures", json={"id_reparation": 0}, headers=headers_responsable
        )
        assert res_zero.status_code == 422

        res_str = test_client.post(
            "/api/v1/factures", json={"id_reparation": "non-num"}, headers=headers_responsable
        )
        assert res_str.status_code == 422

        res_missing = test_client.post(
            "/api/v1/factures", json={}, headers=headers_responsable
        )
        assert res_missing.status_code == 422

    def test_create_facture_date_before_reparation_rejected(
        self, test_client, headers_responsable, reparation_labor_only
    ):
        """Date de facturation antérieure à la date d'intervention rejetée (HTTP 422)."""
        # reparation date = 2026-11-10
        payload = {
            "id_reparation": reparation_labor_only.id_reparation,
            "date_facture": "2026-11-05",  # Antérieur !
        }
        res = test_client.post("/api/v1/factures", json=payload, headers=headers_responsable)
        assert res.status_code == 422
        body = res.get_json()
        assert body["error"]["code"] == "VALIDATION_ERROR"
        assert "antérieure" in body["error"]["message"].lower()

    def test_create_facture_invalid_date_format(
        self, test_client, headers_responsable, reparation_labor_only
    ):
        """Format de date invalide renvoie HTTP 422."""
        payload = {
            "id_reparation": reparation_labor_only.id_reparation,
            "date_facture": "invalid-date",
        }
        res = test_client.post("/api/v1/factures", json=payload, headers=headers_responsable)
        assert res.status_code == 422

    def test_create_facture_invalid_payment_status(
        self, test_client, headers_responsable, reparation_labor_only
    ):
        """Statut de paiement non reconnu rejeté avec HTTP 422."""
        payload = {
            "id_reparation": reparation_labor_only.id_reparation,
            "statut_paiement": "STATUT_INCONNU",
        }
        res = test_client.post("/api/v1/factures", json=payload, headers=headers_responsable)
        assert res.status_code == 422
        body = res.get_json()
        assert body["error"]["code"] == "VALIDATION_ERROR"

    def test_create_facture_payment_status_normalization(
        self, test_client, headers_responsable, reparation_labor_only
    ):
        """Normalisation du statut de paiement (minuscules, accents, espaces)."""
        payload = {
            "id_reparation": reparation_labor_only.id_reparation,
            "statut_paiement": "payée",
        }
        res = test_client.post("/api/v1/factures", json=payload, headers=headers_responsable)
        assert res.status_code == 201
        assert res.get_json()["data"]["statut_paiement"] == "PAYEE"


# ============================================================================
# Tests: Detail Retrieval & Listing / Filtering
# ============================================================================

class TestFactureRetrievalAndFiltering:
    """Consultation et filtrage des factures."""

    @pytest.fixture
    def setup_factures(
        self, facture_app, vehicule1, vehicule2, mecanicien_profile
    ):
        """Crée plusieurs réparations et factures pour tests de filtrage."""
        # Réparation 1 (véhicule 1, client Claire)
        r1 = Reparation(
            description="Réparation 1",
            date_reparation=date(2026, 11, 1),
            statut="TERMINEE",
            cout=Decimal("100.00"),
            id_vehicule=vehicule1.id_vehicule,
            id_mecanicien=mecanicien_profile.id_mecanicien,
        )
        # Réparation 2 (véhicule 1, client Claire)
        r2 = Reparation(
            description="Réparation 2",
            date_reparation=date(2026, 11, 5),
            statut="TERMINEE",
            cout=Decimal("200.00"),
            id_vehicule=vehicule1.id_vehicule,
            id_mecanicien=mecanicien_profile.id_mecanicien,
        )
        # Réparation 3 (véhicule 2, client Lucas)
        r3 = Reparation(
            description="Réparation 3",
            date_reparation=date(2026, 11, 10),
            statut="TERMINEE",
            cout=Decimal("300.00"),
            id_vehicule=vehicule2.id_vehicule,
            id_mecanicien=mecanicien_profile.id_mecanicien,
        )
        db.session.add_all([r1, r2, r3])
        db.session.commit()

        f1 = Facture(
            date_facture=date(2026, 11, 2),
            montant_total=Decimal("100.00"),
            statut_paiement="PAYEE",
            id_reparation=r1.id_reparation,
        )
        f2 = Facture(
            date_facture=date(2026, 11, 6),
            montant_total=Decimal("200.00"),
            statut_paiement="EN_ATTENTE",
            id_reparation=r2.id_reparation,
        )
        f3 = Facture(
            date_facture=date(2026, 11, 12),
            montant_total=Decimal("300.00"),
            statut_paiement="PAYEE",
            id_reparation=r3.id_reparation,
        )
        db.session.add_all([f1, f2, f3])
        db.session.commit()
        return {"f1": f1, "f2": f2, "f3": f3, "r1": r1, "r2": r2, "r3": r3}

    def test_get_facture_by_id_success(
        self, test_client, headers_responsable, setup_factures
    ):
        """Récupération du détail complet d'une facture par son ID (HTTP 200)."""
        f1 = setup_factures["f1"]
        res = test_client.get(f"/api/v1/factures/{f1.id_facture}", headers=headers_responsable)
        assert res.status_code == 200

        data = res.get_json()["data"]
        assert data["id_facture"] == f1.id_facture
        assert data["montant_total"] == 100.00
        assert data["statut_paiement"] == "PAYEE"
        assert data["id_reparation"] == f1.id_reparation
        assert data["reparation"]["id_reparation"] == f1.id_reparation

    def test_get_facture_by_id_not_found(self, test_client, headers_responsable):
        """Facture introuvable renvoie HTTP 404 Not Found."""
        res = test_client.get("/api/v1/factures/99999", headers=headers_responsable)
        assert res.status_code == 404
        assert res.get_json()["error"]["code"] == "NOT_FOUND"

    def test_list_factures_all(self, test_client, headers_responsable, setup_factures):
        """Liste de toutes les factures (triées par date décroissante)."""
        res = test_client.get("/api/v1/factures", headers=headers_responsable)
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert len(data) == 3
        # f3 est la plus récente (2026-11-12)
        assert data[0]["id_facture"] == setup_factures["f3"].id_facture

    def test_list_factures_filter_by_status(
        self, test_client, headers_responsable, setup_factures
    ):
        """Filtrage des factures par statut de paiement."""
        res_payee = test_client.get("/api/v1/factures?statut=PAYEE", headers=headers_responsable)
        assert res_payee.status_code == 200
        data_payee = res_payee.get_json()["data"]
        assert len(data_payee) == 2
        assert all(f["statut_paiement"] == "PAYEE" for f in data_payee)

        res_attente = test_client.get("/api/v1/factures?statut=EN_ATTENTE", headers=headers_responsable)
        assert res_attente.status_code == 200
        data_attente = res_attente.get_json()["data"]
        assert len(data_attente) == 1
        assert data_attente[0]["id_facture"] == setup_factures["f2"].id_facture

    def test_list_factures_filter_by_reparation(
        self, test_client, headers_responsable, setup_factures
    ):
        """Filtrage par réparation associée."""
        r2 = setup_factures["r2"]
        res = test_client.get(f"/api/v1/factures?id_reparation={r2.id_reparation}", headers=headers_responsable)
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert len(data) == 1
        assert data[0]["id_facture"] == setup_factures["f2"].id_facture

    def test_list_factures_filter_by_date(
        self, test_client, headers_responsable, setup_factures
    ):
        """Filtrage par date exacte."""
        res = test_client.get("/api/v1/factures?date=2026-11-06", headers=headers_responsable)
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert len(data) == 1
        assert data[0]["id_facture"] == setup_factures["f2"].id_facture

    def test_list_factures_filter_by_date_range(
        self, test_client, headers_responsable, setup_factures
    ):
        """Filtrage par plage de dates (date_debut et date_fin)."""
        res = test_client.get(
            "/api/v1/factures?date_debut=2026-11-05&date_fin=2026-11-15",
            headers=headers_responsable,
        )
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert len(data) == 2
        ids = [f["id_facture"] for f in data]
        assert setup_factures["f2"].id_facture in ids
        assert setup_factures["f3"].id_facture in ids

    def test_list_factures_filter_by_vehicule(
        self, test_client, headers_responsable, setup_factures, vehicule1, vehicule2
    ):
        """Filtrage des factures par véhicule."""
        res1 = test_client.get(
            f"/api/v1/factures?id_vehicule={vehicule1.id_vehicule}",
            headers=headers_responsable,
        )
        assert res1.status_code == 200
        assert len(res1.get_json()["data"]) == 2

        res2 = test_client.get(
            f"/api/v1/factures?id_vehicule={vehicule2.id_vehicule}",
            headers=headers_responsable,
        )
        assert res2.status_code == 200
        assert len(res2.get_json()["data"]) == 1

    def test_list_factures_filter_by_client(
        self, test_client, headers_responsable, setup_factures, client_owner, client_other
    ):
        """Filtrage des factures par client."""
        res1 = test_client.get(
            f"/api/v1/factures?id_client={client_owner.id_client}",
            headers=headers_responsable,
        )
        assert res1.status_code == 200
        assert len(res1.get_json()["data"]) == 2

        res2 = test_client.get(
            f"/api/v1/factures?id_client={client_other.id_client}",
            headers=headers_responsable,
        )
        assert res2.status_code == 200
        assert len(res2.get_json()["data"]) == 1

    def test_list_factures_invalid_filter_formats(
        self, test_client, headers_responsable
    ):
        """Rejet des filtres avec formats invalides (HTTP 422)."""
        res_rep = test_client.get("/api/v1/factures?id_reparation=abc", headers=headers_responsable)
        assert res_rep.status_code == 422

        res_date = test_client.get("/api/v1/factures?date=not-a-date", headers=headers_responsable)
        assert res_date.status_code == 422

        res_debut = test_client.get("/api/v1/factures?date_debut=wrong", headers=headers_responsable)
        assert res_debut.status_code == 422

        res_fin = test_client.get("/api/v1/factures?date_fin=wrong", headers=headers_responsable)
        assert res_fin.status_code == 422

        res_veh = test_client.get("/api/v1/factures?id_vehicule=bad", headers=headers_responsable)
        assert res_veh.status_code == 422

        res_cli = test_client.get("/api/v1/factures?id_client=bad", headers=headers_responsable)
        assert res_cli.status_code == 422


# ============================================================================
# Tests: Payment Status Updates (PATCH) & Immutability
# ============================================================================

class TestFacturePatchAndImmutability:
    """Mise à jour du statut de paiement et garantie d'inviolabilité des montants."""

    @pytest.fixture
    def active_facture(self, facture_app, reparation_labor_only):
        """Facture initiale en attente de paiement."""
        f = Facture(
            date_facture=date(2026, 11, 15),
            montant_total=Decimal("85.50"),
            statut_paiement="EN_ATTENTE",
            id_reparation=reparation_labor_only.id_reparation,
        )
        db.session.add(f)
        db.session.commit()
        return f

    def test_patch_payment_status_success(
        self, test_client, headers_responsable, active_facture
    ):
        """Mise à jour réussie du statut de paiement vers 'PAYEE' (HTTP 200)."""
        payload = {"statut_paiement": "PAYEE"}
        res = test_client.patch(
            f"/api/v1/factures/{active_facture.id_facture}",
            json=payload,
            headers=headers_responsable,
        )
        assert res.status_code == 200
        data = res.get_json()["data"]
        assert data["statut_paiement"] == "PAYEE"

        # Vérification en base
        db.session.refresh(active_facture)
        assert active_facture.statut_paiement == "PAYEE"

    def test_patch_payment_status_normalized(
        self, test_client, headers_responsable, active_facture
    ):
        """Normalisation du statut dans PATCH (minuscules, accents)."""
        payload = {"statut_paiement": "partiellement payée"}
        res = test_client.patch(
            f"/api/v1/factures/{active_facture.id_facture}",
            json=payload,
            headers=headers_responsable,
        )
        assert res.status_code == 200
        assert res.get_json()["data"]["statut_paiement"] == "PARTIELLEMENT_PAYEE"

    def test_patch_invalid_payment_status(
        self, test_client, headers_responsable, active_facture
    ):
        """Statut de paiement invalide rejeté avec HTTP 422."""
        payload = {"statut_paiement": "NON_EXISTANT"}
        res = test_client.patch(
            f"/api/v1/factures/{active_facture.id_facture}",
            json=payload,
            headers=headers_responsable,
        )
        assert res.status_code == 422

    def test_patch_empty_payload(
        self, test_client, headers_responsable, active_facture
    ):
        """Corps de requête vide rejeté avec HTTP 422."""
        res = test_client.patch(
            f"/api/v1/factures/{active_facture.id_facture}",
            json={},
            headers=headers_responsable,
        )
        assert res.status_code == 422

    def test_patch_attempt_modify_montant_total_rejected(
        self, test_client, headers_responsable, active_facture
    ):
        """Interdiction formelle de modifier manuellement le montant total (HTTP 422)."""
        payload = {"montant_total": 500.00}
        res = test_client.patch(
            f"/api/v1/factures/{active_facture.id_facture}",
            json=payload,
            headers=headers_responsable,
        )
        assert res.status_code == 422
        body = res.get_json()
        assert "montant_total" in body["error"]["details"]
        assert "montant total" in body["error"]["details"]["montant_total"][0].lower()

        # Vérification : le montant en base est resté rigoureusement intact
        db.session.refresh(active_facture)
        assert active_facture.montant_total == Decimal("85.50")

    def test_patch_attempt_modify_reparation_rejected(
        self, test_client, headers_responsable, active_facture
    ):
        """Interdiction formelle de réassigner la réparation associée (HTTP 422)."""
        payload = {"id_reparation": 999}
        res = test_client.patch(
            f"/api/v1/factures/{active_facture.id_facture}",
            json=payload,
            headers=headers_responsable,
        )
        assert res.status_code == 422
        body = res.get_json()
        assert "id_reparation" in body["error"]["details"]
        assert "réparation" in body["error"]["details"]["id_reparation"][0].lower()

    def test_patch_attempt_modify_date_rejected(
        self, test_client, headers_responsable, active_facture
    ):
        """Interdiction formelle de modifier la date d'émission (HTTP 422)."""
        payload = {"date_facture": "2026-12-31"}
        res = test_client.patch(
            f"/api/v1/factures/{active_facture.id_facture}",
            json=payload,
            headers=headers_responsable,
        )
        assert res.status_code == 422
        body = res.get_json()
        assert "date_facture" in body["error"]["details"]
        assert "date" in body["error"]["details"]["date_facture"][0].lower()

    def test_patch_not_found(self, test_client, headers_responsable):
        """Facture inexistante renvoie HTTP 404."""
        res = test_client.patch(
            "/api/v1/factures/99999",
            json={"statut_paiement": "PAYEE"},
            headers=headers_responsable,
        )
        assert res.status_code == 404


# ============================================================================
# Tests: Protection of History & Integrity (Exigence 10)
# ============================================================================

class TestHistoryAndIntegrityProtection:
    """Préservation de l'intégrité comptable et interdiction de suppression."""

    def test_delete_facture_is_strictly_prevented(
        self, test_client, headers_responsable, reparation_labor_only
    ):
        """Toute tentative de suppression d'une facture est bloquée (HTTP 409 Conflict)."""
        facture = Facture(
            date_facture=date(2026, 11, 15),
            montant_total=Decimal("85.50"),
            statut_paiement="EN_ATTENTE",
            id_reparation=reparation_labor_only.id_reparation,
        )
        db.session.add(facture)
        db.session.commit()
        f_id = facture.id_facture

        res = test_client.delete(f"/api/v1/factures/{f_id}", headers=headers_responsable)
        assert res.status_code == 409
        body = res.get_json()
        assert body["error"]["code"] == "CONFLICT"
        assert "suppression" in body["error"]["message"].lower()

        # Vérification en base : la facture est TOUJOURS présente
        assert db.session.get(Facture, f_id) is not None

    def test_delete_nonexistent_facture_returns_404(
        self, test_client, headers_responsable
    ):
        """Suppression d'une facture inexistante renvoie HTTP 404."""
        res = test_client.delete("/api/v1/factures/99999", headers=headers_responsable)
        assert res.status_code == 404

    def test_reparation_parts_cannot_be_altered_after_invoice(
        self,
        test_client,
        headers_responsable,
        reparation_with_parts,
        sample_piece1,
    ):
        """L'émission d'une facture gèle l'ajout et la suppression de pièces détachées."""
        # Émission de la facture
        f = Facture(
            date_facture=date(2026, 11, 15),
            montant_total=Decimal("215.50"),
            statut_paiement="EN_ATTENTE",
            id_reparation=reparation_with_parts.id_reparation,
        )
        db.session.add(f)
        db.session.commit()

        # Tentative d'ajout d'une nouvelle pièce -> bloqué 409
        new_piece = PieceDetachee(
            nom="Bougie d'allumage",
            prix_unitaire=Decimal("12.00"),
            quantite_stock=100,
        )
        db.session.add(new_piece)
        db.session.commit()

        res_add = test_client.post(
            f"/api/v1/reparations/{reparation_with_parts.id_reparation}/pieces",
            json={"id_piece": new_piece.id_piece, "quantite": 4},
            headers=headers_responsable,
        )
        assert res_add.status_code == 409
        assert "facturée" in res_add.get_json()["error"]["message"].lower()

        # Tentative de suppression d'une pièce associée -> bloqué 409
        res_del = test_client.delete(
            f"/api/v1/reparations/{reparation_with_parts.id_reparation}/pieces/{sample_piece1.id_piece}",
            headers=headers_responsable,
        )
        assert res_del.status_code == 409
        assert "facturée" in res_del.get_json()["error"]["message"].lower()

    def test_reparation_cannot_be_deleted_after_invoice(
        self, test_client, headers_responsable, reparation_labor_only
    ):
        """Une réparation facturée ne peut pas être supprimée (HTTP 409 Conflict)."""
        f = Facture(
            date_facture=date(2026, 11, 15),
            montant_total=Decimal("85.50"),
            statut_paiement="EN_ATTENTE",
            id_reparation=reparation_labor_only.id_reparation,
        )
        db.session.add(f)
        db.session.commit()

        res = test_client.delete(
            f"/api/v1/reparations/{reparation_labor_only.id_reparation}",
            headers=headers_responsable,
        )
        assert res.status_code == 409
        assert "facture" in res.get_json()["error"]["message"].lower()


# ============================================================================
# Tests: Transaction Rollback & Database Integrity (Exigence 12)
# ============================================================================

class TestTransactionRollback:
    """Validation de l'atomicité transactionnelle et du rollback."""

    def test_create_facture_rollback_on_commit_error(
        self, reparation_labor_only
    ):
        """En cas d'exception lors du commit, la session effectue un rollback."""
        with patch("app.extensions.db.session.commit", side_effect=Exception("Database crash")):
            with pytest.raises(Exception):
                facture_service.create_facture({
                    "id_reparation": reparation_labor_only.id_reparation,
                    "date_facture": date(2026, 11, 15),
                })

        db.session.rollback()
        # Vérification : aucune facture persistée
        assert Facture.query.filter_by(id_reparation=reparation_labor_only.id_reparation).first() is None

    def test_create_facture_integrity_error_mapped_to_conflict(
        self, reparation_labor_only
    ):
        """IntegrityError lors du commit est mappée sur ConflictError."""
        with patch(
            "app.extensions.db.session.commit",
            side_effect=IntegrityError("INSERT INTO facture ...", {}, Exception("Duplicate key")),
        ):
            with pytest.raises(ConflictError) as exc_info:
                facture_service.create_facture({
                    "id_reparation": reparation_labor_only.id_reparation,
                    "date_facture": date(2026, 11, 15),
                })
            assert "conflit d'intégrité" in exc_info.value.message.lower()

    def test_update_statut_rollback_on_commit_error(
        self, reparation_labor_only
    ):
        """En cas d'erreur lors du commit de la mise à jour, rollback et ConflictError."""
        f = Facture(
            date_facture=date(2026, 11, 15),
            montant_total=Decimal("85.50"),
            statut_paiement="EN_ATTENTE",
            id_reparation=reparation_labor_only.id_reparation,
        )
        db.session.add(f)
        db.session.commit()

        with patch(
            "app.extensions.db.session.commit",
            side_effect=IntegrityError("UPDATE facture ...", {}, Exception("Integrity violation")),
        ):
            with pytest.raises(ConflictError):
                facture_service.update_statut_paiement(
                    f.id_facture,
                    {"statut_paiement": "PAYEE"},
                )

        db.session.rollback()
        db.session.refresh(f)
        assert f.statut_paiement == "EN_ATTENTE"


# ============================================================================
# Tests: Direct Service & Schemas Unit Tests
# ============================================================================

class TestFactureDirectUnitTests:
    """Tests unitaires directs sur les calculs et les schémas Marshmallow."""

    def test_calculate_totals_precision(self, reparation_labor_only):
        """Précision décimale de calculate_invoice_totals."""
        mo, pieces, total = facture_service.calculate_invoice_totals(reparation_labor_only)
        assert mo == Decimal("85.50")
        assert pieces == Decimal("0.00")
        assert total == Decimal("85.50")

    def test_calculate_totals_with_floating_prices(
        self, facture_app, vehicule1, mecanicien_profile
    ):
        """Précision exacte évitant toute dérive de virgule flottante."""
        r = Reparation(
            description="Test précision",
            date_reparation=date(2026, 11, 10),
            statut="TERMINEE",
            cout=Decimal("33.33"),
            id_vehicule=vehicule1.id_vehicule,
            id_mecanicien=mecanicien_profile.id_mecanicien,
        )
        db.session.add(r)
        db.session.commit()

        p = PieceDetachee(
            nom="Rondelle cuivre",
            prix_unitaire=Decimal("0.67"),
            quantite_stock=100,
        )
        db.session.add(p)
        db.session.commit()

        # 3 * 0.67 = 2.01
        rp = ReparationPiece(
            id_reparation=r.id_reparation,
            id_piece=p.id_piece,
            quantite=3,
            prix_unitaire=Decimal("0.67"),
        )
        db.session.add(rp)
        db.session.commit()

        mo, pieces, total = facture_service.calculate_invoice_totals(r)
        assert mo == Decimal("33.33")
        assert pieces == Decimal("2.01")
        assert total == Decimal("35.34")

    def test_create_schema_load(self):
        """Test de validation du schéma FactureCreateSchema."""
        res = facture_create_schema.load({"id_reparation": 42})
        assert res["id_reparation"] == 42
        assert res["statut_paiement"] == "EN_ATTENTE"
        assert res["date_facture"] == date.today()

    def test_update_schema_load(self):
        """Test de validation du schéma FactureUpdateSchema."""
        res = facture_update_schema.load({"statut_paiement": "payee"})
        assert res["statut_paiement"] == "PAYEE"

    def test_allowed_payment_statuses_comprehensive(self):
        """Vérification de la liste des statuts autorisés."""
        assert "EN_ATTENTE" in ALLOWED_PAYMENT_STATUSES
        assert "PAYEE" in ALLOWED_PAYMENT_STATUSES
        assert "ANNULEE" in ALLOWED_PAYMENT_STATUSES
        assert "IMPAYEE" in ALLOWED_PAYMENT_STATUSES
        assert "PARTIELLE" in ALLOWED_PAYMENT_STATUSES
