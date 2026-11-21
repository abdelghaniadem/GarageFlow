"""Service métier pour la gestion des factures de GarageFlow.

Fournit les fonctionnalités de facturation conformément aux exigences métier et au diagramme UML :
- Émission d'une facture unique par fiche de réparation (relation 1:1 stricte).
- Calcul automatique inviolable du montant total :
  * Coût main-d'œuvre = reparation.cout (ou 0.00 si non défini).
  * Coût des pièces = somme de (quantite * prix_unitaire) d'après l'historique figé dans reparation_piece.
  * Montant total = main-d'œuvre + pièces.
- Prise en charge des réparations sans pièces (coût pièces = 0.00).
- Utilisation stricte des prix historiques enregistrés dans reparation_piece (jamais le prix courant du catalogue).
- Validation des dates d'émission (ne peut être antérieure à la date d'intervention).
- Validation et normalisation des statuts de paiement autorisés.
- Interdiction absolue de modification manuelle du montant calculé ou de suppression comptable.
- Mises à jour partielles sécurisées (uniquement le statut de paiement).
- Recherche, filtrage multicritère et consultation détaillée.
- Gestion transactionnelle stricte avec rollback en cas d'IntegrityError.
"""
from datetime import date
from decimal import Decimal
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.facture import Facture
from app.models.reparation import Reparation
from app.models.vehicule import Vehicule
from app.schemas.facture_schema import ALLOWED_PAYMENT_STATUSES, _normalize_payment_status
from app.utils.exceptions import NotFoundError, ConflictError, ValidationError


def calculate_invoice_totals(reparation: Reparation) -> Tuple[Decimal, Decimal, Decimal]:
    """Calcule automatiquement le coût de main-d'œuvre, le coût des pièces et le montant total.

    Règles de gestion :
    - Coût de la main-d'œuvre : reparation.cout (ou 0.00 si non défini).
    - Coût des pièces : somme de (reparation_piece.quantite * reparation_piece.prix_unitaire).
      Utilise impérativement l'instantané du prix historique stocké dans la table d'association
      reparation_piece, et JAMAIS le prix courant du catalogue piece_detachee.
    - Montant total : coût main-d'œuvre + coût des pièces.

    Args:
        reparation: Instance Reparation ciblée.

    Returns:
        Tuple (cout_main_oeuvre, cout_pieces, montant_total) avec une précision de 2 décimales.
    """
    # Coût main-d'œuvre
    cout_main_oeuvre = (
        Decimal(str(reparation.cout)).quantize(Decimal("0.01"))
        if reparation.cout is not None
        else Decimal("0.00")
    )

    # Coût des pièces détachées basé sur l'historique figé dans reparation_piece
    cout_pieces = Decimal("0.00")
    if reparation.reparation_pieces:
        for rp in reparation.reparation_pieces:
            if rp.prix_unitaire is not None and rp.quantite is not None:
                p_unit = Decimal(str(rp.prix_unitaire))
                qty = Decimal(str(rp.quantite))
                cout_pieces += p_unit * qty

    cout_pieces = cout_pieces.quantize(Decimal("0.01"))
    montant_total = (cout_main_oeuvre + cout_pieces).quantize(Decimal("0.01"))

    return cout_main_oeuvre, cout_pieces, montant_total


def list_factures(
    statut_paiement: Optional[str] = None,
    id_reparation: Optional[int] = None,
    date_facture: Optional[date] = None,
    date_debut: Optional[date] = None,
    date_fin: Optional[date] = None,
    id_vehicule: Optional[int] = None,
    id_client: Optional[int] = None,
) -> List[Facture]:
    """Liste les factures enregistrées avec filtres multicritères optionnels.

    Args:
        statut_paiement: Filtrer par statut de paiement normalisé.
        id_reparation: Filtrer par réparation associée.
        date_facture: Filtrer par date exacte de facture.
        date_debut: Filtrer les factures à partir de cette date (inclusive).
        date_fin: Filtrer les factures jusqu'à cette date (inclusive).
        id_vehicule: Filtrer les factures liées au véhicule spécifié.
        id_client: Filtrer les factures liées au client spécifié.

    Returns:
        Liste d'instances Facture ordonnées de la plus récente à la plus ancienne.
    """
    query = Facture.query

    if statut_paiement and isinstance(statut_paiement, str) and statut_paiement.strip():
        norm_statut = _normalize_payment_status(statut_paiement)
        query = query.filter(Facture.statut_paiement == norm_statut)

    if id_reparation is not None:
        query = query.filter(Facture.id_reparation == id_reparation)

    if date_facture is not None:
        query = query.filter(Facture.date_facture == date_facture)

    if date_debut is not None:
        query = query.filter(Facture.date_facture >= date_debut)

    if date_fin is not None:
        query = query.filter(Facture.date_facture <= date_fin)

    if id_vehicule is not None or id_client is not None:
        query = query.join(Facture.reparation)
        if id_vehicule is not None:
            query = query.filter(Reparation.id_vehicule == id_vehicule)
        if id_client is not None:
            query = query.join(Reparation.vehicule).filter(Vehicule.id_client == id_client)

    return query.order_by(Facture.date_facture.desc(), Facture.id_facture.desc()).all()


