"""Tests d'intégration de bout en bout pour GarageFlow (Phase 7).

Couvre l'intégration croisée entre tous les modules fonctionnels de l'application :
- Scénario A : Cycle de vie d'un client (Client -> Véhicule -> Relations ORM)
- Scénario B : Cycle de réparation (Réparation -> Mécanicien -> Pièces -> Décrémentation/Différentiel/Restauration de stock)
- Scénario C : Facturation (Réparation éligible -> Calcul automatique inviolable -> Prix historiques figés -> Unicité 1:1 -> Immutabilité comptable)
- Scénario D : Rendez-vous (Planification -> Vérification stricte cohérence propriété client-véhicule -> Règles de suppression d'historique)
- Scénario E : Authentification et permissions (Tokens manquants/invalides -> RBAC RESPONSABLE vs MECANICIEN -> Isolation des réparations assignées)

Exécution isolée et hermétique en mémoire via SQLite (sqlite:///:memory:).
Aucune altération de la base PostgreSQL réelle.
"""
import pytest
from datetime import date, timedelta
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
    RendezVous,
)


@pytest.fixture
def app_instance(monkeypatch):
    """Instancie une application Flask de test avec base SQLite en mémoire."""
    monkeypatch.setenv("TEST_DATABASE_URL", "sqlite:///:memory:")
    app = create_app("testing")
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client_http(app_instance):
    """Client de test HTTP Flask."""
    return app_instance.test_client()


@pytest.fixture
def responsable_headers(app_instance):
    """Génère les en-têtes d'authentification pour un utilisateur RESPONSABLE."""
    with app_instance.app_context():
        user = Utilisateur(
            nom="Directeur",
            prenom="Sami",
            email="sami.directeur@garageflow.tn",
            role="RESPONSABLE",
            telephone="71000001",
        )
        user.set_password("Responsable123!")
        db.session.add(user)
        db.session.commit()

        token = create_access_token(
            identity=str(user.id_utilisateur),
            additional_claims={"role": "RESPONSABLE", "email": user.email},
        )
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture
def mecanicien_setup(app_instance):
    """Crée deux mécaniciens distincts et retourne leurs en-têtes d'authentification."""
    with app_instance.app_context():
        u1 = Utilisateur(
            nom="Trabelsi",
            prenom="Karim",
            email="karim.meca@garageflow.tn",
            role="MECANICIEN",
            telephone="71000002",
        )
        u1.set_password("Mecanicien123!")
        db.session.add(u1)
        db.session.flush()

        m1 = Mecanicien(id_utilisateur=u1.id_utilisateur, specialite="Moteur")
        db.session.add(m1)

        u2 = Utilisateur(
            nom="Ben Salem",
            prenom="Nabil",
            email="nabil.meca@garageflow.tn",
            role="MECANICIEN",
            telephone="71000003",
        )
        u2.set_password("Mecanicien456!")
        db.session.add(u2)
        db.session.flush()

        m2 = Mecanicien(id_utilisateur=u2.id_utilisateur, specialite="Électricité")
        db.session.add(m2)
        db.session.commit()

        t1 = create_access_token(identity=str(u1.id_utilisateur), additional_claims={"role": "MECANICIEN", "email": u1.email})
        t2 = create_access_token(identity=str(u2.id_utilisateur), additional_claims={"role": "MECANICIEN", "email": u2.email})

        return {
            "meca1": {"headers": {"Authorization": f"Bearer {t1}", "Content-Type": "application/json"}, "id": m1.id_mecanicien, "user_id": u1.id_utilisateur},
            "meca2": {"headers": {"Authorization": f"Bearer {t2}", "Content-Type": "application/json"}, "id": m2.id_mecanicien, "user_id": u2.id_utilisateur},
        }


# ============================================================================
# SCÉNARIO A : CYCLE DE VIE D'UN CLIENT
# ============================================================================

