"""Service métier pour la gestion des véhicules de GarageFlow.

Fournit les opérations de création, lecture, mise à jour et suppression (CRUD)
avec validation des clients rattachés, unicité de l'immatriculation et
contrôle d'intégrité référentielle anti-cascade.
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.vehicule import Vehicule
from app.models.client import Client
from app.utils.exceptions import NotFoundError, ConflictError, ValidationError


def list_vehicules(
    id_client: Optional[int] = None,
    immatriculation: Optional[str] = None,
    search: Optional[str] = None,
) -> List[Vehicule]:
    """Liste tous les véhicules avec filtres optionnels par client, immatriculation ou recherche textuelle.

    Args:
        id_client: Filtrer par l'identifiant du client propriétaire.
        immatriculation: Filtrer par immatriculation (recherche insensible à la casse).
        search: Terme de recherche optionnel filtrant marque, modèle ou immatriculation.

    Returns:
        Liste d'instances Vehicule triées par identifiant croissant.
    """
    query = Vehicule.query

    if id_client is not None:
        query = query.filter_by(id_client=id_client)

    if immatriculation and isinstance(immatriculation, str) and immatriculation.strip():
        term_immat = f"%{immatriculation.strip().upper()}%"
        query = query.filter(Vehicule.immatriculation.ilike(term_immat))

    if search and isinstance(search, str) and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            db.or_(
                Vehicule.marque.ilike(term),
                Vehicule.modele.ilike(term),
                Vehicule.immatriculation.ilike(term),
            )
        )

    return query.order_by(Vehicule.id_vehicule.asc()).all()


def get_vehicule_by_id(id_vehicule: int) -> Vehicule:
    """Récupère un véhicule par son identifiant unique.

    Args:
        id_vehicule: Identifiant primaire du véhicule.

    Returns:
        L'instance Vehicule correspondante.

    Raises:
        NotFoundError: Si aucun véhicule ne correspond à l'identifiant.
    """
    vehicule = db.session.get(Vehicule, id_vehicule)
    if vehicule is None:
        raise NotFoundError(f"Véhicule avec l'identifiant {id_vehicule} introuvable.")
    return vehicule


def create_vehicule(data: Dict[str, Any]) -> Vehicule:
    """Crée un nouveau véhicule après vérification du client et unicité de l'immatriculation.

    Args:
        data: Dictionnaire contenant marque, modele, immatriculation, id_client et champs optionnels.

    Returns:
        L'instance Vehicule persistée.

    Raises:
        NotFoundError: Si le client spécifié par id_client n'existe pas.
        ConflictError: Si l'immatriculation existe déjà ou en cas de conflit d'intégrité.
    """
    # 1. Vérification de l'existence du client propriétaire
    client_id = data["id_client"]
    client = db.session.get(Client, client_id)
    if client is None:
        raise NotFoundError(f"Client avec l'identifiant {client_id} introuvable.")

    # 2. Vérification de l'unicité de l'immatriculation
    immatriculation = data["immatriculation"]
    existing = Vehicule.query.filter_by(immatriculation=immatriculation).first()
    if existing:
        raise ConflictError(
            message=f"Un véhicule avec l'immatriculation '{immatriculation}' existe déjà.",
            details={"immatriculation": ["Cette immatriculation est déjà enregistrée."]},
        )

    vehicule = Vehicule(
        marque=data["nom"] if "nom" in data else data["marque"],
        modele=data["modele"],
        immatriculation=immatriculation,
        annee=data.get("annee"),
        kilometrage=data.get("kilometrage"),
        etat=data.get("etat"),
        id_client=client_id,
    )

    db.session.add(vehicule)
    try:
        db.session.commit()
    except IntegrityError as err:
        db.session.rollback()
        raise ConflictError(
            message="Impossible de créer le véhicule en raison d'un conflit d'intégrité.",
            details={"error": "Database integrity conflict."},
        ) from err
    except Exception:
        db.session.rollback()
        raise

    return vehicule


def update_vehicule(id_vehicule: int, data: Dict[str, Any]) -> Vehicule:
    """Met à jour un véhicule existant (partiellement ou totalement).

    Args:
        id_vehicule: Identifiant du véhicule à modifier.
        data: Dictionnaire contenant les champs à modifier.

    Returns:
        L'instance Vehicule mise à jour.

    Raises:
        NotFoundError: Si le véhicule ou le nouveau client n'existe pas.
        ValidationError: Si aucune donnée n'est fournie.
        ConflictError: Si la nouvelle immatriculation est déjà utilisée par un autre véhicule.
    """
    if not data or not isinstance(data, dict):
        raise ValidationError("Aucune donnée fournie pour la mise à jour.")

    vehicule = get_vehicule_by_id(id_vehicule)

    # Vérification du client si modification du propriétaire
    if "id_client" in data and data["id_client"] != vehicule.id_client:
        client_id = data["id_client"]
        client = db.session.get(Client, client_id)
        if client is None:
            raise NotFoundError(f"Client avec l'identifiant {client_id} introuvable.")
        vehicule.id_client = client_id

    # Vérification de l'unicité si modification de l'immatriculation
    if "immatriculation" in data and data["immatriculation"] != vehicule.immatriculation:
        new_immat = data["immatriculation"]
        existing = Vehicule.query.filter_by(immatriculation=new_immat).first()
        if existing and existing.id_vehicule != vehicule.id_vehicule:
            raise ConflictError(
                message=f"Un véhicule avec l'immatriculation '{new_immat}' existe déjà.",
                details={"immatriculation": ["Cette immatriculation est déjà enregistrée."]},
            )
        vehicule.immatriculation = new_immat

    if "marque" in data:
        vehicule.marque = data["marque"]
    if "modele" in data:
        vehicule.modele = data["modele"]
    if "annee" in data:
        vehicule.annee = data["annee"]
    if "kilometrage" in data:
        vehicule.kilometrage = data["kilometrage"]
    if "etat" in data:
        vehicule.etat = data["etat"]

    try:
        db.session.commit()
    except IntegrityError as err:
        db.session.rollback()
        raise ConflictError(
            message="Impossible de mettre à jour le véhicule en raison d'un conflit d'intégrité.",
            details={"error": "Database integrity conflict."},
        ) from err
    except Exception:
        db.session.rollback()
        raise

    return vehicule


def delete_vehicule(id_vehicule: int) -> None:
    """Supprime un véhicule uniquement si aucun enregistrement lié n'existe.

    Garantit la non-suppression en cascade des réparations ou des rendez-vous
    afin de préserver l'historique technique.

    Args:
        id_vehicule: Identifiant du véhicule à supprimer.

    Raises:
        NotFoundError: Si le véhicule n'existe pas.
        ConflictError: Si des réparations ou des rendez-vous sont rattachés au véhicule.
    """
    vehicule = get_vehicule_by_id(id_vehicule)

    reasons = []
    details = {}
    if vehicule.reparations:
        reasons.append(f"{len(vehicule.reparations)} réparation(s)")
        details["reparations_count"] = len(vehicule.reparations)
    if vehicule.rendez_vous:
        reasons.append(f"{len(vehicule.rendez_vous)} rendez-vous")
        details["rendez_vous_count"] = len(vehicule.rendez_vous)

    if reasons:
        raise ConflictError(
            message=f"Impossible de supprimer le véhicule : {' et '.join(reasons)} associé(s).",
            details=details,
        )

    try:
        db.session.delete(vehicule)
        db.session.commit()
    except IntegrityError as err:
        db.session.rollback()
        raise ConflictError(
            message="Impossible de supprimer ce véhicule en raison de contraintes d'intégrité relationnelle.",
            details={"error": "Foreign key constraint violation."},
        ) from err
    except Exception:
        db.session.rollback()
        raise
