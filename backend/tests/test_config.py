"""Unit tests for configuration validation and test database safety guard.

These tests execute in complete isolation without establishing any network
or database connection to PostgreSQL.
"""
import pytest
from app.config import (
    validate_test_database_url,
    ALLOWED_POSTGRES_TEST_DB,
    TestingConfig,
)


class TestDatabaseURLValidation:
    """Test suite verifying strict validation rules of validate_test_database_url."""

    def test_allows_exact_postgres_test_db(self):
        """Allows PostgreSQL URLs targeting exclusively 'garageflow_test_db'."""
        valid_urls = [
            f"postgresql://garageflow_app:password@localhost:5432/{ALLOWED_POSTGRES_TEST_DB}",
            f"postgresql+psycopg2://user:pwd@127.0.0.1:5432/{ALLOWED_POSTGRES_TEST_DB}",
            f"postgresql+psycopg2://localhost/{ALLOWED_POSTGRES_TEST_DB}?sslmode=disable",
            f"postgresql://db.internal:5432/{ALLOWED_POSTGRES_TEST_DB}?sslmode=require&connect_timeout=10",
        ]
        for url in valid_urls:
            assert validate_test_database_url(url) == url

    def test_rejects_live_garageflow_db(self):
        """Strictly rejects the live production/development database 'garageflow_db'."""
        live_urls = [
            "postgresql://garageflow_app:password@localhost:5432/garageflow_db",
            "postgresql://localhost/garageflow_db",
            "postgresql+psycopg2://admin:secret@127.0.0.1:5432/garageflow_db?sslmode=require",
        ]
        for url in live_urls:
            with pytest.raises(ValueError, match="CRITICAL SECURITY VIOLATION.*live database 'garageflow_db'"):
                validate_test_database_url(url)

    def test_rejects_other_postgres_databases(self):
        """Rejects any PostgreSQL database that is not exactly 'garageflow_test_db'."""
        disallowed_urls = [
            "postgresql://localhost:5432/other_db",
            "postgresql://localhost:5432/my_test_db",
            "postgresql://localhost:5432/garageflow_test",
            "postgresql://localhost:5432/garageflow_test_database",
            "postgresql://localhost:5432/test",
            "postgresql://localhost:5432/test_db",
        ]
        for url in disallowed_urls:
            with pytest.raises(ValueError, match="Only the exact database name 'garageflow_test_db' is permitted"):
                validate_test_database_url(url)

    def test_rejects_missing_postgres_database_name(self):
        """Rejects PostgreSQL URLs missing a database path."""
        with pytest.raises(ValueError, match="Database name is missing"):
            validate_test_database_url("postgresql://localhost:5432/")

    def test_allows_sqlite_test_configurations(self):
        """Allows SQLite exclusively for in-memory or explicitly whitelisted test database filenames."""
        valid_sqlite = [
            "sqlite:///:memory:",
            "sqlite://",
            "sqlite:///test.db",
            "sqlite:///garageflow_test.db",
            "sqlite:////tmp/test.db",
            "sqlite:////tmp/garageflow_test.db",
        ]
        for url in valid_sqlite:
            assert validate_test_database_url(url) == url

    def test_rejects_sqlite_non_test_configurations(self):
        """Rejects SQLite URLs targeting non-whitelisted files, including substring matches."""
        disallowed_sqlite = [
            "sqlite:///production.db",
            "sqlite:///garageflow.db",
            "sqlite:///data.sqlite",
            # Substrings containing 'test' must be strictly rejected if not in the whitelist
            "sqlite:///my_test_database.db",
            "sqlite:///random_test.db",
            "sqlite:///testing.db",
            "sqlite:///contest.db",
        ]
        for url in disallowed_sqlite:
            with pytest.raises(ValueError, match="is not an approved test database"):
                validate_test_database_url(url)

    def test_rejects_empty_and_non_string_urls(self):
        """Rejects empty, whitespace, or invalid types."""
        invalid_inputs = [None, "", "   ", 123, ["postgresql://..."]]
        for invalid in invalid_inputs:
            with pytest.raises(ValueError, match="must be a non-empty string"):
                validate_test_database_url(invalid)

    def test_rejects_malformed_urls(self):
        """Rejects URLs that fail make_url parsing."""
        malformed_urls = [
            "invalid-url-string",
            "://broken",
            "postgresql:/missing-slashes",
        ]
        for malformed in malformed_urls:
            with pytest.raises(ValueError, match="Malformed database URL"):
                validate_test_database_url(malformed)

    def test_rejects_unsupported_dialects(self):
        """Rejects databases other than PostgreSQL and SQLite."""
        unsupported = [
            "mysql://localhost:3306/garageflow_test_db",
            "mariadb://localhost:3306/garageflow_test_db",
            "oracle://localhost:1521/garageflow_test_db",
            "mssql+pyodbc://localhost/garageflow_test_db",
        ]
        for url in unsupported:
            with pytest.raises(ValueError, match="Unsupported test database backend"):
                validate_test_database_url(url)


class TestTestingConfigDefaults:
    """Verifies that TestingConfig uses the safe test database by default."""

    def test_testing_config_database_defaults_to_safe_test_db(self, monkeypatch):
        monkeypatch.delenv("TEST_DATABASE_URL", raising=False)
        db_uri = TestingConfig.SQLALCHEMY_DATABASE_URI
        assert db_uri.endswith(f"/{ALLOWED_POSTGRES_TEST_DB}")

    def test_testing_config_secrets_are_static_test_strings(self):
        assert TestingConfig.SECRET_KEY == "garageflow-test-only-secret-key-not-for-production"
        assert TestingConfig.JWT_SECRET_KEY == "garageflow-test-only-jwt-secret-key-not-for-production"
