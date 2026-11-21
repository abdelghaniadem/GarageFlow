"""Service métier pour la gestion des pièces détachées de GarageFlow.

Fournit les opérations CRUD, le contrôle d'unicité sur le nom de la pièce,
la recherche textuelle, le filtrage par seuil de stock ou fourchette de prix,
et l'intégrité relationnelle anti-cascade (protection contre la suppression
si la pièce est associée à une ou plusieurs réparations).
"""
from typing import List, Optional, Dict, Any
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.piece_detachee import PieceDetachee
from app.models.reparation_piece import ReparationPiece
from app.utils.exceptions import NotFoundError, ConflictError, ValidationError


def list_pieces(
    search: Optional[str] = None,
    stock_faible: Optional[bool] = None,
    seuil_stock_faible: Optional[int] = None,
    stock_min: Optional[int] = None,
    stock_max: Optional[int] = None,
    prix_min: Optional[float] = None,
    prix_max: Optional[float] = None,
) -> List[PieceDetachee]:
    """Liste les pièces détachées avec filtres optionnels de recherche, stock et prix.

    Args:
        search: Terme de recherche sur le nom de la pièce.
        stock_faible: Si True, filtre les pièces dont le stock est <= seuil_stock_faible.
        seuil_stock_faible: Seuil d'alerte pour stock faible (utilise LOW_STOCK_THRESHOLD si omis).
        stock_min: Filtrer par quantité de stock minimale.
        stock_max: Filtrer par quantité de stock maximale.
        prix_min: Filtrer par prix unitaire minimal.
        prix_max: Filtrer par prix unitaire maximal.

    Returns:
        Liste d'instances PieceDetachee.
    """
    query = PieceDetachee.query

    if search and isinstance(search, str) and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(PieceDetachee.nom.ilike(term))

    if stock_faible is True:
        effective_seuil = seuil_stock_faible
        if effective_seuil is None:
            try:
                from flask import current_app
                effective_seuil = current_app.config.get("LOW_STOCK_THRESHOLD", 5) if current_app else 5
            except Exception:
                effective_seuil = 5
        query = query.filter(PieceDetachee.quantite_stock <= effective_seuil)

    if stock_min is not None:
        query = query.filter(PieceDetachee.quantite_stock >= stock_min)

    if stock_max is not None:
        query = query.filter(PieceDetachee.quantite_stock <= stock_max)

    if prix_min is not None:
        query = query.filter(PieceDetachee.prix_unitaire >= prix_min)

    if prix_max is not None:
        query = query.filter(PieceDetachee.prix_unitaire <= prix_max)

    return query.order_by(PieceDetachee.nom.asc(), PieceDetachee.id_piece.asc()).all()


def get_piece_by_id(id_piece: int) -> PieceDetachee:
    """Récupère une pièce détachée par son identifiant unique.

    Args:
        id_piece: Identifiant primaire de la pièce.

    Returns:
        L'instance PieceDetachee correspondante.

    Raises:
        NotFoundError: Si aucune pièce ne correspond à l'identifiant.
    """
    piece = db.session.get(PieceDetachee, id_piece)
    if piece is None:
        raise NotFoundError(f"Pièce détachée avec l'identifiant {id_piece} introuvable.")
    return piece


def create_piece(data: Dict[str, Any]) -> PieceDetachee:
    """Crée une nouvelle pièce détachée après validation préalable.

    Args:
        data: Dictionnaire validé contenant nom, prix_unitaire et quantite_stock.

    Returns:
        L'instance PieceDetachee persistée.

    Raises:
        ValidationError: Si les champs requis sont manquants ou négatifs.
        ConflictError: Si une pièce avec le même nom existe déjà.
    """
    if not data or not isinstance(data, dict):
        raise ValidationError("Données de la pièce détachée obligatoires.")

    nom = data.get("nom")
    if not nom or not str(nom).strip():
        raise ValidationError("Le nom de la pièce est obligatoire.", details={"nom": ["Champ obligatoire."]})
    nom = str(nom).strip()

    prix_unitaire = data.get("prix_unitaire")
    if prix_unitaire is None:
        raise ValidationError("Le prix unitaire est obligatoire.", details={"prix_unitaire": ["Champ obligatoire."]})
    if prix_unitaire < 0:
        raise ValidationError("Le prix unitaire ne peut pas être négatif.", details={"prix_unitaire": ["Doit être >= 0."]})

    quantite_stock = data.get("quantite_stock")
    if quantite_stock is None:
        raise ValidationError("La quantité en stock est obligatoire.", details={"quantite_stock": ["Champ obligatoire."]})
    if quantite_stock < 0:
        raise ValidationError("La quantité en stock ne peut pas être négative.", details={"quantite_stock": ["Doit être >= 0."]})

    # Vérification d'unicité sur le nom de la pièce (insensible à la casse)
    existing = PieceDetachee.query.filter(func.lower(PieceDetachee.nom) == nom.lower()).first()
    if existing is not None:
        raise ConflictError(
            message=f"Une pièce détachée avec le nom '{nom}' existe déjà.",
            details={"nom": ["Cette pièce détachée existe déjà dans le catalogue."]},
        )

    piece = PieceDetachee(
        nom=nom,
        prix_unitaire=prix_unitaire,
        quantite_stock=quantite_stock,
    )

    db.session.add(piece)
    try:
        db.session.commit()
    except IntegrityError as err:
        db.session.rollback()
        raise ConflictError(
            message="Impossible de créer la pièce détachée en raison d'un conflit d'intégrité.",
            details={"error": "Database integrity conflict."},
        ) from err
    except Exception:
        db.session.rollback()
        raise

    return piece


