"""GarageFlow Application Factory Module.

Instantiates and configures the Flask application.
No database queries or connections are executed at initialization time.
"""
import os
from flask import Flask, jsonify
from marshmallow import ValidationError as MarshmallowValidationError
from werkzeug.exceptions import HTTPException

from .config import config_by_name
from .extensions import db, jwt, cors, bcrypt
from .utils.responses import error_response
from .utils.exceptions import APIError
from .routes.auth_routes import auth_bp
from .routes.client_routes import client_bp
from .routes.vehicule_routes import vehicule_bp
from .routes.mecanicien_routes import mecanicien_bp
from .routes.reparation_routes import reparation_bp
from .routes.piece_detachee_routes import piece_detachee_bp
from .routes.facture_routes import facture_bp
from .routes.rendez_vous_routes import rendez_vous_bp
from .routes.dashboard_routes import dashboard_bp


def create_app(config_name=None):
    """Factory function creating the Flask application instance."""
    if config_name is None:
        config_name = os.environ.get("FLASK_ENV", "development")

    app = Flask(__name__)
    app.config.from_object(config_by_name.get(config_name, config_by_name["default"]))

    # Initialize extensions without triggering active database connections
    db.init_app(app)
    jwt.init_app(app)
    cors.init_app(app, origins=app.config["CORS_ORIGINS"])
    bcrypt.init_app(app)

    # Custom Flask-JWT-Extended error callbacks conforming to GarageFlow error format
    @jwt.unauthorized_loader
    def handle_missing_jwt(err_str):
        return error_response(
            code="AUTHENTICATION_REQUIRED",
            message="Authentification requise. Jeton d'accès manquant.",
            status_code=401,
            details={"jwt": [err_str]} if err_str else None,
        )

    @jwt.invalid_token_loader
    def handle_invalid_jwt(err_str):
        return error_response(
            code="INVALID_TOKEN",
            message="Jeton d'accès invalide ou corrompu.",
            status_code=401,
            details={"jwt": [err_str]} if err_str else None,
        )

    @jwt.expired_token_loader
    def handle_expired_jwt(jwt_header, jwt_payload):
        return error_response(
            code="TOKEN_EXPIRED",
            message="Votre session a expiré. Veuillez vous reconnecter.",
            status_code=401,
            details={"jwt": ["The token has expired."]},
        )

    # Global error handlers for consistent JSON API responses
    @app.errorhandler(APIError)
    def handle_api_error(err):
        return error_response(
            code=err.code,
            message=err.message,
            status_code=err.status_code,
            details=err.details,
        )

    @app.errorhandler(MarshmallowValidationError)
    def handle_marshmallow_error(err):
        return error_response(
            code="VALIDATION_ERROR",
            message="Données de requête invalides.",
            status_code=422,
            details=err.messages,
        )

    @app.errorhandler(HTTPException)
    def handle_http_exception(err):
        code_str = err.name.upper().replace(" ", "_") if hasattr(err, "name") and err.name else "HTTP_ERROR"
        return error_response(
            code=code_str,
            message=err.description or "Une erreur HTTP est survenue.",
            status_code=err.code if err.code else 500,
        )

    @app.errorhandler(Exception)
    def handle_unexpected_exception(err):
        app.logger.exception("Erreur interne inattendue du serveur : %s", err)
        return error_response(
            code="INTERNAL_SERVER_ERROR",
            message="Une erreur inattendue est survenue sur le serveur.",
            status_code=500,
        )

    # Register API blueprints
    app.register_blueprint(auth_bp, url_prefix="/api/v1/auth")
    app.register_blueprint(client_bp, url_prefix="/api/v1/clients")
    app.register_blueprint(vehicule_bp, url_prefix="/api/v1/vehicules")
    app.register_blueprint(mecanicien_bp, url_prefix="/api/v1/mecaniciens")
    app.register_blueprint(reparation_bp, url_prefix="/api/v1/reparations")
    app.register_blueprint(piece_detachee_bp, url_prefix="/api/v1/pieces")
    app.register_blueprint(piece_detachee_bp, url_prefix="/api/v1/pieces-detachees", name="pieces_detachees_alias")
    app.register_blueprint(facture_bp, url_prefix="/api/v1/factures")
    app.register_blueprint(rendez_vous_bp, url_prefix="/api/v1/rendez-vous")
    app.register_blueprint(rendez_vous_bp, url_prefix="/api/v1/rendezvous", name="rendezvous_alias")
    app.register_blueprint(dashboard_bp, url_prefix="/api/v1/dashboard")

    # Base healthcheck route (no database connection required)
    @app.route("/api/v1/health", methods=["GET"])
    def health_check():
        return jsonify({
            "status": "healthy",
            "service": "GarageFlow Backend API",
            "version": "1.0.0"
        }), 200

    return app
