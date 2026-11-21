"""Service métier pour la gestion des clients de GarageFlow.

Fournit les opérations de création, lecture, mise à jour et suppression (CRUD)
avec gestion transactionnelle stricte et contrôle de l'intégrité référentielle.
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.client import Client
from app.utils.exceptions import NotFoundError, ConflictError, ValidationError


def list_clients(search: Optional[str] = None) -> List[Client]:
    """Liste tous les clients avec recherche textuelle optionnelle.

    Args:
        search: Terme de recherche optionnel filtrant nom, prénom, téléphone ou adresse.

    Returns:
        Liste d'instances Client triées par identifiant croissant.
    """
    query = Client.query
    if search and isinstance(search, str) and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            db.or_(
                Client.nom.ilike(term),
                Client.prenom.ilike(term),
                Client.telephone.ilike(term),
                Client.adresse.ilike(term),
            )
        )
    return query.order_by(Client.id_client.asc()).all()


def get_client_by_id(id_client: int) -> Client:
    """Récupère un client par son identifiant unique.

    Args:
        id_client: Identifiant primaire du client.

    Returns:
        L'instance Client correspondante.

    Raises:
        NotFoundError: Si aucun client ne correspond à l'identifiant.
    """
    client = db.session.get(Client, id_client)
    if client is None:
        raise NotFoundError(f"Client avec l'identifiant {id_client} introuvable.")
    return client


def create_client(data: Dict[str, Any]) -> Client:
    """Crée un nouveau client après validation préalable.

    Args:
        data: Dictionnaire validé contenant nom, prenom, telephone et adresse (optionnelle).

    Returns:
        L'instance Client persistée.

    Raises:
        ConflictError: En cas de conflit d'intégrité en base de données.
    """
    client = Client(
        nom=data["nom"],
        prenom=data["prenom"],
        telephone=data["telephone"],
        adresse=data.get("adresse"),
    )
    db.session.add(client)
    try:
        db.session.commit()
    except IntegrityError as err:
        db.session.rollback()
        raise ConflictError(
            message="Impossible de créer le client en raison d'un conflit d'intégrité.",
            details={"error": "Database integrity conflict."},
        ) from err
    except Exception:
        db.session.rollback()
        raise

    return client


def update_client(id_client: int, data: Dict[str, Any]) -> Client:
    """Met à jour les informations d'un client existant.

    Args:
        id_client: Identifiant du client à modifier.
        data: Dictionnaire contenant les champs à modifier.

    Returns:
        L'instance Client mise à jour.

    Raises:
        NotFoundError: Si le client n'existe pas.
        ValidationError: Si aucune donnée n'est fournie.
        ConflictError: En cas de violation de contrainte d'intégrité.
    """
    if not data or not isinstance(data, dict):
        raise ValidationError("Aucune donnée fournie pour la mise à jour.")

    client = get_client_by_id(id_client)

    if "nom" in data:
        client.nom = data["nom"]
    if "prenom" in data:
        client.prenom = data["prenom"]
    if "telephone" in data:
        client.telephone = data["telephone"]
    if "adresse" in data:
        client.adresse = data["adresse"]

    try:
        db.session.commit()
    except IntegrityError as err:
        db.session.rollback()
        raise ConflictError(
            message="Impossible de mettre à jour le client en raison d'un conflit d'intégrité.",
            details={"error": "Database integrity conflict."},
        ) from err
    except Exception:
        db.session.rollback()
        raise

    return client


def delete_client(id_client: int) -> None:
    """Supprime un client uniquement si aucun enregistrement lié n'existe.

    Garantit la non-suppression en cascade des véhicules, réparations ou rendez-vous
    afin de préserver l'historique d'atelier.

    Args:
        id_client: Identifiant du client à supprimer.

    Raises:
        NotFoundError: Si le client n'existe pas.
        ConflictError: Si le client a des véhicules ou des rendez-vous associés.
    """
    client = get_client_by_id(id_client)

    # Protection explicite contre la suppression d'historique (véhicules & rendez-vous)
    reasons = []
    details = {}
    if client.vehicules:
        reasons.append(f"{len(client.vehicules)} véhicule(s)")
        details["vehicules_count"] = len(client.vehicules)
    if client.rendez_vous:
        reasons.append(f"{len(client.rendez_vous)} rendez-vous")
        details["rendez_vous_count"] = len(client.rendez_vous)

    if reasons:
        raise ConflictError(
            message=f"Impossible de supprimer le client : {' et '.join(reasons)} associé(s).",
            details=details,
        )

    try:
        db.session.delete(client)
        db.session.commit()
    except IntegrityError as err:
        db.session.rollback()
        raise ConflictError(
            message="Impossible de supprimer ce client en raison de contraintes d'intégrité relationnelle.",
            details={"error": "Foreign key constraint violation."},
        ) from err
    except Exception:
        db.session.rollback()
        raise