def update_piece(id_piece: int, data: Dict[str, Any]) -> PieceDetachee:
    """Met à jour une pièce détachée existante.

    Args:
        id_piece: Identifiant de la pièce à modifier.
        data: Dictionnaire des champs à mettre à jour.

    Returns:
        L'instance PieceDetachee mise à jour.

    Raises:
        NotFoundError: Si la pièce n'existe pas.
        ValidationError: Si aucune donnée n'est fournie ou si les valeurs sont invalides.
        ConflictError: Si le nouveau nom est déjà utilisé par une autre pièce.
    """
    if not data or not isinstance(data, dict):
        raise ValidationError("Aucune donnée fournie pour la mise à jour.")

    piece = get_piece_by_id(id_piece)

    if "nom" in data:
        nom = data["nom"]
        if not nom or not str(nom).strip():
            raise ValidationError("Le nom de la pièce ne peut pas être vide.", details={"nom": ["Ne peut pas être vide."]})
        nom = str(nom).strip()
        # Vérification d'unicité si le nom a changé
        if nom.lower() != piece.nom.lower():
            existing = PieceDetachee.query.filter(func.lower(PieceDetachee.nom) == nom.lower()).first()
            if existing is not None and existing.id_piece != id_piece:
                raise ConflictError(
                    message=f"Une pièce détachée avec le nom '{nom}' existe déjà.",
                    details={"nom": ["Cette pièce détachée existe déjà dans le catalogue."]},
                )
        piece.nom = nom

    if "prix_unitaire" in data:
        prix_unitaire = data["prix_unitaire"]
        if prix_unitaire is None or prix_unitaire < 0:
            raise ValidationError("Le prix unitaire ne peut pas être négatif.", details={"prix_unitaire": ["Doit être >= 0."]})
        piece.prix_unitaire = prix_unitaire

    if "quantite_stock" in data:
        quantite_stock = data["quantite_stock"]
        if quantite_stock is None or quantite_stock < 0:
            raise ValidationError("La quantité en stock ne peut pas être négative.", details={"quantite_stock": ["Doit être >= 0."]})
        piece.quantite_stock = quantite_stock

    try:
        db.session.commit()
    except IntegrityError as err:
        db.session.rollback()
        raise ConflictError(
            message="Impossible de mettre à jour la pièce détachée en raison d'un conflit d'intégrité.",
            details={"error": "Database integrity conflict."},
        ) from err
    except Exception:
        db.session.rollback()
        raise

    return piece


def delete_piece(id_piece: int) -> None:
    """Supprime une pièce détachée si aucune réparation ne l'a consommée (anti-cascade).

    Args:
        id_piece: Identifiant de la pièce à supprimer.

    Raises:
        NotFoundError: Si la pièce n'existe pas.
        ConflictError: Si la pièce est associée à une ou plusieurs réparations.
    """
    piece = get_piece_by_id(id_piece)

    # Protection contre la suppression si la pièce a un historique dans reparation_piece
    reparation_pieces = piece.reparation_pieces or ReparationPiece.query.filter_by(id_piece=id_piece).all()
    if reparation_pieces:
        raise ConflictError(
            message=f"Impossible de supprimer la pièce : {len(reparation_pieces)} réparation(s) y sont associée(s).",
            details={"reparations_count": len(reparation_pieces)},
        )

    try:
        db.session.delete(piece)
        db.session.commit()
    except IntegrityError as err:
        db.session.rollback()
        raise ConflictError(
            message="Impossible de supprimer cette pièce détachée en raison de contraintes d'intégrité relationnelle.",
            details={"error": "Foreign key constraint violation."},
        ) from err
    except Exception:
        db.session.rollback()
        raise