def get_facture_by_id(id_facture: int) -> Facture:
    """Récupère une facture par son identifiant unique.

    Args:
        id_facture: Identifiant unique de la facture.

    Returns:
        L'instance Facture correspondante.

    Raises:
        NotFoundError: Si aucune facture n'existe avec cet identifiant.
        ValidationError: Si l'identifiant fourni est invalide.
    """
    try:
        id_int = int(id_facture)
        if id_int <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        raise ValidationError(
            message="Identifiant de facture invalide.",
            details={"id_facture": ["L'identifiant doit être un entier positif."]},
        )

    facture = db.session.get(Facture, id_int)
    if facture is None:
        raise NotFoundError(f"Facture avec l'identifiant {id_facture} introuvable.")
    return facture


def create_facture(data: Dict[str, Any]) -> Facture:
    """Émet une nouvelle facture liée à une réparation existante.

    Opération transactionnelle atomique :
    1. Validation de l'identifiant de la réparation et de son existence.
    2. Vérification de l'unicité de la facture (1:1 stricte : 409 si déjà facturée).
    3. Validation de la date d'émission (interdiction d'antériorité par rapport à la réparation).
    4. Validation du statut de paiement initial.
    5. Calcul automatique et inviolable du montant total.
    6. Persistance en base avec capture des IntegrityError et rollback sécurisé.

    Args:
        data: Dictionnaire validé contenant id_reparation, date_facture, statut_paiement.

    Returns:
        L'instance Facture créée et persistée.

    Raises:
        NotFoundError: Si la réparation demandée n'existe pas.
        ValidationError: Si les paramètres d'entrée ou les dates violent les règles métier.
        ConflictError: Si la réparation fait déjà l'objet d'une facture.
    """
    if not data or not isinstance(data, dict):
        raise ValidationError("Données de facturation requises.")

    id_reparation = data.get("id_reparation")
    if id_reparation is None:
        raise ValidationError(
            message="L'identifiant de la réparation est obligatoire.",
            details={"id_reparation": ["Champ obligatoire."]},
        )

    try:
        id_reparation = int(id_reparation)
        if id_reparation <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        raise ValidationError(
            message="L'identifiant de la réparation doit être un entier positif.",
            details={"id_reparation": ["Doit être >= 1."]},
        )

    # 1. Vérification de l'existence de la réparation
    reparation = db.session.get(Reparation, id_reparation)
    if reparation is None:
        raise NotFoundError(f"Réparation avec l'identifiant {id_reparation} introuvable.")

    # 2. Règle métier : une seule facture par réparation (contrainte 1:1 stricte)
    existing_facture = reparation.facture or Facture.query.filter_by(id_reparation=id_reparation).first()
    if existing_facture is not None:
        raise ConflictError(
            message=f"Une facture a déjà été émise pour la réparation {id_reparation}.",
            details={"id_reparation": [f"Facture ID {existing_facture.id_facture} déjà existante pour cette réparation."]},
        )

    # 3. Validation de la date de facturation
    raw_date = data.get("date_facture")
    if raw_date is None:
        date_facture = date.today()
    elif isinstance(raw_date, str):
        try:
            date_facture = date.fromisoformat(raw_date.strip())
        except ValueError:
            raise ValidationError(
                message="Format de date invalide pour la facture.",
                details={"date_facture": ["La date doit être au format ISO AAAA-MM-JJ."]},
            )
    elif isinstance(raw_date, date):
        date_facture = raw_date
    else:
        raise ValidationError(
            message="Format de date invalide pour la facture.",
            details={"date_facture": ["Format de date non reconnu."]},
        )

    # Règle métier : la date de facturation ne doit pas être antérieure à la date de l'intervention
    if reparation.date_reparation and date_facture < reparation.date_reparation:
        raise ValidationError(
            message="La date de la facture ne peut pas être antérieure à la date de la réparation.",
            details={
                "date_facture": [
                    f"La date de la facture ({date_facture.isoformat()}) ne peut pas être antérieure "
                    f"à la date de la réparation ({reparation.date_reparation.isoformat()})."
                ]
            },
        )

    # 4. Validation et normalisation du statut de paiement
    raw_statut = data.get("statut_paiement", "EN_ATTENTE")
    norm_statut = _normalize_payment_status(str(raw_statut)) if raw_statut else "EN_ATTENTE"
    if norm_statut not in ALLOWED_PAYMENT_STATUSES:
        raise ValidationError(
            message=f"Statut de paiement '{raw_statut}' invalide.",
            details={"statut_paiement": [f"Statuts autorisés : {', '.join(ALLOWED_PAYMENT_STATUSES)}."]},
        )

    # 5. Calcul automatique du montant total (aucun montant manuel n'est accepté)
    _, _, montant_total = calculate_invoice_totals(reparation)

    # 6. Instanciation et persistance transactionnelle
    facture = Facture(
        date_facture=date_facture,
        montant_total=montant_total,
        statut_paiement=norm_statut,
        id_reparation=id_reparation,
    )

    db.session.add(facture)
    try:
        db.session.commit()
    except IntegrityError as err:
        db.session.rollback()
        raise ConflictError(
            message="Impossible de créer la facture en raison d'un conflit d'intégrité.",
            details={"error": "Database integrity conflict (duplicate invoice for reparation)."},
        ) from err
    except Exception:
        db.session.rollback()
        raise

    return facture