class TestScenarioAClientLifecycle:
    """Scénario A : Création, association véhicule, consultation, mise à jour et intégrité relationnelle."""

    def test_client_and_vehicle_lifecycle(self, client_http, responsable_headers, app_instance):
        # 1. Créer un client
        client_payload = {
            "nom": "Gharbi",
            "prenom": "Mohamed",
            "telephone": "20112233",
            "adresse": "Avenue Habib Bourguiba, Tunis",
        }
        res_client = client_http.post("/api/v1/clients", json=client_payload, headers=responsable_headers)
        assert res_client.status_code == 201
        client_data = res_client.get_json()["data"]
        id_client = client_data["id_client"]
        assert client_data["nom"] == "Gharbi"

        # 2. Créer un véhicule associé au client
        vehicule_payload = {
            "immatriculation": "180-TUN-5544",
            "marque": "Peugeot",
            "modele": "208",
            "annee": 2021,
            "kilometrage": 45000,
            "etat": "Bon",
            "id_client": id_client,
        }
        res_vehicule = client_http.post("/api/v1/vehicules", json=vehicule_payload, headers=responsable_headers)
        assert res_vehicule.status_code == 201
        vehicule_data = res_vehicule.get_json()["data"]
        id_vehicule = vehicule_data["id_vehicule"]
        assert vehicule_data["id_client"] == id_client

        # 3. Consulter le client et son véhicule
        res_get_client = client_http.get(f"/api/v1/clients/{id_client}", headers=responsable_headers)
        assert res_get_client.status_code == 200
        assert res_get_client.get_json()["data"]["id_client"] == id_client

        res_get_vehicule = client_http.get(f"/api/v1/vehicules/{id_vehicule}", headers=responsable_headers)
        assert res_get_vehicule.status_code == 200
        assert res_get_vehicule.get_json()["data"]["immatriculation"] == "180-TUN-5544"

        # 4. Modifier les informations
        res_up_client = client_http.put(
            f"/api/v1/clients/{id_client}",
            json={"telephone": "20998877", "adresse": "Les Berges du Lac, Tunis"},
            headers=responsable_headers,
        )
        assert res_up_client.status_code == 200
        assert res_up_client.get_json()["data"]["telephone"] == "20998877"

        res_up_veh = client_http.put(
            f"/api/v1/vehicules/{id_vehicule}",
            json={"kilometrage": 52000, "etat": "Excellent"},
            headers=responsable_headers,
        )
        assert res_up_veh.status_code == 200
        assert res_up_veh.get_json()["data"]["kilometrage"] == 52000

        # 5. Vérifier les relations en base de données
        with app_instance.app_context():
            client_db = db.session.get(Client, id_client)
            vehicule_db = db.session.get(Vehicule, id_vehicule)
            assert vehicule_db in client_db.vehicules
            assert vehicule_db.client.id_client == id_client


# ============================================================================
# SCÉNARIO B : CYCLE DE RÉPARATION ET GESTION DU STOCK
# ============================================================================

