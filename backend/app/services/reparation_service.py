"""Service métier pour la gestion des réparations de GarageFlow.

Fournit les opérations CRUD, la validation des clés étrangères (véhicule et mécanicien),
le contrôle d'accès strict par rôle et propriétaire (les mécaniciens n'accèdent qu'à leurs propres réparations),
et l'intégrité relationnelle anti-cascade (protection contre la suppression si facture ou pièces associées).
"""
from typing import List, Optional, Dict, Any
from datetime import date
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.reparation import Reparation
from app.models.vehicule import Vehicule
from app.models.mecanicien import Mecanicien
from app.models.facture import Facture
from app.models.reparation_piece import ReparationPiece
from app.utils.exceptions import NotFoundError, ConflictError, ValidationError, ForbiddenError


def _get_authenticated_mecanicien(user_id: Any) -> Mecanicien:
    """Récupère l'entité Mecanicien correspondant à un utilisateur connecté."""
    if user_id is None:
        raise ForbiddenError("Profil mécanicien introuvable pour cet utilisateur.")
    try:
        user_id_int = int(user_id)
    except (ValueError, TypeError):
        raise ForbiddenError("Identifiant utilisateur invalide.")
    mecanicien = Mecanicien.query.filter_by(id_utilisateur=user_id_int).first()
    if mecanicien is None:
        raise ForbiddenError("Profil mécanicien introuvable pour cet utilisateur.")
    return mecanicien


def list_reparations(
    id_vehicule: Optional[int] = None,
    id_mecanicien: Optional[int] = None,
    statut: Optional[str] = None,
    date_reparation: Optional[date] = None,
    user_role: Optional[str] = None,
    user_id: Optional[int] = None,
) -> List[Reparation]:
    """Liste les réparations avec filtres par véhicule, mécanicien, statut et date.

    Contrôle de propriété :
    Si l'utilisateur connecté est un MECANICIEN, il ne peut consulter QUE les réparations qui lui sont assignées.

    Args:
        id_vehicule: Filtrer par véhicule.
        id_mecanicien: Filtrer par mécanicien (ignoré/écrasé si l'utilisateur est un mécanicien).
        statut: Filtrer par statut.
        date_reparation: Filtrer par date de réparation.
        user_role: Rôle de l'utilisateur ('RESPONSABLE' ou 'MECANICIEN').
        user_id: Identifiant de l'utilisateur connecté.

    Returns:
        Liste d'instances Reparation.
    """
    query = Reparation.query

    # Application de la restriction de propriété pour les mécaniciens
    if user_role == "MECANICIEN":
        mecanicien = _get_authenticated_mecanicien(user_id)
        query = query.filter(Reparation.id_mecanicien == mecanicien.id_mecanicien)
    elif id_mecanicien is not None:
        query = query.filter(Reparation.id_mecanicien == id_mecanicien)

    if id_vehicule is not None:
        query = query.filter(Reparation.id_vehicule == id_vehicule)

    if statut and isinstance(statut, str) and statut.strip():
        norm_statut = statut.strip().upper().replace(" ", "_").replace("É", "E").replace("È", "E")
        query = query.filter(Reparation.statut == norm_statut)

    if date_reparation is not None:
        query = query.filter(Reparation.date_reparation == date_reparation)

    return query.order_by(Reparation.date_reparation.desc(), Reparation.id_reparation.asc()).all()


def get_reparation_by_id(
    id_reparation: int,
    user_role: Optional[str] = None,
    user_id: Optional[int] = None,
) -> Reparation:
    """Récupère une réparation par son identifiant unique avec vérification de propriété.

    Args:
        id_reparation: Identifiant primaire de la réparation.
        user_role: Rôle de l'utilisateur connecté.
        user_id: Identifiant de l'utilisateur connecté.

    Returns:
        L'instance Reparation correspondante.

    Raises:
        NotFoundError: Si la réparation n'existe pas.
        ForbiddenError: Si un mécanicien tente d'accéder à une réparation qui ne lui est pas assignée.
    """
    reparation = db.session.get(Reparation, id_reparation)
    if reparation is None:
        raise NotFoundError(f"Réparation avec l'identifiant {id_reparation} introuvable.")

    if user_role == "MECANICIEN":
        mecanicien = _get_authenticated_mecanicien(user_id)
        if reparation.id_mecanicien != mecanicien.id_mecanicien:
            raise ForbiddenError("Accès non autorisé : cette réparation ne vous est pas assignée.")

    return reparation


