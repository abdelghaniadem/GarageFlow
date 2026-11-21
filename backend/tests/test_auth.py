"""Tests unitaires et d'intégration d'API pour le module d'authentification.

Exécution isolée en mémoire avec SQLite (sqlite:///:memory:).
Aucune connexion à PostgreSQL, aucune modification de la base réelle et aucune migration.
"""
import pytest
from datetime import timedelta
from flask_jwt_extended import decode_token, create_access_token

from app import create_app
from app.extensions import db
from app.models.utilisateur import Utilisateur
from app.models.mecanicien import Mecanicien
from app.services.auth_service import login
from app.utils.exceptions import AuthenticationError


@pytest.fixture
def auth_app(monkeypatch):
    """Crée une application isolée utilisant une base SQLite en mémoire."""
    monkeypatch.setenv("TEST_DATABASE_URL", "sqlite:///:memory:")
    app = create_app("testing")
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(auth_app):
    """Client de test Flask pour les requêtes HTTP."""
    return auth_app.test_client()


@pytest.fixture
def sample_user(auth_app):
    """Création d'un utilisateur Responsable de test."""
    user = Utilisateur(
        nom="Dupont",
        prenom="Jean",
        email="jean.dupont@garageflow.fr",
        role="RESPONSABLE",
        telephone="0123456789",
    )
    user.set_password("SecurePass123!")
    db.session.add(user)
    db.session.commit()
    return user


@pytest.fixture
def mechanic_user(auth_app):
    """Création d'un utilisateur Mécanicien de test."""
    user = Utilisateur(
        nom="Martin",
        prenom="Luc",
        email="luc.martin@garageflow.fr",
        role="MECANICIEN",
        telephone="0987654321",
    )
    user.set_password("MecaPass456!")
    db.session.add(user)
    db.session.commit()
    return user


class TestAuthService:
    """Tests unitaires pour le service d'authentification (app.services.auth_service)."""

    def test_service_successful_login(self, auth_app, sample_user):
        """Vérifie le succès de l'authentification avec des identifiants valides."""
        result = login("jean.dupont@garageflow.fr", "SecurePass123!")

        assert "access_token" in result
        assert "token" not in result
        assert "user" in result
        assert result["user"]["email"] == "jean.dupont@garageflow.fr"
        assert result["user"]["role"] == "RESPONSABLE"
        assert "mot_de_passe" not in result["user"]

    def test_service_email_normalization(self, auth_app, sample_user):
        """Vérifie la normalisation de l'email (espaces et minuscules) par le service."""
        result = login("   JEAN.DUPONT@GARAGEFLOW.FR   ", "SecurePass123!")
        assert result["user"]["email"] == "jean.dupont@garageflow.fr"

    def test_service_incorrect_password(self, auth_app, sample_user):
        """Vérifie le rejet d'un mot de passe incorrect avec un message générique."""
        with pytest.raises(AuthenticationError) as exc_info:
            login("jean.dupont@garageflow.fr", "WrongPassword!")

        assert exc_info.value.code == "AUTHENTICATION_FAILED"
        assert exc_info.value.status_code == 401
        assert exc_info.value.message == "Identifiants invalides."

    def test_service_unknown_email(self, auth_app, sample_user):
        """Vérifie le rejet d'un email inexistant avec le même message générique."""
        with pytest.raises(AuthenticationError) as exc_info:
            login("inconnu@garageflow.fr", "SecurePass123!")

        assert exc_info.value.code == "AUTHENTICATION_FAILED"
        assert exc_info.value.status_code == 401
        assert exc_info.value.message == "Identifiants invalides."

    def test_service_jwt_identity_and_role_claims(self, auth_app, sample_user):
        """Vérifie que le JWT utilise l'id en chaîne et contient le rôle en claim."""
        result = login("jean.dupont@garageflow.fr", "SecurePass123!")
        decoded = decode_token(result["access_token"])

        assert decoded["sub"] == str(sample_user.id_utilisateur)
        assert isinstance(decoded["sub"], str)
        assert decoded["role"] == "RESPONSABLE"

    def test_service_jwt_mechanic_role_claim(self, auth_app, mechanic_user):
        """Vérifie la présence du rôle MECANICIEN dans les claims du JWT."""
        result = login("luc.martin@garageflow.fr", "MecaPass456!")
        decoded = decode_token(result["access_token"])

        assert decoded["sub"] == str(mechanic_user.id_utilisateur)
        assert decoded["role"] == "MECANICIEN"

    def test_service_password_never_in_result(self, auth_app, sample_user):
        """Vérifie qu'aucun hash de mot de passe n'apparaît dans le dictionnaire retourné."""
        result = login("jean.dupont@garageflow.fr", "SecurePass123!")
        assert "mot_de_passe" not in result
        assert "token" not in result
        assert "mot_de_passe" not in result["user"]