class TestScenarioBReparationAndStockCycle:
    """Scénario B : Fiche réparation, assignation, gestion des pièces, variations de stock et rollback."""

    def test_reparation_pieces_and_stock_differential(self, client_http, responsable_headers, mecanicien_setup, app_instance):
        meca1_id = mecanicien_setup["meca1"]["id"]

        # Création client et véhicule
        with app_instance.app_context():
            cl = Client(nom="Jaziri", prenom="Anis", telephone="22334455")
            db.session.add(cl)
            db.session.flush()
            veh = Vehicule(immatriculation="195-TUN-1234", marque="Volkswagen", modele="Golf 7", annee=2019, id_client=cl.id_client)
            db.session.add(veh)
            piece = PieceDetachee(nom="Plaquettes de frein avant", prix_unitaire=85.50, quantite_stock=10)
            db.session.add(piece)
            db.session.commit()
            id_vehicule = veh.id_vehicule
            id_piece = piece.id_piece

        # 1. Créer une réparation avec assignation du mécanicien 1
        rep_payload = {
            "description": "Changement des plaquettes de frein avant et purge",
            "date_reparation": date.today().isoformat(),
            "statut": "EN_ATTENTE",
            "cout": 60.00,
            "id_vehicule": id_vehicule,
            "id_mecanicien": meca1_id,
        }
        res_rep = client_http.post("/api/v1/reparations", json=rep_payload, headers=responsable_headers)
        assert res_rep.status_code == 201
        id_reparation = res_rep.get_json()["data"]["id_reparation"]

        # 2. Modifier le statut de la réparation
        res_statut = client_http.put(
            f"/api/v1/reparations/{id_reparation}",
            json={"statut": "EN_REPARATION", "diagnostic": "Plaquettes usées à 90%"},
            headers=responsable_headers,
        )
        assert res_statut.status_code == 200
        assert res_statut.get_json()["data"]["statut"] == "EN_REPARATION"

        # 3. Ajouter des pièces détachées (quantité = 2) -> vérification décrémentation stock (10 -> 8)
        res_add_piece = client_http.post(
            f"/api/v1/reparations/{id_reparation}/pieces",
            json={"id_piece": id_piece, "quantite": 2},
            headers=responsable_headers,
        )
        assert res_add_piece.status_code == 201
        assert res_add_piece.get_json()["data"]["quantite"] == 2

        with app_instance.app_context():
            p_check = db.session.get(PieceDetachee, id_piece)
            assert p_check.quantite_stock == 8

        # 4. Modifier la quantité consommée (2 -> 5) -> vérification différentiel de stock (8 - (5 - 2) = 5)
        res_patch_piece = client_http.patch(
            f"/api/v1/reparations/{id_reparation}/pieces/{id_piece}",
            json={"quantite": 5},
            headers=responsable_headers,
        )
        assert res_patch_piece.status_code == 200
        assert res_patch_piece.get_json()["data"]["quantite"] == 5

        with app_instance.app_context():
            p_check = db.session.get(PieceDetachee, id_piece)
            assert p_check.quantite_stock == 5

        # 5. Supprimer l'association de la pièce -> vérification restitution complète du stock (5 + 5 = 10)
        res_del_piece = client_http.delete(
            f"/api/v1/reparations/{id_reparation}/pieces/{id_piece}",
            headers=responsable_headers,
        )
        assert res_del_piece.status_code == 200

        with app_instance.app_context():
            p_check = db.session.get(PieceDetachee, id_piece)
            assert p_check.quantite_stock == 10


# ============================================================================
# SCÉNARIO C : FACTURATION ET HISTORIQUE COMPTABLE
# ============================================================================

