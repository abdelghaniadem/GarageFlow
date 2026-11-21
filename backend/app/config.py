"""GarageFlow Application Configuration Module.

Provides environment-based configuration classes.
Reads sensitive parameters exclusively from environment variables.
Strictly prohibits insecure default secrets in runtime environments.
Enforces test database isolation to protect live database instances using SQLAlchemy make_url.
"""
import os
from datetime import timedelta
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

ALLOWED_POSTGRES_TEST_DB = "garageflow_test_db"
ALLOWED_SQLITE_TEST_FILENAMES = {"garageflow_test.db", "test.db"}


class LazyConfig:
    """Descriptor evaluating configuration values at access time.

    Prevents import-time exceptions while guaranteeing runtime validation
    when configuration attributes are retrieved by Flask's from_object().
    """
    def __init__(self, getter):
        self.getter = getter

    def __get__(self, instance, owner):
        return self.getter(owner.__name__ if owner else "Config")


def _get_required_env(var_name: str, config_name: str) -> str:
    """Retrieve an environment variable, failing safely if missing or empty."""
    val = os.environ.get(var_name)
    if not val or not val.strip():
        raise ValueError(
            f"Configuration Error for '{config_name}': Environment variable '{var_name}' "
            f"must be explicitly set. Please configure it in your local .env file."
        )
    return val.strip()


def _get_database_url(config_name: str) -> str:
    """Retrieve and validate DATABASE_URL for runtime environments.

    Fails safely with a descriptive error if missing.
    No hardcoded fallback database is permitted.
    """
    url = os.environ.get("DATABASE_URL")
    if not url or not url.strip():
        raise ValueError(
            f"Configuration Error for '{config_name}': 'DATABASE_URL' must be explicitly provided "
            f"through environment variables. Ensure your .env file contains valid database credentials. "
            f"No hardcoded fallback database is permitted."
        )
    return url.strip()


def validate_test_database_url(url: str) -> str:
    """Strict validation to ensure the test suite NEVER targets the live database 'garageflow_db'.

    Parses the URL using SQLAlchemy's make_url() to guarantee exact dialect and database extraction.

    Enforcement Rules:
    1. Rejects missing, empty, or malformed database URLs.
    2. For PostgreSQL (and its drivers e.g. postgresql+psycopg2), allows ONLY the exact database
       name 'garageflow_test_db'. Strictly rejects 'garageflow_db' and any other PostgreSQL database name.
    3. SQLite is permitted ONLY through explicitly defined test-only configurations:
       in-memory databases (':memory:', '') or explicit test files (e.g., 'test.db').
    4. Rejects all other unapproved database engines.
    """
    if not url or not isinstance(url, str) or not url.strip():
        raise ValueError("Test database configuration error: Test database URL must be a non-empty string.")

    clean_url = url.strip()

    try:
        parsed = make_url(clean_url)
    except (ArgumentError, ValueError) as err:
        raise ValueError(f"Malformed database URL: Unable to parse '{clean_url}'. Error: {err}") from err

    backend = parsed.get_backend_name()
    database_name = parsed.database

    if backend == "postgresql":
        if not database_name:
            raise ValueError("Malformed PostgreSQL URL: Database name is missing.")

        if database_name == "garageflow_db":
            raise ValueError(
                "CRITICAL SECURITY VIOLATION: Test database URL targets the live database 'garageflow_db'. "
                f"Tests must strictly run against the isolated test database '{ALLOWED_POSTGRES_TEST_DB}'."
            )

        if database_name != ALLOWED_POSTGRES_TEST_DB:
            raise ValueError(
                f"CRITICAL SECURITY VIOLATION: Invalid PostgreSQL test database '{database_name}'. "
                f"Only the exact database name '{ALLOWED_POSTGRES_TEST_DB}' is permitted for tests."
            )

        return clean_url

    elif backend == "sqlite":
        # 1. Allow in-memory databases explicitly: sqlite:///:memory: or sqlite://
        if database_name in (":memory:", None, ""):
            return clean_url

        # 2. For file-based SQLite, permit ONLY explicitly defined test database filenames.
        # Substring matching is rejected; the filename must strictly match the approved whitelist.
        filename = os.path.basename(database_name)
        if filename in ALLOWED_SQLITE_TEST_FILENAMES:
            return clean_url

        raise ValueError(
            f"CRITICAL SECURITY VIOLATION: SQLite database '{database_name}' is not an approved test database. "
            f"SQLite is restricted exclusively to in-memory (':memory:') or explicitly defined test filenames: "
            f"{sorted(ALLOWED_SQLITE_TEST_FILENAMES)}."
        )

    else:
        raise ValueError(
            f"CRITICAL SECURITY VIOLATION: Unsupported test database backend '{backend}'. "
            f"Tests only permit PostgreSQL (exact database '{ALLOWED_POSTGRES_TEST_DB}') "
            "or SQLite test-only configurations."
        )


def _get_test_database_url(config_name: str) -> str:
    """Retrieve and validate the test database URL."""
    url = os.environ.get(
        "TEST_DATABASE_URL",
        f"postgresql+psycopg2://garageflow_app:password@localhost:5432/{ALLOWED_POSTGRES_TEST_DB}",
    )
    return validate_test_database_url(url)


class Config:
    """Base configuration with common operational parameters."""
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }

    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        seconds=int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRES", 86400))
    )

    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")
    LOW_STOCK_THRESHOLD = int(os.environ.get("LOW_STOCK_THRESHOLD", 5))


class DevelopmentConfig(Config):
    """Configuration for local development.

    Requires explicit, strong secrets and DATABASE_URL via environment variables.
    Insecure defaults and hardcoded database URLs are strictly disallowed.
    """
    DEBUG = True

    SQLALCHEMY_DATABASE_URI = LazyConfig(lambda name: _get_database_url(name))
    SECRET_KEY = LazyConfig(lambda name: _get_required_env("SECRET_KEY", name))
    JWT_SECRET_KEY = LazyConfig(lambda name: _get_required_env("JWT_SECRET_KEY", name))


class TestingConfig(Config):
    """Configuration for automated test execution.

    Strictly isolated from the live database 'garageflow_db'.
    Uses validated test database and static test-only secrets.
    """
    TESTING = True
    DEBUG = False

    SQLALCHEMY_DATABASE_URI = LazyConfig(lambda name: _get_test_database_url(name))
    SECRET_KEY = "garageflow-test-only-secret-key-not-for-production"
    JWT_SECRET_KEY = "garageflow-test-only-jwt-secret-key-not-for-production"


class ProductionConfig(Config):
    """Configuration for production deployment.

    Strictly enforces environment-provided secrets and database credentials.
    """
    DEBUG = False

    SQLALCHEMY_DATABASE_URI = LazyConfig(lambda name: _get_database_url(name))
    SECRET_KEY = LazyConfig(lambda name: _get_required_env("SECRET_KEY", name))
    JWT_SECRET_KEY = LazyConfig(lambda name: _get_required_env("JWT_SECRET_KEY", name))


config_by_name = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}