def update_statut_paiement(id_facture: int, data: Dict[str, Any]) -> Facture:
    """Met à jour le statut de paiement d'une facture existante.

    Règles de sécurité financière et comptable :
    - Le montant total est strictement verrouillé et ne peut JAMAIS être modifié manuellement.
    - La réparation associée est strictement immuable (lien 1:1 permanent).
    - La date de facturation d'origine ne peut pas être altérée.
    - Seul le statut_paiement peut évoluer parmi les statuts autorisés.

    Args:
        id_facture: Identifiant de la facture.
        data: Dictionnaire contenant statut_paiement.

    Returns:
        L'instance Facture mise à jour.

    Raises:
        NotFoundError: Si la facture n'existe pas.
        ValidationError: Si des modifications interdites sont tentées ou le statut est invalide.
        ConflictError: En cas de conflit d'intégrité transactionnel.
    """
    if not data or not isinstance(data, dict):
        raise ValidationError(
            message="Le corps de la requête ne peut pas être vide pour une mise à jour.",
            details={"_schema": ["At least one field must be provided for update."]},
        )

    # Interdiction formelle de modifier le montant total
    if "montant_total" in data:
        raise ValidationError(
            message="Le montant total est calculé automatiquement et ne peut pas être modifié manuellement.",
            details={"montant_total": ["Modification interdite du montant calculé."]},
        )

    # Interdiction formelle de modifier la réparation associée
    if "id_reparation" in data:
        raise ValidationError(
            message="L'association de réparation d'une facture ne peut pas être modifiée.",
            details={"id_reparation": ["Modification interdite de la réparation associée."]},
        )

    # Interdiction formelle de modifier la date de facture
    if "date_facture" in data:
        raise ValidationError(
            message="La date de la facture ne peut pas être modifiée après son émission.",
            details={"date_facture": ["Modification interdite de la date de facturation."]},
        )

    facture = get_facture_by_id(id_facture)

    raw_statut = data.get("statut_paiement")
    if not raw_statut or not isinstance(raw_statut, str) or not raw_statut.strip():
        raise ValidationError(
            message="Le statut de paiement est obligatoire pour cette mise à jour.",
            details={"statut_paiement": ["Champ obligatoire non vide."]},
        )

    norm_statut = _normalize_payment_status(raw_statut)
    if norm_statut not in ALLOWED_PAYMENT_STATUSES:
        raise ValidationError(
            message=f"Statut de paiement '{raw_statut}' invalide.",
            details={"statut_paiement": [f"Statuts autorisés : {', '.join(ALLOWED_PAYMENT_STATUSES)}."]},
        )

    facture.statut_paiement = norm_statut

    try:
        db.session.commit()
    except IntegrityError as err:
        db.session.rollback()
        raise ConflictError(
            message="Impossible de mettre à jour le statut de paiement en raison d'un conflit d'intégrité.",
            details={"error": "Database integrity conflict."},
        ) from err
    except Exception:
        db.session.rollback()
        raise

    return facture


def delete_facture(id_facture: int) -> None:
    """Interdiction formelle de suppression d'une facture.

    Une facture est un document comptable et fiscal légal dont la suppression
    est prohibée pour garantir l'intégrité et la traçabilité de l'historique financier.

    Args:
        id_facture: Identifiant de la facture.

    Raises:
        NotFoundError: Si la facture n'existe pas.
        ConflictError: Toujours levée si la facture existe pour bloquer formellement la suppression.
    """
    get_facture_by_id(id_facture)
    raise ConflictError(
        message="La suppression d'une facture est strictement interdite pour préserver l'historique comptable et fiscal.",
        details={"id_facture": id_facture},
    )