class TestScenarioCInvoicingAndAccounting:
    """Scénario C : Émission, calcul inviolable, snapshot historique, contrainte 1:1 et immutabilité."""

    def test_invoice_automatic_calculation_and_historical_integrity(self, client_http, responsable_headers, mecanicien_setup, app_instance):
        meca1_id = mecanicien_setup["meca1"]["id"]

        with app_instance.app_context():
            cl = Client(nom="Mansour", prenom="Tarak", telephone="98123456")
            db.session.add(cl)
            db.session.flush()
            veh = Vehicule(immatriculation="210-TUN-7890", marque="Renault", modele="Megane 4", annee=2020, id_client=cl.id_client)
            db.session.add(veh)
            p1 = PieceDetachee(nom="Filtre à huile", prix_unitaire=25.00, quantite_stock=20)
            p2 = PieceDetachee(nom="Huile moteur 5W40 (5L)", prix_unitaire=80.00, quantite_stock=15)
            db.session.add_all([p1, p2])
            db.session.flush()

            # Réparation terminée avec coût main-d'œuvre = 70.00
            rep = Reparation(
                description="Vidange complète et remplacement filtres",
                date_reparation=date.today(),
                statut="TERMINEE",
                cout=70.00,
                id_vehicule=veh.id_vehicule,
                id_mecanicien=meca1_id,
            )
            db.session.add(rep)
            db.session.flush()

            # Association des pièces : 1 filtre à huile (25.00) + 1 bidon d'huile (80.00)
            rp1 = ReparationPiece(id_reparation=rep.id_reparation, id_piece=p1.id_piece, quantite=1, prix_unitaire=25.00)
            rp2 = ReparationPiece(id_reparation=rep.id_reparation, id_piece=p2.id_piece, quantite=1, prix_unitaire=80.00)
            db.session.add_all([rp1, rp2])
            db.session.commit()

            id_reparation = rep.id_reparation
            id_p1 = p1.id_piece

        # 1. Émettre la facture
        # Montant attendu = Main d'œuvre (70.00) + Pièces (25.00 + 80.00) = 175.00
        res_fac = client_http.post(
            "/api/v1/factures",
            json={"id_reparation": id_reparation, "statut_paiement": "EN_ATTENTE"},
            headers=responsable_headers,
        )
        assert res_fac.status_code == 201
        fac_data = res_fac.get_json()["data"]
        id_facture = fac_data["id_facture"]
        assert fac_data["montant_total"] == 175.00
        assert fac_data["cout_main_oeuvre"] == 70.00
        assert fac_data["cout_pieces"] == 105.00

        # 2. Règle métier : modification ultérieure des prix dans le catalogue
        with app_instance.app_context():
            p1_mod = db.session.get(PieceDetachee, id_p1)
            p1_mod.prix_unitaire = 999.00  # Forte hausse catalogue
            db.session.commit()

        # 3. La facture doit impérativement conserver le montant historique figé (175.00)
        res_get_fac = client_http.get(f"/api/v1/factures/{id_facture}", headers=responsable_headers)
        assert res_get_fac.status_code == 200
        assert res_get_fac.get_json()["data"]["montant_total"] == 175.00

        # 4. Modification autorisée : statut de paiement vers "PAYEE"
        res_patch = client_http.patch(
            f"/api/v1/factures/{id_facture}",
            json={"statut_paiement": "PAYEE"},
            headers=responsable_headers,
        )
        assert res_patch.status_code == 200
        assert res_patch.get_json()["data"]["statut_paiement"] == "PAYEE"

        # 5. Tentative de double facturation pour la même réparation (rejet HTTP 409 Conflict)
        res_dup = client_http.post(
            "/api/v1/factures",
            json={"id_reparation": id_reparation},
            headers=responsable_headers,
        )
        assert res_dup.status_code == 409

        # 6. Tentative d'altération manuelle du montant (rejet HTTP 422)
        res_tamper = client_http.patch(
            f"/api/v1/factures/{id_facture}",
            json={"montant_total": 50.00},
            headers=responsable_headers,
        )
        assert res_tamper.status_code == 422

        # 7. Tentative de suppression comptable (rejet HTTP 409 Conflict)
        res_del = client_http.delete(f"/api/v1/factures/{id_facture}", headers=responsable_headers)
        assert res_del.status_code == 409


# ============================================================================
# SCÉNARIO D : PLANIFICATION DES RENDEZ-VOUS ET COHÉRENCE CLIENT-VÉHICULE
# ============================================================================

