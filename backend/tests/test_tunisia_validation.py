"""Tests spécifiques pour les validations et formats tunisiens (Phase 9 & 10)."""
import pytest
from app.schemas.client_schema import client_create_schema, client_update_schema
from app.schemas.vehicule_schema import vehicule_create_schema, vehicule_update_schema
from marshmallow import ValidationError


class TestTunisianPhoneValidation:
    """Validation des numéros de téléphone tunisiens."""

    @pytest.mark.parametrize("phone", [
        "98123456",
        "98 123 456",
        "55 123 456",
        "20-456-789",
        "+216 98 123 456",
        "+21698123456",
        "0021655123456",
        "71 234 567",
        "31 456 789",
    ])
    def test_valid_tunisian_phones(self, phone):
        data = {
            "nom": "Ben Salem",
            "prenom": "Mohamed",
            "telephone": phone,
            "adresse": "Tunis",
        }
        loaded = client_create_schema.load(data)
        assert "telephone" in loaded

    @pytest.mark.parametrize("invalid_phone", [
        "123",
        "abcdefgh",
        "+216",
        "12345",
        "01234567890123456",  # Trop long (>15)
    ])
    def test_invalid_phones_rejected(self, invalid_phone):
        data = {
            "nom": "Ben Salem",
            "prenom": "Mohamed",
            "telephone": invalid_phone,
        }
        with pytest.raises(ValidationError) as exc:
            client_create_schema.load(data)
        assert "telephone" in exc.value.messages


class TestTunisianPlateValidation:
    """Validation et nettoyage des plaques d'immatriculation tunisiennes."""

    @pytest.mark.parametrize("immat,expected", [
        ("123 تونس 4567", "123 تونس 4567"),
        ("205 TU 4589", "205 TU 4589"),
        ("  205 tu 4589  ", "205 TU 4589"),
        ("180-TUN-5544", "180-TUN-5544"),
        ("200-4713", "200-4713"),
        ("TU-1234", "TU-1234"),
    ])
    def test_tunisian_plates_accepted_and_cleaned(self, immat, expected):
        data = {
            "marque": "Volkswagen",
            "modele": "Golf 7",
            "immatriculation": immat,
            "id_client": 1,
        }
        loaded = vehicule_create_schema.load(data)
        assert loaded["immatriculation"] == expected

    @pytest.mark.parametrize("invalid_plate", [
        "AA-123-BB",
        "BB-234-CC",
        "123-XYZ-78",
        "ABC",
        "1234567890",
    ])
    def test_invalid_plates_rejected(self, invalid_plate):
        data = {
            "marque": "Volkswagen",
            "modele": "Golf 7",
            "immatriculation": invalid_plate,
            "id_client": 1,
        }
        with pytest.raises(ValidationError) as exc:
            vehicule_create_schema.load(data)
        assert "immatriculation" in exc.value.messages