def create_reparation(data: Dict[str, Any]) -> Reparation:
    """Crée une nouvelle fiche de réparation après validation des clés étrangères.

    Args:
        data: Dictionnaire validé contenant description, date_reparation, statut, id_vehicule, id_mecanicien...

    Returns:
        L'instance Reparation persistée.

    Raises:
        NotFoundError: Si le véhicule ou le mécanicien n'existe pas.
        ValidationError: Si le coût ou le kilométrage est négatif.
        ConflictError: En cas de conflit d'intégrité en base de données.
    """
    # 1. Validation de l'existence du véhicule
    id_vehicule = data["id_vehicule"]
    vehicule = db.session.get(Vehicule, id_vehicule)
    if vehicule is None:
        raise NotFoundError(f"Véhicule avec l'identifiant {id_vehicule} introuvable.")

    # 2. Validation de l'existence du mécanicien
    id_mecanicien = data["id_mecanicien"]
    mecanicien = db.session.get(Mecanicien, id_mecanicien)
    if mecanicien is None:
        raise NotFoundError(f"Mécanicien avec l'identifiant {id_mecanicien} introuvable.")

    # Validation du coût et du kilométrage
    if data.get("cout") is not None and data["cout"] < 0:
        raise ValidationError("Le coût ne peut pas être négatif.", details={"cout": ["Doit être >= 0."]})
    if data.get("kilometrage") is not None and data["kilometrage"] < 0:
        raise ValidationError("Le kilométrage ne peut pas être négatif.", details={"kilometrage": ["Doit être >= 0."]})

    reparation = Reparation(
        description=data["description"],
        date_reparation=data["date_reparation"],
        diagnostic=data.get("diagnostic"),
        travail_effectue=data.get("travail_effectue"),
        statut=data["statut"],
        cout=data.get("cout"),
        kilometrage=data.get("kilometrage"),
        id_vehicule=id_vehicule,
        id_mecanicien=id_mecanicien,
    )

    db.session.add(reparation)
    try:
        db.session.commit()
    except IntegrityError as err:
        db.session.rollback()
        raise ConflictError(
            message="Impossible de créer la réparation en raison d'un conflit d'intégrité.",
            details={"error": "Database integrity conflict."},
        ) from err
    except Exception:
        db.session.rollback()
        raise

    return reparation