class TestAuthAPIRoutes:
    """Tests d'intégration d'API pour la route POST /api/v1/auth/login."""

    def test_api_login_success(self, client, sample_user):
        """Succès de la connexion HTTP (200 OK) avec structure standardisée."""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "jean.dupont@garageflow.fr",
                "mot_de_passe": "SecurePass123!",
            },
        )
        assert response.status_code == 200
        data = response.get_json()

        assert data["success"] is True
        assert "access_token" in data["data"]
        assert "token" not in data["data"]
        assert data["data"]["user"]["id_utilisateur"] == sample_user.id_utilisateur
        assert data["data"]["user"]["email"] == "jean.dupont@garageflow.fr"
        assert data["data"]["user"]["role"] == "RESPONSABLE"
        assert "mot_de_passe" not in data["data"]["user"]

    def test_api_login_rejects_password_alias(self, client, sample_user):
        """Vérifie que le champ 'password' seul est rejeté avec HTTP 422 (seul 'mot_de_passe' est accepté)."""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "jean.dupont@garageflow.fr",
                "password": "SecurePass123!",
            },
        )
        assert response.status_code == 422
        data = response.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"
        assert "mot_de_passe" in data["error"]["details"]

    def test_api_login_email_normalization(self, client, sample_user):
        """Vérifie la normalisation de l'email via l'API (espaces et casse)."""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "   JEAN.DUPONT@GARAGEFLOW.FR   ",
                "mot_de_passe": "SecurePass123!",
            },
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert data["data"]["user"]["email"] == "jean.dupont@garageflow.fr"

    def test_api_login_incorrect_password(self, client, sample_user):
        """Échec avec mot de passe incorrect : HTTP 401 et code AUTHENTICATION_FAILED."""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "jean.dupont@garageflow.fr",
                "mot_de_passe": "MauvaisMotDePasse",
            },
        )
        assert response.status_code == 401
        data = response.get_json()

        assert data["success"] is False
        assert data["error"]["code"] == "AUTHENTICATION_FAILED"
        assert data["error"]["message"] == "Identifiants invalides."

    def test_api_login_unknown_email(self, client, sample_user):
        """Échec avec email inconnu : HTTP 401 et même message générique."""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "inconnu@garageflow.fr",
                "mot_de_passe": "SecurePass123!",
            },
        )
        assert response.status_code == 401
        data = response.get_json()

        assert data["success"] is False
        assert data["error"]["code"] == "AUTHENTICATION_FAILED"
        assert data["error"]["message"] == "Identifiants invalides."

    def test_api_login_missing_email(self, client):
        """Validation : HTTP 422 si le champ email est absent."""
        response = client.post(
            "/api/v1/auth/login",
            json={"mot_de_passe": "SecurePass123!"},
        )
        assert response.status_code == 422
        data = response.get_json()

        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"
        assert "email" in data["error"]["details"]

    def test_api_login_missing_password(self, client):
        """Validation : HTTP 422 si le mot de passe est absent."""
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "test@garageflow.fr"},
        )
        assert response.status_code == 422
        data = response.get_json()

        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"
        assert "mot_de_passe" in data["error"]["details"]

    def test_api_login_invalid_email_format(self, client):
        """Validation : HTTP 422 si le format d'email est invalide."""
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "not-an-email", "mot_de_passe": "pass"},
        )
        assert response.status_code == 422
        data = response.get_json()

        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"
        assert "email" in data["error"]["details"]

    def test_api_login_empty_body(self, client):
        """Validation : HTTP 422 si le corps de la requête est vide ou non-JSON."""
        response = client.post(
            "/api/v1/auth/login",
            data="not a json",
            content_type="text/plain",
        )
        assert response.status_code == 422
        data = response.get_json()
        assert data["success"] is False
        assert data["error"]["code"] == "VALIDATION_ERROR"

    def test_api_jwt_claims_verification(self, client, sample_user):
        """Vérifie le contenu du jeton JWT extrait de la réponse HTTP."""
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "jean.dupont@garageflow.fr",
                "mot_de_passe": "SecurePass123!",
            },
        )
        assert response.status_code == 200
        token = response.get_json()["data"]["access_token"]
        decoded = decode_token(token)

        assert decoded["sub"] == str(sample_user.id_utilisateur)
        assert decoded["role"] == "RESPONSABLE"

    def test_password_hash_never_appearing_in_response(self, client, sample_user):
        """Vérification stricte de non-exposition du hash de mot de passe."""
        # Test sur réponse de succès
        resp_success = client.post(
            "/api/v1/auth/login",
            json={
                "email": "jean.dupont@garageflow.fr",
                "mot_de_passe": "SecurePass123!",
            },
        )
        text_success = resp_success.get_data(as_text=True)
        assert sample_user.mot_de_passe not in text_success
        assert "$2b$" not in text_success
        assert "mot_de_passe" not in resp_success.get_json()["data"]["user"]

        # Test sur réponse d'échec
        resp_error = client.post(
            "/api/v1/auth/login",
            json={
                "email": "jean.dupont@garageflow.fr",
                "mot_de_passe": "MauvaisMotDePasse",
            },
        )
        text_error = resp_error.get_data(as_text=True)
        assert sample_user.mot_de_passe not in text_error
        assert "$2b$" not in text_error


