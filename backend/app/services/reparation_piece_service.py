"""Service métier pour la gestion de l'association Réparations - Pièces détachées.

Gère l'association entre les fiches d'intervention et les pièces consommées :
- Contrôle strict des clés étrangères (réparation et pièce détachée)
- Gestion transactionnelle atomique avec verrouillage de ligne (with_for_update)
- Décrémentation et réintégration automatique des stocks
- Détection des ruptures de stock et prévention des stocks négatifs
- Capture de l'instantané historique du prix unitaire catalogue (prix_unitaire)
- Préservation de l'historique de facturation (rejet si facture émise)
- Contrôle de propriété mécanicien (les mécaniciens n'interviennent que sur leurs réparations)
- Prévention des doublons d'association pour un même couple (id_reparation, id_piece)
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.reparation import Reparation
from app.models.piece_detachee import PieceDetachee
from app.models.reparation_piece import ReparationPiece
from app.services import reparation_service
from app.utils.exceptions import NotFoundError, ConflictError, ValidationError, ForbiddenError


def list_reparation_pieces(
    id_reparation: int,
    user_role: Optional[str] = None,
    user_id: Optional[int] = None,
) -> List[ReparationPiece]:
    """Liste l'ensemble des pièces consommées pour une réparation donnée.

    Args:
        id_reparation: Identifiant de la réparation.
        user_role: Rôle de l'utilisateur connecté ('RESPONSABLE' ou 'MECANICIEN').
        user_id: Identifiant de l'utilisateur connecté.

    Returns:
        Liste d'instances ReparationPiece.

    Raises:
        NotFoundError: Si la réparation n'existe pas.
        ForbiddenError: Si un mécanicien tente d'accéder à une réparation non assignée.
    """
    # Vérification d'existence et contrôle de propriété par rôle
    reparation_service.get_reparation_by_id(
        id_reparation=id_reparation,
        user_role=user_role,
        user_id=user_id,
    )
    return ReparationPiece.query.filter_by(id_reparation=id_reparation).all()


def get_reparation_piece(
    id_reparation: int,
    id_piece: int,
    user_role: Optional[str] = None,
    user_id: Optional[int] = None,
) -> ReparationPiece:
    """Récupère une association réparation-pièce spécifique.

    Args:
        id_reparation: Identifiant de la réparation.
        id_piece: Identifiant de la pièce détachée.
        user_role: Rôle de l'utilisateur connecté.
        user_id: Identifiant de l'utilisateur connecté.

    Returns:
        L'instance ReparationPiece correspondante.

    Raises:
        NotFoundError: Si la réparation, la pièce ou l'association n'existe pas.
        ForbiddenError: Si un mécanicien accède à une réparation non assignée.
    """
    reparation_service.get_reparation_by_id(
        id_reparation=id_reparation,
        user_role=user_role,
        user_id=user_id,
    )
    assoc = db.session.get(ReparationPiece, (id_reparation, id_piece))
    if assoc is None:
        raise NotFoundError(
            f"La pièce détachée {id_piece} n'est pas associée à la réparation {id_reparation}."
        )
    return assoc


def add_piece_to_reparation(
    id_reparation: int,
    data: Dict[str, Any],
    user_role: Optional[str] = None,
    user_id: Optional[int] = None,
) -> ReparationPiece:
    """Associe une pièce détachée à une réparation et décrémente le stock en magasin.

    Opération transactionnelle atomique :
    1. Vérification d'existence de la réparation et des droits de propriété.
    2. Blocage si la réparation a déjà fait l'objet d'une facture.
    3. Vérification de l'absence de doublon d'association.
    4. Verrouillage de la ligne pièce détachée en base (SELECT FOR UPDATE).
    5. Vérification de la disponibilité du stock.
    6. Décrémentation du stock et enregistrement de l'instantané du prix unitaire.

    Args:
        id_reparation: Identifiant de la réparation.
        data: Dictionnaire contenant id_piece et quantite.
        user_role: Rôle de l'utilisateur connecté.
        user_id: Identifiant de l'utilisateur connecté.

    Returns:
        L'instance ReparationPiece créée et persistée.

    Raises:
        NotFoundError: Si la réparation ou la pièce n'existe pas.
        ValidationError: Si les paramètres sont invalides ou non positifs.
        ConflictError: Si la pièce est déjà associée, si le stock est insuffisant,
                       ou si la réparation est déjà facturée.
        ForbiddenError: Si un mécanicien agit sur une réparation qui ne lui est pas assignée.
    """
    if not data or not isinstance(data, dict):
        raise ValidationError("Données de l'association requises.")

    # 1. Vérification de la réparation et de la propriété
    reparation = reparation_service.get_reparation_by_id(
        id_reparation=id_reparation,
        user_role=user_role,
        user_id=user_id,
    )

    # 2. Préservation de l'historique comptable : rejet si déjà facturée
    if reparation.facture is not None:
        raise ConflictError(
            message="Impossible d'ajouter des pièces à une réparation déjà facturée.",
            details={"facture_id": reparation.facture.id_facture},
        )

    # 3. Extraction et validation des données d'entrée
    id_piece = data.get("id_piece")
    if id_piece is None:
        raise ValidationError("L'identifiant de la pièce est obligatoire.", details={"id_piece": ["Champ obligatoire."]})
    try:
        id_piece = int(id_piece)
        if id_piece <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        raise ValidationError("L'identifiant de la pièce doit être un entier positif.", details={"id_piece": ["Doit être >= 1."]})

    quantite = data.get("quantite")
    if quantite is None:
        raise ValidationError("La quantité est obligatoire.", details={"quantite": ["Champ obligatoire."]})
    try:
        quantite = int(quantite)
        if quantite <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        raise ValidationError("La quantité doit être un entier supérieur ou égal à 1.", details={"quantite": ["Doit être >= 1."]})

    # 4. Prévention des doublons d'association pour le même couple (id_reparation, id_piece)
    existing_assoc = db.session.get(ReparationPiece, (id_reparation, id_piece))
    if existing_assoc is not None:
        raise ConflictError(
            message=f"La pièce détachée avec l'identifiant {id_piece} est déjà associée à cette réparation.",
            details={"id_piece": ["Cette pièce est déjà associée à cette réparation. Utilisez la mise à jour pour modifier la quantité."]},
        )

    # 5. Récupération et verrouillage de la pièce en base de données
    piece = db.session.query(PieceDetachee).with_for_update().filter_by(id_piece=id_piece).first()
    if piece is None:
        raise NotFoundError(f"Pièce détachée avec l'identifiant {id_piece} introuvable.")

    # 6. Vérification de la disponibilité du stock
    if piece.quantite_stock < quantite:
        raise ConflictError(
            message=f"Stock insuffisant pour la pièce '{piece.nom}'. Disponible: {piece.quantite_stock}, demandé: {quantite}.",
            details={
                "stock_disponible": piece.quantite_stock,
                "quantite_demandee": quantite,
            },
        )

    # 7. Décrémentation atomique du stock
    piece.quantite_stock -= quantite

    # 8. Création de l'association avec instantané du prix unitaire actuel
    reparation_piece = ReparationPiece(
        id_reparation=id_reparation,
        id_piece=id_piece,
        quantite=quantite,
        prix_unitaire=piece.prix_unitaire,
    )
    db.session.add(reparation_piece)

    try:
        db.session.commit()
    except IntegrityError as err:
        db.session.rollback()
        raise ConflictError(
            message="Impossible d'associer la pièce en raison d'un conflit d'intégrité.",
            details={"error": "Database integrity conflict."},
        ) from err
    except Exception:
        db.session.rollback()
        raise

    return reparation_piece


def update_reparation_piece_quantity(
    id_reparation: int,
    id_piece: int,
    data: Dict[str, Any],
    user_role: Optional[str] = None,
    user_id: Optional[int] = None,
) -> ReparationPiece:
    """Met à jour la quantité d'une pièce consommée en appliquant strictement le différentiel au stock.

    Gestion transactionnelle du différentiel :
    - Si nouvelle_quantite > ancienne_quantite : décrémente le stock du surplus (si disponible).
    - Si nouvelle_quantite < ancienne_quantite : réintègre la différence dans le stock magasin.
    - Si nouvelle_quantite == ancienne_quantite : aucune modification de stock.
    - L'instantané du prix unitaire historique n'est jamais écrasé.

    Args:
        id_reparation: Identifiant de la réparation.
        id_piece: Identifiant de la pièce détachée.
        data: Dictionnaire contenant la nouvelle quantite.
        user_role: Rôle de l'utilisateur connecté.
        user_id: Identifiant de l'utilisateur connecté.

    Returns:
        L'instance ReparationPiece mise à jour.

    Raises:
        NotFoundError: Si la réparation, la pièce ou l'association n'existe pas.
        ValidationError: Si la quantité est négative, nulle ou non fournie.
        ConflictError: Si le stock est insuffisant pour l'augmentation,
                       ou si la réparation est déjà facturée.
        ForbiddenError: Si un mécanicien intervient sur une réparation non assignée.
    """
    if not data or not isinstance(data, dict):
        raise ValidationError("Aucune donnée fournie pour la mise à jour.")

    reparation = reparation_service.get_reparation_by_id(
        id_reparation=id_reparation,
        user_role=user_role,
        user_id=user_id,
    )

    if reparation.facture is not None:
        raise ConflictError(
            message="Impossible de modifier les pièces d'une réparation déjà facturée.",
            details={"facture_id": reparation.facture.id_facture},
        )

    new_quantite = data.get("quantite")
    if new_quantite is None:
        raise ValidationError("La quantité est obligatoire.", details={"quantite": ["Champ obligatoire."]})
    try:
        new_quantite = int(new_quantite)
        if new_quantite <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        raise ValidationError("La quantité doit être un entier supérieur ou égal à 1.", details={"quantite": ["Doit être >= 1."]})

    reparation_piece = db.session.get(ReparationPiece, (id_reparation, id_piece))
    if reparation_piece is None:
        raise NotFoundError(
            f"La pièce détachée {id_piece} n'est pas associée à la réparation {id_reparation}."
        )

    piece = db.session.query(PieceDetachee).with_for_update().filter_by(id_piece=id_piece).first()
    if piece is None:
        raise NotFoundError(f"Pièce détachée avec l'identifiant {id_piece} introuvable.")

    diff = new_quantite - reparation_piece.quantite

    if diff > 0:
        # Augmentation : vérifier si le stock couvre le besoin additionnel
        if piece.quantite_stock < diff:
            raise ConflictError(
                message=f"Stock insuffisant pour augmenter la quantité de la pièce '{piece.nom}'. Disponible: {piece.quantite_stock}, surplus demandé: {diff}.",
                details={
                    "stock_disponible": piece.quantite_stock,
                    "surplus_demande": diff,
                },
            )
        piece.quantite_stock -= diff
    elif diff < 0:
        # Diminution : réinjecter l'excédent dans le stock magasin
        piece.quantite_stock += abs(diff)

    reparation_piece.quantite = new_quantite

    try:
        db.session.commit()
    except IntegrityError as err:
        db.session.rollback()
        raise ConflictError(
            message="Impossible de mettre à jour la quantité en raison d'un conflit d'intégrité.",
            details={"error": "Database integrity conflict."},
        ) from err
    except Exception:
        db.session.rollback()
        raise

    return reparation_piece


def remove_piece_from_reparation(
    id_reparation: int,
    id_piece: int,
    user_role: Optional[str] = None,
    user_id: Optional[int] = None,
) -> None:
    """Retire une pièce d'une réparation et réintègre l'intégralité de sa quantité dans le stock.

    Args:
        id_reparation: Identifiant de la réparation.
        id_piece: Identifiant de la pièce détachée.
        user_role: Rôle de l'utilisateur connecté.
        user_id: Identifiant de l'utilisateur connecté.

    Raises:
        NotFoundError: Si la réparation, la pièce ou l'association n'existe pas.
        ConflictError: Si la réparation est déjà facturée.
        ForbiddenError: Si un mécanicien intervient sur une réparation non assignée.
    """
    reparation = reparation_service.get_reparation_by_id(
        id_reparation=id_reparation,
        user_role=user_role,
        user_id=user_id,
    )

    if reparation.facture is not None:
        raise ConflictError(
            message="Impossible de retirer des pièces d'une réparation déjà facturée.",
            details={"facture_id": reparation.facture.id_facture},
        )

    reparation_piece = db.session.get(ReparationPiece, (id_reparation, id_piece))
    if reparation_piece is None:
        raise NotFoundError(
            f"La pièce détachée {id_piece} n'est pas associée à la réparation {id_reparation}."
        )

    piece = db.session.query(PieceDetachee).with_for_update().filter_by(id_piece=id_piece).first()
    if piece is not None:
        # Réintégration intégrale de la quantité consommée dans le stock magasin
        piece.quantite_stock += reparation_piece.quantite

    db.session.delete(reparation_piece)

    try:
        db.session.commit()
    except IntegrityError as err:
        db.session.rollback()
        raise ConflictError(
            message="Impossible de dissocier la pièce en raison d'un conflit d'intégrité.",
            details={"error": "Database integrity conflict."},
        ) from err
    except Exception:
        db.session.rollback()
        raise