class TestScenarioDAppointmentsAndOwnership:
    """Scénario D : Rendez-vous, cohérence stricte client-véhicule et protection d'historique."""

    def test_appointment_lifecycle_and_ownership_enforcement(self, client_http, responsable_headers, app_instance):
        with app_instance.app_context():
            # Client A et son véhicule
            cl_a = Client(nom="Ben Ammar", prenom="Hedi", telephone="21445566")
            db.session.add(cl_a)
            db.session.flush()
            veh_a = Vehicule(immatriculation="175-TUN-9999", marque="Toyota", modele="Yaris", id_client=cl_a.id_client)

            # Client B et son véhicule
            cl_b = Client(nom="Cherif", prenom="Leila", telephone="25667788")
            db.session.add(cl_b)
            db.session.flush()
            veh_b = Vehicule(immatriculation="188-TUN-1111", marque="Hyundai", modele="i20", id_client=cl_b.id_client)

            db.session.add_all([veh_a, veh_b])
            db.session.commit()

            id_client_a = cl_a.id_client
            id_vehicule_a = veh_a.id_vehicule
            id_client_b = cl_b.id_client
            id_vehicule_b = veh_b.id_vehicule

        # 1. Planifier un rendez-vous légitime (Client A + Véhicule A)
        rdv_payload = {
            "id_client": id_client_a,
            "id_vehicule": id_vehicule_a,
            "date_rendezvous": (date.today() + timedelta(days=2)).isoformat(),
            "heure": "10:30",
            "motif": "Contrôle technique pré-visite",
            "statut": "PLANIFIE",
        }
        res_rdv = client_http.post("/api/v1/rendez-vous", json=rdv_payload, headers=responsable_headers)
        assert res_rdv.status_code == 201
        id_rdv = res_rdv.get_json()["data"]["id_rendezvous"]

        # 2. Tester l'incohérence de propriété : associer Véhicule B à Client A -> rejet HTTP 422
        invalid_rdv_payload = {
            "id_client": id_client_a,
            "id_vehicule": id_vehicule_b,  # Appartient au client B !
            "date_rendezvous": (date.today() + timedelta(days=3)).isoformat(),
            "heure": "14:00",
            "motif": "Révision",
        }
        res_invalid = client_http.post("/api/v1/rendez-vous", json=invalid_rdv_payload, headers=responsable_headers)
        assert res_invalid.status_code == 422
        assert "n'appartient pas au client" in res_invalid.get_json()["error"]["message"]

        # 3. Modification de date et de statut
        res_update = client_http.put(
            f"/api/v1/rendez-vous/{id_rdv}",
            json={"statut": "TERMINE", "motif": "Contrôle effectué sans anomalie"},
            headers=responsable_headers,
        )
        assert res_update.status_code == 200
        assert res_update.get_json()["data"]["statut"] == "TERMINE"

        # 4. Protection d'historique : suppression interdite pour statut 'TERMINE' -> rejet HTTP 409
        res_del_conflict = client_http.delete(f"/api/v1/rendez-vous/{id_rdv}", headers=responsable_headers)
        assert res_del_conflict.status_code == 409

        # 5. Modification vers 'ANNULE' et suppression réussie
        client_http.put(f"/api/v1/rendez-vous/{id_rdv}", json={"statut": "ANNULE"}, headers=responsable_headers)
        res_del_ok = client_http.delete(f"/api/v1/rendez-vous/{id_rdv}", headers=responsable_headers)
        assert res_del_ok.status_code == 200


# ============================================================================
# SCÉNARIO E : CONTRÔLE D'ACCÈS RBAC, SÉCURITÉ JWT ET CONFIDENTIALITÉ
# ============================================================================