class TestJWTCustomErrorCallbacks:
    """Vérifie la standardisation des erreurs JWT (manquant, invalide, expiré)."""

    def test_missing_jwt_response_format(self, client):
        """Une requête protégée sans jeton renvoie HTTP 401 au format JSON standardisé."""
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401
        assert response.is_json
        data = response.get_json()

        assert data["success"] is False
        assert "error" in data
        assert data["error"]["code"] == "AUTHENTICATION_REQUIRED"
        assert "Authentification requise" in data["error"]["message"]
        assert "jwt" in data["error"].get("details", {})

    def test_invalid_jwt_response_format(self, client):
        """Un jeton JWT invalide ou corrompu renvoie HTTP 401 au format standardisé."""
        headers = {"Authorization": "Bearer not-a-valid-jwt-token"}
        response = client.get("/api/v1/auth/me", headers=headers)
        assert response.status_code == 401
        assert response.is_json
        data = response.get_json()

        assert data["success"] is False
        assert data["error"]["code"] == "INVALID_TOKEN"
        assert "invalide" in data["error"]["message"].lower()

    def test_expired_jwt_response_format(self, client, auth_app):
        """Un jeton JWT expiré renvoie HTTP 401 au format standardisé."""
        expired_token = create_access_token(
            identity="1",
            expires_delta=timedelta(seconds=-60),
            additional_claims={"role": "RESPONSABLE"},
        )
        headers = {"Authorization": f"Bearer {expired_token}"}
        response = client.get("/api/v1/auth/me", headers=headers)
        assert response.status_code == 401
        assert response.is_json
        data = response.get_json()

        assert data["success"] is False
        assert data["error"]["code"] == "TOKEN_EXPIRED"
        assert "expiré" in data["error"]["message"].lower()


