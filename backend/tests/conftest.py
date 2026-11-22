"""Configuration globale pytest pour la suite de tests GarageFlow.

Garantit l'isolation stricte de la base de données en mémoire (SQLite)
pour toute exécution locale ou CI, protégeant ainsi la base PostgreSQL de production.
"""
import os

# Force par défaut l'utilisation hermétique de SQLite en mémoire pour tous les tests
os.environ["FLASK_ENV"] = "testing"
if not os.environ.get("TEST_DATABASE_URL") or not os.environ.get("TEST_DATABASE_URL", "").startswith("sqlite"):
    os.environ["TEST_DATABASE_URL"] = "sqlite:///:memory:"

os.environ.setdefault("SECRET_KEY", "pytest-test-secret-key-32-chars-minimum")
os.environ.setdefault("JWT_SECRET_KEY", "pytest-test-jwt-secret-key-32-chars-min")