class TestScenarioESecurityAndPermissions:
    """Scénario E : Sécurité des endpoints, tokens, RBAC RESPONSABLE vs MECANICIEN et isolation des réparations."""

    def test_missing_and_invalid_token_protection(self, client_http):
        # 1. Requête sans en-tête Authorization
        res_no_token = client_http.get("/api/v1/clients")
        assert res_no_token.status_code == 401
        assert res_no_token.get_json()["error"]["code"] == "AUTHENTICATION_REQUIRED"

        # 2. Requête avec jeton corrompu
        res_invalid = client_http.get("/api/v1/clients", headers={"Authorization": "Bearer token_completement_invalide"})
        assert res_invalid.status_code == 401
        assert res_invalid.get_json()["error"]["code"] == "INVALID_TOKEN"

    def test_rbac_responsable_vs_mecanicien(self, client_http, responsable_headers, mecanicien_setup):
        meca_headers = mecanicien_setup["meca1"]["headers"]

        # Routes strictement réservées au RESPONSABLE (HTTP 403 pour le Mécanicien)
        restricted_endpoints = [
            ("GET", "/api/v1/clients"),
            ("POST", "/api/v1/clients"),
            ("GET", "/api/v1/mecaniciens"),
            ("GET", "/api/v1/factures"),
            ("POST", "/api/v1/factures"),
            ("GET", "/api/v1/rendez-vous"),
            ("POST", "/api/v1/rendez-vous"),
        ]

        for method, endpoint in restricted_endpoints:
            if method == "GET":
                res = client_http.get(endpoint, headers=meca_headers)
            else:
                res = client_http.post(endpoint, json={}, headers=meca_headers)
            assert res.status_code == 403, f"Endpoint {endpoint} aurait dû refuser le rôle MECANICIEN avec 403"

        # Protection des données financières sur le dashboard : accès autorisé mais données sensibles masquées
        res_dash_meca = client_http.get("/api/v1/dashboard/stats", headers=meca_headers)
        assert res_dash_meca.status_code == 200
        dash_data_meca = res_dash_meca.get_json()["data"]
        assert dash_data_meca["evolution_revenus"] is None
        assert dash_data_meca["chiffre_affaires"] is None

        # Alors que le RESPONSABLE a accès au chiffre d'affaires et à l'évolution des revenus
        res_dash_resp = client_http.get("/api/v1/dashboard/stats", headers=responsable_headers)
        assert res_dash_resp.status_code == 200
        dash_data_resp = res_dash_resp.get_json()["data"]
        assert dash_data_resp["evolution_revenus"] is not None

    def test_reparation_isolation_between_mechanics(self, client_http, responsable_headers, mecanicien_setup, app_instance):
        meca1_id = mecanicien_setup["meca1"]["id"]
        meca1_headers = mecanicien_setup["meca1"]["headers"]
        meca2_id = mecanicien_setup["meca2"]["id"]
        meca2_headers = mecanicien_setup["meca2"]["headers"]

        with app_instance.app_context():
            cl = Client(nom="Test", prenom="Iso", telephone="11223344")
            db.session.add(cl)
            db.session.flush()
            veh = Vehicule(immatriculation="123-TUN-4567", marque="Fiat", modele="Punto", id_client=cl.id_client)
            db.session.add(veh)
            db.session.flush()

            # Réparation 1 assignée au Mécanicien 1
            rep1 = Reparation(description="Réparation Meca 1", date_reparation=date.today(), statut="EN_COURS", id_vehicule=veh.id_vehicule, id_mecanicien=meca1_id)
            # Réparation 2 assignée au Mécanicien 2
            rep2 = Reparation(description="Réparation Meca 2", date_reparation=date.today(), statut="EN_COURS", id_vehicule=veh.id_vehicule, id_mecanicien=meca2_id)
            db.session.add_all([rep1, rep2])
            db.session.commit()

            id_rep1 = rep1.id_reparation
            id_rep2 = rep2.id_reparation

        # Le Mécanicien 1 ne doit voir QUE sa propre réparation
        res_meca1 = client_http.get("/api/v1/reparations", headers=meca1_headers)
        assert res_meca1.status_code == 200
        rep_ids_meca1 = [r["id_reparation"] for r in res_meca1.get_json()["data"]]
        assert id_rep1 in rep_ids_meca1
        assert id_rep2 not in rep_ids_meca1

        # Le Mécanicien 2 ne doit voir QUE sa propre réparation
        res_meca2 = client_http.get("/api/v1/reparations", headers=meca2_headers)
        assert res_meca2.status_code == 200
        rep_ids_meca2 = [r["id_reparation"] for r in res_meca2.get_json()["data"]]
        assert id_rep2 in rep_ids_meca2
        assert id_rep1 not in rep_ids_meca2

        # Le RESPONSABLE voit TOUTES les réparations
        res_resp = client_http.get("/api/v1/reparations", headers=responsable_headers)
        assert res_resp.status_code == 200
        rep_ids_resp = [r["id_reparation"] for r in res_resp.get_json()["data"]]
        assert id_rep1 in rep_ids_resp
        assert id_rep2 in rep_ids_resp