class TestGlobalHTTPErrors:
    """Vérifie la standardisation JSON des erreurs HTTP 404, 405 et 500."""

    def test_404_not_found_returns_json(self, client):
        """Une route inexistante renvoie HTTP 404 en JSON standardisé sans HTML."""
        response = client.get("/api/v1/route-totalement-inexistante")
        assert response.status_code == 404
        assert response.is_json
        data = response.get_json()

        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"
        assert "trouvée" in data["error"]["message"].lower() or "not found" in data["error"]["message"].lower()

    def test_405_method_not_allowed_returns_json(self, client):
        """Une méthode HTTP non autorisée renvoie HTTP 405 en JSON standardisé."""
        # /api/v1/auth/login n'autorise que POST
        response = client.get("/api/v1/auth/login")
        assert response.status_code == 405
        assert response.is_json
        data = response.get_json()

        assert data["success"] is False
        assert data["error"]["code"] == "METHOD_NOT_ALLOWED"

    def test_500_unexpected_exception_returns_json_safely(self, client, auth_app):
        """Une exception inattendue renvoie HTTP 500 sans divulgation de stack trace."""
        @auth_app.route("/api/v1/test-500-endpoint", methods=["GET"])
        def raise_unexpected_error():
            raise ZeroDivisionError("Simulation d'erreur serveur inattendue")

        response = client.get("/api/v1/test-500-endpoint")
        assert response.status_code == 500
        assert response.is_json
        data = response.get_json()

        assert data["success"] is False
        assert data["error"]["code"] == "INTERNAL_SERVER_ERROR"
        assert "inattendue" in data["error"]["message"]
        # Vérification d'absence de fuite technique
        raw_text = response.get_data(as_text=True)
        assert "ZeroDivisionError" not in raw_text
        assert "Traceback" not in raw_text


class TestAuthMeEndpoint:
    """Tests pour l'endpoint de consultation du profil connecté GET /api/v1/auth/me."""

    def test_get_me_success_responsable(self, client, sample_user):
        """Récupération réussie du profil d'un Responsable connecté."""
        token = create_access_token(
            identity=str(sample_user.id_utilisateur),
            additional_claims={"role": sample_user.role},
        )
        response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        data = response.get_json()

        assert data["success"] is True
        user_info = data["data"]
        assert user_info["id_utilisateur"] == sample_user.id_utilisateur
        assert user_info["nom"] == sample_user.nom
        assert user_info["prenom"] == sample_user.prenom
        assert user_info["email"] == sample_user.email
        assert user_info["role"] == "RESPONSABLE"
        assert user_info["telephone"] == sample_user.telephone
        assert "mot_de_passe" not in user_info
        assert "mecanicien" not in user_info

    def test_get_me_success_mecanicien_with_profile(self, client, mechanic_user):
        """Récupération réussie du profil d'un Mécanicien avec ses données de spécialité."""
        # Création du profil mécanicien associé
        meca = Mecanicien(
            specialite="Électronique et Diagnostic Moteur",
            id_utilisateur=mechanic_user.id_utilisateur,
        )
        db.session.add(meca)
        db.session.commit()

        token = create_access_token(
            identity=str(mechanic_user.id_utilisateur),
            additional_claims={"role": mechanic_user.role},
        )
        response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        data = response.get_json()

        assert data["success"] is True
        user_info = data["data"]
        assert user_info["id_utilisateur"] == mechanic_user.id_utilisateur
        assert user_info["email"] == mechanic_user.email
        assert user_info["role"] == "MECANICIEN"
        assert user_info["id_mecanicien"] == meca.id_mecanicien
        assert user_info["specialite"] == "Électronique et Diagnostic Moteur"
        assert user_info["mecanicien"]["id_mecanicien"] == meca.id_mecanicien
        assert user_info["mecanicien"]["specialite"] == "Électronique et Diagnostic Moteur"
        assert "mot_de_passe" not in user_info

    def test_get_me_user_not_found(self, client, auth_app):
        """Jeton valide pour un identifiant inexistant ou supprimé renvoie HTTP 404 NOT_FOUND."""
        token = create_access_token(
            identity="99999",
            additional_claims={"role": "RESPONSABLE"},
        )
        response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 404
        assert response.is_json
        data = response.get_json()

        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"

    def test_get_me_invalid_identity_format(self, client, auth_app):
        """Identifiant JWT non numérique manipulé renvoie HTTP 404 NOT_FOUND de manière sécurisée."""
        token = create_access_token(
            identity="invalid-id-non-integer",
            additional_claims={"role": "RESPONSABLE"},
        )
        response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 404
        assert response.is_json
        data = response.get_json()

        assert data["success"] is False
        assert data["error"]["code"] == "NOT_FOUND"