def update_reparation(
    id_reparation: int,
    data: Dict[str, Any],
    user_role: Optional[str] = None,
    user_id: Optional[int] = None,
) -> Reparation:
    """Met à jour une réparation existante avec contrôle des droits de propriété.

    Un mécanicien ne peut mettre à jour que les réparations qui lui sont assignées
    (diagnostic, travail_effectue, statut, kilométrage) et ne peut pas réassigner le véhicule ou le mécanicien.

    Args:
        id_reparation: Identifiant de la réparation.
        data: Champs à modifier.
        user_role: Rôle de l'utilisateur connecté.
        user_id: Identifiant de l'utilisateur connecté.

    Returns:
        L'instance Reparation mise à jour.

    Raises:
        NotFoundError: Si la réparation, le nouveau véhicule ou le nouveau mécanicien n'existe pas.
        ForbiddenError: Si un mécanicien tente de modifier une réparation non assignée ou de réassigner les clés.
        ValidationError: Si les données sont vides ou invalides.
    """
    if not data or not isinstance(data, dict):
        raise ValidationError("Aucune donnée fournie pour la mise à jour.")

    reparation = get_reparation_by_id(id_reparation, user_role=user_role, user_id=user_id)

    # Restriction supplémentaire pour les mécaniciens : interdiction de réassigner véhicule ou mécanicien
    if user_role == "MECANICIEN":
        if "id_mecanicien" in data and data["id_mecanicien"] != reparation.id_mecanicien:
            raise ForbiddenError("Un mécanicien ne peut pas réassigner le mécanicien en charge d'une réparation.")
        if "id_vehicule" in data and data["id_vehicule"] != reparation.id_vehicule:
            raise ForbiddenError("Un mécanicien ne peut pas réassigner le véhicule d'une réparation.")

    # Validation du nouveau véhicule si modification par un responsable
    if "id_vehicule" in data and data["id_vehicule"] != reparation.id_vehicule:
        id_vehicule = data["id_vehicule"]
        vehicule = db.session.get(Vehicule, id_vehicule)
        if vehicule is None:
            raise NotFoundError(f"Véhicule avec l'identifiant {id_vehicule} introuvable.")
        reparation.id_vehicule = id_vehicule

    # Validation du nouveau mécanicien si modification par un responsable
    if "id_mecanicien" in data and data["id_mecanicien"] != reparation.id_mecanicien:
        id_mecanicien = data["id_mecanicien"]
        mecanicien = db.session.get(Mecanicien, id_mecanicien)
        if mecanicien is None:
            raise NotFoundError(f"Mécanicien avec l'identifiant {id_mecanicien} introuvable.")
        reparation.id_mecanicien = id_mecanicien

    if "description" in data:
        reparation.description = data["description"]
    if "date_reparation" in data:
        reparation.date_reparation = data["date_reparation"]
    if "diagnostic" in data:
        reparation.diagnostic = data["diagnostic"]
    if "travail_effectue" in data:
        reparation.travail_effectue = data["travail_effectue"]
    if "statut" in data:
        reparation.statut = data["statut"]
    if "cout" in data:
        if data["cout"] is not None and data["cout"] < 0:
            raise ValidationError("Le coût ne peut pas être négatif.", details={"cout": ["Doit être >= 0."]})
        reparation.cout = data["cout"]
    if "kilometrage" in data:
        if data["kilometrage"] is not None and data["kilometrage"] < 0:
            raise ValidationError("Le kilométrage ne peut pas être négatif.", details={"kilometrage": ["Doit être >= 0."]})
        reparation.kilometrage = data["kilometrage"]

    try:
        db.session.commit()
    except IntegrityError as err:
        db.session.rollback()
        raise ConflictError(
            message="Impossible de mettre à jour la réparation en raison d'un conflit d'intégrité.",
            details={"error": "Database integrity conflict."},
        ) from err
    except Exception:
        db.session.rollback()
        raise

    return reparation


def delete_reparation(id_reparation: int) -> None:
    """Supprime une réparation uniquement si aucune facture ni pièce n'y est rattachée.

    Préserve l'historique de facturation et de consommation de pièces (anti-cascade).

    Args:
        id_reparation: Identifiant de la réparation à supprimer.

    Raises:
        NotFoundError: Si la réparation n'existe pas.
        ConflictError: Si une facture ou des pièces sont associées.
    """
    reparation = db.session.get(Reparation, id_reparation)
    if reparation is None:
        raise NotFoundError(f"Réparation avec l'identifiant {id_reparation} introuvable.")

    reasons = []
    details = {}
    facture = reparation.facture or Facture.query.filter_by(id_reparation=id_reparation).first()
    if facture is not None:
        reasons.append("une facture")
        details["facture_id"] = facture.id_facture

    pieces = reparation.reparation_pieces or ReparationPiece.query.filter_by(id_reparation=id_reparation).all()
    if pieces:
        reasons.append(f"{len(pieces)} pièce(s) détachée(s)")
        details["pieces_count"] = len(pieces)

    if reasons:
        raise ConflictError(
            message=f"Impossible de supprimer la réparation : {' et '.join(reasons)} associée(s).",
            details=details,
        )

    try:
        db.session.delete(reparation)
        db.session.commit()
    except IntegrityError as err:
        db.session.rollback()
        raise ConflictError(
            message="Impossible de supprimer cette réparation en raison de contraintes d'intégrité relationnelle.",
            details={"error": "Foreign key constraint violation."},
        ) from err
    except Exception:
        db.session.rollback()
        raise
